import express from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware.js';
import { validateMongoId } from '../../../middlewares/validation.middleware.js';

import {
  getAllVendors,
  getVendorById,
  updateVendorProfile,
  getVendorStats,
  toggleVendorStatus,
  deleteVendor,
} from '../../../controllers/vendor/vendor.controller.js';

const router = express.Router();

// Public routes
router.get('/public/:id', validateMongoId, getVendorById);

// Vendor-only routes (self-service)
router.use(authMiddleware(['vendor']));
router.get('/profile', getVendorProfile);
router.patch('/profile', updateVendorProfile);
router.get('/stats', getVendorStats);
router.patch('/toggle-status', toggleVendorStatus);

// Admin-only routes
router.use(authMiddleware(['admin']));
router.get('/', getAllVendors);
router
  .route('/:id')
  .get(validateMongoId, getVendorById)
  .patch(validateMongoId, updateVendorProfile)
  .delete(validateMongoId, deleteVendor);

export default router;
