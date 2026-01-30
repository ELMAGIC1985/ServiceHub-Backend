import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import s3Client from '../../config/awsConfig.js';
import config from '../../config/config.js';

class UploadService {
  async generatePresignedUrl({ userId, fileType, fileSize, folder }) {
    // ✅ validations
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(fileType)) {
      throw new Error('INVALID_FILE_TYPE');
    }

    if (fileSize > 5 * 1024 * 1024) {
      throw new Error('FILE_TOO_LARGE');
    }

    // 🔐 controlled S3 key
    const key = `uploads/${folder}/${userId}/${uuid()}`;

    const command = new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60, // seconds
    });

    return { uploadUrl, key, bucket: config.AWS_S3_BUCKET_NAME };
  }
}

export default new UploadService();
