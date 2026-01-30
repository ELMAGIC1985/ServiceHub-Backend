import { notificationService } from './notification.service.js';
import { generateNotificationMessage } from './utils/generateNotificationMessage.js';

class VendorNotificationService {
  async sendPaymentGetNotification(addonsData) {
    const { vendor, bookingId, amount } = addonsData;

    const notificationMessage = generateNotificationMessage({
      user: vendor,
      title: 'Payment Received',
      body: `You have received a payment of ₹${amount} for booking #${bookingId}.`,
      data: {
        type: 'PAYMENT_RECEIVED',
        bookingId,
        amount,
      },
      androidData: {
        click_action: 'OPEN_VENDOR_BOOKING_DETAILS',
        booking_id: bookingId,
      },
      apnsCategory: 'VENDOR_PAYMENT',
    });

    return await notificationService.sendSingleNotification(notificationMessage);
  }
}

const vendorNotificationService = new VendorNotificationService();

export { vendorNotificationService };
