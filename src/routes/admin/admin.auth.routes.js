import express from 'express';
import adminController from '../../controllers/admin/admin.auth.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/refresh-token').get(adminController.refreshToken);
router.route('/login').post(adminController.loginAdmin);
router.route('/register').post(adminController.registerAdmin);
router.route('/current-user').get(authMiddleware(['admin', 'sub_admin']), adminController.selfIdentification);
router.route('/logout').get(authMiddleware(['admin']), adminController.logout);

export default router;
