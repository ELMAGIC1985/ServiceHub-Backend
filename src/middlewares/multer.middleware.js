import multer from 'multer';
import path from 'path';

// Store files in memory
const storage = multer.memoryStorage();

// Simple file filter - just check if it's an image
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed!'), false);
  }

  const allowedFormats = ['jpeg', 'jpg', 'png', 'webp'];
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  if (!allowedFormats.includes(ext)) {
    return cb(new Error(`Invalid format. Allowed: ${allowedFormats.join(', ')}`), false);
  }

  cb(null, true);
};

const excelFileFilter = (req, file, cb) => {
  const allowedExt = ['.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExt.includes(ext)) {
    return cb(new Error('Only Excel files are allowed'), false);
  }
  cb(null, true);
};

export const uploadExcel = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  excelFileFilter,
});

// Single image upload
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Multiple images upload
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files
  },
});

// Error handler
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const errorMessages = {
      LIMIT_FILE_SIZE: 'File too large (max 10MB)',
      LIMIT_FILE_COUNT: 'Too many files (max 10)',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };

    return res.status(400).json({
      success: false,
      error: errorMessages[error.code] || 'Upload error',
    });
  }

  if (error.message) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  next(error);
};
