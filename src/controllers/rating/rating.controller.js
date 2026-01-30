import { ApiError, asyncHandler } from '../../utils/index.js';
import { ratingCommandService } from '../../services/rating/rating.command.service.js';

import { STATUS } from '../../constants/constants.js';
import { ratingQueryService } from '../../services/rating/rating.query.service.js';

const addRating = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userType = req.userType;
  try {
    const { ratingDoc, totalRatings, averageRating, isUpdate } = await ratingCommandService.addRating(
      req.body,
      userId,
      userType
    );

    return res.status(STATUS.OK).json({ ratingDoc, totalRatings, averageRating, isUpdate });
  } catch (error) {
    console.log('error', error.message);
    throw new ApiError(400, error.message || 'Something went wrong');
  }
});

const getRatings = async (req, res, next) => {
  const params = req.params;
  const query = req.query;

  try {
    const { formatedRatings, ratingStats, totalRatings, pagination } = await ratingQueryService.getItemRatings(
      params,
      query
    );
    res.status(STATUS.OK).json({
      ratings: formatedRatings,
      pagination,
      statistics: {
        averageRating: ratingStats[0]?.averageRating?.toFixed(2) || 0,
        totalRatings: totalRatings,
      },
    });
  } catch (error) {
    const errorMessage = new ApiError(500, error.message || 'Failed to fetch ratings');
    return next(errorMessage);
  }
};

const getProductRating = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;
  const query = req.query;

  try {
    const { formatedRatings, ratingStats, totalRatings, pagination } = await ratingQueryService.getProductRating(
      itemId,
      query
    );
    res.status(STATUS.OK).json({
      ratings: formatedRatings,
      pagination,
      statistics: {
        averageRating: ratingStats[0]?.averageRating?.toFixed(2) || 0,
        totalRatings: totalRatings,
      },
    });
  } catch (error) {
    const errorMessage = new ApiError(500, error.message || 'Failed to fetch ratings');
    return next(errorMessage);
  }
});

const getVendorRating = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;
  const query = req.query;

  try {
    const { formatedRatings, ratingStats, totalRatings, pagination } = await ratingQueryService.getVendorRating(
      itemId,
      query
    );
    res.status(STATUS.OK).json({
      data: formatedRatings,
      pagination,
      statistics: {
        averageRating: ratingStats[0]?.averageRating?.toFixed(2) || 0,
        totalRatings: totalRatings,
      },
    });
  } catch (error) {
    const errorMessage = new ApiError(500, error.message || 'Failed to fetch ratings');
    return next(errorMessage);
  }
});

const getBookingRating = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;
  const query = req.query;

  try {
    const { formatedRatings, ratingStats, totalRatings, pagination } = await ratingQueryService.getBookingRating(
      itemId,
      query
    );
    res.status(STATUS.OK).json({
      ratings: formatedRatings,
      pagination,
      statistics: {
        averageRating: ratingStats[0]?.averageRating?.toFixed(2) || 0,
        totalRatings: totalRatings,
      },
    });
  } catch (error) {
    const errorMessage = new ApiError(500, error.message || 'Failed to fetch ratings');
    return next(errorMessage);
  }
});

export { addRating, getRatings, getProductRating, getBookingRating, getVendorRating };
