import { notificationService } from './notification.service.js';
import { generateNotificationMessage } from './utils/generateNotificationMessage.js';

class UserNotificationService {
  async sendAddonAddNotification(addedCount, user, bookingId) {
    const notificationMessage = generateNotificationMessage({
      user,
      title: 'Add-on Added to Your Booking',
      body: `Vendor added ${addedCount} add-on(s) to your booking. Please review and approve.`,
      data: {
        type: 'ADDON_ADDED',
        bookingId,
        count: addedCount,
      },
      androidData: {
        click_action: 'OPEN_BOOKING_DETAILS',
        booking_id: bookingId,
      },
      apnsCategory: 'BOOKING_UPDATE',
    });

    return await notificationService.sendSingleNotification(notificationMessage);
  }
}

const userNotificationService = new UserNotificationService();
export { userNotificationService };
