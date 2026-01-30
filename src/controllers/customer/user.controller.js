import mongoose from 'mongoose';
import { Address, Membership, MembershipPlan, User } from '../../models/index.js';
import httpResponse from '../../utils/httpResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { restrictedFields, updateProfileSchema } from '../../validators/user.validation.js';
import { formatMembershipData, getProfileStatus } from './utils/helpers.js';
import simpleImageService from '../../services/image/SimpleImageService.js';

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user; // From auth middleware

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    // Check authorization - users can only access their own profile unless they're admin
    const isAdmin = requestingUser?.roles?.includes('admin');

    const baseFields = '-password -refreshToken';
    const adminFields = baseFields; // Admin can see all fields
    const userFields = `${baseFields} -firebaseUID`; // Users can't see their own firebaseUID

    const selectFields = isAdmin ? adminFields : userFields;

    // Find user with populated references
    const user = await User.findById(id)
      .select(selectFields)
      .populate('address', 'street area city state country pincode type')
      .populate('addresses.address')
      .populate('wallet', 'balance currency status')
      .populate('membership')
      .populate('referredBy', 'firstName lastName userName email')
      .populate('referredUsers', 'firstName lastName userName email createdAt')
      .populate({
        path: 'bookings',
        select: 'date timeSlot status paymentStatus pricing rating createdAt',
        populate: [
          { path: 'serviceTemplate', select: 'title description price' },
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' },
          { path: 'product', select: 'name price' },
          { path: 'address', select: 'street area city state country pincode type' },
          { path: 'pricing' },
          {
            path: 'vendorSearch.assignedVendor.vendorId',
            model: 'Vendor',
            select: 'firstName lastName rating',
          },
        ],
      })
      .populate('coupons', 'code discountType discountValue validUntil isUsed')
      .lean()
      .exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const [bookingStats, supportTickets] = await Promise.all([
      // Get booking statistics
      mongoose.connection.db
        .collection('bookings')
        .aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(id) } },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              totalSpent: { $sum: '$amount' },
              completedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
              },
            },
          },
        ])
        .toArray(),

      // Get support tickets if available
      mongoose.connection.db
        .collection('supporttickets')
        .find({
          userId: new mongoose.Types.ObjectId(id),
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
    ]);

    const stats = bookingStats[0] || { totalBookings: 0, totalSpent: 0, completedBookings: 0 };

    // Calculate enhanced user data matching your desired format
    const enhancedUser = {
      _id: user._id,
      firebaseUID: isAdmin ? user.firebaseUID : undefined,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      userName: user.userName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      dob: user.dob,
      avatar: user.avatar,
      roles: user.role,
      isVerified: user.isVerified,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      referralCode: user.referralCode,
      referralReward: user.referralReward || 0,
      referredBy: user.referredBy,
      referredUsers: user.referredUsers || [],

      // Calculated fields
      totalBookings: stats.totalBookings,
      totalSpent: stats.totalSpent,
      lastActive: user.updatedAt,
      joinedDate: user.createdAt,
      membership: user.membership,

      // Enhanced addresses format
      addresses: user.addresses || [],

      bookings: user.bookings.map((b) => {
        const vendor = b?.vendorSearch?.assignedVendor?.vendorId;
        delete b.vendorSearch;
        return {
          ...b,
          vendor,
        };
      }),

      fcmTokens: user.fcmToken || [],
    };

    // Remove sensitive fields that shouldn't be exposed even to the user
    if (!isAdmin) {
      delete enhancedUser.firebaseUID;
      delete enhancedUser.googleId;
      delete enhancedUser.facebookId;
      delete enhancedUser.socketId;
    }

    const response = {
      success: true,
      data: enhancedUser, // Direct user object like your mock data
      message: 'User retrieved successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching user by ID:', error);

    const errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

