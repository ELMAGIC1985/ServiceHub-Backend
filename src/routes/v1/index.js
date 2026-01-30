// routes/v1/index.js
import express from 'express';

// Auth routes
import userAuthRoutes from './auth/user.routes.js';
// import vendorAuthRoutes from './auth/vendor.js';
// import adminAuthRoutes from './auth/admin.js';

// Resource routes
import userRoutes from './resources/users.routes.js';
// import vendorRoutes from './resources/vendors.js';
// import bookingRoutes from './resources/bookings.js';
// import serviceRoutes from './resources/services.js';
// import productRoutes from './resources/products.js';
// import categoryRoutes from './resources/categories.js';

// Module routes
// import kycRoutes from './modules/kyc.js';
// import paymentRoutes from './modules/payments.js';
// import walletRoutes from './modules/wallets.js';
// import notificationRoutes from './modules/notifications.js';
import dashboardRoutes from './modules/dashboard.js';
import membershipRoutes from './modules/membership.routes.js';
import addOnsRoutes from './modules/addOns.routes.js';

// Utility routes
// import uploadRoutes from './utils/uploads.js';
// import otpRoutes from './utils/otp.js';
// import commonRoutes from './utils/common.js';

const router = express.Router();

// Auth routes
router.use('/auth/user', userAuthRoutes);
// router.use('/auth/vendors', vendorAuthRoutes);
// router.use('/auth/admin', adminAuthRoutes);

// Resource routes
router.use('/users', userRoutes);
// router.use('/vendors', vendorRoutes);
// router.use('/bookings', bookingRoutes);
// router.use('/services', serviceRoutes);
// router.use('/products', productRoutes);
// router.use('/categories', categoryRoutes);

// Module routes
// router.use('/kyc', kycRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/wallets', walletRoutes);
// router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/memberships', membershipRoutes);
router.use('/addon', addOnsRoutes);

// Utility routes
// router.use('/uploads', uploadRoutes);
// router.use('/otp', otpRoutes);
// router.use('/common', commonRoutes);

export default router;
