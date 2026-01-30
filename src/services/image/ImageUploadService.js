import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import config from '../../config/config.js';

const bucketName = config.AWS_S3_BUCKET_NAME;
const region = config.AWS_REGION;
const accessKeyId = config.AWS_ACCESS_KEY_ID;
const secretAccessKey = config.AWS_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

class ImageUploadService {
  constructor() {
    this.imageConfigs = {
      avatar: {
        sizes: [
          { width: 150, height: 150, quality: 85, suffix: 'thumb' },
          { width: 300, height: 300, quality: 90, suffix: 'medium' },
        ],
        folder: 'avatars',
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
        maxFileSize: 5 * 1024 * 1024, // 5MB
      },
      icon: {
        sizes: [
          { width: 32, height: 32, quality: 90, suffix: 'sm' },
          { width: 64, height: 64, quality: 90, suffix: 'md' },
          { width: 128, height: 128, quality: 90, suffix: 'lg' },
        ],
        folder: 'icons',
        allowedFormats: ['jpeg', 'jpg', 'png', 'svg', 'webp'],
        maxFileSize: 2 * 1024 * 1024, // 2MB
      },
      product: {
        sizes: [
          { width: 300, height: 300, quality: 80, suffix: 'thumb' },
          { width: 600, height: 600, quality: 85, suffix: 'medium' },
          { width: 1200, height: 1200, quality: 90, suffix: 'large' },
        ],
        folder: 'products',
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
      },
      service: {
        sizes: [
          { width: 400, height: 300, quality: 80, suffix: 'thumb' },
          { width: 800, height: 600, quality: 85, suffix: 'medium' },
          { width: 1600, height: 1200, quality: 90, suffix: 'large' },
        ],
        folder: 'services',
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
        maxFileSize: 8 * 1024 * 1024, // 8MB
      },
      category: {
        sizes: [
          { width: 200, height: 200, quality: 85, suffix: 'thumb' },
          { width: 400, height: 400, quality: 90, suffix: 'medium' },
        ],
        folder: 'categories',
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
        maxFileSize: 5 * 1024 * 1024, // 5MB
      },
      poster: {
        sizes: [
          { width: 400, height: 600, quality: 80, suffix: 'mobile' },
          { width: 800, height: 1200, quality: 85, suffix: 'tablet' },
          { width: 1200, height: 1800, quality: 90, suffix: 'desktop' },
        ],
        folder: 'posters',
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
        maxFileSize: 15 * 1024 * 1024, // 15MB
      },
      banner: {
        sizes: [
          { width: 800, height: 400, quality: 80, suffix: 'mobile' },
          { width: 1200, height: 600, quality: 85, suffix: 'tablet' },
          { width: 1920, height: 960, quality: 90, suffix: 'desktop' },
        ],
        folder: 'banners',
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
        maxFileSize: 12 * 1024 * 1024, // 12MB
      },
    };
  }

  /**
   * Generate unique filename
   */
  generateFileName(originalName, suffix = '') {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(originalName).toLowerCase();
    const name = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '');

