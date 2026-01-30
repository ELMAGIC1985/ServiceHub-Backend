import { Membership } from '../../models/membership.model.js';
import { MembershipPlan } from '../../models/membershipPlan.model.js';

export const assignMembership = async (req, res) => {
  try {
    const { memberType, memberId, planId, autoRenew = false, paymentDetails } = req.body;

    if (!memberType || !memberId || !planId) {
      return res.status(400).json({ message: 'Member type, member ID, and plan ID are required.' });
    }

    const plan = await MembershipPlan.findById(planId);

    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: 'Membership plan not found or inactive' });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + plan.durationInDays * 24 * 60 * 60 * 1000);

    const membership = await Membership.create({
      memberType,
      memberId,
      memberTypeRef: memberType === 'USER' ? 'User' : 'Vendor',
      planId,
      startDate,
      endDate,
      autoRenew,
      paymentDetails,
      membershipUsage: plan.price * 2,
    });

    res.status(201).json({ message: 'Membership assigned successfully', data: membership });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get all memberships
export const getAllMemberships = async (req, res) => {
  try {
    // Extract filters from query params
    const { memberType, status, planId, memberId } = req.query;

    // Build dynamic filter object
    const filter = {};
    if (memberType) filter.memberType = memberType;
    if (status) filter.status = status;
    if (planId) filter.planId = planId;
    if (memberId) filter.memberId = memberId;

    const memberships = await Membership.find(filter)
      .populate('planId', 'name price durationInDays benefits')
      .populate('memberId', 'firstName lastName businessName email phoneNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ message: 'Memberships fetched successfully', data: memberships });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get a single membership
export const getMembershipById = async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id)
      .populate('planId', 'name price durationInDays benefits')
      .populate('memberId', 'firstName lastName businessName email phoneNumber');

    if (!membership) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    res.status(200).json(membership);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update membership (e.g., change status, autoRenew, etc.)
export const updateMembership = async (req, res) => {
  try {
    const updatedMembership = await Membership.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedMembership) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    res.status(200).json({ message: 'Membership updated successfully', data: updatedMembership });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete membership
export const deleteMembership = async (req, res) => {
  try {
    const deletedMembership = await Membership.findByIdAndDelete(req.params.id);
    if (!deletedMembership) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    res.status(200).json({ message: 'Membership deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
