import { VendorService } from '../../models/vendorServiceSchema.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

// ==================== CONSTANTS ====================
const SEARCH_CONSTANTS = {
  DEFAULT_RADIUS: 10, // km
  MAX_RADIUS: 50, // km
  MIN_RADIUS: 1, // km
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Validates and sanitizes search parameters
 */
const validateSearchParams = (params) => {
  const {
    lat,
    lng,
    radius = SEARCH_CONSTANTS.DEFAULT_RADIUS,
    minPrice,
    maxPrice,
    minRating,
    limit = SEARCH_CONSTANTS.DEFAULT_LIMIT,
    offset = 0,
    sortBy = 'distance',
    category,
    subCategory,
    search,
  } = params;

  // Validate required location parameters
  if (!lat || !lng) {
    throw new Error('Latitude and longitude are required');
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new Error('Invalid latitude or longitude values');
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  // Validate and sanitize other parameters
  const searchRadius = Math.min(
    Math.max(parseFloat(radius) || SEARCH_CONSTANTS.DEFAULT_RADIUS, SEARCH_CONSTANTS.MIN_RADIUS),
    SEARCH_CONSTANTS.MAX_RADIUS
  );

  const searchLimit = Math.min(
    Math.max(parseInt(limit) || SEARCH_CONSTANTS.DEFAULT_LIMIT, 1),
    SEARCH_CONSTANTS.MAX_LIMIT
  );

  return {
    latitude,
    longitude,
    radius: searchRadius,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    minRating: minRating ? parseFloat(minRating) : null,
    limit: searchLimit,
    offset: Math.max(parseInt(offset) || 0, 0),
    sortBy: ['distance', 'price', 'rating', 'popularity'].includes(sortBy) ? sortBy : 'distance',
    category: category ? mongoose.Types.ObjectId(category) : null,
    subCategory: subCategory ? mongoose.Types.ObjectId(subCategory) : null,
    search: search ? search.trim() : null,
  };
};

/**
 * Builds MongoDB aggregation pipeline for service search
 */
const buildSearchPipeline = (params) => {
  const {
    latitude,
    longitude,
    radius,
    minPrice,
    maxPrice,
    minRating,
    category,
    subCategory,
    search,
    sortBy,
    limit,
    offset,
  } = params;

  const pipeline = [
    // Stage 1: Geospatial lookup for nearby vendor services
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        distanceField: 'distance',
        maxDistance: radius * 1000, // Convert km to meters
        spherical: true,
        query: {
          isActive: true,
          isDeleted: false,
          status: 'approved',
          'availability.isAvailable': true,
        },
      },
    },

    // Stage 2: Lookup ServiceTemplate details
    {
      $lookup: {
        from: 'servicetemplates',
        localField: 'serviceTemplate',
        foreignField: '_id',
        as: 'template',
      },
    },

    // Stage 3: Unwind template (should be single document)
    {
      $unwind: '$template',
    },

    // Stage 4: Filter by template conditions
    {
      $match: {
        'template.isActive': true,
        'template.isDeleted': false,
        ...(category && {
          $or: [
            { 'template.category': category },
            { 'template.subCategory': category },
            { 'template.childCategory': category },
          ],
        }),
        ...(subCategory && {
          $or: [{ 'template.subCategory': subCategory }, { 'template.childCategory': subCategory }],
        }),
        ...(search && {
          $or: [
            { 'template.title': { $regex: search, $options: 'i' } },
            { 'template.description': { $regex: search, $options: 'i' } },
            { 'template.tags': { $in: [new RegExp(search, 'i')] } },
            { 'template.shortDescription': { $regex: search, $options: 'i' } },
          ],
        }),
      },
    },

    // Stage 5: Lookup Vendor details
    {
      $lookup: {
        from: 'vendors',
        localField: 'vendor',
        foreignField: '_id',
        as: 'vendorDetails',
      },
    },

    // Stage 6: Unwind vendor details
    {
      $unwind: '$vendorDetails',
    },

    // Stage 7: Lookup Categories for template
    {
      $lookup: {
        from: 'categories',
        localField: 'template.category',
        foreignField: '_id',
        as: 'template.categoryDetails',
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'template.subCategory',
        foreignField: '_id',
        as: 'template.subCategoryDetails',
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'template.childCategory',
        foreignField: '_id',
        as: 'template.childCategoryDetails',
      },
    },

    // Stage 8: Add computed fields
    {
      $addFields: {
        finalPrice: {
          $ifNull: ['$pricing.discountPrice', '$pricing.basePrice'],
        },
        discountPercentage: {
          $cond: {
            if: { $and: ['$pricing.discountPrice', { $gt: ['$pricing.basePrice', '$pricing.discountPrice'] }] },
            then: {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: [{ $subtract: ['$pricing.basePrice', '$pricing.discountPrice'] }, '$pricing.basePrice'],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            else: 0,
          },
        },
        distanceInKm: { $round: [{ $divide: ['$distance', 1000] }, 2] },
        vendorRating: '$vendorDetails.rating',
        isVendorVerified: '$vendorDetails.isVerified',
      },
    },

    // Stage 9: Apply price and rating filters
    {
      $match: {
        ...(minPrice && { finalPrice: { $gte: minPrice } }),
        ...(maxPrice && { finalPrice: { $lte: maxPrice } }),
        ...(minRating && { 'ratings.average': { $gte: minRating } }),
      },
    },

    // Stage 10: Group by service template to avoid duplicates and get best vendor
    {
      $group: {
        _id: '$template._id',
        serviceTemplate: { $first: '$template' },
        bestVendor: {
          $first: {
            _id: '$vendorDetails._id',
            firstName: '$vendorDetails.firstName',
            lastName: '$vendorDetails.lastName',
            rating: '$vendorDetails.rating',
            isVerified: '$vendorDetails.isVerified',
            profileImage: '$vendorDetails.profileImage',
          },
        },
        minPrice: { $min: '$finalPrice' },
        maxPrice: { $max: '$finalPrice' },
        avgRating: { $avg: '$ratings.average' },
        totalVendors: { $sum: 1 },
        minDistance: { $min: '$distanceInKm' },
        vendorServices: {
          $push: {
            vendorServiceId: '$_id',
            vendorId: '$vendor',
            vendorName: { $concat: ['$vendorDetails.firstName', ' ', '$vendorDetails.lastName'] },
            price: '$finalPrice',
            discountPercentage: '$discountPercentage',
            rating: '$ratings.average',
            distance: '$distanceInKm',
            isVerified: '$vendorDetails.isVerified',
          },
        },
      },
    },

    // Stage 11: Project final structure
    {
      $project: {
        _id: '$_id',
        title: '$serviceTemplate.title',
        slug: '$serviceTemplate.slug',
        description: '$serviceTemplate.description',
        shortDescription: '$serviceTemplate.shortDescription',
        images: '$serviceTemplate.images',
        features: '$serviceTemplate.features',
        category: {
          _id: '$serviceTemplate.category',
          name: { $arrayElemAt: ['$serviceTemplate.categoryDetails.name', 0] },
          slug: { $arrayElemAt: ['$serviceTemplate.categoryDetails.slug', 0] },
        },
        subCategory: {
          _id: '$serviceTemplate.subCategory',
          name: { $arrayElemAt: ['$serviceTemplate.subCategoryDetails.name', 0] },
          slug: { $arrayElemAt: ['$serviceTemplate.subCategoryDetails.slug', 0] },
        },
        childCategory: {
          $cond: {
            if: '$serviceTemplate.childCategory',
            then: {
              _id: '$serviceTemplate.childCategory',
              name: { $arrayElemAt: ['$serviceTemplate.childCategoryDetails.name', 0] },
              slug: { $arrayElemAt: ['$serviceTemplate.childCategoryDetails.slug', 0] },
            },
            else: null,
          },
        },
        pricing: {
          minPrice: '$minPrice',
          maxPrice: '$maxPrice',
          currency: 'INR',
        },
        ratings: {
          average: { $round: ['$avgRating', 1] },
          totalVendors: '$totalVendors',
        },
        distance: '$minDistance',
        totalVendors: '$totalVendors',
        isAvailable: { $gt: ['$totalVendors', 0] },
        bestVendor: '$bestVendor',
        tags: '$serviceTemplate.tags',
        // Include vendor services for detailed view (optional)
        vendorServices: '$vendorServices',
      },
    },

    // Stage 12: Sort results
    ...(sortBy === 'distance'
      ? [{ $sort: { distance: 1, 'ratings.average': -1 } }]
      : sortBy === 'price'
      ? [{ $sort: { 'pricing.minPrice': 1, distance: 1 } }]
      : sortBy === 'rating'
      ? [{ $sort: { 'ratings.average': -1, distance: 1 } }]
      : [{ $sort: { totalVendors: -1, 'ratings.average': -1, distance: 1 } }]), // popularity

    // Stage 13: Pagination
    { $skip: offset },
    { $limit: limit },
  ];

  return pipeline;
};

export const serviceSearch = async (req, res, next) => {
  try {
    console.log('Search query params:', req.query);

    // Validate and sanitize search parameters
    const searchParams = validateSearchParams(req.query);
    console.log('Processed search params:', searchParams);

    // Build aggregation pipeline
    const pipeline = buildSearchPipeline(searchParams);

    // Execute search query
    const [searchResults, totalCount] = await Promise.all([
      VendorService.aggregate(pipeline),
      VendorService.aggregate([
        ...pipeline.slice(0, -2), // Remove skip and limit for count
        { $count: 'total' },
      ]),
    ]);

    const total = totalCount[0]?.total || 0;
    const hasMore = searchParams.offset + searchResults.length < total;

    // Prepare response
    const response = {
      services: searchResults,
      pagination: {
        total,
        limit: searchParams.limit,
        offset: searchParams.offset,
        hasMore,
        currentPage: Math.floor(searchParams.offset / searchParams.limit) + 1,
        totalPages: Math.ceil(total / searchParams.limit),
      },
      searchInfo: {
        query: searchParams.search,
        location: {
          latitude: searchParams.latitude,
          longitude: searchParams.longitude,
          radius: searchParams.radius,
        },
        filters: {
          minPrice: searchParams.minPrice,
          maxPrice: searchParams.maxPrice,
          minRating: searchParams.minRating,
          category: searchParams.category,
          subCategory: searchParams.subCategory,
        },
        sortBy: searchParams.sortBy,
      },
    };

    console.log(`Found ${searchResults.length} services out of ${total} total matches`);

    res.status(200).json(new ApiResponse(200, response, `Found ${total} services in your area`));
  } catch (error) {
    console.error('Service search error:', error);

    // Handle validation errors differently
    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return res.status(400).json(new ApiError(400, error.message || 'Invalid search parameters'));
    }

    const apiError = new ApiError(500, error.message || 'Internal server error');
    next(apiError);
  }
};

