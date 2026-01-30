import cron from 'node-cron';
import { Booking } from '../../models/index.js';
import logger from '../../utils/logger.js';

class BookingExpirationScheduler {
  constructor() {
    this.cronJob = null;
  }

  start() {
    logger.info('Starting booking expiration scheduler');

    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.expireBookings();
    });

    logger.info('Booking expiration scheduler started - Running every minute');

    this.expireBookings();
  }

  async expireBookings() {
    try {
      const now = new Date();

      const result = await Booking.updateMany(
        {
          status: { $in: ['pending', 'searching'] },
          'timing.searchTimeout': { $lte: now },
        },
        {
          $set: { status: 'expired' },
          $push: {
            statusHistory: {
              status: 'expired',
              timestamp: new Date(),
              changedBy: null,
              changedByModel: 'System',
              reason: 'Request timeout exceeded',
              notes: 'Auto-expired by system due to timeout',
            },
          },
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(`⏰ Auto-expired ${result.modifiedCount} bookings`);
      }
    } catch (error) {
      logger.error('❌ Error in expireBookings job:', error);
    }
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Booking expiration scheduler stopped');
    }
  }

  getStatus() {
    return {
      isRunning: this.cronJob ? true : false,
      schedule: '* * * * *',
      description: 'Runs every minute to expire pending/searching bookings',
    };
  }
}

export const bookingExpirationScheduler = new BookingExpirationScheduler();
