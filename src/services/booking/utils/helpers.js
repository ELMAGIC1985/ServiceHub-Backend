import { logger } from '../../../utils/index.js';

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function isTimeSlotInWorkingHours(timeSlot, startTime, endTime) {
  try {
    const [slotStart, slotEnd] = timeSlot.split(' - ');
    const slotStartMinutes = parseTimeToMinutes(slotStart);
    const slotEndMinutes = parseTimeToMinutes(slotEnd);
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);

    return slotStartMinutes >= startMinutes && slotEndMinutes <= endMinutes;
  } catch (error) {
    logger.warn('Error checking working hours', { timeSlot, startTime, endTime });
    return true;
  }
}

function parseTimeToMinutes(timeString) {
  if (!timeString) return 0;

  const [timePart, modifier] = timeString.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);

  if (modifier?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
  if (modifier?.toLowerCase() === 'am' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function getDayOfWeek(date) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[date.getDay()];
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  // console.log(lat1, lon1, lat2, lon2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export { toRadians, isTimeSlotInWorkingHours, parseTimeToMinutes, getDayOfWeek, calculateDistance };
