import { firebaseAdmin, firestore } from '../../../config/firebase.js';
import { Vendor } from '../../../models/index.js';

class BookingSearchManager {
  constructor() {
    this.db = firestore;
    this.activeSearches = new Map();
  }

  // Initialize search status for user
  async initializeSearch(bookingId, userId, bookingData) {
    try {
      const searchData = {
        bookingId,
        userId,
        status: 'searching',
        searchPhase: {
          startedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          estimatedDuration: 300,
          progress: 0,
          searchRadius: 5,
          maxRadius: 15,
        },
        eligibleVendors: [],
        assignedVendor: null,
        searchStats: {
          totalVendorsNotified: 0,
          responseRate: 0,
          averageResponseTime: 0,
        },
        bookingDetails: {
          serviceTitle: bookingData.service?.title,
          timeSlot: bookingData.timeSlot,
          address: bookingData.address?.formattedAddress,
          price: bookingData.price,
        },
        lastUpdated: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      };

      // Save to Firebase
      await this.db.collection('userBookingSearch').doc(userId).collection('searches').doc(bookingId).set(searchData);

      // Cache locally
      this.activeSearches.set(bookingId, searchData);

      console.log(`🔍 Search initialized for booking ${bookingId}`);
      return searchData;
    } catch (error) {
      console.error('Error initializing search:', error);
      throw error;
    }
  }

  // Update search progress
  async updateSearchProgress(bookingId, userId, updates) {
    try {
      const updateData = {
        ...updates,
        lastUpdated: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      };

      await this.db
        .collection('userBookingSearch')
        .doc(userId)
        .collection('searches')
        .doc(bookingId)
        .update(updateData);

      // Update local cache
      const cached = this.activeSearches.get(bookingId);
      if (cached) {
        Object.assign(cached, updates);
      }

      console.log(`📊 Search progress updated for booking ${bookingId}:`, updates);
    } catch (error) {
      console.error('Error updating search progress:', error);
    }
  }

  // Add eligible vendors to search
  async addEligibleVendors(bookingId, userId, vendors) {
    try {
      const vendorData = vendors.map((vendor) => ({
        vendorId: vendor.vendorId,
        name: vendor.vendor,
        rating: vendor.rating || 4.5,
        distance: vendor.distance,
        responseStatus: 'notified',
        notifiedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        responseAt: null,
      }));

      await this.updateSearchProgress(bookingId, userId, {
        eligibleVendors: vendorData,
        'searchStats.totalVendorsNotified': vendors.length,
        'searchPhase.progress': 50, // Mid-search progress
      });

      console.log(`👥 Added ${vendors.length} eligible vendors to search ${bookingId}`);
    } catch (error) {
      console.error('Error adding eligible vendors:', error);
    }
  }

  // Handle vendor response
  async handleVendorResponse(bookingId, userId, vendorId, response) {
    try {
      if (response === 'accepted') {
        // Get vendor details for assignment
        const vendor = await Vendor.findById(vendorId).select('firstName lastName');
        const assignedVendor = {
          vendorId,
          name: `${vendor.firstName} ${vendor.lastName}`,
          assignedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          estimatedArrival: this.calculateArrivalTime(vendorId, bookingId),
        };

        await this.updateSearchProgress(bookingId, userId, {
          status: 'vendor_found',
          assignedVendor,
          'searchPhase.progress': 100,
        });

        console.log(`✅ Vendor ${vendorId} assigned to booking ${bookingId}`);
      } else if (response === 'declined') {
        // Update vendor response status
        await this.updateVendorResponseStatus(bookingId, userId, vendorId, 'declined');

        // Check if all vendors have responded
        await this.checkSearchCompletion(bookingId, userId);
      }
    } catch (error) {
      console.error('Error handling vendor response:', error);
    }
  }

