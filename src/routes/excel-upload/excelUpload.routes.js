import express from 'express';
const router = express.Router();

import { addonsUpload } from '../../controllers/excel-upload/excelUpload.controller.js';
import { uploadExcel } from '../../middlewares/multer.middleware.js';

router.route('/addons').post(uploadExcel.single('file'), addonsUpload);

export default router;
