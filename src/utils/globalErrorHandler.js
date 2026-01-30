import { ApiError } from '../utils/ApiError.js';

const errorResponse = (res, statusCode, message, details = null) => {
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    ...(details && { details }),
  });
};

const handleCastError = (err) => {
  return new ApiError(400, `Invalid ID format: ${err.path} should be an ObjectId. Received: ${err.value}`);
};

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = err.keyValue ? err.keyValue[field] : 'unknown';

  return new ApiError(400, `Duplicate value for field '${field}': '${value}'. Please use a different value.`);
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((val) => val.message);
  return new ApiError(400, `Validation failed: ${errors.join('. ')}`);
};

const globalErrorHandler = (error, req, res, next) => {
  console.error('Global Error Handler:', error);

  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  let formattedError = error;

  if (error.name === 'CastError') formattedError = handleCastError(error);
  if (error.code === 11000) formattedError = handleDuplicateKeyError(error);
  if (error.name === 'ValidationError') formattedError = handleValidationError(error);

  if (process.env.NODE_ENV === 'development') {
    return errorResponse(res, formattedError.statusCode, formattedError.message, {
      stack: formattedError.stack,
      errorType: formattedError.name || formattedError.code || 'Unknown Error',
    });
  }

  return errorResponse(res, formattedError.statusCode, formattedError.message);
};

export default globalErrorHandler;
