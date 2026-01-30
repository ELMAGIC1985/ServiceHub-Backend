import cron from 'node-cron';
import { cleanupUnassignedBookings } from './bookingCleanup.job.js';
import { vendorWalletCheckJob } from './vendorWalletCheck.job.js';
import logger from '../utils/logger.js';

export const initCronJobs = () => {
  logger.info('\n🚀 Initializing Cron Jobs...\n');

  cron.schedule(
    '0 2 * * *', // Daily at 2:00 AM IST
    async () => {
      logger.info('⏰ Triggered: Unassigned Bookings Cleanup');
      await cleanupUnassignedBookings();
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    }
  );

  // cron.schedule('', async () => {
  //   logger.info('');
  //   await vendorWalletCheckJob();
  // });

  logger.info('✅ Job registered: Cleanup Unassigned Bookings (Daily at 2:00 AM IST)');

  logger.info('✅ Job registered: Expire Pending Bookings (Every hour)');

  logger.info('\n✨ All cron jobs initialized successfully!\n');
};

export const stopCronJobs = () => {
  logger.info('🛑 Stopping all cron jobs...');
  cron.getTasks().forEach((task) => task.stop());
  logger.info('✅ All cron jobs stopped');
};

export const listCronJobs = () => {
  const tasks = cron.getTasks();
  logger.info(`\n📋 Active Cron Jobs: ${tasks.size}`);
  tasks.forEach((task, key) => {
    logger.info(`  - Job ${key}: ${task.options?.scheduled ? 'Running' : 'Stopped'}`);
  });
  logger.info();
};
