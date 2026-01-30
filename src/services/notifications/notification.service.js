import admin from '../../config/firebase.js';
import logger from '../../utils/logger.js';

class NotificationClass {
  async sendSimultaneousNotifications(messages) {
    try {
      const response = await admin.messaging().sendEach(messages);

      logger.info('Notifications sent :', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      logger.error('Sending notifications failed', {
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }
  async sendSingleNotification(message) {
    try {
      const response = await admin.messaging().send(message);

      logger.info('Single notification sent', {
        messageId: response,
      });

      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      logger.error('Failed to send single notification', {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }
}

const notificationService = new NotificationClass();

export { notificationService };
