import { Admin } from '../../models/admin.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import quicker from '../../utils/quicker.js';
import config from '../../config/config.js';
import responseMessages from '../../constants/responseMessages.js';

export default {
  registerAdmin: async (req, res, next) => {
    const { username, email, fullName, password } = req.body;
    if (!username || !email || !fullName || !password) {
      const error = new ApiError(400, 'All fields are required');
      return next(error);
    }
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { email }],
    });
    if (existingAdmin) {
      const error = new ApiError(409, responseMessages.ALREADY_EXIST('Admin', email));
      return next(error);
    }
    const newAdmin = new Admin({
      username,
      email: email.toLowerCase(),
      fullName,
      password,
    });
    await newAdmin.save();

    const accessToken = newAdmin.generateAccessToken();
    const refreshToken = newAdmin.generateRefreshToken();
    newAdmin.refreshToken = refreshToken;
    await newAdmin.save();
    const options = {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
    };
    res
      .status(201)
      .cookie('accessToken', accessToken, {
        ...options,
        maxAge: 60 * 1000 * 60, // 1 hour
      })
      .cookie('refreshToken', refreshToken, {
        ...options,
        maxAge: 60 * 1000 * 60 * 24 * 30, // 30 days
      })
      .json(
        new ApiResponse(
          201,
          {
            user: newAdmin,
          },
          'Admin registered successfully'
        )
      );
  },

  loginAdmin: async (req, res) => {
    const { email, password, username } = req.body;

    try {
      // Validate input parameters
      if ((!email && !username) || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/username and password are required',
          timestamp: new Date().toISOString(),
        });
      }

      // Find admin by email or username
      const query = email ? { email: email.toLowerCase() } : { username: username.toLowerCase() };
      const admin = await Admin.findOne(query);

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }

      // Check if admin is blocked
      if (admin.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Account has been blocked. Please contact support',
          timestamp: new Date().toISOString(),
        });
      }

      // Verify password
      const isPasswordValid = await admin.isPasswordCorrect(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }

      // Generate tokens
      const accessToken = admin.generateAccessToken();
      const refreshToken = admin.generateRefreshToken();

      // Construct comprehensive response object
      const loginResponse = {
        success: true,
        message: 'Login successful',
        timestamp: new Date().toISOString(),
        data: {
          id: admin._id,
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      };

      // Set secure cookie options
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      };

      // Set cookies and send response
      res
        .cookie('accessToken', accessToken, cookieOptions)
        .cookie('refreshToken', refreshToken, cookieOptions)
        .status(200)
        .json(loginResponse);

      // Log successful login (remove in production)
      console.log(`Admin login successful: ${admin.email} (${admin.username})`);
    } catch (error) {
      // Handle different types of errors
      let errorMessage = 'Login failed';
      let statusCode = 500;

      // Handle specific error types
      if (error.name === 'ValidationError') {
        errorMessage = 'Invalid input data';
        statusCode = 400;
      } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
        errorMessage = 'Database error occurred';
        statusCode = 500;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Construct error response object
      const errorResponse = {
        success: false,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        error: {
          name: error.name,
          message: error.message,
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
        },
      };

      // Log error (remove in production)
      console.error('Admin login error:', errorResponse);

      res.status(statusCode).json(errorResponse);
    }
  },

  selfIdentification: asyncHandler(async (req, res, next) => {
    console.log(req._id);
    const admin = await Admin.findById(req._id);
    res.status(200).json(new ApiResponse(200, admin, 'User identified successfully'));
  }),

  logout: asyncHandler((req, res, next) => {
    const options = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 1000 * 60 * 24 * 30, // 30 days
    };

    res
      .status(200)
      .clearCookie('accessToken', options)
      .clearCookie('refreshToken', options)
      .json(
        new ApiResponse(
          200,
          {
            user: null,
          },
          'User logged out Successfully'
        )
      );
  }),

  refreshToken: asyncHandler(async (req, res, next) => {
    const { cookies } = req;
    const { refreshToken } = cookies;

    if (!refreshToken) {
      const error = new ApiError(401, responseMessages.UNAUTHORIZED);
      return next(error);
    }

    const { _id } = quicker.verifyToken(refreshToken, config.REFRESH_TOKEN.SECRET);

    if (!_id) {
      const error = new ApiError(401, responseMessages.UNAUTHORIZED);
      return next(error);
    }

    const user = await Admin.findById(_id).select('-password -refreshToken');

    if (!user) {
      const error = new ApiError(401, responseMessages.UNAUTHORIZED);
      return next(error);
    }

    const accessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save();

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 1000 * 60 * 24 * 30, // 30 days
    };

    res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            user,
            accessToken,
          },
          'Token refreshed successfully'
        )
      );
  }),

  createSubAdmin: asyncHandler(async (req, res) => {
    const { username, email, fullName, password, permissions, assignedLocations } = req.body;

    // Only full admin can create sub-admins
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can create sub-admins',
      });
    }

    const newSubAdmin = await Admin.create({
      username,
      email,
      fullName,
      password,
      role: 'sub_admin',
      assignedLocations: assignedLocations || [],
      hasAllLocationAccess: false,
      permissions: permissions || {
        products: ['READ'],
        vendors: ['READ'],
        users: ['READ'],
        bookings: ['READ'],
        reports: ['READ'],
        settings: [],
      },
    });

    const createdAdmin = await Admin.findById(newSubAdmin._id).select('-password -refreshToken');

    res.status(201).json({
      success: true,
      message: 'Sub-admin created successfully',
      data: createdAdmin,
    });
  }),

  getAllAdmins: asyncHandler(async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can view all admins',
      });
    }

    const { page = 1, limit = 10, role } = req.query;

    const filter = {};
    if (role) filter.role = role;

    const admins = await Admin.find(filter)
      .select('-password -refreshToken')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .exec();

    const count = await Admin.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: admins,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count,
    });
  }),

  updateAdmin: asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const { fullName, email, avatar, permissions } = req.body;

    const requesterId = req._id.toString();
    const requesterRole = req.userRole;

    // Fetch target admin
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // 1️⃣ Role-based permission checks
    // Sub-admin can only update their own profile
    if (requesterRole !== 'admin' && requesterId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
      });
    }

    // Only full admin can update permissions
    if (permissions && requesterRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only full admin can update permissions',
      });
    }

    // Cannot update your own permissions (even as full admin)
    if (permissions && requesterId === adminId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot update your own permissions',
      });
    }

    // Cannot update another full admin’s permissions
    if (permissions && admin.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update permissions of another full admin',
      });
    }

    // 2️⃣ Email validation
    if (email) {
      const existingAdmin = await Admin.findOne({
        email,
        _id: { $ne: adminId },
      });
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use',
        });
      }
    }

    // 3️⃣ Build update object
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (avatar) updateData.avatar = avatar;
    if (permissions) updateData.permissions = permissions;

    // 4️⃣ Perform update
    const updatedAdmin = await Admin.findByIdAndUpdate(adminId, updateData, {
      new: true,
      runValidators: true,
    }).select('-password -refreshToken');

    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      data: updatedAdmin,
    });
  }),

  changeAdminPassword: asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Admin can only change their own password
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can change password',
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Verify current password
    const isPasswordValid = await admin.isPasswordCorrect(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  }),

  toggleAdminBlock: asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const { isBlocked } = req.body;

    // Only full admin can block/unblock
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can block/unblock sub-admins',
      });
    }

    // Cannot block self
    if (req._id.toString() === adminId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself',
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Cannot block full admin
    if (admin.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot block full admin',
      });
    }

    admin.isBlocked = isBlocked;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Admin ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      data: {
        _id: admin._id,
        username: admin.username,
        isBlocked: admin.isBlocked,
      },
    });
  }),
};
