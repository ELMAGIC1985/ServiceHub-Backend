import userRouter from './customer/user.routes.js';

import vendorAuthRoutes from './vendor/vendor.auth.routes.js';

import adminRoutes from './admin/admin.routes.js';
import adminAuthRoutes from './admin/admin.auth.routes.js';
import optionsRoutes from './admin/options.routes.js';

// import serviceRoutes from './customer/userInfo.routes.js';

import customerRoutes from './customer/userInfo.routes.js';

import googleRoutes from './google/google.routes.js';

//updated
import serviceRoutes1 from './services/service.routes.js';
import productRoutes from './product/product.routes.js';
import categoryRoutes from './category/category.routes.js';
import vendorRoutes from './vendor/vendor.routes.js';
import ratingRouter from './rating/rating.routes.js';
import walletRouter from './wallet/wallet.routes.js';
import paymentRouter from './payment/payment.routes.js';
import couponRoutes from './admin/coupon.routes.js';
import commonRoutes from './common/common.routes.js';
import bookingRoutes from './customer/booking.routes.js';
import notificationRoutes from './notification.routes.js';
import imageUploadRoutes from './image.routes.js';
import fcmTokenRoutes from './firebase/fcmToken.routes.js';
import bankAccountRoutes from './bankDetails.routes.js';
import otpRoutes from './otp/otp.routes.js';
import bannerRoutes from './banner.routes.js';
import settingRoutes from './admin/settings.routes.js';
import withdrawalRequestRoutes from './wallet/withdrawalRequest.routes.js';
import excelUploadRoutes from './excel-upload/excelUpload.routes.js';
import calculatorRoutes from './calculator.routes.js';

// reports
import userReportRoutes from './reports/user.report.routes.js';
import kpisRoutes from './reports/kpis.routes.js';

//testing routes
import notificationFirebaseRoutes from './testing/test.routes.js';

export default {
  USER_AUTH_ROUTES: userRouter,

  VENDOR_AUTH_ROUTES: vendorAuthRoutes,
  ADMIN_ROUTES: adminRoutes,
  OPTIONS_ROUTE: optionsRoutes,
  ADMIN_AUTH_ROUTES: adminAuthRoutes,
  // SERVICE_ROUTES: serviceRoutes,
  CUSTOMER_ROUTES: customerRoutes,
  BANNER_ROUTES: bannerRoutes,

  //  updated
  SERVICE_ROUTES1: serviceRoutes1,
  PRODUCT_ROUTES: productRoutes,
  CATEGORY_ROUTES: categoryRoutes,
  VENDOR_ROUTES: vendorRoutes,
  RATING_ROUTES: ratingRouter,
  WALLET_ROUTES: walletRouter,
  PAYMENT_ROUTES: paymentRouter,
  COUPON_ROUTES: couponRoutes,
  COMMON_ROUTES: commonRoutes,
  BOOKING_ROUTES: bookingRoutes,
  NOTIFICATION_ROUTES: notificationRoutes,
  IMAGE_UPLOAD_ROUTES: imageUploadRoutes,
  FCM_TOKEN_ROUTES: fcmTokenRoutes,
  BANK_ACCOUNT_ROUTES: bankAccountRoutes,
  OTP_ROUTES: otpRoutes,
  SETTING_ROUTES: settingRoutes,
  WITHDRAWAL_REQUEST_ROUTES: withdrawalRequestRoutes,
  EXCEL_UPLOAD_ROUTES: excelUploadRoutes,
  CALCULATOR_ROUTES: calculatorRoutes,

  GOOGLE_ROUTES: googleRoutes,

  // reports
  USER_REPORTS_ROUTES: userReportRoutes,
  KPIS_ROUTES: kpisRoutes,

  // testing routes
  TESTING_ROUTES: notificationFirebaseRoutes,
};
