import { Vendor, User, Booking, Address } from '../../models/index.js';
import logger from '../../utils/logger.js';
import admin from '../../config/firebase.js';
import { createNotification } from '../../controllers/notification/utils/createNotification.js';
export class NotificationService {
  static async notifyEligibleVendors({ booking, serviceTemplate, eligibleVendors, userDetails }) {
    try {
      logger.info('Sending simultaneous notifications to eligible vendors', {
        bookingId: booking._id,
        vendorCount: eligibleVendors.length,
      });

      const address = await Address.findById(booking.address);

      const notificationData = {
        bookingId: booking._id.toString(),
        serviceId: serviceTemplate._id.toString(),
        serviceTitle: serviceTemplate.title,
        serviceDescription: serviceTemplate.description,
        serviceType: serviceTemplate.serviceType,
        address: address,
        date: booking.date.toISOString(),
        timeSlot: booking.timeSlot,
        pricing: booking.pricing,
        specialRequirements: booking.specialRequirements || '',
        userNotes: booking.userNotes || '',
        timestamp: new Date().toISOString(),
        expiresAt: booking.timing.searchTimeout.toISOString(),
        notificationType: 'new_booking_request',
      };

      console.log('notification', notificationData);

      // METHOD 1: Use FCM Multicast for truly simultaneous delivery
      const simultaneousResult = await this.sendSimultaneousNotifications({
        eligibleVendors,
        notificationData,
        bookingId: booking._id,
      });

      if (simultaneousResult.success) {
        await this.updateBookingNotificationHistory(booking._id, eligibleVendors, simultaneousResult.results);

        return {
          success: true,
          notificationsSent: simultaneousResult.successCount,
          notificationsFailed: simultaneousResult.failureCount,
          method: 'multicast',
        };
      }

      return {
        success: false,
        notificationsSent: simultaneousResult.successCount,
        notificationsFailed: simultaneousResult.failureCount,
        method: 'multicast',
      };

      // return await this.sendParallelNotifications({
      //   eligibleVendors,
      //   notificationData,
      //   bookingId: booking._id,
      // });
    } catch (error) {
      logger.error('Error notifying eligible vendors', {
        bookingId: booking._id,
        error: error.message,
        stack: error.stack,
      });

      throw new Error(`Failed to notify vendors: ${error.message}`);
    }
  }

