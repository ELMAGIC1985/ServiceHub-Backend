import express from 'express';
import { getDashboardKPIs } from '../../../controllers/dashboard/dashboard.controller.js';

const router = express.Router();

router.get('/kpis', getDashboardKPIs);

export default router;
