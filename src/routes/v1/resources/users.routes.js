import { Router } from 'express';

import {
  getCurrentUser,
  updateProfile,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultAddress,
  getAllUsers,
  getUserById,
} from '../../../controllers/customer/user.controller.js';

import authMiddleware from '../../../middlewares/auth.middleware.js';

const router = Router();

// Get current logged-in user
router.get('/current-user', authMiddleware(['user', 'admin']), getCurrentUser);

// Update profile
router.put('/profile', authMiddleware(['user', 'admin']), updateProfile);

// User Addresses
router.get('/addresses', authMiddleware(['user', 'admin']), getUserAddresses);
router.post('/addresses', authMiddleware(['user', 'admin']), addUserAddress);
router.put('/address/:addressId', authMiddleware(['user', 'admin']), updateUserAddress);
router.delete('/address/:addressId', authMiddleware(['user', 'admin']), deleteUserAddress);
router.patch('/address/:addressId/default', authMiddleware(['user', 'admin']), setDefaultAddress);

// User access
router.get('/all', getAllUsers);
router.get('/:id', getUserById);

export default router;
