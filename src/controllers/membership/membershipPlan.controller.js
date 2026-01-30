import { MembershipPlan } from '../../models/membershipPlan.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import slugify from 'slugify';

export const createMembershipPlan = async (req, res, next) => {
  try {
    const { name, description, price, durationInDays, benefits } = req.body;

    if (!name || !price || !durationInDays) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and duration are required.',
      });
    }

    // 1️⃣ Generate slug from name
    let slug = slugify(name, { lower: true, strict: true });

    // 2️⃣ Check if a plan with this slug already exists
    const existingPlan = await MembershipPlan.findOne({ slug });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: `A membership plan with this name already exists.`,
      });
    }

    // 3️⃣ Create new plan
    const plan = await MembershipPlan.create({
      name,
      slug, // manually set slug
      description,
      price,
      durationInDays,
      benefits,
      createdBy: req.user?._id,
    });

    res.status(201).json({
      success: true,
      message: 'Membership plan created successfully',
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllMembershipPlans = async (req, res) => {
  try {
    await MembershipPlan.syncIndexes();
    const plans = await MembershipPlan.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, plans));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMembershipPlanById = async (req, res) => {
  try {
    const plan = await MembershipPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Membership plan not found' });
    }
    res.status(200).json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMembershipPlan = async (req, res) => {
  try {
    const updatedPlan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedPlan) {
      return res.status(404).json({ message: 'Membership plan not found' });
    }

    res.status(200).json({ message: 'Membership plan updated successfully', data: updatedPlan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMembershipPlan = async (req, res) => {
  try {
    const deletedPlan = await MembershipPlan.findByIdAndDelete(req.params.id);
    if (!deletedPlan) {
      return res.status(404).json({ message: 'Membership plan not found' });
    }

    res.status(200).json({ message: 'Membership plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