    return suffix ? `${name}_${timestamp}_${random}_${suffix}${ext}` : `${name}_${timestamp}_${random}${ext}`;
  }

  /**
   * Validate image file
   */
  validateImage(file, imageType) {
    const config = this.imageConfigs[imageType];
    if (!config) {
      throw new Error(`Invalid image type: ${imageType}`);
    }

    // Check file size
    if (file.size > config.maxFileSize) {
      throw new Error(`File size exceeds limit of ${config.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check file format
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!config.allowedFormats.includes(ext)) {
      throw new Error(`Invalid file format. Allowed: ${config.allowedFormats.join(', ')}`);
    }

    return true;
  }

  /**
   * Optimize image using Sharp
   */
  async optimizeImage(buffer, sizeConfig, originalFormat) {
    try {
      let image = sharp(buffer);

      // Get image metadata
      const metadata = await image.metadata();

      // Resize image if dimensions are specified
      if (sizeConfig.width && sizeConfig.height) {
        image = image.resize(sizeConfig.width, sizeConfig.height, {
          fit: 'cover',
          position: 'center',
        });
      }

      // Handle different formats
      let optimizedBuffer;
      const format = originalFormat.toLowerCase();

      switch (format) {
        case 'png':
          optimizedBuffer = await image
            .png({
              quality: sizeConfig.quality,
              compressionLevel: 8,
              progressive: true,
            })
            .toBuffer();
          break;

        case 'webp':
          optimizedBuffer = await image
            .webp({
              quality: sizeConfig.quality,
              effort: 6,
            })
            .toBuffer();
          break;

        case 'svg':
          // SVG files don't need optimization, return original
          return buffer;

        default: // jpeg, jpg
          optimizedBuffer = await image
            .jpeg({
              quality: sizeConfig.quality,
              progressive: true,
              mozjpeg: true,
            })
            .toBuffer();
      }

      return optimizedBuffer;
    } catch (error) {
      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  /**
   * Upload single image variant to S3
   */
  async uploadImageToS3(imageBuffer, fileName, mimeType) {
    const uploadParams = {
      Bucket: bucketName,
      Body: imageBuffer,
      Key: fileName,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000', // 1 year cache
    };

    try {
      const result = await s3Client.send(new PutObjectCommand(uploadParams));
      const imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;

      return {
        url: imageUrl,
        key: fileName,
        s3Response: result,
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Process and upload all image variants
   */
  async processAndUploadImages(file, imageType) {
    const config = this.imageConfigs[imageType];
    if (!config) {
      throw new Error(`Invalid image type: ${imageType}`);
    }

    // Validate the image
    this.validateImage(file, imageType);

    const originalFormat = path.extname(file.originalname).toLowerCase().replace('.', '');
    const uploadResults = {};
    const uploadPromises = [];

    // Upload original image (unoptimized)
    // const originalFileName = `${config.folder}/original/${this.generateFileName(file.originalname)}`;
    // uploadPromises.push(
    //   this.uploadImageToS3(file.buffer, originalFileName, file.mimetype).then((result) => {
    //     uploadResults.original = result;
    //   })
    // );

    // Process and upload each size variant
    for (const sizeConfig of config.sizes) {
      const optimizedBuffer = await this.optimizeImage(file.buffer, sizeConfig, originalFormat);
      const fileName = `${config.folder}/${sizeConfig.suffix}/${this.generateFileName(
        file.originalname,
        sizeConfig.suffix
      )}`;

      uploadPromises.push(
        this.uploadImageToS3(optimizedBuffer, fileName, file.mimetype).then((result) => {
          uploadResults[sizeConfig.suffix] = result;
        })
      );
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    return uploadResults;
  }

  /**
   * Main upload middleware
   */
  async uploadToS3(req, res, next) {
    try {
      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const { imageType } = req.params;
      const file = req.file;

      // Validate image type
      if (!this.imageConfigs[imageType]) {
        return res.status(400).json({
          success: false,
          error: `Invalid image type: ${imageType}`,
        });
      }

      // Process and upload all variants
      const uploadResults = await this.processAndUploadImages(file, imageType);

      console.log('Image upload completed:', uploadResults);

      // Send success response
      res.status(200).json({
        success: true,
        message: `${imageType} images uploaded successfully`,
        imageType: imageType,
        images: uploadResults,
        metadata: {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload and process images',
        details: error.message,
      });
    }
  }

  /**
   * Delete image variants from S3
   */
  async deleteImageFromS3(imageRecord) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const deletePromises = [];

    try {
      // Delete all size variants
      for (const size of imageRecord.sizes) {
        deletePromises.push(
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: size.key,
            })
          )
        );
      }

      // Delete original image if exists
      if (imageRecord.metadata?.originalKey) {
        deletePromises.push(
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: imageRecord.metadata.originalKey,
            })
          )
        );
      }

      await Promise.all(deletePromises);
      console.log('Successfully deleted images from S3:', imageRecord._id);
    } catch (error) {
      console.error('Error deleting images from S3:', error);
      throw new Error(`S3 deletion failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple images from S3
   */
  async deleteMultipleImagesFromS3(imageKeys) {
    const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

    try {
      const deleteParams = {
        Bucket: bucketName,
        Delete: {
          Objects: imageKeys.map((key) => ({ Key: key })),
          Quiet: false,
        },
      };

      const result = await s3Client.send(new DeleteObjectsCommand(deleteParams));
      console.log('Batch delete result:', result);

      return result;
    } catch (error) {
      console.error('Error batch deleting images from S3:', error);
      throw new Error(`S3 batch deletion failed: ${error.message}`);
    }
  }
}

// Create instance and export the middleware
const imageUploadService = new ImageUploadService();

// Export the middleware function bound to the instance
export const uploadToS3 = imageUploadService.uploadToS3.bind(imageUploadService);

// Export the service class for direct usage if needed
export { ImageUploadService };