export const getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Use the same logic as getUserById but for current user
    req.params.id = userId.toString();
    await getUserById(req, res);
  } catch (error) {
    console.error('Error fetching current user profile:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select('-refreshToken -googleId -facebookId -socketId')
      .populate('address')
      .populate('wallet')
      .populate('membership')
      .populate('coupons')
      .populate('referredBy', 'firstName lastName phoneNumber')
      .populate('referredUsers', 'firstName lastName phoneNumber');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Convert to plain object for easy manipulation
    const userObj = user.toObject();

    console.log('user', userObj);

    let membershipData = null;
    if (userObj.membership) {
      const membership = await Membership.findById(userObj.membership);
      const plan = membership ? await MembershipPlan.findById(membership.planId) : null;
      membershipData = formatMembershipData(membership, plan);
    }

    const profileStatus = getProfileStatus(user);

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        ...userObj,
        membership: membershipData,
        profileCompleted: profileStatus?.profileCompleted,
        missingFields: profileStatus?.missingFields,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    let updateData = { ...req.body };

    restrictedFields.forEach((field) => delete updateData[field]);

    const { error, value } = updateProfileSchema.validate(updateData, {
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message,
      });
    }

    updateData = value;

    let imageUrl = null;
    if (req.file) {
      const urls = await simpleImageService.processAndUploadSingleImage(req.file, 'avatar');
      imageUrl = urls[0];
    }

    if (imageUrl) {
      updateData.avatar = imageUrl?.url;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
      .select('-refreshToken -googleId -facebookId -socketId')
      .populate('address')
      .populate('wallet')
      .populate('membership')
      .populate('referredBy', 'firstName lastName phoneNumber');

    if (!updatedUser) {
      return res.status(404).json(new ApiResponse(404, null, 'User not found'));
    }

    const profileStatus = getProfileStatus(updatedUser);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          user: { ...updatedUser.toObject(), ...profileStatus },
        },
        'Profile updated successfully'
      )
    );
  } catch (error) {
    console.error('Update profile error:', error);

    // Mongoose duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json(new ApiResponse(400, null, `${field} already exists`));
    }

    return res.status(500).json(new ApiResponse(500, null, 'Internal server error'));
  }
};

export const addUserAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    line1,
    line2,
    street,
    city,
    state,
    country,
    postalCode,
    landmark,
    addressType,
    location,
    isDefault = false,
  } = req.body;

  // Validate required fields
  if (!city || !state || !country || !postalCode) {
    return httpResponse(res, 400, 'City, state, country, and postal code are required');
  }

  if (location && location.coordinates) {
    const [lng, lat] = location.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return httpResponse(res, 400, 'Invalid location coordinates. Must be numbers [longitude, latitude]');
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return httpResponse(
        res,
        400,
        'Invalid location coordinates. Longitude must be between -180 and 180, latitude between -90 and 90'
      );
    }
  }

  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return httpResponse(res, 404, 'User not found');
    }

    // If this is set as default, unset other default addresses
    if (isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    // Create new address
    const newAddress = new Address({
      line1,
      line2,
      street,
      city,
      state,
      country,
      postalCode,
      landmark,
      addressType: addressType || 'other',
      location: location || { type: 'Point', coordinates: [0, 0] },
    });

    // Save the address
    await newAddress.save();

    // Add address reference to user
    user.addresses.push({
      address: newAddress._id,
      isDefault: isDefault || user.addresses.length === 0, // First address is default
    });

    // Save user
    await user.save();

    // Populate the newly added address
    await user.populate('addresses.address');

    const addedAddress = user.addresses[user.addresses.length - 1];

    return httpResponse(res, 201, 'Address added successfully', {
      address: addedAddress,
      totalAddresses: user.addresses.length,
    });
  } catch (error) {
    console.error('Error adding address:', error);
    return httpResponse(res, 500, 'Failed to add address', { error: error.message });
  }
});

export const updateUserAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { addressId } = req.params;
  const { line1, line2, street, city, state, country, postalCode, landmark, addressType, location, isDefault } =
    req.body;

  // Validate required fields if they are being updated
  const updateData = {};
  if (line1 !== undefined) updateData.line1 = line1;
  if (line2 !== undefined) updateData.line2 = line2;
  if (street !== undefined) updateData.street = street;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (country !== undefined) updateData.country = country;
  if (postalCode !== undefined) updateData.postalCode = postalCode;
  if (landmark !== undefined) updateData.landmark = landmark;
  if (addressType !== undefined) updateData.addressType = addressType;
  if (location !== undefined) updateData.location = location;

  // Validate location coordinates if provided
  if (location && location.coordinates) {
    const [lng, lat] = location.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return httpResponse(res, 400, 'Invalid location coordinates. Must be numbers [longitude, latitude]');
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return httpResponse(
        res,
        400,
        'Invalid location coordinates. Longitude must be between -180 and 180, latitude between -90 and 90'
      );
    }
  }

  try {
    // Find the user and check if address belongs to them
    const user = await User.findById(userId).populate('addresses.address');
    if (!user) {
      return httpResponse(res, 404, 'User not found');
    }

    // Find the address in user's addresses array
    const userAddressIndex = user.addresses.findIndex((addr) => addr.address._id.toString() === addressId);

    if (userAddressIndex === -1) {
      return httpResponse(res, 404, 'Address not found or does not belong to this user');
    }

    // Update the address document
    const updatedAddress = await Address.findByIdAndUpdate(addressId, updateData, { new: true, runValidators: true });

    if (!updatedAddress) {
      return httpResponse(res, 404, 'Address not found');
    }

    // Handle default address logic
    if (isDefault !== undefined) {
      if (isDefault) {
        // Unset all other addresses as default
        user.addresses.forEach((addr, index) => {
          addr.isDefault = index === userAddressIndex;
        });
      } else {
        // If unsetting default, make sure at least one address remains default
        const hasOtherDefault = user.addresses.some((addr, index) => index !== userAddressIndex && addr.isDefault);

        if (!hasOtherDefault && user.addresses.length > 1) {
          // Set the first address (other than current) as default
          const otherIndex = userAddressIndex === 0 ? 1 : 0;
          user.addresses[otherIndex].isDefault = true;
        }

        user.addresses[userAddressIndex].isDefault = false;
      }

      await user.save();
    }

    return httpResponse(res, 200, 'Address updated successfully', {
      address: {
        ...updatedAddress.toObject(),
        isDefault: user.addresses[userAddressIndex].isDefault,
      },
    });
  } catch (error) {
    console.error('Error updating address:', error);
    return httpResponse(res, 500, 'Failed to update address', { error: error.message });
  }
});

