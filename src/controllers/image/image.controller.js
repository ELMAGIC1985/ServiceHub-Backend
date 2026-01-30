import Image from '../../models/image.model.js';
import { ImageUploadService } from '../../services/image/ImageUploadService.js';

import uploadService from '../../services/image/upload.service.js';
class ImageController {
  constructor() {
    this.imageUploadService = new ImageUploadService();
  }

  uploadSingleImage = async (req, res) => {
    try {
      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const { imageType } = req.params;
      const { entityId, description, tags } = req.body;
      const uploadedBy = req.user?.id || null; // Assuming user is attached by auth middleware

      // Validate image type
      if (!this.imageUploadService.imageConfigs[imageType]) {
        return res.status(400).json({
          success: false,
          error: `Invalid image type: ${imageType}`,
        });
      }

      // Process and upload image to S3
      const uploadResults = await this.imageUploadService.processAndUploadImages(req.file, imageType);
      const config = this.imageUploadService.imageConfigs[imageType];

      // Prepare image data for database
      const imageData = {
        originalName: req.file.originalname,
        imageType: imageType,
        folder: config.folder,
        sizes: [],
        metadata: {
          entityId: entityId || null,
          description: description || '',
          tags: tags ? tags.split(',').map((tag) => tag.trim()) : [],
          fileSize: req.file.size,
          mimetype: req.file.mimetype,
          uploadedAt: new Date(),
        },
        uploadedBy: uploadedBy,
      };

      // Convert upload results to sizes array
      for (const [sizeKey, result] of Object.entries(uploadResults)) {
        if (sizeKey === 'original') {
          continue; // Skip original for sizes array
        }

        const sizeConfig = config.sizes.find((s) => s.suffix === sizeKey);
        if (sizeConfig) {
          imageData.sizes.push({
            size: sizeKey,
            width: sizeConfig.width,
            height: sizeConfig.height,
            url: result.url,
            key: result.key,
          });
        }
      }

      // Add original image info to metadata
      if (uploadResults.original) {
        imageData.metadata.originalUrl = uploadResults.original.url;
        imageData.metadata.originalKey = uploadResults.original.key;
      }

      // Save to database
      const savedImage = await Image.create(imageData);

      console.log('Image saved to database:', savedImage._id);

      // Send success response
      res.status(200).json({
        success: true,
        message: `${imageType} image uploaded successfully`,
        data: {
          imageId: savedImage._id,
          imageType: imageType,
          originalName: req.file.originalname,
          sizes: uploadResults,
          metadata: imageData.metadata,
          dbRecord: savedImage,
        },
      });
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload and process image',
        details: error.message,
      });
    }
  };

  uploadMultipleImages = async (req, res) => {
    try {
      // Check if files exist
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
      }

      const { imageType } = req.params;
      const { entityId, description, tags } = req.body;
      const uploadedBy = req.user?.id || null;

      // Validate image type
      if (!this.imageUploadService.imageConfigs[imageType]) {
        return res.status(400).json({
          success: false,
          error: `Invalid image type: ${imageType}`,
        });
      }

      const uploadedImages = [];
      const errors = [];

      // Process each file
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        try {
          // Process and upload image to S3
          const uploadResults = await this.imageUploadService.processAndUploadImages(file, imageType);
          const config = this.imageUploadService.imageConfigs[imageType];

          // Prepare image data for database
          const imageData = {
            originalName: file.originalname,
            imageType: imageType,
            folder: config.folder,
            sizes: [],
            metadata: {
              entityId: entityId || null,
              description: description || '',
              tags: tags ? tags.split(',').map((tag) => tag.trim()) : [],
              fileSize: file.size,
              mimetype: file.mimetype,
              uploadedAt: new Date(),
              batchIndex: i,
            },
            uploadedBy: uploadedBy,
          };

          // Convert upload results to sizes array
          for (const [sizeKey, result] of Object.entries(uploadResults)) {
            if (sizeKey === 'original') {
              continue;
            }

            const sizeConfig = config.sizes.find((s) => s.suffix === sizeKey);
            if (sizeConfig) {
              imageData.sizes.push({
                size: sizeKey,
                width: sizeConfig.width,
                height: sizeConfig.height,
                url: result.url,
                key: result.key,
              });
            }
          }

          // Add original image info to metadata
          if (uploadResults.original) {
            imageData.metadata.originalUrl = uploadResults.original.url;
            imageData.metadata.originalKey = uploadResults.original.key;
          }

          // Save to database
          const savedImage = await Image.create(imageData);

          uploadedImages.push({
            imageId: savedImage._id,
            originalName: file.originalname,
            sizes: uploadResults,
            dbRecord: savedImage,
          });
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          errors.push({
            fileName: file.originalname,
            error: fileError.message,
          });
        }
      }

      // Send response
      const response = {
        success: uploadedImages.length > 0,
        message: `Uploaded ${uploadedImages.length} of ${req.files.length} images`,
        data: {
          imageType: imageType,
          uploadedImages: uploadedImages,
          totalUploaded: uploadedImages.length,
          totalFiles: req.files.length,
        },
      };

      if (errors.length > 0) {
        response.errors = errors;
        response.message += ` (${errors.length} failed)`;
      }

      const statusCode = uploadedImages.length > 0 ? 200 : 400;
      res.status(statusCode).json(response);
    } catch (error) {
      console.error('Multiple image upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload and process images',
        details: error.message,
      });
    }
  };

  getSignedUploadUrl = async (req, res) => {
    try {
      const { fileType, fileSize } = req.body;

      console.log('fileType', req.body);

      const result = await uploadService.generatePresignedUrl({
        userId: req.user.id,
        fileType,
        fileSize,
        folder: 'images',
      });

      res.status(200).json(result);
    } catch (error) {
      if (error.message === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ message: 'Invalid file type' });
      }

      if (error.message === 'FILE_TOO_LARGE') {
        return res.status(400).json({ message: 'File too large' });
      }

      console.error(error);
      res.status(500).json({ message: 'Failed to generate upload URL' });
    }
  };
}

const imageController = new ImageController();

export { imageController };

export default ImageController;
