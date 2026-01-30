import { ApiError, ApiResponse, asyncHandler } from '../../utils/index.js';

import { deleteProductService, getProductCategory } from '../../services/admin/product.service.js';
import { Product, Rating, Setting } from '../../models/index.js';
import simpleImageService from '../../services/image/SimpleImageService.js';
import { STATUS } from '../../constants/constants.js';
import { couponQueryClass } from '../../services/coupons/coupons.query.service.js';
import { calculateFinalPrice, formatProductPricing } from './utils/index.js';

const addProduct = asyncHandler(async (req, res, next) => {
  try {
    const productData = req.body;
    const uploadedBy = req.user?.id || null;

    const product = new Product({
      ...productData,
      createdBy: uploadedBy,
    });

    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: savedProduct,
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      details: error.message,
    });
  }
});

const editProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json(new ApiResponse(200, product, 'Product updated successfully'));
});

const deleteProduct = asyncHandler(async (req, res, next) => {
  await deleteProductService(req.params.id);
  res.status(200).json(new ApiResponse(200, null, 'Product deleted successfully'));
});

const getAllProductList = asyncHandler(async (req, res, next) => {
  const {
    category,
    minPrice,
    maxPrice,
    brand,
    status,
    minInventory,
    maxInventory,
    search,
    sortBy,
    sortOrder = 'desc',
    page = 1,
    limit = 10,
    isFeatured,
    visibility = 'public',
  } = req.query;

  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (isFeatured) {
    filter.isFeatured = isFeatured;
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  if (brand) {
    filter.brand = new RegExp(brand, 'i');
  }

  if (status) {
    filter.status = status;
  }

  if (minInventory || maxInventory) {
    filter.inventoryCount = {};
    if (minInventory) filter.inventoryCount.$gte = parseInt(minInventory);
    if (maxInventory) filter.inventoryCount.$lte = parseInt(maxInventory);
  }

  if (search) {
    filter.$or = [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }];
  }

  const sortOptions = {};
  if (sortBy) {
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
  } else {
    sortOptions.createdAt = -1;
  }

  if (req.userRole !== 'admin') {
    filter.visibility = visibility;
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  filter.isDeleted = false;

  // Fetch products
  const products = await Product.find(filter)
    .populate('category', 'name')
    .populate('ratings', 'rating comment')
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNum);

  const priceStats = await Product.aggregate([
    {
      $group: {
        _id: null,
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
  ]);

  // Total count for pagination
  const totalCount = await Product.countDocuments(filter);
  const totalSalesAgg = await Product.aggregate([{ $group: { _id: null, totalSales: { $sum: '$totalSold' } } }]);
  const activeProducts = await Product.countDocuments({ status: 'inStock' });
  const lowStockProducts = await Product.countDocuments({ stock: { $lte: 5 } });

  const totalPages = Math.ceil(totalCount / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  res.status(200).json(
    new ApiResponse(
      200,
      {
        products,
        pagination: {
          currentPage: pageNum,
          totalPages,
          total: totalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          skip,
          showing: `${skip + 1}-${Math.min(skip + limitNum, totalCount)} of ${totalCount}`,
        },
        statistics: {
          total: totalCount,
          active: activeProducts,
          lowStock: lowStockProducts,
          totalSales: totalSalesAgg[0]?.totalSales || 0,
          pricing: priceStats[0] || { avgPrice: 0, minPrice: 0, maxPrice: 0 },
        },
      },
      'Products retrieved successfully'
    )
  );
});

const getProductById = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  const settings = await Setting.findOne();
  const ratings = await Rating.find({
    itemId: product?._id,
    itemType: 'Product',
  })
    .populate('userId', 'firstName lastName name email selfieImage')
    .sort({ createdAt: -1 });

  if (!product) {
    throw new ApiError(STATUS.NOT_FOUND, 'Product not found');
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ...product.toObject(),
        pricing: formatProductPricing(product, settings),
        ratings,
      },
      'Product retrieved successfully'
    )
  );
});

