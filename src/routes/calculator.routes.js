import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import {
  submitCalculator,
  getAllCalculatorLeads,
  getCalculatorLeadById,
  updateCalculatorStatus,
} from '../controllers/calculator/calculator.controller.js';

const router = express.Router();

router.post('/submit', authMiddleware(['user']), submitCalculator);

router.get('/leads', getAllCalculatorLeads);
router.get('/leads/:id', authMiddleware(['admin']), getCalculatorLeadById);
router.put('/leads/:id', authMiddleware(['admin']), updateCalculatorStatus);

export default router;