  // Update individual vendor response status
  async updateVendorResponseStatus(bookingId, userId, vendorId, status) {
    try {
      const searchRef = this.db.collection('userBookingSearch').doc(userId).collection('searches').doc(bookingId);

      const searchDoc = await searchRef.get();
      if (!searchDoc.exists) return;

      const searchData = searchDoc.data();
      const eligibleVendors = searchData.eligibleVendors || [];

      // Update the specific vendor's status
      const updatedVendors = eligibleVendors.map((vendor) => {
        if (vendor.vendorId === vendorId) {
          return {
            ...vendor,
            responseStatus: status,
            responseAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          };
        }
        return vendor;
      });

      await searchRef.update({
        eligibleVendors: updatedVendors,
        lastUpdated: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating vendor response status:', error);
    }
  }

  // Check if search should be marked as completed/failed
  async checkSearchCompletion(bookingId, userId) {
    try {
      const searchRef = this.db.collection('userBookingSearch').doc(userId).collection('searches').doc(bookingId);

      const searchDoc = await searchRef.get();
      if (!searchDoc.exists) return;

      const searchData = searchDoc.data();
      const eligibleVendors = searchData.eligibleVendors || [];

      // Check if all vendors have responded
      const pendingVendors = eligibleVendors.filter((v) => v.responseStatus === 'notified');
      const acceptedVendors = eligibleVendors.filter((v) => v.responseStatus === 'accepted');

      if (acceptedVendors.length === 0 && pendingVendors.length === 0) {
        // All vendors declined - mark as failed
        await this.updateSearchProgress(bookingId, userId, {
          status: 'failed',
          'searchPhase.progress': 100,
        });

        console.log(`❌ Search failed for booking ${bookingId} - all vendors declined`);
      }
    } catch (error) {
      console.error('Error checking search completion:', error);
    }
  }

  // Calculate estimated arrival time
  calculateArrivalTime(vendorId, bookingId) {
    // This would calculate based on vendor location and booking address
    // For now, return a mock estimate
    return {
      estimatedMinutes: 25,
      estimatedTime: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    };
  }

  // Clean up completed searches
  async cleanupSearch(bookingId, userId) {
    try {
      await this.db.collection('userBookingSearch').doc(userId).collection('searches').doc(bookingId).delete();

      this.activeSearches.delete(bookingId);

      console.log(`🧹 Cleaned up search for booking ${bookingId}`);
    } catch (error) {
      console.error('Error cleaning up search:', error);
    }
  }
}

// ========================================

// export const handleSearchTimeout = async (bookingId, userId) => {
//   try {
//     // Update booking status
//     await Booking.findByIdAndUpdate(bookingId, {
//       status: 'failed',
//       $push: {
//         statusHistory: {
//           status: 'failed',
//           timestamp: new Date(),
//           changedBy: null,
//           changedByModel: 'System',
//           reason: 'Search timeout - no vendors responded',
//           notes: 'Search timed out after maximum duration',
//         },
//       },
//     });

//     // Update search status
//     await searchManager.updateSearchProgress(bookingId, userId, {
//       status: 'failed',
//       'searchPhase.progress': 100,
//     });

//     console.log(`⏰ Search timeout for booking ${bookingId}`);
//   } catch (error) {
//     console.error('Error handling search timeout:', error);
//   }
// };

// export const cleanupExpiredSearches = async () => {
//   try {
//     const now = new Date();

//     // Query expired searches
//     const expiredSearches = awaitfirestore().collectionGroup('searches').where('expiresAt', '<', now).get();

//     const batch =firestore().batch();

//     expiredSearches.forEach((doc) => {
//       batch.delete(doc.ref);
//     });

//     await batch.commit();

//     console.log(`🧹 Cleaned up ${expiredSearches.size} expired searches`);
//   } catch (error) {
//     console.error('Error cleaning up expired searches:', error);
//   }
// };

// Run cleanup every 10 minutes
// setInterval(cleanupExpiredSearches, 10 * 60 * 1000);

// ========================================
// EXPORT ALL FUNCTIONS
// ========================================

export { BookingSearchManager };
