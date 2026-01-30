import admin from '../../config/firebase.js';
import { auth } from '../../config/firebaseConfig.js';
import { Vendor } from '../../models/index.js';

import { signInWithEmailAndPassword, sendEmailVerification, createUserWithEmailAndPassword } from 'firebase/auth';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { USER_ROLES } from '../../models/vendor.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import mongoose from 'mongoose';

const addVendorToDatabase = asyncHandler(async (req, res) => {
  const { firstName, lastName, phoneNumber, email, dob, firebaseUID } = req.body;

  console.log('Adding vendor to database with Firebase UID:', firebaseUID);

  // Validate required fields
  if (!firstName || !lastName || !phoneNumber || !email || !dob || !firebaseUID) {
    return res.status(400).json({
      message: 'All required fields must be provided (firstName, lastName, phoneNumber, email, dob, firebaseUID)',
    });
  }

  try {
    // Check if vendor already exists with this Firebase UID
    const existingVendor = await Vendor.findOne({
      $or: [{ firebaseUID }, { email: email.toLowerCase().trim() }, { phoneNumber: phoneNumber.trim() }],
    });

    if (existingVendor) {
      return res.status(400).json({
        message: 'Vendor already exists with this Firebase UID, email, or phone number',
        existingVendor: {
          id: existingVendor._id,
          email: existingVendor.email,
          firebaseUID: existingVendor.firebaseUID,
        },
      });
    }

    // Create new vendor with Firebase authentication
    const vendor = new Vendor({
      firebaseUID: firebaseUID.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim(),
      email: email.toLowerCase().trim(),
      dob: new Date(dob),
      roles: [USER_ROLES.VENDOR],
      // Since Firebase handles authentication, we can set these as verified
      isVerified: true,
      isEmailVerified: true, // Firebase handles email verification
      isMobileVerified: false, // You may want to implement separate mobile verification
      isKYCVerified: false, // Business logic verification
      isBlocked: false,
    });

    // Save vendor to database
    const savedVendor = await vendor.save();

    // Return vendor data without sensitive information
    const vendorResponse = await Vendor.findById(savedVendor._id).select('-refreshToken').lean();

    console.log('Vendor successfully added to database:', vendorResponse._id);

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          user: vendorResponse,
          message: 'Vendor successfully added to database',
        },
        'Vendor registration completed'
      )
    );
  } catch (error) {
    console.error('Database registration error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: errorMessages,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `Duplicate ${field}: A vendor with this ${field} already exists`,
      });
    }

    return res.status(500).json({
      message: 'Internal server error during vendor registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

const verifyFirebaseTokenAndAddVendor = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    phoneNumber,
    dob,
    idToken, // Firebase ID token from frontend
  } = req.body;

  try {
    // Verify Firebase ID token (you'll need Firebase Admin SDK)
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid: firebaseUID, email, email_verified } = decodedToken;

    console.log(decodedToken);

    if (!email_verified) {
      const link = await admin.auth().generateEmailVerificationLink(email);
      console.log('verification link', link);
      return res.status(400).json({
        message: 'Email must be verified in Firebase before registration',
      });
    }

    // Now add vendor to database with verified Firebase data
    const vendorData = {
      firstName,
      lastName,
      phoneNumber,
      email,
      dob,
      firebaseUID,
    };

    // Call the main registration function
    req.body = vendorData;
    return addVendorToDatabase(req, res);
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).json({
      message: 'Invalid or expired Firebase token',
    });
  }
});

export const loginWithEmailPassword = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Validate input parameters
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Perform Firebase authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Extract user data from the credential
    const user = userCredential.user;

    // Get ID token for API calls
    const idToken = await user.getIdToken();

    // Get ID token result with claims
    const idTokenResult = await user.getIdTokenResult();

    // Construct comprehensive response object
    const loginResponse = {
      success: true,
      message: 'Login successful',
      timestamp: new Date().toISOString(),
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        isAnonymous: user.isAnonymous,
        tenantId: user.tenantId,
        providerData: user.providerData,
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime,
        },
      },
      tokens: {
        accessToken: user.accessToken,
        // idToken: idToken,
        // refreshToken: user.refreshToken,
      },
      // idTokenResult: {
      //   token: idTokenResult.token,
      //   authTime: idTokenResult.authTime,
      //   issuedAtTime: idTokenResult.issuedAtTime,
      //   expirationTime: idTokenResult.expirationTime,
      //   signInProvider: idTokenResult.signInProvider,
      //   signInSecondFactor: idTokenResult.signInSecondFactor,
      //   claims: idTokenResult.claims,
      // },
      operationType: userCredential.operationType,
      providerId: userCredential.providerId,
    };

    // Log successful login (remove in production)
    console.log('Login successful:', loginResponse);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    res.cookie('accessToken', idToken, cookieOptions).json(loginResponse);
  } catch (error) {
    // Handle different types of Firebase auth errors
    let errorMessage = 'Login failed';
    let errorCode = error.code;

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No user found with this email address';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address format';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This user account has been disabled';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed login attempts. Please try again later';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'Invalid email or password';
        break;
      default:
        errorMessage = error.message || 'An unexpected error occurred';
    }

    // Construct error response object
    const errorResponse = {
      success: false,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      error: {
        code: errorCode,
        message: error.message,
        stack: error.stack,
      },
    };

    // Log error (remove in production)
    console.error('Login error:', errorResponse);

    res.json(errorResponse);
  }
};

