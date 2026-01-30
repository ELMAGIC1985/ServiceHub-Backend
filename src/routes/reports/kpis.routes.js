import { Router } from 'express';
import { getPlatformKPIs } from '../../controllers/reports/kpis.controller.js';

const router = Router();

router.route('/kips/summary').get(getPlatformKPIs);

export default router;
