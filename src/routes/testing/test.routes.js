import { Router } from 'express';
import {
  addMultipleCategories,
  createMultipleServiceTemplates,
  registerMultipleVendorsNoVerification,
} from '../../controllers/testing/vendor.js';
import { bookingNotificationService } from '../../services/booking/booking.notification.service.js';

const router = Router();

router.route('/test-notification').post(async (req, res) => {
  const { fcmToken, platform } = req.body;
  const result = await bookingNotificationService.testVendorNotification(fcmToken, platform);
  res.status(200).json(result);
});

router.route('/test-payment-notification').post(async (req, res) => {
  const { fcmToken, platform } = req.body;

  const result = await bookingNotificationService.sendTestPaymentNotification(fcmToken, platform);
  res.status(200).json(result);
});

router.route('/register-multiple-vendor').post(registerMultipleVendorsNoVerification);
router.route('/register-multiple-categories').post(addMultipleCategories);
router.route('/register-multiple-services').post(createMultipleServiceTemplates);

export default router;
