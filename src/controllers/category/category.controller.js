import mongoose from 'mongoose';
import slugify from 'slugify';
import { Category, Service, ServiceTemplate, VendorService } from '../../models/index.js';
import { ApiError, ApiResponse, asyncHandler } from '../../utils/index.js';
import { categorySchema } from '../../validators/category/category.validation.js';

const addCategory = asyncHandler(async (req, res) => {
  const { parentCategory, seo } = req.body;

  const { error, value } = categorySchema.validate(req.body);

  if (error) {
    throw new ApiError(400, `${error.details.map((d) => d.message).join(', ')}`);
  }

  if (parentCategory) {
    const parent = await Category.findById(parentCategory);
    if (!parent) {
      throw new ApiError(404, 'Parent category not found');
    }

    if (parent.level >= 3) {
      throw new ApiError(400, 'Cannot create subcategory. Maximum depth of 3 levels reached');
    }
  }

  const existingCategory = await Category.findOne({
    slug: slugify(value.name, { lower: true }),
  });

  if (existingCategory) {
    throw new ApiError(409, 'Category with this name already exists at this level');
  }

  const categoryData = {
    ...value,
    slug: slugify(value.name, { lower: true }),
    parentCategory: parentCategory || null,
    seo,
    createdBy: req.user._id,
  };

  const category = await Category.create(categoryData);

  res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, parentCategory, image, isFeatured, seo, isActive, sortOrder } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid category ID');
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Validate parent category change
  if (parentCategory && parentCategory !== category.parentCategory?.toString()) {
    const parent = await Category.findById(parentCategory);
    if (!parent) {
      throw new ApiError(404, 'Parent category not found');
    }

    // Prevent circular reference
    if (parentCategory === id) {
      throw new ApiError(400, 'Category cannot be its own parent');
    }

    // Check if new parent would exceed depth limit
    if (parent.level >= 3) {
      throw new ApiError(400, 'Cannot move category. Maximum depth of 3 levels would be exceeded');
    }
  }

  // Check for duplicate name if name is being changed
  if (name && name.trim() !== category.name) {
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: name.trim(),
      type: category.type,
      parentCategory: parentCategory || category.parentCategory || null,
      isDeleted: false,
    });

    if (existingCategory) {
      throw new ApiError(409, 'Category with this name already exists at this level');
    }
  }

  const updateData = {
    ...(name && { name: name.trim() }),
    ...(description !== undefined && { description: description?.trim() }),
    ...(parentCategory !== undefined && { parentCategory: parentCategory || null }),
    ...(image !== undefined && { image }),
    ...(isFeatured !== undefined && { isFeatured }),
    ...(seo !== undefined && { seo }),
    ...(isActive !== undefined && { isActive }),
    ...(sortOrder !== undefined && { sortOrder }),
    updatedBy: req.user._id,
  };

  console.log('updateData', updateData);

  const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json(new ApiResponse(200, updatedCategory, 'Category updated successfully'));
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('Deleting category with ID:', id);

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid category ID');
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Check if category has children
  const childrenCount = await Category.countDocuments({
    parentCategory: id,
    isDeleted: false,
  });

  if (childrenCount > 0) {
    throw new ApiError(400, 'Delete failed: Category in use.');
  }

  // Check if category has associated services
  const servicesCount = await ServiceTemplate.countDocuments({
    category: id,
    isDeleted: false,
  });

  if (servicesCount > 0) {
    throw new ApiError(400, 'Delete failed: category in use.');
  }

  const serviceCountWithSubcategory = await ServiceTemplate.countDocuments({
    childCategory: id,
    isDeleted: false,
  });

  if (serviceCountWithSubcategory > 0) {
    throw new ApiError(400, 'Delete failed: category in use.');
  }

  // Soft delete
  await Category.findByIdAndUpdate(id, {
    isDeleted: true,
    isActive: false,
  });

  res.status(200).json(new ApiResponse(200, null, 'Category deleted successfully'));
});

