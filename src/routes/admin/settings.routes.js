import express from 'express';
import {
  getSettings,
  updateSettings,
  resetSettings,
  getSettingByKey,
  updateSettingByKey,
  toggleMaintenanceMode,
  getPublicSettings,
} from '../../controllers/settings/settings.controller.js';

const router = express.Router();

router.get('/public', getPublicSettings);

router.route('/').get(getSettings).put(updateSettings);

router.post('/reset', resetSettings);

router.patch('/maintenance/toggle', toggleMaintenanceMode);

router.route('/:key').get(getSettingByKey).patch(updateSettingByKey);

export default router;
