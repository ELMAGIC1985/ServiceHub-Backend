import Wallet from '../../models/wallet.model.js';
import { updateBalanceSchema, walletValidationSchema } from '../../services/validation/wallet.validation.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { checkUserExists } from '../../utils/helpers/checkUserExists.js';
import { checkSameUser } from '../../utils/helpers/verifyUser.js';

const createWallet = asyncHandler(async (req, res, next) => {
  const { error } = walletValidationSchema.validate(req.body);

  if (error) {
    return next(new ApiError('Invalid userId format', 400));
  }

  const { userId } = req.body;

  const checkSame = await checkSameUser(req, userId);

  if (!checkSame) {
    return next(new ApiError('Not Authorised', 400));
  }

  const isUserExist = await checkUserExists(userId, req?.user?.role);

  if (!isUserExist) {
    return next(new ApiError('User not found', 404));
  }

  const existingWallet = await Wallet.findOne({ userId });

  if (existingWallet) {
    return next(new ApiError('Wallet already exists for this vendor', 400));
  }

  const newWallet = new Wallet({
    userId,
    role: req?.user?.role,
  });

  if (req?.user?.role === 'vendor') {
    isUserExist.wallet = newWallet._id;
  } else if (req?.user?.role === 'customer') {
    isUserExist.wallet = newWallet._id;
  } else if (req?.user?.role === 'admin') {
    isUserExist.wallet = newWallet._id;
  }

  await isUserExist.save();
  await newWallet.save();

  res.status(201).json(new ApiResponse(201, newWallet, 'Wallet created successfully'));
});

const getWallet = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const checkSame = await checkSameUser(req, userId);

  if (!checkSame) {
    return next(new ApiError('Not Authorised', 400));
  }

  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    return next(new ApiError('Wallet not found for this vendor', 404));
  }

  res.status(200).json(new ApiResponse(200, wallet, 'Wallet retrieved successfully'));
});

const updateBalance = asyncHandler(async (req, res, next) => {
  const { error } = updateBalanceSchema.validate(req.body);

  if (error) {
    return next(new ApiError(error.message, 400, error.message || 'Validation Error'));
  }

  const { userId, amount, type } = req.body;

  if (type !== 'increment' && type !== 'decrement') {
    return next(new ApiError("Transaction type must be 'increment' or 'decrement'", 400));
  }

  // Ensure amount is positive
  if (amount <= 0) {
    return next(new ApiError('Amount must be greater than 0', 400));
  }

  // Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await Wallet.findOne({ userId }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Wallet not found for this vendor' });
    }

    // Check if there is enough balance for decrement type
    if (type === 'decrement' && wallet.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return next(new ApiError('Insufficient balance', 400));
    }

    // Perform the balance update based on the type
    if (type === 'increment') {
      wallet.balance += amount;
    } else if (type === 'decrement') {
      wallet.balance -= amount;
    }

    await wallet.save();

    await session.commitTransaction();
    session.endSession();

    res.status(200).json(new ApiResponse(200, wallet, 'Transaction successful'));
  } catch (error) {
    console.error(error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: 'Transaction failed, rollback changes',
    });
  }
});

const incrementBalance = async (req, res) => {
  const { vendorId, amount } = req.body;

  // Ensure amount is positive
  if (amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  // Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await Wallet.findOne({ vendorId }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Wallet not found for this vendor' });
    }

    // Increment the balance
    wallet.balance += amount;

    // Save wallet changes
    await wallet.save();

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Transaction successful', wallet });
  } catch (error) {
    console.error(error);

    // Abort the transaction in case of any errors
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: 'Transaction failed, rollback changes',
    });
  }
};

export { createWallet, getWallet, updateBalance, incrementBalance };