// ==================== ADDITIONAL SEARCH METHODS ====================

/**
 * Get popular services in area (most vendors)
 */
export const getPopularServices = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10, limit = 10 } = req.query;

    const searchParams = validateSearchParams({ lat, lng, radius, limit, sortBy: 'popularity' });
    const pipeline = buildSearchPipeline(searchParams);

    const popularServices = await VendorService.aggregate(pipeline);

    res.status(200).json(new ApiResponse(200, popularServices, 'Popular services fetched successfully'));
  } catch (error) {
    console.error('Popular services error:', error);
    next(new ApiError(500, error.message || 'Failed to fetch popular services'));
  }
};

/**
 * Get services by category with location
 */
export const getServicesByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const searchParams = validateSearchParams({ ...req.query, category: categoryId });

    const pipeline = buildSearchPipeline(searchParams);
    const services = await VendorService.aggregate(pipeline);

    res.status(200).json(new ApiResponse(200, services, 'Category services fetched successfully'));
  } catch (error) {
    console.error('Category services error:', error);
    next(new ApiError(500, error.message || 'Failed to fetch category services'));
  }
};

/**
 * Quick search with text query
 */
export const quickSearch = async (req, res, next) => {
  try {
    const { q: search, lat, lng, limit = 5 } = req.query;

    if (!search || search.trim().length < 2) {
      return res.status(400).json(new ApiError(400, 'Search query must be at least 2 characters long'));
    }

    const searchParams = validateSearchParams({ lat, lng, search, limit });
    const pipeline = buildSearchPipeline(searchParams);

    const quickResults = await VendorService.aggregate(pipeline);

    res.status(200).json(new ApiResponse(200, quickResults, 'Quick search results'));
  } catch (error) {
    console.error('Quick search error:', error);
    next(new ApiError(500, error.message || 'Quick search failed'));
  }
};