export const getUserAddresses = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await User.findById(userId).populate('addresses.address').select('addresses');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const addresses = user.addresses.map((addr) => ({
      ...addr.address.toObject(),
      isDefault: addr.isDefault,
      userAddressId: addr._id,
    }));

    return res.status(200).json({
      success: true,
      message: 'Addresses retrieved successfully',
      data: {
        addresses,
        totalAddresses: addresses.length,
      },
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses',
      error: error.message,
    });
  }
});

export const deleteUserAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { addressId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Find the address index in user's addresses array
    const addressIndex = user.addresses.findIndex((addr) => addr.address.toString() === addressId);

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to this user',
      });
    }

    const wasDefault = user.addresses[addressIndex].isDefault;

    // Remove address from user's addresses array
    user.addresses.splice(addressIndex, 1);

    // If the deleted address was default and there are other addresses, set first one as default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    // Delete the address document
    await Address.findByIdAndDelete(addressId);

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      data: {
        totalAddresses: user.addresses.length,
      },
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message,
    });
  }
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { addressId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Find the address index
    const addressIndex = user.addresses.findIndex((addr) => addr.address.toString() === addressId);

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to this user',
      });
    }

    // Unset all addresses as default
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });

    // Set the specified address as default
    user.addresses[addressIndex].isDefault = true;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
    });
  } catch (error) {
    console.error('Error setting default address:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set default address',
      error: error.message,
    });
  }
});

export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      role = '',
      isVerified = '',
      isEmailVerified = '',
      isMobileVerified = '',
    } = req.query;

    // ---------- 1. Build match conditions for filtering ----------
    const matchConditions = {};

    // Search functionality - searches in firstName, lastName, email, phoneNumber
    if (search.trim() !== '') {
      matchConditions.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Role filter
    if (role.trim() !== '') {
      matchConditions.role = role;
    }

    // Verification status filters
    if (isVerified !== '') {
      matchConditions.isVerified = isVerified === 'true';
    }

    if (isEmailVerified !== '') {
      matchConditions.isEmailVerified = isEmailVerified === 'true';
    }

    if (isMobileVerified !== '') {
      matchConditions.isMobileVerified = isMobileVerified === 'true';
    }

    // ---------- 2. Convert pagination params ----------
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    // ---------- 3. Build sort object ----------
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // ---------- 4. Get paginated results ----------
    const [users, totalUsers] = await Promise.all([
      User.find(matchConditions)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .select('-refreshToken -fcmToken')
        .populate('addresses.address')
        .populate('membership'),

      User.countDocuments(matchConditions),
    ]);

    // ---------- 5. Calculate pagination info ----------
    const totalPages = Math.ceil(totalUsers / limitNum);

    const paginationInfo = {
      currentPage: pageNum,
      totalPages,
      totalUsers,
      usersPerPage: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      nextPage: pageNum < totalPages ? pageNum + 1 : null,
      prevPage: pageNum > 1 ? pageNum - 1 : null,
    };

    // ---------- 6. Return response ----------
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          users,
          pagination: paginationInfo,
        },
        `Successfully fetched ${users.length} user(s)`
      )
    );
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    throw new ApiError(500, 'Internal server error while fetching users');
  }
});

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'User is already deleted',
      });
    }

    // Soft delete
    user.isDeleted = true;
    user.isBlocked = true; // Prevent login
    user.refreshToken = null; // Invalidate any refresh tokens

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully (soft delete)',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isDeleted: user.isDeleted,
      },
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
    });
  }
};