  static async sendSimultaneousNotifications({ eligibleVendors, notificationData, bookingId }) {
    try {
      const validVendors = eligibleVendors.filter((vendor) => vendor.fcmToken && vendor.fcmToken.token.trim() !== '');

      console.log(
        'valid vendor',
        validVendors,
        validVendors.map((vendor) => vendor.fcmToken.token)
      );

      if (validVendors.length === 0) {
        return { success: false, reason: 'No vendors with valid FCM tokens' };
      }

      // Helper function to convert all values to strings
      const stringifyDataValues = (data) => {
        const stringifiedData = {};
        for (const [key, value] of Object.entries(data)) {
          if (value === null || value === undefined) {
            stringifiedData[key] = '';
          } else if (typeof value === 'object') {
            stringifiedData[key] = JSON.stringify(value);
          } else {
            stringifiedData[key] = String(value);
          }
        }
        return stringifiedData;
      };

      // 🔹 Build individual messages for each vendor
      const messages = validVendors.map((vendor) => {
        const vendorSpecificData = {
          ...notificationData,
          distance: vendor.distance?.toFixed(2).toString() || '0',
        };

        const stringifiedNotificationData = stringifyDataValues(vendorSpecificData);

        return {
          token: vendor.fcmToken.token,
          notification: {
            title: '🔔 New Service Request',
            body: `New ${notificationData.serviceTitle} request available`,
          },
          data: {
            ...stringifiedNotificationData,
            click_action: 'OPEN_BOOKING_REQUEST',
            booking_id: bookingId.toString(),
          },

          // ✅ Android Priority - HIGH
          android: {
            priority: 'high',
            notification: {
              channelId: 'call_channel',
              priority: 'high',
              defaultSound: true,
              defaultVibrateTimings: true,
              icon: 'notification_icon',
              color: '#FF6B35',
            },
            data: {
              click_action: 'OPEN_BOOKING_REQUEST',
              booking_id: bookingId.toString(),
              distance: vendor.distance?.toString() || '0',
            },
          },

          // ✅ iOS Priority - HIGH
          apns: {
            headers: {
              'apns-priority': '10', // Immediate delivery
            },
            payload: {
              aps: {
                alert: {
                  title: '🔔 New Service Request',
                  body: `New ${notificationData.serviceTitle} request available`,
                },
                sound: 'default',
                badge: 1,
                category: 'BOOKING_REQUEST',
              },
            },
          },
        };
      });

      const response = await admin.messaging().sendEach(messages);

      logger.info('Notifications sent with vendor-specific distances', {
        bookingId,
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalVendors: validVendors.length,
      });

      // Process invalid tokens
      await this.processInvalidTokens(validVendors, response.responses);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        results: response.responses.map((result, index) => ({
          vendorId: validVendors[index].vendorId,
          distance: validVendors[index].distance, // Include distance in results
          status: result.success ? 'fulfilled' : 'rejected',
          messageId: result.messageId,
          error: result.error,
        })),
      };
    } catch (error) {
      logger.error('Sending vendor notifications failed', {
        bookingId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  static async sendParallelNotifications({ eligibleVendors, notificationData, bookingId }) {
    const BATCH_SIZE = 20; // Process in smaller batches for better performance
    const results = [];

    // Process vendors in batches for better resource management
    for (let i = 0; i < eligibleVendors.length; i += BATCH_SIZE) {
      const batch = eligibleVendors.slice(i, i + BATCH_SIZE);

      // Send all notifications in current batch simultaneously
      const batchPromises = batch.map((vendor) =>
        this.sendVendorNotification({
          vendor,
          notificationData: {
            ...notificationData,
            vendorDistance: vendor.distance.toString(),
            vendorId: vendor.vendorId.toString(),
          },
          bookingId,
        })
      );

      // Wait for current batch to complete before starting next batch
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < eligibleVendors.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Process results
    const successful = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected').length;

    logger.info('Parallel vendor notification results', {
      bookingId,
      successful,
      failed,
      total: eligibleVendors.length,
      method: 'parallel_batched',
    });

    // Store notification history
    await this.updateBookingNotificationHistory(bookingId, eligibleVendors, results);

    // Add to Firebase Realtime Database
    await this.addToFirebaseRealtime(notificationData, eligibleVendors);

    return {
      success: true,
      notificationsSent: successful,
      notificationsFailed: failed,
      method: 'parallel_batched',
    };
  }

  static async sendTrulySimultaneousNotifications({ eligibleVendors, notificationData, bookingId }) {
    try {
      // Create all notification promises at once
      const notificationPromises = eligibleVendors.map((vendor) =>
        this.sendVendorNotification({
          vendor,
          notificationData: {
            ...notificationData,
            vendorDistance: vendor.distance.toString(),
            vendorId: vendor.vendorId.toString(),
          },
          bookingId,
        })
      );

      // Execute ALL notifications truly simultaneously
      const startTime = Date.now();
      const results = await Promise.allSettled(notificationPromises);
      const endTime = Date.now();

      const successful = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.filter((result) => result.status === 'rejected').length;

      logger.info('Truly simultaneous notification results', {
        bookingId,
        successful,
        failed,
        total: eligibleVendors.length,
        executionTime: `${endTime - startTime}ms`,
        method: 'truly_simultaneous',
      });

      return {
        success: true,
        notificationsSent: successful,
        notificationsFailed: failed,
        executionTime: endTime - startTime,
        results,
      };
    } catch (error) {
      logger.error('Truly simultaneous notifications failed', {
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  static async sendVendorNotification({ vendor, notificationData, bookingId }) {
    try {
      const message = {
        token: vendor.fcmToken,
        notification: {
          title: '🔔 New Service Request',
          body: `New ${notificationData.serviceTitle} request nearby (${vendor.distance}km away)`,
        },
        data: notificationData,
        android: {
          notification: {
            channelId: 'booking_requests',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            icon: 'notification_icon',
            color: '#FF6B35',
          },
          data: {
            click_action: 'OPEN_BOOKING_REQUEST',
            booking_id: bookingId.toString(),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: '🔔 New Service Request',
                body: `New ${notificationData.serviceTitle} request nearby (${vendor.distance}km away)`,
              },
              sound: 'default',
              badge: 1,
              category: 'BOOKING_REQUEST',
            },
          },
          fcmOptions: {
            imageUrl: notificationData.serviceImage,
          },
        },
      };

      const response = await admin.messaging().send(message);

      logger.debug('Vendor notification sent successfully', {
        vendorId: vendor.vendorId,
        messageId: response,
        distance: vendor.distance,
      });

      return {
        vendorId: vendor.vendorId,
        success: true,
        messageId: response,
      };
    } catch (error) {
      logger.error('Failed to send vendor notification', {
        vendorId: vendor.vendorId,
        error: error.message,
      });

      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        await this.markFCMTokenAsInvalid(vendor.vendorId);
      }

      throw error;
    }
  }

  static async sendNotification({
    token,
    title,
    body,
    data = {},
    imageUrl,
    channelId = 'general',
    clickAction = 'OPEN_APP',
    color = '#2196F3',
    icon = 'notification_icon',
    sound = 'default',
  }) {
    try {
      if (!token) {
        throw new Error('Missing FCM token');
      }

      const message = {
        token,
        notification: { title, body },
        data: {
          ...data,
          click_action: clickAction,
        },
        android: {
          notification: {
            channelId,
            priority: 'high',
            sound,
            color,
            icon,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound,
              badge: 1,
            },
          },
          fcmOptions: imageUrl ? { imageUrl } : {},
        },
      };

      const response = await admin.messaging().send(message);

      logger.debug('Notification sent successfully', {
        token: token.slice(0, 12) + '...',
        messageId: response,
        title,
      });

      return { success: true, messageId: response };
    } catch (error) {
      logger.error('Failed to send notification', {
        token,
        error: error.message,
      });

      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        // Optionally mark token invalid in DB
        logger.warn('Invalid FCM token detected', { token });
      }

      return { success: false, error: error.message };
    }
  }

  static async processInvalidTokens(vendors, responses) {
    const invalidTokenPromises = [];

    responses.forEach((response, index) => {
      if (!response.success && response.error) {
        const errorCode = response.error.code;
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          invalidTokenPromises.push(this.markFCMTokenAsInvalid(vendors[index].vendorId));
        }
      }
    });

    if (invalidTokenPromises.length > 0) {
      await Promise.allSettled(invalidTokenPromises);
    }
  }

  static async notifyUser({ userId, type, message, data = {} }) {
    try {
      const user = await User.findById(userId).select('fcmToken firstName lastName');
      if (!user || !user.fcmToken?.token || !user.fcmToken?.isActive) {
        logger.warn('User FCM token not available', { userId });
        return { success: false, reason: 'No valid FCM token' };
      }

      const notificationMessage = {
        token: user.fcmToken.token,
        notification: {
          title: this.getNotificationTitle(type),
          body: message,
        },
        data: {
          type,
          userId: userId.toString(),
          timestamp: new Date().toISOString(),
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = data[key].toString();
            return acc;
          }, {}),
        },
        android: {
          notification: {
            channelId: 'booking_updates',
            priority: 'high',
            defaultSound: true,
            icon: 'notification_icon',
            color: '#007AFF',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: this.getNotificationTitle(type),
                body: message,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(notificationMessage);

      logger.info('User notification sent successfully', {
        userId,
        type,
        messageId: response,
      });

      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      logger.error('Failed to send user notification', {
        userId,
        type,
        error: error.message,
      });

      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        await this.markUserFCMTokenAsInvalid(userId);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async notifyOtherVendors({ booking, acceptedVendorId, message }) {
    try {
      const otherVendors = booking.vendorSearch.eligibleVendors.filter(
        (v) => v.vendorId.toString() !== acceptedVendorId.toString() && v.response === 'pending'
      );

      if (otherVendors.length === 0) {
        return { success: true, notificationsSent: 0 };
      }

      const vendorIds = otherVendors.map((v) => v.vendorId);
      const vendors = await Vendor.find({
        _id: { $in: vendorIds },
        'fcmToken.isActive': true,
      }).select('fcmToken');

      const notificationPromises = vendors.map((vendor) =>
        this.sendBookingCancellationNotification({
          vendorId: vendor._id,
          fcmToken: vendor.fcmToken.token,
          bookingId: booking._id,
          message,
        })
      );

      const results = await Promise.allSettled(notificationPromises);
      const successful = results.filter((result) => result.status === 'fulfilled').length;

      logger.info('Other vendors notified about booking assignment', {
        bookingId: booking._id,
        acceptedVendorId,
        notificationsSent: successful,
      });

      return {
        success: true,
        notificationsSent: successful,
      };
    } catch (error) {
      logger.error('Error notifying other vendors', {
        bookingId: booking._id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async sendBookingCancellationNotification({ vendorId, fcmToken, bookingId, message }) {
    const notificationMessage = {
      token: fcmToken,
      notification: {
        title: 'Booking Update',
        body: message,
      },
      data: {
        type: 'booking_no_longer_available',
        bookingId: bookingId.toString(),
        vendorId: vendorId.toString(),
        timestamp: new Date().toISOString(),
      },
      android: {
        notification: {
          channelId: 'booking_updates',
          priority: 'normal',
          icon: 'notification_icon',
          color: '#FF9500',
        },
      },
    };

    return admin.messaging().send(notificationMessage);
  }

  static async updateBookingNotificationHistory(bookingId, eligibleVendors, results) {
    try {
      const notifications = eligibleVendors.map((vendor, index) => {
        const result = results[index];
        return {
          vendorId: vendor.vendorId,
          type: 'new_booking_request',
          sentAt: new Date(),
          status: result.status === 'fulfilled' ? 'sent' : 'failed',
          message: 'New booking request notification',
          error: result.status === 'rejected' ? result.reason?.message : undefined,
        };
      });

      await Booking.findByIdAndUpdate(bookingId, {
        $push: {
          'notifications.vendorNotifications': { $each: notifications },
        },
      });
    } catch (error) {
      logger.error('Error updating booking notification history', {
        bookingId,
        error: error.message,
      });
    }
  }

  static async markFCMTokenAsInvalid(vendorId) {
    try {
      await Vendor.findByIdAndUpdate(vendorId, {
        'fcmToken.isActive': false,
        'fcmToken.lastError': new Date(),
      });

      logger.info('Marked vendor FCM token as invalid', { vendorId });
    } catch (error) {
      logger.error('Error marking vendor FCM token as invalid', {
        vendorId,
        error: error.message,
      });
    }
  }

  static async markUserFCMTokenAsInvalid(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        'fcmToken.isActive': false,
        'fcmToken.lastError': new Date(),
      });

      logger.info('Marked user FCM token as invalid', { userId });
    } catch (error) {
      logger.error('Error marking user FCM token as invalid', {
        userId,
        error: error.message,
      });
    }
  }

  static getNotificationTitle(type) {
    const titles = {
      booking_created: '✅ Booking Confirmed',
      vendor_assigned: '👨‍🔧 Vendor Assigned',
      vendor_accepted: '🎉 Request Accepted',
      vendor_on_route: '🚗 Vendor On Route',
      vendor_arrived: '📍 Vendor Arrived',
      service_started: '🔧 Service Started',
      service_completed: '✅ Service Completed',
      booking_cancelled: '❌ Booking Cancelled',
      booking_expired: '⏰ Request Expired',
      booking_failed: '❌ Request Failed',
    };

    return titles[type] || '🔔 Booking Update';
  }

  static async sendBulkNotification({ userIds, vendorIds, title, body, data = {} }) {
    try {
      const tokens = [];

      if (userIds && userIds.length > 0) {
        const users = await User.find({
          _id: { $in: userIds },
          'fcmToken.isActive': true,
        }).select('fcmToken');

        tokens.push(...users.map((user) => user.fcmToken.token).filter(Boolean));
      }

      if (vendorIds && vendorIds.length > 0) {
        const vendors = await Vendor.find({
          _id: { $in: vendorIds },
          'fcmToken.isActive': true,
        }).select('fcmToken');

        tokens.push(...vendors.map((vendor) => vendor.fcmToken.token).filter(Boolean));
      }

      if (tokens.length === 0) {
        return {
          success: false,
          message: 'No valid FCM tokens found',
        };
      }

      const message = {
        notification: { title, body },
        data: {
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = data[key].toString();
            return acc;
          }, {}),
          timestamp: new Date().toISOString(),
        },
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      logger.info('Bulk notification sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalTokens: tokens.length,
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
      };
    } catch (error) {
      logger.error('Error sending bulk notification', {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendPaymentNotifications({ booking, paymentResult, vendorId }) {
    const isCashPayment = paymentResult.paymentMethod === 'cash';

    // User notification
    await createNotification({
      title: isCashPayment ? 'Cash Payment Recorded' : 'Payment Initiated',
      description: isCashPayment
        ? `Cash payment of ₹${paymentResult.paymentBreakdown.totalAmount} has been recorded`
        : `Payment initiated for your booking on ${booking.date?.toLocaleDateString()}`,
      userType: 'User',
      userId: booking.user._id || booking.user,
      category: 'booking_payment',
    });

    // Vendor notification
    if (vendorId) {
      const vendorDesc = isCashPayment
        ? `Cash payment recorded. You received ₹${paymentResult.paymentBreakdown.vendorAmount} (after ₹${paymentResult.paymentBreakdown.commissionAmount} platform fee)`
        : `Payment initiated for booking`;

      await createNotification({
        title: isCashPayment ? 'Cash Payment Processed' : 'Customer Payment Initiated',
        description: vendorDesc,
        userType: 'Vendor',
        userId: vendorId,
        category: 'booking_payment',
      });
    }
  }
}
