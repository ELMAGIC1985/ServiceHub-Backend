import { Router } from 'express';
import { authenticateUser, verifyOtp } from '../../../controllers/customer/auth.controller.js';

const router = Router();

// User Authentication
router.post('/authenticate', authenticateUser);
router.post('/verify', verifyOtp);

export default router;