const getAllCategoryList = asyncHandler(async (req, res) => {
  const { type, level, parentCategory, isActive, isFeatured, page = 1, limit = 10, search } = req.query;

  // Build filter object
  const filter = { isDeleted: false };

  if (type) filter.type = type;
  if (level) filter.level = parseInt(level);
  if (parentCategory) filter.parentCategory = parentCategory;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
  if (search) {
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [categories, totalCount] = await Promise.all([
    Category.find(filter)
      .sort({ sortOrder: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('parentCategory', 'name level')
      .populate({
        path: 'childCategories',
        select: 'name level image description',
        match: { isDeleted: false },
      })
      .lean(),
    Category.countDocuments(filter),
  ]);

  // Add aggregated stats
  const categoriesWithStats = await Promise.all(
    categories.map(async (category) => {
      const [servicesCount, childrenCount] = await Promise.all([
        Service.countDocuments({ category: category._id, isDeleted: false }),
        Category.countDocuments({ parentCategory: category._id, isDeleted: false }),
      ]);

      return {
        ...category,
        stats: {
          ...category.stats,
          totalServices: servicesCount,
          totalChildren: childrenCount,
        },
      };
    })
  );

  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalCount / parseInt(limit)),
    totalCount,
    hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
    hasPrev: parseInt(page) > 1,
  };

  res.status(200).json(
    new ApiResponse(
      200,
      {
        categories: categoriesWithStats,
        pagination,
      },
      'Categories retrieved successfully'
    )
  );
});

const getAvailableRequestCategoryList = asyncHandler(async (req, res) => {
  const { type, level, parentCategory, isActive, isFeatured, page = 1, limit = 10, search } = req.query;

  // Build filter object
  const filter = { isDeleted: false };

  if (type) filter.type = type;
  if (level) filter.level = parseInt(level);
  if (parentCategory) filter.parentCategory = parentCategory;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
  if (search) {
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const services = await VendorService.find({
    vendor: req.user._id,
    status: { $in: ['pending', 'approved'] },
    isDeleted: false,
  }).select('childCategory');

  const categoryIds = services.map((s) => s.childCategory.toString());

  // not inc;ude already assigned categories
  filter._id = { $nin: categoryIds };

  const [categories, totalCount] = await Promise.all([
    Category.find(filter)
      .sort({ sortOrder: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('parentCategory', 'name level')
      .populate({
        path: 'childCategories',
        select: 'name level image description',
        match: { isDeleted: false },
      })
      .lean(),
    Category.countDocuments(filter),
  ]);

  // Add aggregated stats
  const categoriesWithStats = await Promise.all(
    categories.map(async (category) => {
      const [servicesCount, childrenCount] = await Promise.all([
        Service.countDocuments({ category: category._id, isDeleted: false }),
        Category.countDocuments({ parentCategory: category._id, isDeleted: false }),
      ]);

      return {
        ...category,
        stats: {
          ...category.stats,
          totalServices: servicesCount,
          totalChildren: childrenCount,
        },
      };
    })
  );

  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalCount / parseInt(limit)),
    totalCount,
    hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
    hasPrev: parseInt(page) > 1,
  };

  res.status(200).json(
    new ApiResponse(
      200,
      {
        categories: categoriesWithStats,
        pagination,
      },
      'Categories retrieved successfully'
    )
  );
});

const getCategoryTree = asyncHandler(async (req, res) => {
  const { type = 'service' } = req.query;

  const categoryTree = await Category.getCategoryTree(type);

  res.status(200).json(new ApiResponse(200, categoryTree, 'Category tree retrieved successfully'));
});

const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid category ID');
  }

  const category = await Category.findById(id)
    .populate('parentCategory', 'name level slug isActive')
    .populate('childCategories', 'name level slug isActive')
    .populate('services', 'name description price image isActive')
    .lean();

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Get breadcrumb path
  const breadcrumbPath = await Category.getBreadcrumbPath(id);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        category,
        breadcrumbPath,
      },
      'Category retrieved successfully'
    )
  );
});

const getProductCategory = asyncHandler(async (req, res) => {
  const categories = await Category.find({
    type: 'product',
    isDeleted: false,
    isActive: true,
  })
    .sort({ sortOrder: 1, name: 1 })
    .populate('childCategories', 'name slug isActive');

  res.status(200).json(new ApiResponse(200, categories, 'Product categories retrieved successfully'));
});

const getServicesByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { page = 1, limit = 10, isActive = true } = req.query;

  if (!mongoose.isValidObjectId(categoryId)) {
    throw new ApiError(400, 'Invalid category ID');
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Get all descendant categories
  const descendants = await category.getDescendants();
  const categoryIds = [categoryId, ...descendants.map((d) => d._id)];

  // Build filter
  const filter = {
    category: { $in: categoryIds },
    isDeleted: false,
  };

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [services, totalCount] = await Promise.all([
    Service.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('category', 'name slug')
      .lean(),
    Service.countDocuments(filter),
  ]);

  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalCount / parseInt(limit)),
    totalCount,
    hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
    hasPrev: parseInt(page) > 1,
  };

  res.status(200).json(
    new ApiResponse(
      200,
      {
        services,
        pagination,
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
        },
      },
      'Services retrieved successfully'
    )
  );
});

const getFeaturedCategories = asyncHandler(async (req, res) => {
  const { type, limit = 10 } = req.query;

  const filter = {
    isFeatured: true,
    isActive: true,
    isDeleted: false,
  };

  if (type) filter.type = type;

  const categories = await Category.find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .limit(parseInt(limit))
    .select('name slug description image type level')
    .lean();

  res.status(200).json(new ApiResponse(200, categories, 'Featured categories retrieved successfully'));
});

const searchCategories = asyncHandler(async (req, res) => {
  const { q, type, limit = 10 } = req.query;

  if (!q || q.trim().length < 2) {
    throw new ApiError(400, 'Search query must be at least 2 characters long');
  }

  const filter = {
    $or: [
      { name: { $regex: q.trim(), $options: 'i' } },
      { description: { $regex: q.trim(), $options: 'i' } },
      { 'seo.keywords': { $regex: q.trim(), $options: 'i' } },
    ],
    isActive: true,
    isDeleted: false,
  };

  if (type) filter.type = type;

  const categories = await Category.find(filter)
    .sort({ isFeatured: -1, name: 1 })
    .limit(parseInt(limit))
    .select('name slug description image type level')
    .lean();

  res.status(200).json(new ApiResponse(200, categories, 'Search results retrieved successfully'));
});

export {
  addCategory,
  updateCategory,
  deleteCategory,
  getAllCategoryList,
  getCategoryTree,
  getCategoryById,
  getProductCategory,
  getServicesByCategory,
  getFeaturedCategories,
  searchCategories,
  getAvailableRequestCategoryList,
};