const getAllProductCategoryList = asyncHandler(async (req, res, next) => {
  const productCategories = await getProductCategory();
  res.status(200).json(new ApiResponse(200, productCategories, 'Product categories retrieved successfully'));
});

const uploadProductImages = asyncHandler(async (req, res, next) => {
  try {
    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files uploaded',
      });
    }

    const { productId } = req.params;
    const uploadedBy = req.user?.id || null;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const uploadedImages = [];

    // Process each file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      try {
        // Use the simple image upload that returns array of URLs
        const imageUrls = await simpleImageService.processAndUploadImages(file);

        console.log('Uploaded image URLs:', imageUrls);
        product.productImages.push(imageUrls[0]);
        uploadedImages.push(imageUrls[0]);
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        // Continue with other files even if one fails
      }
    }

    // Save product with new images
    if (uploadedImages.length > 0) {
      await product.save();
    }

    res.status(200).json({
      success: true,
      message: `Uploaded ${uploadedImages.length} product images`,
      data: {
        productId: productId,
        uploadedImages: uploadedImages,
        totalUploaded: uploadedImages.length,
        totalProductImages: product.images.length,
      },
    });
  } catch (error) {
    console.error('Product image upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload product images',
      details: error.message,
    });
  }
});

const reorderProductImages = asyncHandler(async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { imageType = 'productImages', newOrder } = req.body;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Validate image type
    if (!['productImages', 'images'].includes(imageType)) {
      return res.status(400).json({
        success: false,
        error: 'imageType must be either "productImages" or "images"',
      });
    }

    // Validate newOrder array
    if (!Array.isArray(newOrder)) {
      return res.status(400).json({
        success: false,
        error: 'newOrder must be an array of indices',
      });
    }

    const currentImages = product[imageType] || [];

    if (newOrder.length !== currentImages.length) {
      return res.status(400).json({
        success: false,
        error: 'newOrder array length must match current images length',
      });
    }

    // Reorder images based on newOrder indices
    const reorderedImages = newOrder.map((index) => {
      if (index >= currentImages.length || index < 0) {
        throw new Error(`Invalid index: ${index}`);
      }
      return currentImages[index];
    });

    // Update product with reordered images
    await Product.findByIdAndUpdate(productId, { [imageType]: reorderedImages });

    res.json({
      success: true,
      message: `Product ${imageType} reordered successfully`,
      data: {
        productId: productId,
        imageType: imageType,
        newOrder: newOrder,
        reorderedImages: reorderedImages,
      },
    });
  } catch (error) {
    console.error('Reorder product images error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder product images',
      details: error.message,
    });
  }
});

const getProductPricing = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  const setting = await Setting.findOne();
  if (!product) {
    throw new ApiError(STATUS.NOT_FOUND, 'Product not found');
  }

  const { coupons } = await couponQueryClass.getCouponsForProduct(productId);

  const pricingOptions = coupons.map((coupon) => calculateFinalPrice(product, coupon, setting.productTaxRate));

  const bestDeal =
    pricingOptions.length > 0
      ? pricingOptions.reduce((best, cur) => (cur.finalPrice < best.finalPrice ? cur : best))
      : calculateFinalPrice(product, null, setting.productTaxRate);

  return res.status(STATUS.OK).json({
    success: true,
    data: {
      product: {
        id: productId,
        name: product.name,
        basePrice: product.price,
        productDiscountPrice: product.discountPrice,
        discountPercentage: product.discountPercentage,
      },
      coupons,
      pricingOptions,
      bestDeal,
    },
  });
});

export {
  addProduct,
  editProduct,
  deleteProduct,
  getAllProductList,
  getProductById,
  getAllProductCategoryList,
  uploadProductImages,
  reorderProductImages,
  getProductPricing,
};
