import { body, param, query } from 'express-validator';

export const createWalletValidation = [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('userType')
    .optional()
    .isIn(['Admin', 'Vendor', 'User'])
    .withMessage('User type must be Admin, Vendor, or Customer'),
  body('currency').optional().isIn(['INR', 'USD', 'EUR']).withMessage('Currency must be INR, USD, or EUR'),
  body('initialBalance').optional().isFloat({ min: 0 }).withMessage('Initial balance must be a positive number'),
];

export const walletIdValidation = [param('walletId').isMongoId().withMessage('Valid wallet ID is required')];

export const amountValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1-500 characters'),
  body('reference')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Reference must be between 1-100 characters'),
];

export const transferValidation = [
  body('fromWalletId').isMongoId().withMessage('Valid from wallet ID is required'),
  body('toWalletId').isMongoId().withMessage('Valid to wallet ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1-500 characters'),
];

export const freezeFundsValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1-500 characters'),
];

export const walletSettingsValidation = [
  body('dailyLimit').optional().isFloat({ min: 0 }).withMessage('Daily limit must be a positive number'),
  body('monthlyLimit').optional().isFloat({ min: 0 }).withMessage('Monthly limit must be a positive number'),
  body('autoFreeze').optional().isBoolean().withMessage('Auto freeze must be a boolean value'),
];

export const statusUpdateValidation = [
  body('status').isIn(['active', 'suspended', 'frozen']).withMessage('Status must be active, suspended, or frozen'),
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1-500 characters'),
];

export const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
  query('userType')
    .optional()
    .isIn(['admin', 'vendor', 'customer'])
    .withMessage('User type must be admin, vendor, or customer'),
  query('status')
    .optional()
    .isIn(['active', 'suspended', 'frozen'])
    .withMessage('Status must be active, suspended, or frozen'),
  query('currency').optional().isIn(['INR', 'USD', 'EUR']).withMessage('Currency must be INR, USD, or EUR'),
  query('minBalance').optional().isFloat({ min: 0 }).withMessage('Minimum balance must be a positive number'),
  query('maxBalance').optional().isFloat({ min: 0 }).withMessage('Maximum balance must be a positive number'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'balance', 'userType'])
    .withMessage('Sort by must be createdAt, updatedAt, balance, or userType'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];
