import mongoose from 'mongoose';
import config from '../config/config.js';
import { initCronJobs } from '../jobs/index.js';
import { DB_NAME } from '../constants/constants.js';

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(config.DATABASE_URL, {
      dbName: DB_NAME,
    });

    console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    initCronJobs();
  } catch (error) {
    console.log('MONGODB connection FAILED ', error);
    process.exit(1);
  }
};

export default connectDB;
