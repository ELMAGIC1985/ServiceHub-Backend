import { addonsUploadService } from '../../services/excel-uploads/addonsUpload.service.js';
import { ApiError, asyncHandler } from '../../utils/index.js';

export const addonsUpload = asyncHandler(async (req, res, next) => {
  try {
    const result = await addonsUploadService.uploadAddonsFromExcel(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: 'Addons uploaded successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error uploading addons from excel:', error);
    return next(new ApiError(500, error.message || 'Failed to upload addons'));
  }
});
