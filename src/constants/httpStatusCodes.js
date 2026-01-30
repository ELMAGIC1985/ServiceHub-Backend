import { ApiError } from '../utils/index.js';

export const HTTP_STATUS = {
  // 2xx Success
  SUCCESS: {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
  },

  // 4xx Client Errors
  CLIENT_ERROR: {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
  },

  // 5xx Server Errors
  SERVER_ERROR: {
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  },
};

export const ERROR_MESSAGES = {
  // Authentication & Authorization
  AUTH: {
    TOKEN_REQUIRED: 'Access token is required',
    INVALID_TOKEN: 'Invalid or expired token',
    INVALID_CREDENTIALS: 'Invalid email or password',
    ACCESS_DENIED: 'Access denied',
    ADMIN_REQUIRED: 'Admin privileges required',
    TOKEN_EXPIRED: 'Token has expired',
    UNAUTHORIZED_ACCESS: 'Unauthorized access to this resource',
  },

  // Validation
  VALIDATION: {
    REQUIRED_FIELDS: 'Required fields are missing',
    INVALID_EMAIL: 'Please provide a valid email address',
    WEAK_PASSWORD:
      'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one numeric digit, and one special character',
    PASSWORD_MISMATCH: 'Password and confirm password do not match',
    INVALID_FORMAT: 'Invalid data format provided',
    INVALID_ID: 'Invalid ID format',
    EMAIL_REQUIRED: 'Email is required',
    PASSWORD_REQUIRED: 'Password is required',
    INVALID_PHONE: 'Please provide a valid phone number',
  },

  // Resource Management
  RESOURCE: {
    NOT_FOUND: 'Resource not found',
    USER_NOT_FOUND: 'User not found',
    ALREADY_EXISTS: 'Resource already exists',
    EMAIL_EXISTS: 'Email is already registered',
    USERNAME_EXISTS: 'Username is already taken',
    CREATION_FAILED: 'Failed to create resource',
    UPDATE_FAILED: 'Failed to update resource',
    DELETE_FAILED: 'Failed to delete resource',
  },

  // Business Logic
  BUSINESS: {
    INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
    ORDER_CANCELLED: 'Cannot modify cancelled order',
    INVALID_DATE_RANGE: 'End date cannot be before start date',
    LIMIT_EXCEEDED: 'Request limit exceeded',
    OPERATION_NOT_ALLOWED: 'This operation is not allowed',
    DUPLICATE_OPERATION: 'This operation has already been performed',
  },

  // Server Errors
  SERVER: {
    INTERNAL_ERROR: 'Internal server error occurred',
    DATABASE_ERROR: 'Database connection failed',
    PAYMENT_GATEWAY_ERROR: 'Payment gateway is currently unavailable',
    THIRD_PARTY_ERROR: 'Third party service error',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
    MAINTENANCE_MODE: 'Service is under maintenance',
  },

  // Rate Limiting
  RATE_LIMIT: {
    TOO_MANY_REQUESTS: 'Too many requests. Please try again later',
    LOGIN_ATTEMPTS: 'Too many login attempts. Please try again in 15 minutes',
    API_LIMIT_EXCEEDED: 'API rate limit exceeded',
  },

  // File Operations
  FILE: {
    FILE_TOO_LARGE: 'File size exceeds the maximum limit',
    INVALID_FILE_TYPE: 'Invalid file type. Please upload a valid file',
    UPLOAD_FAILED: 'File upload failed',
    FILE_NOT_FOUND: 'File not found',
  },

  // Payment
  PAYMENT: {
    PAYMENT_FAILED: 'Payment processing failed',
    INVALID_PAYMENT_METHOD: 'Invalid payment method',
    PAYMENT_REQUIRED: 'Payment is required to proceed',
    REFUND_FAILED: 'Refund processing failed',
  },

  OTP: {
    EXCEED_LIMIT: 'Rate limit exceeded. Maximum 5 OTPs allowed per hour.',
  },
};

