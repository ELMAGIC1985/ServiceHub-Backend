import { Product } from '../../models/product.model.js';
import { Category } from '../../models/category.model.js';

const addProductService = async (data) => {
  return await Product.create(data);
};
const editProductService = async (productId, data) => {
  return await Product.findByIdAndUpdate(productId, data, { new: true });
};
const deleteProductService = async (productId) => {
  await Product.findByIdAndUpdate(productId, {
    isDeleted: true,
  });
};

const getProductListService = async () => {
  return await Product.find().populate('category');
};
const getProductByIdService = async (productId) => {
  return await Product.findById(productId);
};
const getProductCategory = async () => {
  return await Category.find({ type: 'product' });
};

export {
  addProductService,
  editProductService,
  deleteProductService,
  getProductListService,
  getProductByIdService,
  getProductCategory,
};
