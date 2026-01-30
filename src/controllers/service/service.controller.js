import { VendorService } from '../../models/vendorServiceSchema.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Get all vendor services with filters and pagination
const getAllVendorServices = asyncHandler(async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      subCategory,
      childCategory,
      vendor,
      status = 'approved', // Default to approved services
      availability,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice,
      priceType,
      location, // For location-based filtering
      radius = 100, // Default radius in km
      isActive, // Filter for active services
      isDeleted = false, // Filter for non-deleted services
    } = req.query;

    const filter = {};

    // Category filters
    // if (category) filter.category = category;
    // if (subCategory) filter.subCategory = subCategory;
    // if (childCategory) filter.childCategory = childCategory;

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    filter.isDeleted = isDeleted === false;

    console.log('filter', filter.isActive, filter.isDeleted);
    // Vendor filter
    if (vendor) filter.vendor = vendor;

    // Status filter (approved by default for public API)
    if (status) filter.status = status;

    // Availability filter
    if (availability !== undefined) filter.availability = availability === 'true';

    // Price filters
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Price type filter
    if (priceType) filter.priceType = priceType;

    // Location-based filtering
    if (location) {
      try {
        const [lng, lat] = location.split(',').map((coord) => parseFloat(coord));
        if (!isNaN(lng) && !isNaN(lat)) {
          filter.location = {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [lng, lat],
              },
              $maxDistance: radius * 1000, // Convert km to meters
            },
          };
        }
      } catch (error) {
        console.warn('Invalid location format provided');
      }
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let query = VendorService.find(filter);

    // Text search functionality
    if (search) {
      // Create text search query
      const searchRegex = new RegExp(search, 'i');
      query = query.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { shortDescription: searchRegex },
          // You can add more fields for text search
        ],
      });
    }

    // Pagination
    const skip = (page - 1) * limit;
    const services = await query
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('vendor', 'firstName lastName email phone')
      .select('-statusHistory -ratings') // Exclude heavy fields for list view
      .lean();

    // Get total count for pagination
    const totalServices = await VendorService.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(totalServices / limit);
    const currentPage = parseInt(page);

    const response = {
      services,
      pagination: {
        currentPage,
        totalPages,
        totalServices,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        limit: parseInt(limit),
      },
      filters: {
        category,
        subCategory,
        childCategory,
        vendor,
        status,
        availability,
        minPrice,
        maxPrice,
        priceType,
        location,
        radius,
        search,
      },
    };

    res.status(200).json(new ApiResponse(200, response, 'Services fetched successfully'));
  } catch (error) {
    console.error('Error fetching services:', error);
    return next(new ApiError(500, error.message || 'Failed to fetch services'));
  }
});

// Get vendor service by ID
const getVendorServiceById = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = await VendorService.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate('vendor', 'firstName lastName email phoneNumber businessName profileImage')
      .populate('serviceTemplate', 'title description category subCategory features whatIncluded whatExcluded')
      .populate('createdBy updatedBy', 'firstName lastName email');

    if (!service) {
      return next(new ApiError(404, 'Vendor service not found'));
    }

    res.status(200).json(new ApiResponse(200, service, 'Vendor service fetched successfully'));
  } catch (error) {
    console.error('Error fetching vendor service:', error);
    return next(new ApiError(500, error.message || 'Failed to fetch vendor service'));
  }
});

// Get vendor services by vendor ID
const getServicesByVendor = asyncHandler(async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { status = 'approved', isActive = true, page = 1, limit = 10 } = req.query;

    const filter = {
      vendor: vendorId,
      isDeleted: false,
    };

    if (status) filter.status = status;

    if (isActive !== undefined) filter.isActive = isActive;

    const skip = (page - 1) * limit;

    const services = await VendorService.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('serviceTemplate', 'title description')
      .lean();

    const totalServices = await VendorService.countDocuments(filter);

    const response = {
      services,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalServices / limit),
        totalServices,
        hasNextPage: page < Math.ceil(totalServices / limit),
        hasPrevPage: page > 1,
      },
    };

    res.status(200).json(new ApiResponse(200, response, 'Vendor services fetched successfully'));
  } catch (error) {
    console.error('Error fetching vendor services:', error);
    return next(new ApiError(500, error.message || 'Failed to fetch vendor services'));
  }
});

// Update vendor service
const updateVendorService = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.vendor; // Prevent vendor change
    delete updateData.serviceTemplate; // Prevent template change

    // Add updatedBy field
    if (req.user) {
      updateData.updatedBy = req.user._id;
    }

    const service = await VendorService.findOneAndUpdate({ _id: id, isDeleted: false }, updateData, {
      new: true,
      runValidators: true,
      select: '-reviews -bookingStats',
    })
      .populate('vendor', 'firstName lastName businessName')
      .populate('serviceTemplate', 'title description');

    if (!service) {
      return next(new ApiError(404, 'Vendor service not found'));
    }

    res.status(200).json(new ApiResponse(200, service, 'Vendor service updated successfully'));
  } catch (error) {
    console.error('Error updating vendor service:', error);
    return next(new ApiError(500, error.message || 'Failed to update vendor service'));
  }
});

