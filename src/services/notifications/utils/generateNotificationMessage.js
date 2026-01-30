export const generateNotificationMessage = ({ user, data = {} }) => {
  return {
    token: user.fcmToken?.token || '',
    data: {
      type: data.type || 'GENERAL',
      ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
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
};
