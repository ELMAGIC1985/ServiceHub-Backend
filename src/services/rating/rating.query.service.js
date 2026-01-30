import mongoose from 'mongoose';
import { Rating } from '../../models/index.js';
import { formatRating } from './utils/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { STATUS } from '../../constants/constants.js';

class RatingQueryService {
  async getItemRatings(itemId, query, itemType) {
    const { page = 1, limit = 50 } = query;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Invalid item ID');
    }

    const skip = (page - 1) * limit;

    console.log(itemId, itemType);

    const ratings = await Rating.find({ itemId, itemType })
      .populate('userId', 'firstName lastName email selfieImage')
      .sort({ createdAt: -1 });
    // .skip(skip)
    // .limit(parseInt(limit));

    const totalRatings = await Rating.countDocuments({ itemId, itemType });

    const ratingStats = await Rating.aggregate([
      {
        $match: {
          itemId: new mongoose.Types.ObjectId(itemId),
          itemType: itemType,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    const formatedRatings = ratings.map((rating) => formatRating(rating));

    return {
      formatedRatings,
      ratingStats,
      totalRatings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRatings / limit),
        totalRatings,
        limit: parseInt(limit),
      },
    };
  }

  async getProductRating(productId, query) {
    return this.getItemRatings(productId, query, 'Product');
  }

  async getBookingRating(bookingId, query) {
    return this.getItemRatings(bookingId, query, 'ServiceTemplate');
  }

  async getVendorRating(vendorId, query) {
    return this.getItemRatings(vendorId, query, 'Vendor');
  }
}

const ratingQueryService = new RatingQueryService();

export { ratingQueryService };