// Update service status (Admin only)
const updateServiceStatus = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, adminNotes } = req.body;

    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      return next(new ApiError(400, 'Invalid status value'));
    }

    const updateData = {
      status,
      updatedBy: req.user._id,
    };

    // Handle approval data
    if (status === 'approved') {
      updateData['approval.isApproved'] = true;
      updateData['approval.approvedBy'] = req.user._id;
      updateData['approval.approvedAt'] = new Date();
      updateData.isActive = true;
    } else if (status === 'rejected') {
      updateData['approval.isApproved'] = false;
      updateData['approval.rejectionReason'] = rejectionReason;
      updateData.isActive = false;
    }

    if (adminNotes) {
      updateData['approval.adminNotes'] = adminNotes;
    }

    const service = await VendorService.findOneAndUpdate({ _id: id, isDeleted: false }, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('vendor', 'firstName lastName businessName email')
      .populate('serviceTemplate', 'title');

    if (!service) {
      return next(new ApiError(404, 'Vendor service not found'));
    }

    res.status(200).json(new ApiResponse(200, service, `Service status updated to ${status} successfully`));
  } catch (error) {
    console.error('Error updating service status:', error);
    return next(new ApiError(500, error.message || 'Failed to update service status'));
  }
});

// Toggle service availability
const toggleServiceAvailability = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const service = await VendorService.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        'availability.isAvailable': isAvailable,
        updatedBy: req.user?._id,
      },
      { new: true }
    );

    if (!service) {
      return next(new ApiError(404, 'Vendor service not found'));
    }

    res.status(200).json(new ApiResponse(200, service, `Service availability updated successfully`));
  } catch (error) {
    console.error('Error updating service availability:', error);
    return next(new ApiError(500, error.message || 'Failed to update service availability'));
  }
});

// Soft delete vendor service
const deleteVendorService = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = await VendorService.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        isActive: false,
        updatedBy: req.user?._id,
      },
      { new: true }
    );

    if (!service) {
      return next(new ApiError(404, 'Vendor service not found'));
    }

    res.status(200).json(new ApiResponse(200, null, 'Vendor service deleted successfully'));
  } catch (error) {
    console.error('Error deleting vendor service:', error);
    return next(new ApiError(500, error.message || 'Failed to delete vendor service'));
  }
});

// Restore deleted vendor service
const restoreVendorService = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const service = await VendorService.findOneAndUpdate(
      { _id: id, isDeleted: true },
      {
        isDeleted: false,
        updatedBy: req.user?._id,
      },
      { new: true }
    )
      .populate('vendor', 'firstName lastName businessName')
      .populate('serviceTemplate', 'title description');

    if (!service) {
      return next(new ApiError(404, 'Deleted vendor service not found'));
    }

    res.status(200).json(new ApiResponse(200, service, 'Vendor service restored successfully'));
  } catch (error) {
    console.error('Error restoring vendor service:', error);
    return next(new ApiError(500, error.message || 'Failed to restore vendor service'));
  }
});

// Update service pricing
const updateServicePricing = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { basePrice, discountPrice, currency, taxIncluded } = req.body;

    if (basePrice <= 0) {
      return next(new ApiError(400, 'Base price must be greater than 0'));
    }

    if (discountPrice && discountPrice >= basePrice) {
      return next(new ApiError(400, 'Discount price must be less than base price'));
    }

    const updateData = {
      'pricing.basePrice': basePrice,
      updatedBy: req.user?._id,
    };

    if (discountPrice !== undefined) updateData['pricing.discountPrice'] = discountPrice;
    if (currency) updateData['pricing.currency'] = currency;
    if (taxIncluded !== undefined) updateData['pricing.taxIncluded'] = taxIncluded;

    const service = await VendorService.findOneAndUpdate({ _id: id, isDeleted: false }, updateData, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return next(new ApiError(404, 'Vendor service not found'));
    }

    res.status(200).json(new ApiResponse(200, service.pricing, 'Service pricing updated successfully'));
  } catch (error) {
    console.error('Error updating service pricing:', error);
    return next(new ApiError(500, error.message || 'Failed to update service pricing'));
  }
});

// Get service statistics
const getServiceStatistics = asyncHandler(async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    const stats = await VendorService.aggregate([
      { $match: { vendor: mongoose.Types.ObjectId(vendorId), isDeleted: false } },
      {
        $group: {
          _id: null,
          totalServices: { $sum: 1 },
          activeServices: { $sum: { $cond: ['$isActive', 1, 0] } },
          approvedServices: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          pendingServices: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          featuredServices: { $sum: { $cond: ['$isFeatured', 1, 0] } },
          totalBookings: { $sum: '$bookingStats.totalBookings' },
          completedBookings: { $sum: '$bookingStats.completedBookings' },
          averageRating: { $avg: '$ratings.average' },
          totalRatings: { $sum: '$ratings.totalCount' },
        },
      },
    ]);

    const statistics = stats[0] || {
      totalServices: 0,
      activeServices: 0,
      approvedServices: 0,
      pendingServices: 0,
      featuredServices: 0,
      totalBookings: 0,
      completedBookings: 0,
      averageRating: 0,
      totalRatings: 0,
    };

    res.status(200).json(new ApiResponse(200, statistics, 'Service statistics fetched successfully'));
  } catch (error) {
    console.error('Error fetching service statistics:', error);
    return next(new ApiError(500, error.message || 'Failed to fetch service statistics'));
  }
});

export {
  getAllVendorServices,
  getVendorServiceById,
  getServicesByVendor,
  updateVendorService,
  updateServiceStatus,
  toggleServiceAvailability,
  deleteVendorService,
  restoreVendorService,
  updateServicePricing,
  getServiceStatistics,
};
