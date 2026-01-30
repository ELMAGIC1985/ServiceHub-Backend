import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import dotenv from 'dotenv';
import config from './config.js';

dotenv.config();

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

export default s3Client;
