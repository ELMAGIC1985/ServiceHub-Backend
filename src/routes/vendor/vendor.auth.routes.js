import express from 'express';
const router = express.Router();

import {
  authenticateVendor,
  verifyOtp,
  deleteVendor,
  selfIdentification,
  updatedAddress,
  updateVendorProfile,
  deleteVendorProfile,
} from '../../controllers/vendor/vendor.auth.controller.js';

import { authMiddleware } from '../../middlewares/auth.middleware.js';

import { uploadSingle } from '../../middlewares/multer.middleware.js';
import { checkSameUser } from '../../middlewares/checkSameUser.middleware.js';
import { vendorManagement } from '../../controllers/vendor/vendor.controller.js';
import {
  addProductDeliveryAddress,
  getProductDeliveryAddresses,
  updateProductDeliveryAddress,
} from '../../controllers/vendor/vendor.address.controller.js';

router.route('/authenticate').post(authenticateVendor);
router.route('/verify').post(verifyOtp);
router.route('/profile').put(authMiddleware(['vendor', 'admin']), uploadSingle.single('image'), updateVendorProfile);

router.route('/delivery-address').get(authMiddleware(['vendor', 'admin']), getProductDeliveryAddresses);
router.route('/delivery-address').post(authMiddleware(['vendor', 'admin']), addProductDeliveryAddress);
router.route('/delivery-address/:addressId').put(authMiddleware(['vendor', 'admin']), updateProductDeliveryAddress);
router.route('/update-address/:id').put(authMiddleware(['vendor', 'admin']), updatedAddress);
router.route('/current-user').get(authMiddleware(['vendor']), selfIdentification);
router.route('/delete').delete(authMiddleware(['vendor']), deleteVendorProfile);
router.route('/:id').delete(authMiddleware(['vendor', 'admin']), checkSameUser(), deleteVendor);

// Managed by admin
router.route('/vendor-management/:id').post(authMiddleware(['admin']), vendorManagement);

export default router;
