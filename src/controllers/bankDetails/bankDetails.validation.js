import { body, param, query } from 'express-validator';

const validateCreateBankAccount = [
  body('accountHolderName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder name must be between 2-100 characters')
    .trim(),
  body('accountNumber')
    .matches(/^[0-9]{9,18}$/)
    .withMessage('Account number must be 9-18 digits'),
  body('ifscCode')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC code format')
    .toUpperCase(),
  body('bankName').isLength({ min: 2, max: 100 }).withMessage('Bank name must be between 2-100 characters').trim(),
  body('branchName').isLength({ min: 2, max: 100 }).withMessage('Branch name must be between 2-100 characters').trim(),
  body('accountType')
    .optional()
    .isIn(['savings', 'current', 'salary', 'overdraft', 'nri'])
    .withMessage('Invalid account type'),
  body('isPrimary').optional().isBoolean().withMessage('isPrimary must be a boolean'),
  body('dailyLimit').optional().isNumeric().withMessage('Daily limit must be a number'),
  body('monthlyLimit').optional().isNumeric().withMessage('Monthly limit must be a number'),
];

const validateUpdateBankAccount = [
  body('accountHolderName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder name must be between 2-100 characters')
    .trim(),
  body('bankName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Bank name must be between 2-100 characters')
    .trim(),
  body('branchName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Branch name must be between 2-100 characters')
    .trim(),
  body('accountType')
    .optional()
    .isIn(['savings', 'current', 'salary', 'overdraft', 'nri'])
    .withMessage('Invalid account type'),
  body('isPrimary').optional().isBoolean().withMessage('isPrimary must be a boolean'),
  body('dailyLimit').optional().isNumeric().withMessage('Daily limit must be a number'),
  body('monthlyLimit').optional().isNumeric().withMessage('Monthly limit must be a number'),
];

const validateVerifyBankAccount = [
  body('verificationMethod')
    .isIn(['penny_drop', 'bank_statement', 'passbook', 'manual'])
    .withMessage('Invalid verification method'),
  body('pennyDropData.amount').optional().isNumeric().withMessage('Penny drop amount must be a number'),
  body('pennyDropData.referenceId')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Reference ID is required for penny drop'),
  body('pennyDropData.transactionId')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Transaction ID is required for penny drop'),
  body('pennyDropData.status')
    .optional()
    .isIn(['pending', 'success', 'failed'])
    .withMessage('Invalid penny drop status'),
];

const validateRejectBankAccount = [
  body('reason').isLength({ min: 5, max: 500 }).withMessage('Rejection reason must be between 5-500 characters').trim(),
];

const validateRecordTransfer = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('success').optional().isBoolean().withMessage('Success must be a boolean'),
];

const validateMongoId = [param('id').isMongoId().withMessage('Invalid ID format')];

const validateUserParams = [];

export {
  validateCreateBankAccount,
  validateMongoId,
  validateRecordTransfer,
  validateRejectBankAccount,
  validateUpdateBankAccount,
  validateUserParams,
  validateVerifyBankAccount,
};
