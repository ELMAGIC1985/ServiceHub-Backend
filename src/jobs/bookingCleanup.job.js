import { Booking } from '../models/index.js';

export const cleanupUnassignedBookings = async () => {
  const jobStartTime = new Date();
  console.log(`\n========================================`);
  console.log(`🧹 Starting Booking Cleanup Job`);
  console.log(`Started at: ${jobStartTime.toISOString()}`);
  console.log(`========================================\n`);

  try {
    const config = {
      // Delete bookings older than this (in hours)
      olderThanHours: 24, // 24 hours

      // Statuses to consider for cleanup
      statusesToCleanup: ['pending', 'searching', 'expired', 'failed', 'rejected'],

      // Whether to do a soft delete (update status) or hard delete
      softDelete: false, // Set to false for hard delete

      // Batch size for processing (to avoid memory issues)
      batchSize: 100,
    };

    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - config.olderThanHours);

    console.log(`📋 Configuration:`);
    console.log(`  - Delete bookings older than: ${config.olderThanHours} hours`);
    console.log(`  - Cutoff date: ${cutoffDate.toISOString()}`);
    console.log(`  - Statuses to cleanup: ${config.statusesToCleanup.join(', ')}`);
    console.log(`  - Delete type: ${config.softDelete ? 'Soft Delete' : 'Hard Delete'}`);
    console.log();

    // Build the filter
    const filter = {
      createdAt: { $lt: cutoffDate },
      status: { $in: config.statusesToCleanup },
      $or: [
        { 'vendorSearch.assignedVendor': { $exists: false } },
        { 'vendorSearch.assignedVendor.vendorId': { $exists: false } },
        { 'vendorSearch.assignedVendor.vendorId': null },
      ],
    };

    // Count total bookings to be cleaned
    const totalBookings = await Booking.countDocuments(filter);
    console.log(`📊 Found ${totalBookings} bookings to cleanup\n`);

    if (totalBookings === 0) {
      console.log(`✅ No bookings to cleanup. Job completed successfully.\n`);
      return {
        success: true,
        deletedCount: 0,
        message: 'No bookings to cleanup',
      };
    }

    let deletedCount = 0;
    let errorCount = 0;
    let processedBatches = 0;

    // Process in batches
    const totalBatches = Math.ceil(totalBookings / config.batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      console.log(`📦 Processing batch ${batch + 1}/${totalBatches}...`);

      try {
        if (config.softDelete) {
          // Soft delete: Update status to 'cancelled_by_system'
          const result = await Booking.updateMany(
            filter,
            {
              $set: {
                status: 'cancelled_by_system',
                'cancellation.cancelledBy': null,
                'cancellation.cancelledByModel': 'System',
                'cancellation.cancelledAt': new Date(),
                'cancellation.reason': `Automatic cleanup: No vendor assigned after ${config.olderThanHours} hours`,
                'cancellation.refundStatus': 'not_applicable',
              },
              $push: {
                statusHistory: {
                  status: 'cancelled_by_system',
                  timestamp: new Date(),
                  changedBy: null,
                  changedByModel: 'System',
                  reason: `Automatic cleanup: No vendor assigned after ${config.olderThanHours} hours`,
                  notes: 'Cancelled by cron job due to no vendor assignment',
                },
              },
            },
            { limit: config.batchSize }
          );

          deletedCount += result.modifiedCount;
          console.log(`  ✓ Soft deleted ${result.modifiedCount} bookings`);
        } else {
          const bookingsToDelete = await Booking.find(filter).select('_id').limit(config.batchSize).lean();

          if (bookingsToDelete.length > 0) {
            const idsToDelete = bookingsToDelete.map((b) => b._id);
            const result = await Booking.deleteMany({ _id: { $in: idsToDelete } });
            deletedCount += result.deletedCount;
            console.log(`  ✓ Hard deleted ${result.deletedCount} bookings`);
          }
        }

        processedBatches++;
      } catch (batchError) {
        errorCount++;
        console.error(`  ✗ Error processing batch ${batch + 1}:`, batchError.message);
      }
    }

    const jobEndTime = new Date();
    const duration = (jobEndTime - jobStartTime) / 1000; // in seconds

    console.log(`\n========================================`);
    console.log(`✅ Booking Cleanup Job Completed`);
    console.log(`========================================`);
    console.log(`📊 Summary:`);
    console.log(`  - Total bookings found: ${totalBookings}`);
    console.log(`  - Successfully processed: ${deletedCount}`);
    console.log(`  - Errors: ${errorCount}`);
    console.log(`  - Batches processed: ${processedBatches}/${totalBatches}`);
    console.log(`  - Duration: ${duration.toFixed(2)} seconds`);
    console.log(`  - Completed at: ${jobEndTime.toISOString()}`);
    console.log(`========================================\n`);

    return {
      success: true,
      totalFound: totalBookings,
      deletedCount,
      errorCount,
      duration,
      type: config.softDelete ? 'soft_delete' : 'hard_delete',
    };
  } catch (error) {
    console.error(`\n❌ Booking Cleanup Job Failed`);
    console.error(`Error:`, error.message);
    console.error(`Stack:`, error.stack);
    console.log(`========================================\n`);

    return {
      success: false,
      error: error.message,
    };
  }
};

export const cleanupOldBookings = async (daysOld = 90) => {
  console.log(`\n🗑️  Starting Old Bookings Cleanup (${daysOld} days old)...\n`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filter = {
      createdAt: { $lt: cutoffDate },
      status: {
        $in: ['completed', 'cancelled_by_user', 'cancelled_by_vendor', 'cancelled_by_system'],
      },
      paymentStatus: { $in: ['paid', 'refunded'] }, // Only cleanup if payment is settled
    };

    const count = await Booking.countDocuments(filter);
    console.log(`📊 Found ${count} old bookings to archive/delete`);

    if (count > 0) {
      // Option 1: Archive to another collection (recommended)
      // await archiveBookings(filter);

      // Option 2: Delete permanently
      const result = await Booking.deleteMany(filter);
      // console.log(`✅ Deleted ${result.deletedCount} old bookings`);

      console.log(`ℹ️  Skipping deletion - implement archiving first\n`);
    } else {
      console.log(`✅ No old bookings to cleanup\n`);
    }

    return { success: true, count };
  } catch (error) {
    console.error(`❌ Old Bookings Cleanup Failed:`, error.message);
    return { success: false, error: error.message };
  }
};
