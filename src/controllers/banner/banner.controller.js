import { validationResult } from 'express-validator';
import logger from '../../utils/logger.js';
import Banner from '../../models/banner.model.js';

class BannerController {
  async createBanner(req, res) {
    console.log('create banner', req.body);
    try {
      // const errors = validationResult(req);
      // if (!errors.isEmpty()) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'Validation failed',
      //     errors: errors.array(),
      //   });
      // }

      const {
        title,
        subtitle,
        description,
        imageUrl,
        imageAlt,
        type,
        position,
        isActive,
        startDate,
        endDate,
        clickAction,
        targetAudience,
      } = req.body;

      const banner = new Banner({
        title,
        subtitle,
        description,
        imageUrl,
        imageAlt,
        type,
        position,
        isActive,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        clickAction,
        targetAudience,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });

      const savedBanner = await banner.save();

      logger.info('Banner created successfully', {
        bannerId: savedBanner._id,
        title: savedBanner.title,
        // createdBy: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: 'Banner created successfully',
        data: savedBanner,
      });
    } catch (error) {
      logger.error('Error creating banner', {
        error: error.message,
        stack: error.stack,
        // userId: req.user?.id,
      });

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async getAllBanners(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        isActive,
        sortBy = 'position',
        sortOrder = 'asc',
        search,
        activeOnly = false,
      } = req.query;

      // Build filter object
      const filter = {};

      if (type) {
        filter.type = type;
      }

      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { subtitle: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // If activeOnly is true, filter for currently active banners
      if (activeOnly === 'true') {
        const now = new Date();
        filter.isActive = true;
        filter.startDate = { $lte: now };
        filter.$or = [{ endDate: { $gte: now } }, { endDate: null }];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      filter.isDeleted = false;

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query with population
      const [banners, totalCount] = await Promise.all([
        Banner.find(filter)
          // .populate('createdBy', 'firstName lastName email')
          // .populate('updatedBy', 'firstName lastName email')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Banner.countDocuments(filter),
      ]);

      // Add virtual field manually since we're using lean()
      const bannersWithVirtuals = banners.map((banner) => {
        const now = new Date();
        const isWithinDateRange = banner.startDate <= now && (!banner.endDate || banner.endDate >= now);

        return {
          ...banner,
          isCurrentlyActive: banner.isActive && isWithinDateRange,
        };
      });

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.status(200).json({
        success: true,
        message: 'Banners retrieved successfully',
        data: {
          banners: bannersWithVirtuals,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            limit: parseInt(limit),
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching banners', {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async getActiveBanners(req, res) {
    try {
      const { type, limit = 10 } = req.query;

      const now = new Date();
      const filter = {
        isActive: true,
        startDate: { $lte: now },
        $or: [{ endDate: { $gte: now } }, { endDate: null }],
      };

      if (type) {
        filter.type = type;
      }

      const banners = await Banner.find(filter)
        .select('-analytics -createdBy -updatedBy')
        .sort({ position: 1, createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      // Increment impressions for analytics
      const bannerIds = banners.map((banner) => banner._id);
      await Banner.updateMany({ _id: { $in: bannerIds } }, { $inc: { 'analytics.impressions': 1 } });

      res.status(200).json({
        success: true,
        message: 'Active banners retrieved successfully',
        data: banners,
      });
    } catch (error) {
      logger.error('Error fetching active banners', {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async getBannerById(req, res) {
    try {
      const { id } = req.params;

      const banner = await Banner.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email');

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Banner not found',
        });
      }

      // Increment views for analytics
      await Banner.findByIdAndUpdate(id, {
        $inc: { 'analytics.views': 1 },
      });

      res.status(200).json({
        success: true,
        message: 'Banner retrieved successfully',
        data: banner,
      });
    } catch (error) {
      logger.error('Error fetching banner by ID', {
        bannerId: req.params.id,
        error: error.message,
      });

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner ID',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async updateBanner(req, res) {
    try {
      const { id } = req.params;

      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const updateData = {
        ...req.body,
        updatedBy: req.user._id,
      };

      // Handle date fields
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = updateData.endDate === '' ? null : new Date(updateData.endDate);
      }

      const banner = await Banner.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate(
        'createdBy updatedBy',
        'firstName lastName email'
      );

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Banner not found',
        });
      }

      logger.info('Banner updated successfully', {
        bannerId: banner._id,
        title: banner.title,
        updatedBy: req.user._id,
      });

      res.status(200).json({
        success: true,
        message: 'Banner updated successfully',
        data: banner,
      });
    } catch (error) {
      logger.error('Error updating banner', {
        bannerId: req.params.id,
        error: error.message,
        userId: req.user?._id,
      });

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        });
      }

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner ID',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async toggleBannerStatus(req, res) {
    try {
      const { id } = req.params;

      const banner = await Banner.findById(id);

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Banner not found',
        });
      }

      banner.isActive = !banner.isActive;
      banner.updatedBy = req.user.id;
      await banner.save();

      logger.info('Banner status toggled', {
        bannerId: banner._id,
        newStatus: banner.isActive,
        updatedBy: req.user.id,
      });

      res.status(200).json({
        success: true,
        message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { isActive: banner.isActive },
      });
    } catch (error) {
      logger.error('Error toggling banner status', {
        bannerId: req.params.id,
        error: error.message,
        userId: req.user?.id,
      });

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner ID',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async updateBannerPosition(req, res) {
    try {
      const { id } = req.params;
      const { position } = req.body;

      if (typeof position !== 'number' || position < 0) {
        return res.status(400).json({
          success: false,
          message: 'Position must be a non-negative number',
        });
      }

      const banner = await Banner.findByIdAndUpdate(
        id,
        {
          position,
          updatedBy: req.user.id,
        },
        { new: true }
      );

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Banner not found',
        });
      }

      logger.info('Banner position updated', {
        bannerId: banner._id,
        newPosition: position,
        updatedBy: req.user.id,
      });

      res.status(200).json({
        success: true,
        message: 'Banner position updated successfully',
        data: { position: banner.position },
      });
    } catch (error) {
      logger.error('Error updating banner position', {
        bannerId: req.params.id,
        error: error.message,
        userId: req.user?.id,
      });

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner ID',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async deleteBanner(req, res) {
    try {
      const { id } = req.params;

      console.log('delete banner', id);

      const banner = await Banner.findById(id);

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Banner not found',
        });
      }

      banner.isDeleted = true;
      banner.updatedBy = req.user._id;

      await banner.save();

      logger.info('Banner deleted successfully', {
        bannerId: banner._id,
        title: banner.title,
        deletedBy: req.user._id,
      });

      res.status(200).json({
        success: true,
        message: 'Banner deleted successfully',
        data: { deletedId: id },
      });
    } catch (error) {
      logger.error('Error deleting banner', {
        bannerId: req.params.id,
        error: error.message,
        userId: req.user?.id,
      });

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner ID',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async trackBannerClick(req, res) {
    try {
      const { id } = req.params;

      const banner = await Banner.findByIdAndUpdate(id, { $inc: { 'analytics.clicks': 1 } }, { new: true });

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Banner not found',
        });
      }

      logger.debug('Banner click tracked', {
        bannerId: banner._id,
        totalClicks: banner.analytics.clicks,
      });

      res.status(200).json({
        success: true,
        message: 'Click tracked successfully',
        data: {
          clickAction: banner.clickAction,
          analytics: banner.analytics,
        },
      });
    } catch (error) {
      logger.error('Error tracking banner click', {
        bannerId: req.params.id,
        error: error.message,
      });

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner ID',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async getBannerAnalytics(req, res) {
    try {
      const { id } = req.params;

      const banner = await Banner.findById(id).select('title analytics createdAt isCurrentlyActive');

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Banner not found',
        });
      }

      // Calculate click-through rate
      const ctr =
        banner.analytics.impressions > 0
          ? ((banner.analytics.clicks / banner.analytics.impressions) * 100).toFixed(2)
          : 0;

      res.status(200).json({
        success: true,
        message: 'Banner analytics retrieved successfully',
        data: {
          bannerId: banner._id,
          title: banner.title,
          analytics: {
            ...banner.analytics.toObject(),
            clickThroughRate: `${ctr}%`,
          },
          isCurrentlyActive: banner.isCurrentlyActive,
          createdAt: banner.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error fetching banner analytics', {
        bannerId: req.params.id,
        error: error.message,
      });

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner ID',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  async bulkBannerOperations(req, res) {
    try {
      const { operation, bannerIds, data } = req.body;

      if (!operation || !bannerIds || !Array.isArray(bannerIds)) {
        return res.status(400).json({
          success: false,
          message: 'Operation and bannerIds array are required',
        });
      }

      let result;

      switch (operation) {
        case 'activate':
          result = await Banner.updateMany(
            { _id: { $in: bannerIds } },
            {
              isActive: true,
              updatedBy: req.user.id,
            }
          );
          break;

        case 'deactivate':
          result = await Banner.updateMany(
            { _id: { $in: bannerIds } },
            {
              isActive: false,
              updatedBy: req.user.id,
            }
          );
          break;

        case 'delete':
          result = await Banner.deleteMany({ _id: { $in: bannerIds } });
          break;

        case 'update_position':
          if (!data || typeof data.position !== 'number') {
            return res.status(400).json({
              success: false,
              message: 'Position data is required for position update',
            });
          }

          result = await Banner.updateMany(
            { _id: { $in: bannerIds } },
            {
              position: data.position,
              updatedBy: req.user.id,
            }
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid operation. Supported: activate, deactivate, delete, update_position',
          });
      }

      logger.info('Bulk banner operation completed', {
        operation,
        affectedCount: result.modifiedCount || result.deletedCount,
        bannerIds,
        userId: req.user.id,
      });

      res.status(200).json({
        success: true,
        message: `Bulk ${operation} completed successfully`,
        data: {
          operation,
          affectedCount: result.modifiedCount || result.deletedCount,
          bannerIds,
        },
      });
    } catch (error) {
      logger.error('Error in bulk banner operations', {
        error: error.message,
        operation: req.body.operation,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
}

const bannerController = new BannerController();

export { bannerController };
