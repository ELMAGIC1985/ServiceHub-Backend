import { Notification } from '../../../models/notification.model.js';
import { ApiError } from '../../../utils/index.js';

export const createNotification = async (options) => {
  const {
    title,
    description,
    userType,
    userId,
    category,
    vendors = [],
    users = [],
    image,
    link,
    isSend = true,
  } = options;

  if (!title) throw new ApiError(400, 'Notification title is required');
  if (!category) throw new ApiError(400, 'Notification category is required');
  if (!userType) throw new ApiError(400, 'userType is required');

  const notificationData = {
    title,
    description,
    type: userType.toLowerCase(),
    category,
    image,
    link,
    isSend,
    vendors: [],
    users: [],
  };

  if (userType.toLowerCase() === 'vendor') {
    notificationData.vendors = [userId, ...vendors];
  } else if (userType.toLowerCase() === 'user') {
    notificationData.users = [userId, ...users];
  } else if (userType.toLowerCase() === 'admin') {
    notificationData.users = users;
    notificationData.vendors = vendors;
  } else {
    throw new ApiError(400, 'Invalid userType provided');
  }

  const notification = new Notification(notificationData);
  return await notification.save();
};
