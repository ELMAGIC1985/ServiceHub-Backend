import mongoose from 'mongoose';
import { AddOn, ServiceTemplate } from '../../models/index.js';
import { formatAddOns } from './utils/helpers.js';

export const createAddOn = async (req, res) => {
  try {
    const { name, description, pricing, tags, images } = req.body;
    const adminId = req.user?._id;

    const newAddOn = await AddOn.create({
      name,
      description,
      pricing,
      tags,
      images,
      createdBy: adminId,
      updatedBy: adminId,
    });

    res.status(201).json({
      success: true,
      message: 'Add-on created successfully',
      data: newAddOn,
    });
  } catch (error) {
    console.error('Error creating add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create add-on',
      error: error.message,
    });
  }
};

export const getAllAddOns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      priceRange,
      serviceTemplate,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {
      isDeleted: false,
    };

    /* ---------------- Status Filter ---------------- */
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    if (status === 'deleted') filter.isDeleted = true;

    /* ---------------- Service Template ---------------- */
    if (serviceTemplate) {
      filter.serviceTemplates = new mongoose.Types.ObjectId(serviceTemplate);
    }

    /* ---------------- Price Range (FIXED) ---------------- */
    if (priceRange) {
      let minPrice = 0;
      let maxPrice = Number.MAX_SAFE_INTEGER;

      if (priceRange.includes('-')) {
        const [min, max] = priceRange.split('-');
        minPrice = Number(min);
        maxPrice = Number(max);
      }

      if (priceRange.includes('+')) {
        minPrice = Number(priceRange.replace('+', ''));
      }

      filter['pricing.price'] = {
        $gte: minPrice,
        $lte: maxPrice,
      };
    }

    /* ---------------- Search ---------------- */
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    /* ---------------- Pagination ---------------- */
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalAddOns = await AddOn.countDocuments(filter);

    const addOns = await AddOn.find(filter)
      .populate('createdBy', 'name email')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        addOns,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalAddOns / limitNum),
          total: totalAddOns,
          limit: limitNum,
          hasNextPage: pageNum < Math.ceil(totalAddOns / limitNum),
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching add-ons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch add-ons',
      error: error.message,
    });
  }
};

export const getAddOnById = async (req, res) => {
  try {
    const { id } = req.params;

    const addOn = await AddOn.findOne({
      $or: [{ _id: id }, { slug: id }],
      isDeleted: false,
    }).populate('serviceTemplate', 'title slug category subCategory');

    if (!addOn) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found',
      });
    }

    res.status(200).json({
      success: true,
      data: addOn,
    });
  } catch (error) {
    console.error('Error fetching add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch add-on',
      error: error.message,
    });
  }
};

export const updateAddOn = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id;

    const updatedAddOn = await AddOn.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        ...req.body,
        updatedBy: adminId,
      },
      { new: true, runValidators: true }
    );

    if (!updatedAddOn) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found or already deleted',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Add-on updated successfully',
      data: updatedAddOn,
    });
  } catch (error) {
    console.error('Error updating add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update add-on',
      error: error.message,
    });
  }
};

export const softDeleteAddOn = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id;

    const deletedAddOn = await AddOn.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, updatedBy: adminId },
      { new: true }
    );

    if (!deletedAddOn) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found or already deleted',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Add-on deleted successfully',
      data: deletedAddOn,
    });
  } catch (error) {
    console.error('Error deleting add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete add-on',
      error: error.message,
    });
  }
};

export const hardDeleteAddOn = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedAddOn = await AddOn.findByIdAndDelete(id);

    if (!deletedAddOn) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Add-on permanently deleted',
    });
  } catch (error) {
    console.error('Error hard deleting add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete add-on',
      error: error.message,
    });
  }
};

export const assignAddOnToServiceTemplates = async (req, res) => {
  try {
    const { addOnId, serviceTemplateIds } = req.body;

    if (!addOnId || !serviceTemplateIds || !Array.isArray(serviceTemplateIds) || serviceTemplateIds.length === 0) {
      return res.status(400).json({
        message: 'addOnId and serviceTemplateIds (array) are required.',
      });
    }

    // Validate add-on existence
    const addOn = await AddOn.findById(addOnId);
    if (!addOn) {
      return res.status(404).json({ message: 'Add-on not found' });
    }

    // Validate service template IDs
    const validServiceTemplates = await ServiceTemplate.find({
      _id: { $in: serviceTemplateIds },
    });

    if (validServiceTemplates.length !== serviceTemplateIds.length) {
      return res.status(400).json({ message: 'One or more service templates are invalid.' });
    }

    // Update the add-on's serviceTemplates array
    await AddOn.findByIdAndUpdate(
      addOnId,
      {
        $addToSet: { serviceTemplates: { $each: serviceTemplateIds } }, // Avoid duplicates
      },
      { new: true }
    );

    res.status(200).json({
      message: 'Add-on assigned to service templates successfully',
      addOnId,
      serviceTemplateIds,
    });
  } catch (error) {
    console.error('Error assigning add-on to service templates:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getAddOnsByServiceTemplate = async (req, res) => {
  try {
    const { serviceTemplateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(serviceTemplateId)) {
      return res.status(400).json({ message: 'Invalid service template ID' });
    }

    const serviceTemplate = await ServiceTemplate.findById(serviceTemplateId)
      .select('serviceAddOns')
      .populate('serviceAddOns');

    return res.status(200).json({
      success: true,
      data: formatAddOns(serviceTemplate.serviceAddOns),
    });
  } catch (error) {
    console.error('Error fetching add-ons for service template:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const assignAddOnsToServiceTemplate = async (req, res) => {
  try {
    const { serviceTemplateId, addOnIds } = req.body;

    if (!serviceTemplateId || !Array.isArray(addOnIds) || addOnIds.length === 0) {
      return res.status(400).json({
        message: 'serviceTemplateId and addOnIds (array) are required.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceTemplateId)) {
      return res.status(400).json({ message: 'Invalid service template ID' });
    }

    // Validate add-ons
    const validAddOns = await AddOn.find({
      _id: { $in: addOnIds },
      isDeleted: false,
    });

    if (validAddOns.length !== addOnIds.length) {
      return res.status(400).json({ message: 'One or more add-ons are invalid or deleted' });
    }

    // Step 1: Update ServiceTemplate -> Add addOns
    await ServiceTemplate.findByIdAndUpdate(
      serviceTemplateId,
      { $addToSet: { serviceAddOns: { $each: addOnIds } } },
      { new: true }
    );

    // Step 2: Update AddOn -> Add serviceTemplate
    await AddOn.updateMany({ _id: { $in: addOnIds } }, { $addToSet: { serviceTemplates: serviceTemplateId } });

    return res.status(200).json({
      message: 'Add-ons successfully assigned to service template',
      serviceTemplateId,
      addOnIds,
    });
  } catch (error) {
    console.error('Error assigning add-ons:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getServiceTemplateWithAddOns = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceTemplate = await ServiceTemplate.findById(id).populate({
      path: 'serviceAddOns',
      select: 'name description pricing images',
    });

    if (!serviceTemplate) {
      return res.status(404).json({ message: 'Service template not found' });
    }

    res.status(200).json(serviceTemplate);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
