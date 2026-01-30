import { User, Vendor, Category, Product, ServiceTemplate } from '../../models/index.js';

export const getUsersOptions = async (req, res) => {
  try {
    const users = await User.find()
      .select('_id firstName lastName email role phoneNumber')
      .sort({ firstName: 1 })
      .limit(1000);

    const options = users.map((user) => ({
      id: user._id,
      label: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phoneNumber,
      role: user.role,
    }));

    res.status(200).json({
      success: true,
      data: options,
      count: options.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users options',
      error: error.message,
    });
  }
};

// Get vendors options
export const getVendorsOptions = async (req, res) => {
  try {
    const vendors = await Vendor.find({
      firstName: { $exists: true, $ne: null },
    })
      .select('_id firstName lastName email phoneNumber')
      .sort({ name: 1 })
      .limit(1000);

    const options = vendors.map((vendor) => ({
      id: vendor._id,
      label: `${vendor.firstName} ${vendor.lastName}`,
      name: `${vendor.firstName} ${vendor.lastName}`,
      email: vendor.email,
      phone: vendor.phoneNumber,
    }));

    res.status(200).json({
      success: true,
      data: options,
      count: options.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vendors options',
      error: error.message,
    });
  }
};

// Get categories options
export const getCategoriesOptions = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, level: 1 })
      .select('_id name slug description parentCategory')
      .populate('parentCategory', 'name')
      .sort({ name: 1 });

    const options = categories.map((category) => ({
      value: category._id,
      label: category.name,
      slug: category.slug,
      description: category.description,
      parentCategory: category.parentCategory
        ? {
            id: category.parentCategory._id,
            name: category.parentCategory.name,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: options,
      count: options.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories options',
      error: error.message,
    });
  }
};

export const getSubCategoriesOptions = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, level: 2, parentCategory: req.params.id })
      .select('_id name slug description parentCategory')
      .populate('parentCategory', 'name')
      .sort({ name: 1 });

    const options = categories.map((category) => ({
      value: category._id,
      label: category.name,
      slug: category.slug,
      description: category.description,
      parentCategory: category.parentCategory
        ? {
            id: category.parentCategory._id,
            name: category.parentCategory.name,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: options,
      count: options.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories options',
      error: error.message,
    });
  }
};

// Get products options
export const getProductsOptions = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true, isDeleted: false })
      .select('_id name sku price category brand')
      .populate('category', 'name')
      .sort({ name: 1 })
      .limit(1000);

    const options = products.map((product) => ({
      value: product._id,
      id: product._id,
      label: product.name,
      sku: product.sku,
      price: product.price,
      category: product.category
        ? {
            id: product.category._id,
            name: product.category.name,
          }
        : null,
      brand: product.brand,
    }));

    res.status(200).json({
      success: true,
      data: options,
      count: options.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products options',
      error: error.message,
    });
  }
};

// Get services options
export const getServicesOptions = async (req, res) => {
  try {
    const services = await ServiceTemplate.find({ isActive: true, isDeleted: false })
      .populate('title pricingGuidelines category')
      .sort({ title: 1 })
      .limit(1000);

    const options = services.map((service) => ({
      id: service._id,
      value: service._id,
      label: service.title,
      pricing: service.pricingGuidelines,
      category: service.category
        ? {
            id: service.category._id,
            name: service.category.name,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: options,
      count: options.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching services options',
      error: error.message,
    });
  }
};