export const updateVendorInformation = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid: firebaseUID, email, email_verified } = decodedToken;

    // Find vendor by Firebase UID
    const vendor = await Vendor.findOne({ firebaseUID }).populate([
      'addresses.address',
      'wallet',
      'serviceCategories',
      'serviceChildCategories',
      'referredBy',
      'referredUsers',
    ]);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found. Please register first.',
      });
    }

    // Extract updateable fields from request body
    const {
      // Basic Information
      firstName,
      lastName,
      middleName,
      phoneNumber,
      dob,
      purpose,
      avatar,

      // Location Information
      currentCoordinates,
      addresses,

      // Settings
      isAvailable,

      // FCM Tokens
      fcmToken,
      deviceId,
      platform,
      deviceName,

      // Referral Information
      referralCode,

      ...otherFields
    } = req.body;

    // Prepare update object with validation
    const updateData = {};

    // Basic Information Updates
    if (firstName !== undefined) {
      if (!firstName || firstName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'First name must be at least 2 characters',
        });
      }
      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName || lastName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Last name must be at least 2 characters',
        });
      }
      updateData.lastName = lastName.trim();
    }

    if (middleName !== undefined) {
      updateData.middleName = middleName?.trim();
    }

    if (phoneNumber !== undefined) {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format',
        });
      }

      // Check if phone number already exists (excluding current user)
      const existingPhone = await Vendor.findOne({
        phoneNumber,
        firebaseUID: { $ne: firebaseUID },
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists',
        });
      }

      updateData.phoneNumber = phoneNumber.trim();
      updateData.isMobileVerified = false; // Reset mobile verification if changed
    }

    if (dob !== undefined) {
      updateData.dob = dob;
    }

    if (purpose !== undefined) {
      updateData.purpose = purpose?.trim();
    }

    // Location Updates
    if (currentCoordinates !== undefined) {
      const { coordinates } = currentCoordinates;
      if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
        const [longitude, latitude] = coordinates;
        if (longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90) {
          updateData.currentCoordinates = {
            type: 'Point',
            coordinates: [longitude, latitude],
          };
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid coordinates range',
          });
        }
      }
    }

    if (avatar !== undefined) {
      if (avatar && !/^https?:\/\/.+/.test(avatar)) {
        return res.status(400).json({
          success: false,
          message: 'Selfie image must be a valid URL',
        });
      }
      updateData.avatar = avatar;
    }

    // Settings Updates
    if (isAvailable !== undefined) {
      updateData.isAvailable = Boolean(isAvailable);
    }

    // Referral Code Update
    if (referralCode !== undefined) {
      if (referralCode) {
        const referralRegex = /^[A-Z0-9]{6,10}$/;
        if (!referralRegex.test(referralCode.toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: 'Referral code must be 6-10 alphanumeric characters',
          });
        }

        // Check if referral code already exists
        const existingReferral = await Vendor.findOne({
          referralCode: referralCode.toUpperCase(),
          firebaseUID: { $ne: firebaseUID },
        });

        if (existingReferral) {
          return res.status(400).json({
            success: false,
            message: 'Referral code already exists',
          });
        }

        updateData.referralCode = referralCode.toUpperCase();
      } else {
        updateData.referralCode = null;
      }
    }

    // Handle FCM Token Updates
    if (fcmToken && deviceId && platform) {
      const fcmTokenData = {
        token: fcmToken,
        deviceId,
        platform,
        deviceName: deviceName || 'Unknown Device',
        isActive: true,
        lastUsed: new Date(),
      };

      // Remove existing token for this device
      updateData.$pull = {
        fcmTokens: { deviceId: deviceId },
      };

      // Add new token
      updateData.$push = {
        fcmTokens: fcmTokenData,
      };
    }

    // Update email verification status from Firebase
    updateData.isEmailVerified = email_verified;

    // Set last seen and online status
    updateData.lastSeen = new Date();
    updateData.isOnline = true;

    // Perform the update
    const updatedVendor = await Vendor.findOneAndUpdate({ firebaseUID }, updateData, {
      new: true,
      runValidators: true,
      select: '-password -refreshToken',
    }).populate([
      'addresses.address',
      'wallet',
      'serviceCategories',
      'serviceChildCategories',
      'referredBy',
      'referredUsers',
    ]);

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update vendor information',
      });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Vendor information updated successfully',
      data: {
        vendor: updatedVendor,
        updatedFields: Object.keys(updateData),
      },
    });
  } catch (error) {
    console.error('Update vendor error:', error);

    // Handle specific error types
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value',
        field: Object.keys(error.keyPattern)[0],
      });
    }

    // Firebase token errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        message: 'Firebase token has expired. Please login again.',
      });
    }

    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        success: false,
        message: 'Firebase token has been revoked. Please login again.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export const registerWithEmailPassword = async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  try {
    // Validate input parameters
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!confirmPassword) {
      throw new Error('Password confirmation is required');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Basic password validation
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Perform Firebase authentication - create user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Extract user data from the credential
    const user = userCredential.user;

    // Send email verification immediately after registration
    await sendEmailVerification(user, {
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-verified`,
      handleCodeInApp: false,
    });

    // Get ID token for API calls
    const idToken = await user.getIdToken();

    // Get ID token result with claims
    const idTokenResult = await user.getIdTokenResult();

    // Construct comprehensive response object
    const registrationResponse = {
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      timestamp: new Date().toISOString(),
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        isAnonymous: user.isAnonymous,
        tenantId: user.tenantId,
        providerData: user.providerData,
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime,
        },
      },
      tokens: {
        accessToken: user.accessToken,
        // idToken: idToken,
        // refreshToken: user.refreshToken,
      },
      // idTokenResult: {
      //   token: idTokenResult.token,
      //   authTime: idTokenResult.authTime,
      //   issuedAtTime: idTokenResult.issuedAtTime,
      //   expirationTime: idTokenResult.expirationTime,
      //   signInProvider: idTokenResult.signInProvider,
      //   signInSecondFactor: idTokenResult.signInSecondFactor,
      //   claims: idTokenResult.claims,
      // },
      operationType: userCredential.operationType,
      providerId: userCredential.providerId,
      emailVerificationSent: true,
      nextSteps: [
        'Check your email for verification link',
        'Click the verification link to verify your email',
        'Complete your profile after email verification',
      ],
    };

    // Log successful registration (remove in production)
    console.log('Registration successful:', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
    });

    // Set cookie with ID token
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    res.cookie('accessToken', idToken, cookieOptions).json(registrationResponse);

    return registrationResponse;
  } catch (error) {
    // Handle different types of Firebase auth errors
    let errorMessage = 'Registration failed';
    let errorCode = error.code;
    let statusCode = 400;

    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'An account with this email already exists';
        statusCode = 409; // Conflict
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address format';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Email/password accounts are not enabled';
        statusCode = 403;
        break;
      case 'auth/weak-password':
        errorMessage = 'Password is too weak. Please use a stronger password';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection';
        statusCode = 503;
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many registration attempts. Please try again later';
        statusCode = 429;
        break;
      default:
        errorMessage = error.message || 'An unexpected error occurred during registration';
        if (
          error.message === 'Email and password are required' ||
          error.message === 'Password confirmation is required' ||
          error.message === 'Passwords do not match' ||
          error.message === 'Password must be at least 6 characters long' ||
          error.message === 'Invalid email format'
        ) {
          statusCode = 400;
        } else {
          statusCode = 500;
        }
    }

    // Construct error response object
    const errorResponse = {
      success: false,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      error: {
        code: errorCode,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };

    // Log error (remove in production)
    console.error('Registration error:', {
      code: errorCode,
      message: errorMessage,
      email: email, // Log email for debugging (be careful with PII)
    });

    res.status(statusCode).json(errorResponse);
  }
};

const updateVendorSettings = asyncHandler(async (req, res) => {
  const { idToken, isAvailable, isOnline } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid: firebaseUID } = decodedToken;

    const updateData = {
      lastSeen: new Date(),
    };

    if (isAvailable !== undefined) {
      updateData.isAvailable = Boolean(isAvailable);
    }

    if (isOnline !== undefined) {
      updateData.isOnline = Boolean(isOnline);
    }

    const updatedVendor = await Vendor.findOneAndUpdate({ firebaseUID }, updateData, {
      new: true,
      select: 'isAvailable isOnline lastSeen name email',
    });

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedVendor,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update settings',
    });
  }
});

const updateVendorFCMToken = asyncHandler(async (req, res) => {
  const { idToken, fcmToken, deviceId, platform, deviceName } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid: firebaseUID } = decodedToken;

    if (!fcmToken || !deviceId || !platform) {
      return res.status(400).json({
        success: false,
        message: 'FCM token, device ID, and platform are required',
      });
    }

    // Remove existing token for this device and add new one
    const vendor = await Vendor.findOneAndUpdate(
      { firebaseUID },
      {
        $pull: { fcmTokens: { deviceId } },
        lastSeen: new Date(),
      },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    // Add new FCM token
    await Vendor.findOneAndUpdate(
      { firebaseUID },
      {
        $push: {
          fcmTokens: {
            token: fcmToken,
            deviceId,
            platform,
            deviceName: deviceName || 'Unknown Device',
            isActive: true,
            lastUsed: new Date(),
          },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'FCM token updated successfully',
    });
  } catch (error) {
    console.error('Update FCM token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update FCM token',
    });
  }
});

export { addVendorToDatabase, verifyFirebaseTokenAndAddVendor };
