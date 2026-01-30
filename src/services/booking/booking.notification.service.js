import { STATUS } from '../../constants/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { notificationService } from '../notifications/notification.service.js';

class BookingNotificationClass {
  async sendBookingRequestNotificationToVendor({ eligibleVendors, booking, serviceTemplate, address, session }) {
    const notificationData = {
      bookingId: booking._id.toString(),
      bookingSequenceId: booking.bookingId,
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

    // console.log('notificationData', notificationData);

    const messages = eligibleVendors.map((vendor) => {
      const vendorSpecificData = {
        ...notificationData,
        distance: vendor.distance?.toFixed(2).toString() || '0',
      };

      const stringifiedNotificationData = this.stringifyDataValues(vendorSpecificData);

      return {
        token: vendor.fcmToken,
        ...(vendor.platform === 'ios'
          ? {
              notification: {
                title: '🔔 New Service Request',
                body: `New ${notificationData.serviceTitle} request available`,
              },
            }
          : {}),
        data: {
          ...stringifiedNotificationData,
          click_action: 'OPEN_BOOKING_REQUEST',
          booking_id: booking._id.toString(),
        },

        android: {
          priority: 'high',
          // notification: {
          //   channelId: 'call_channel',
          //   priority: 'high',
          //   defaultSound: true,
          //   defaultVibrateTimings: true,
          //   icon: 'notification_icon',
          //   color: '#FF6B35',
          // },
          // data: {
          //   click_action: 'OPEN_BOOKING_REQUEST',
          //   booking_id: booking._id.toString(),
          //   distance: vendor.distance?.toString() || '0',
          // },
        },

        apns: {
          headers: { 'apns-priority': '10' },
          payload: {
            aps: {
              contentAvailable: 1,
              sound: 'alert.wav',
              badge: 1,
            },
          },
        },
      };
    });

    const notificationResponse = await notificationService.sendSimultaneousNotifications(messages);

    if (!notificationResponse.success) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Unable to send notification to vendor');
    }

    return;
  }

  async sendBookingConformationNotificationToVendor({ booking, vendor }) {
    const vendorSpecificData = {
      bookingId: booking._id,
      paymentComplete: true,
      ringBuzzer: false,
    };
    const stringifiedNotificationData = this.stringifyDataValues(vendorSpecificData);
    const messages = {
      token: vendor.fcmToken.token,
      notification: {
        title: 'Payment received',
        body: `Payment received for ${booking.bookingId}`,
      },
      data: {
        ...stringifiedNotificationData,
      },
      android: {
        priority: 'high',
      },

      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            contentAvailable: 1,
            sound: 'alert.wav',
            badge: 1,
          },
        },
      },
    };

    const notificationResponse = await notificationService.sendSingleNotification(messages);

    if (!notificationResponse.success) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Unable to send notification to vendor');
    }

    return;
  }

  async sendTestPaymentNotification(token, platform) {
    const vendorSpecificData = {
      paymentComplete: true,
      ringBuzzer: false,
    };
    const stringifiedNotificationData = this.stringifyDataValues(vendorSpecificData);
    const messages = {
      token: token,
      ...(platform === 'ios'
        ? {
            notification: {
              title: 'Payment received',
              body: `Payment received for '677777777777777777777777'`,
            },
          }
        : {}),
      data: {
        ...stringifiedNotificationData,
      },
      android: {
        priority: 'high',
      },

      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            contentAvailable: 1,
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const notificationResponse = await notificationService.sendSingleNotification(messages);
    if (!notificationResponse.success) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Unable to send notification to vendor');
    }

    return;
  }

  async sendBookingConformationNotificationToVendorTesting(token) {
    const vendorSpecificData = {
      bookingId: '677777777777777777777777',
      paymentComplete: true,
      ringBuzzer: false,
    };
    const stringifiedNotificationData = this.stringifyDataValues(vendorSpecificData);
    const messages = {
      token: token,
      notification: {
        title: 'Payment received',
        body: `Payment received for '677777777777777777777777'`,
      },
      data: {
        ...stringifiedNotificationData,
      },
      android: {
        priority: 'high',
      },

      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            contentAvailable: 1,
            sound: 'alert.wav',
            badge: 1,
          },
        },
      },
    };

    const notificationResponse = await notificationService.sendSingleNotification(messages);

    if (!notificationResponse.success) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Unable to send notification to vendor');
    }

    return;
  }

  async testVendorNotification(fcmToken, platform) {
    const dummyBookingId = '677777777777777777777777';
    const dummyServiceId = '688888888888888888888888';

    const dummyData = {
      bookingId: dummyBookingId,
      serviceId: dummyServiceId,
      serviceTitle: 'Test Home Cleaning',
      serviceDescription: 'Test description for debugging notifications',
      serviceType: 'home_service',
      address: JSON.stringify({ city: 'Mumbai', street: 'MG Road', pincode: '400001' }),
      date: new Date().toISOString(),
      timeSlot: '10:00 AM - 11:00 AM',
      pricing: JSON.stringify({
        basePrice: 500,
        discountAmount: 50,
        couponDiscount: 0,
        membershipDiscount: 0,
        taxAmount: 45,
        platformFee: 10,
        totalAmount: 505,
      }),
      specialRequirements: '',
      userNotes: '',
      distance: '1.5',
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // expires in 5 min
      notificationType: 'new_booking_request',
    };

    const message = {
      token: fcmToken,
      ...(platform === 'ios'
        ? {
            notification: {
              title: '🔔 New Service Request',
              body: `New ${dummyData.serviceTitle} request available`,
            },
          }
        : {}),
      data: {
        ...dummyData,
        click_action: 'OPEN_BOOKING_REQUEST',
        booking_id: dummyBookingId,
      },
      android: {
        priority: 'high',
        // notification: {
        //   channelId: 'call_channel',
        //   priority: 'high',
        //   defaultSound: true,
        //   defaultVibrateTimings: true,
        //   icon: 'notification_icon',
        //   color: '#FF6B35',
        // },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            contentAvailable: 1,
            sound: 'alert.wav',
            badge: 1,
          },
        },
      },
    };

    const result = await notificationService.sendSimultaneousNotifications([message]);

    return {
      success: result.success,
      message: result.success ? 'Test notification sent successfully' : 'Notification failed',
      raw: result,
    };
  }

  stringifyDataValues(data) {
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
  }
}

const bookingNotificationService = new BookingNotificationClass();

export { bookingNotificationService };
