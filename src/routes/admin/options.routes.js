import express from 'express';
import {
  getUsersOptions,
  getVendorsOptions,
  getCategoriesOptions,
  getProductsOptions,
  getServicesOptions,
  getSubCategoriesOptions,
} from '../../controllers/admin/options.controller.js';

const router = express.Router();

router.route('/users').get(getUsersOptions);
router.route('/vendors').get(getVendorsOptions);
router.route('/categories').get(getCategoriesOptions);
router.route('/subcategories/:id').get(getSubCategoriesOptions);
router.route('/products').get(getProductsOptions);
router.route('/services').get(getServicesOptions);

export default router;