// Success messages
export const SUCCESS_MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: 'Logged in successfully',
    LOGOUT_SUCCESS: 'Logged out successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    EMAIL_VERIFIED: 'Email verified successfully',
  },

  USER: {
    USER_CREATED: 'User account created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deleted successfully',
    PROFILE_FETCHED: 'Profile fetched successfully',
  },

  GENERAL: {
    SUCCESS: 'Operation completed successfully',
    DATA_FETCHED: 'Data retrieved successfully',
    DATA_CREATED: 'Data created successfully',
    DATA_UPDATED: 'Data updated successfully',
    DATA_DELETED: 'Data deleted successfully',
  },

  PAYMENT: {
    PAYMENT_SUCCESS: 'Payment completed successfully',
    REFUND_SUCCESS: 'Refund processed successfully',
    KYC_VERIFIED: 'KYC payment verified successfully',
  },
};

export const CONTROLLER_RESPONSES = {
  // User Authentication
  USER_CREATED: {
    status: HTTP_STATUS.SUCCESS.CREATED,
    message: SUCCESS_MESSAGES.USER.USER_CREATED,
  },

  LOGIN_SUCCESS: {
    status: HTTP_STATUS.SUCCESS.OK,
    message: SUCCESS_MESSAGES.AUTH.LOGIN_SUCCESS,
  },

  INVALID_CREDENTIALS: {
    status: HTTP_STATUS.CLIENT_ERROR.UNAUTHORIZED,
    message: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS,
  },

  EMAIL_EXISTS: {
    status: HTTP_STATUS.CLIENT_ERROR.CONFLICT,
    message: ERROR_MESSAGES.RESOURCE.EMAIL_EXISTS,
  },

  // Validation Errors
  REQUIRED_FIELDS: {
    status: HTTP_STATUS.CLIENT_ERROR.BAD_REQUEST,
    message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS,
  },

  WEAK_PASSWORD: {
    status: HTTP_STATUS.CLIENT_ERROR.BAD_REQUEST,
    message: ERROR_MESSAGES.VALIDATION.WEAK_PASSWORD,
  },

  // Resource Errors
  USER_NOT_FOUND: {
    status: HTTP_STATUS.CLIENT_ERROR.NOT_FOUND,
    message: ERROR_MESSAGES.RESOURCE.USER_NOT_FOUND,
  },

  ACCESS_DENIED: {
    status: HTTP_STATUS.CLIENT_ERROR.FORBIDDEN,
    message: ERROR_MESSAGES.AUTH.ACCESS_DENIED,
  },

  // Server Errors
  INTERNAL_ERROR: {
    status: HTTP_STATUS.SERVER_ERROR.INTERNAL_SERVER_ERROR,
    message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR,
  },

  DATABASE_ERROR: {
    status: HTTP_STATUS.SERVER_ERROR.INTERNAL_SERVER_ERROR,
    message: ERROR_MESSAGES.SERVER.DATABASE_ERROR,
  },
};

export const RESPONSE_PATTERNS = {
  // Success response
  success: (res, statusCode, data = null, message = SUCCESS_MESSAGES.GENERAL.SUCCESS) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  },

  // Error response
  error: (res, statusCode, message, errors = []) => {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  },

  // Paginated response
  paginated: (res, data, pagination, message = SUCCESS_MESSAGES.GENERAL.DATA_FETCHED) => {
    return res.status(HTTP_STATUS.SUCCESS.OK).json({
      success: true,
      message,
      data,
      pagination: {
        currentPage: pagination.page,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        itemsPerPage: pagination.limit,
        hasNextPage: pagination.page < pagination.totalPages,
        hasPrevPage: pagination.page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  },
};

export const createApiError = (responseType) => {
  const response = CONTROLLER_RESPONSES[responseType];
  if (!response) {
    throw new Error(`Invalid response type: ${responseType}`);
  }
  return new ApiError(response.status, response.message);
};
