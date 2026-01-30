import express from 'express';
import { getPlatformKPIs, getKPIsSummary } from '../controllers/reports/kpis.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/checkPermission.js';

const router = express.Router();

/**
 * KPI Routes
 * All routes require authentication and admin/staff permissions
 */

// Get all platform KPIs
router.get('/platform', verifyJWT, checkPermission(['admin', 'staff']), getPlatformKPIs);

// Get KPIs summary with additional details
router.get('/summary', verifyJWT, checkPermission(['admin', 'staff']), getKPIsSummary);

export default router;
