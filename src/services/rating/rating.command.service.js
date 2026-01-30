import mongoose from 'mongoose';
import { STATUS } from '../../constants/constants.js';
import { Booking, Order, Product, Rating, ServiceTemplate } from '../../models/index.js';
import { ApiError } from '../../utils/index.js';
import { bookingRatingSchema, productRatingSchema, vendorRatingSchema } from '../../validators/rating.validation.js';

class RatingCommandService {
  async loadBooking(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(STATUS.NOT_FOUND, 'Booking not found');
    }

    return booking;
  }

  async validateRatingDto(data) {
    let result;

    switch (data.itemType.toLowerCase()) {
      case 'product':
        result = productRatingSchema.validate(data);
        break;

      case 'booking':
        result = bookingRatingSchema.validate(data);
        break;

      case 'vendor':
        result = vendorRatingSchema.validate(data);
        break;

      default:
        throw new ApiError(STATUS.BAD_REQUEST, 'Invalid item type. Must be Product, Booking, or Vendor');
    }

    const { error, value } = result;
    if (error) {
      throw new ApiError(STATUS.BAD_REQUEST, `${error.details.map((x) => x.message).join(', ')}`);
    }

    return value;
  }

  async loadProduct(productId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(STATUS.NOT_FOUND, 'Product not found');
    }
    return product;
  }

  async verifyProductDelivery(userId, userType, productId) {
    const order = await Order.findDeliveredByUserAndProduct(userId, userType, productId);
    console.log('ORder', order, userId, productId);

    if (!order) {
      throw new ApiError(STATUS.BAD_REQUEST, 'You can only rate products from delivered orders');
    }

    if (order?.isUserRated) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Product is already rated for this order');
    }

    return order;
  }

  async findExistingRating(itemId, itemType, userId, userType, sourceId) {
    return await Rating.findOne({
      itemId,
      itemType,
      userId,
      userType,
      sourceId,
    });
  }

  async upsertRating(existingRating, ratingData) {
    const { rating, comment } = ratingData;

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
      await existingRating.save();
      return { ratingDoc: existingRating, isUpdate: true };
    }

    const ratingDoc = await Rating.create(ratingData);

    return { ratingDoc, isUpdate: false };
  }

  async calculateAverageRating(itemId, itemType) {
    const ratings = await Rating.find({ itemId, itemType });

    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings : 0;

    return {
      totalRatings,
      averageRating: parseFloat(averageRating.toFixed(2)),
    };
  }

  async updateServiceTemplateRating(booking, ratingData) {
    if (!booking.serviceTemplate || !mongoose.Types.ObjectId.isValid(booking.serviceTemplate)) {
      return;
    }

    const template = await ServiceTemplate.findById(booking.serviceTemplate);
    if (!template) return;

    if (!template.ratings) {
      template.ratings = [];
    }

    await this.upsertRating(null, {
      ...ratingData,
      itemType: 'ServiceTemplate',
      itemId: template._id,
    });

    const { totalRatings, averageRating } = await this.calculateAverageRating(template._id, 'ServiceTemplate');
    await ServiceTemplate.findByIdAndUpdate(template._id, {
      totalRatings,
      averageRating,
    });
  }

  async handleProductRating(ratingData) {
    const { itemId, userId, userType, sourceId } = ratingData;

    const order = await this.verifyProductDelivery(userId, userType, itemId);
    await this.loadProduct(itemId);

    const existingRating = await this.findExistingRating(itemId, 'Product', userId, userType, sourceId);
    const { ratingDoc, isUpdate } = await this.upsertRating(existingRating, ratingData);

    const { totalRatings, averageRating } = await this.calculateAverageRating(itemId, 'Product');
    await Product.findByIdAndUpdate(itemId, {
      totalRatings,
      averageRating,
    });

    order.isUserRated = true;
    await order.save();

    return { ratingDoc, totalRatings, averageRating, isUpdate };
  }

  async handleBookingRating(ratingData) {
    const { itemId, userId, userType } = ratingData;
    const booking = await this.loadBooking(itemId);
    const { valid, message } = booking.canBeRatedBy(userId);

    if (!valid) {
      throw new ApiError(STATUS.BAD_REQUEST, message);
    }

    const existingRating = await this.findExistingRating(itemId, 'Booking', userId, userType);
    const { ratingDoc, isUpdate } = await this.upsertRating(existingRating, ratingData);

    await Booking.findByIdAndUpdate(itemId, {
      rating: ratingDoc._id,
    });

    await this.updateServiceTemplateRating(booking, ratingData);

    const { totalRatings, averageRating } = await this.calculateAverageRating(itemId, 'Booking');

    return { ratingDoc, totalRatings, averageRating, isUpdate };
  }

  async handleVendorRating(ratingData) {
    const { itemId, userId, userType, sourceId, sourceType } = ratingData;
    const booking = await this.loadBooking(sourceId);

    const { valid, message } = booking.canBeRatedBy(userId);

    if (!valid) {
      throw new ApiError(STATUS.BAD_REQUEST, message);
    }

    const data = booking.canBeVendorRate();

    if (!data?.valid) {
      throw new ApiError(STATUS.BAD_REQUEST, data?.message);
    }

    const existingRating = await this.findExistingRating(itemId, 'Vendor', userId, userType);

    const { ratingDoc, isUpdate } = await this.upsertRating(existingRating, {
      ...ratingData,
      itemId: booking.vendorSearch.assignedVendor.vendorId,
      sourceId: itemId,
    });

    booking.isVendorRated = true;

    await booking.save();

    const { totalRatings, averageRating } = await this.calculateAverageRating(itemId, 'Vendor');

    return { ratingDoc, totalRatings, averageRating, isUpdate };
  }

  async addRating(ratingData, userId, userType) {
    let ratingValidatedData = await this.validateRatingDto(ratingData);

    ratingValidatedData = { ...ratingValidatedData, userId, userType };

    let result;

    switch (ratingValidatedData.itemType.toLowerCase()) {
      case 'product':
        result = await this.handleProductRating(ratingValidatedData);
        break;

      case 'booking':
        result = await this.handleBookingRating(ratingValidatedData);
        break;

      case 'vendor':
        result = await this.handleVendorRating(ratingValidatedData);
        break;

      default:
        throw new ApiError(STATUS.BAD_REQUEST, 'Invalid item type. Must be Product, Booking, or Vendor');
    }

    return result;
  }
}

const ratingCommandService = new RatingCommandService();

export { ratingCommandService };
