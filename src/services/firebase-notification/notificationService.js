import admin from '../../config/firebase.js';

class NotificationService {
  // Send to single device
  async sendToDevice(token, title, body, data = {}) {
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: data,
      token: token,
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          icon: '/icon-192x192.png',
          badge: '/badge-icon.png',
          click_action: 'https://yourwebsite.com',
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      return { success: true, response };
    } catch (error) {
      console.log('Error sending message:', error);
      return { success: false, error };
    }
  }

  async sendToMultipleDevices(tokens, title, body, data = {}) {
    // Convert data object values to strings (FCM requirement)
    const stringData = {};
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          stringData[key] = JSON.stringify(value);
        } else {
          stringData[key] = String(value);
        }
      }
    });

    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: stringData, // Use object with string values, not JSON.stringify()
      tokens: tokens,
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
          badge: '/badge-icon.png',
        },
      },
    };

    console.log('Sending message:', JSON.stringify(message, null, 2));

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log('Successfully sent messages:', response.successCount, 'success,', response.failureCount, 'failed');

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.log('Failed token:', tokens[idx], resp.error);
            failedTokens.push(tokens[idx]);
          }
        });
        return { success: true, response, failedTokens };
      }

      return { success: true, response };
    } catch (error) {
      console.log('Error sending messages:', error);
      return { success: false, error };
    }
  }

  async sendToTopic(topic, title, body, data = {}) {
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: data,
      topic: topic,
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent to topic:', response);
      return { success: true, response };
    } catch (error) {
      console.log('Error sending to topic:', error);
      return { success: false, error };
    }
  }

  // Subscribe users to topic
  async subscribeToTopic(tokens, topic) {
    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      console.log('Successfully subscribed to topic:', response);
      return { success: true, response };
    } catch (error) {
      console.log('Error subscribing to topic:', error);
      return { success: false, error };
    }
  }
}

const notificationService = new NotificationService();

export default notificationService;
