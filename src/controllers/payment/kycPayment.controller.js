import crypto from 'crypto';
import { Vendor, VendorKYC, Transaction } from '../../models/index.js';
import { ApiError, ApiResponse, asyncHandler } from '../../utils/index.js';
import config from '../../config/config.js';
import razorpay from '../../config/razorpay.config.js';
import { KYC_STATUSES } from '../../models/vendor.kyc.modal.js';
import { createKYCOrder } from './utils/createRazorpayOrder.js';
import { loaderService } from '../../services/common/loader.query.service.js';

export const createKYCPaymentOrder = asyncHandler(async (req, res, next) => {
  const { currency = 'INR' } = req.body;
  const vendorId = req.user._id;

  const settings = await loaderService.loadSetting();

  const kycAmount = parseFloat(settings.kycPrice || 500);
  const validityDays = parseInt(config.KYC_PAYMENT_VALIDITY_DAYS || 30);

  if (!kycAmount || kycAmount <= 0) {
    return next(new ApiError('Invalid KYC payment amount configured', 500));
  }

  try {
    // Check if vendor already has a valid KYC payment
    const existingValidPayment = await Transaction.findValidKYCPaymentForVendor(vendorId);

    if (existingValidPayment && existingValidPayment.canSubmitKYCNow) {
      return res.status(400).json({
        success: false,
        message: 'You already have a valid KYC payment. You can submit your documents now.',
        code: 'VALID_PAYMENT_EXISTS',
        data: {
          existingPayment: {
            transactionId: existingValidPayment._id,
            amount: existingValidPayment.amount,
            validUntil: existingValidPayment.kycDetails.validUntil,
            remainingDays: existingValidPayment.remainingValidityDays,
          },
        },
      });
    }

    // Check if KYC already submitted and approved/pending
    const existingKYC = await VendorKYC.findOne({ vendor: vendorId });
    if (existingKYC && [KYC_STATUSES.APPROVED, KYC_STATUSES.UNDER_REVIEW].includes(existingKYC.kycStatus)) {
      return res.status(400).json({
        success: false,
        message: `KYC already ${existingKYC.kycStatus}. Payment not required.`,
        code: 'KYC_ALREADY_PROCESSED',
        data: {
          kycStatus: existingKYC.kycStatus,
          kycId: existingKYC._id,
        },
      });
    }

    // Create transaction record
    const transaction = new Transaction({
      amount: kycAmount,
      currency,
      transactionType: 'debit',
      status: 'pending',
      paymentMethod: 'razorpay',
      transactionFor: 'kyc_payment',
      user: {
        userType: 'Vendor',
        userId: vendorId,
      },
      relatedEntity: {
        entityType: 'Vendor',
        entityId: vendorId,
      },
      kycDetails: {
        kycPaymentAmount: kycAmount,
        validityDays: validityDays,
        attemptCount: 1,
        maxAttempts: 3,
      },
      metadata: {
        description: 'KYC verification payment',
        businessUnit: 'kyc_verification',
        channel: 'api',
      },
      audit: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        source: 'api',
      },
    });

    await transaction.save();

    let razorpayOrder = null;
    try {
      const customer = {
        name: existingKYC?.firstName + ' ' + existingKYC?.lastName,
        email: existingKYC?.email,
        contact: existingKYC?.phoneNumber,
      };
      const { razorpayOrder: response, paymentLink } = await createKYCOrder({
        totalAmount: kycAmount,
        vendorId,
        userId: vendorId,
        userType: 'Vendor',
        orderId: `KYC_${transaction._id}`,
        transactionId: transaction._id.toString(),
        customer,
      });

      razorpayOrder = response;

      console.log('Payment link created:', paymentLink);

      transaction.paymentDetails.gateway = {
        name: 'razorpay',
        orderId: razorpayOrder.id,
        gatewayResponse: razorpayOrder,
      };
    } catch (razorpayError) {
      return next(new ApiError(500, `Razorpay order creation failed: ${razorpayError.message}`));
    }

    // Set validity period
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);
    transaction.kycDetails.validUntil = validUntil;

    await transaction.save();

    // Response data
    const responseData = {
      transactionId: transaction._id,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
      },
      paymentDetails: {
        amount: kycAmount,
        currency,
        description: 'KYC Verification Payment',
        validityDays,
        validUntil,
      },
      razorpayConfig: {
        key: config.RAZORPAY_KEY_ID,
        name: 'KYC Verification',
        description: 'Payment for KYC document verification',
        theme: {
          color: '#3399cc',
        },
      },
    };

    res.status(201).json(new ApiResponse(201, responseData, 'KYC payment order created successfully'));
  } catch (error) {
    console.error('KYC payment order creation error:', error);

    if (error.error && error.error.code) {
      return next(new ApiError(`Razorpay error: ${error.error.description}`, 400));
    }

    return next(new ApiError('KYC payment order creation failed', 500));
  }
});

export const verifyKYCPayment = asyncHandler(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId } = req.body;

  // Validation
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transactionId) {
    return next(new ApiError(400, 'Missing payment verification details'));
  }

  try {
    // Find the transaction
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return next(new ApiError(404, 'Transaction not found'));
    }

    if (transaction.user.userId.toString() !== req.user._id.toString()) {
      return next(new ApiError(403, 'Unauthorized access to transaction'));
    }

    if (transaction.status === 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment already verified',
        code: 'PAYMENT_ALREADY_VERIFIED',
      });
    }

    // Verify Razorpay signature
    const generated_signature = crypto
      .createHmac('sha256', config.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      // Mark transaction as failed
      await transaction.markAsFailed('Invalid payment signature');
      return next(new ApiError(400, 'Payment verification failed - invalid signature'));
    }

    // Fetch payment details from Razorpay with error handling
    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (razorpayError) {
      console.error('Razorpay API error:', razorpayError);
      await transaction.markAsFailed('Failed to fetch payment details from Razorpay');
      return next(new ApiError(500, 'Unable to verify payment with payment gateway'));
    }

    // Update transaction as successful
    await transaction.markKYCPaymentCompleted(razorpay_payment_id, razorpay_signature, paymentDetails.method);

    // Update payment details with gateway response
    transaction.paymentDetails.gateway.paymentId = razorpay_payment_id;
    transaction.paymentDetails.gateway.signature = razorpay_signature;
    transaction.paymentDetails.gateway.gatewayResponse = paymentDetails;

    // Add payment method details
    transaction.paymentMethodDetails = {
      method: paymentDetails.method,
      bank: paymentDetails.bank || null,
      wallet: paymentDetails.wallet || null,
      vpa: paymentDetails.vpa || null,
      card: paymentDetails.card || null,
    };

    await transaction.save();

    // Update vendor KYC payment status
    const vendorUpdateResult = await Vendor.findByIdAndUpdate(
      req.user._id,
      {
        isKYCPaymentVerified: true,
        kycAmount: transaction.amount,
        kycStatus: KYC_STATUSES.PENDING, // Ready for document submission
      },
      { new: true }
    );

    if (!vendorUpdateResult) {
      return next(new ApiError(500, 'Failed to update vendor KYC status'));
    }

    // Update VendorKYC record
    const vendorKYC = await VendorKYC.findOne({ vendor: req.user._id });

    if (!vendorKYC) {
      return next(new ApiError(404, 'Vendor KYC record not found'));
    }

    vendorKYC.isKYCPaymentVerified = true;
    vendorKYC.kycAmount = transaction.amount;
    await vendorKYC.save();

    res.status(200).json(
      new ApiResponse(
        200,
        {
          transactionId: transaction._id,
          paymentStatus: 'verified',
          amount: transaction.amount,
          paymentDate: transaction.paymentDetails.paymentDate,
          validUntil: transaction.kycDetails.validUntil,
          remainingDays: transaction.remainingValidityDays,
          nextStep: 'Submit KYC documents',
        },
        'KYC payment verified successfully'
      )
    );
  } catch (error) {
    try {
      if (transactionId) {
        const transaction = await Transaction.findById(transactionId);
        if (transaction && transaction.status !== 'failed') {
          await transaction.markAsFailed('System error during verification');
        }
      }
    } catch (markFailedError) {
      console.error('Failed to mark transaction as failed:', markFailedError.message);
    }

    return next(new ApiError(500, 'Payment verification failed due to system error'));
  }
});

export const getKYCPaymentHistory = asyncHandler(async (req, res, next) => {
  const vendorId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  try {
    const skip = (page - 1) * limit;

    const payments = await Transaction.find({
      'user.userId': vendorId,
      'user.userType': 'Vendor',
      transactionFor: 'kyc_payment',
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('amount status createdAt paymentDetails kycDetails references');

    const totalPayments = await Transaction.countDocuments({
      'user.userId': vendorId,
      'user.userType': 'Vendor',
      transactionFor: 'kyc_payment',
    });

    const currentValidPayment = await Transaction.findValidKYCPaymentForVendor(vendorId);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          payments: payments.map((payment) => ({
            transactionId: payment._id,
            amount: payment.amount,
            status: payment.status,
            createdAt: payment.createdAt,
            paymentDate: payment.paymentDetails.paymentDate,
            validUntil: payment.kycDetails?.validUntil,
            isExpired: payment.kycDetails?.isExpired,
            isKYCSubmitted: payment.kycDetails?.isKYCSubmitted,
            remainingDays: payment.remainingValidityDays,
            referenceId: payment.references.referenceId,
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalPayments / limit),
            totalPayments,
            hasNext: page * limit < totalPayments,
            hasPrev: page > 1,
          },
          currentValidPayment: currentValidPayment
            ? {
                transactionId: currentValidPayment._id,
                amount: currentValidPayment.amount,
                validUntil: currentValidPayment.kycDetails.validUntil,
                remainingDays: currentValidPayment.remainingValidityDays,
                canSubmitKYC: currentValidPayment.canSubmitKYCNow,
              }
            : null,
        },
        'KYC payment history retrieved successfully'
      )
    );
  } catch (error) {
    console.error('Get KYC payment history error:', error);
    return next(new ApiError('Failed to retrieve payment history', 500));
  }
});

export const kycPaymentWebhook = async (req, res) => {
  try {
    const secret = config.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify Razorpay signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const expectedSignature = shasum.digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const { event, payload } = req.body;
    const payment = payload.payment.entity;
    const { order_id, notes, id, amount, method, status } = payment;

    console.log('KYC Payment Webhook Event:', event, 'Order ID:', order_id);

    // Handle KYC payment success
    if (event === 'payment.captured' && notes.type === 'kyc_payment') {
      const transaction = await Transaction.findById(notes.transactionId);

      if (!transaction) {
        console.error('Transaction not found for webhook:', notes.transactionId);
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // Update transaction status
      await transaction.markKYCPaymentCompleted(id, null, method);

      // Update additional details from webhook
      transaction.webhook = {
        received: true,
        receivedAt: new Date(),
        webhookData: payload,
        processed: true,
        processedAt: new Date(),
      };

      transaction.paymentDetails.gateway.gatewayResponse = payment;
      transaction.paymentMethodDetails = {
        method: method,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
      };

      await transaction.save();

      // Update vendor status
      await Vendor.findByIdAndUpdate(notes.vendorId, {
        isKYCPaymentVerified: true,
        kycAmount: amount / 100, // Convert from paise to rupees
        kycStatus: KYC_STATUSES.PENDING,
      });

      console.log(`KYC Payment ${notes.transactionId} marked as completed via webhook`);
    }

    // Handle KYC payment failure
    if (event === 'payment.failed' && notes.type === 'kyc_payment') {
      const transaction = await Transaction.findById(notes.transactionId);

      if (transaction) {
        await transaction.markAsFailed(`Payment failed: ${payment.error_description || 'Unknown error'}`);

        transaction.webhook = {
          received: true,
          receivedAt: new Date(),
          webhookData: payload,
          processed: true,
          processedAt: new Date(),
        };

        await transaction.save();

        console.log(`KYC Payment ${notes.transactionId} marked as failed via webhook`);
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('KYC Payment Webhook Error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

export const checkKYCPaymentEligibility = asyncHandler(async (req, res, next) => {
  const vendorId = req.user._id;

  console.log(vendorId);

  try {
    // Check if vendor has valid payment
    const validPayment = await Transaction.findValidKYCPaymentForVendor(vendorId);

    // Check existing KYC status
    const existingKYC = await VendorKYC.findOne({ vendor: vendorId });

    // Get payment configuration
    const kycAmount = parseFloat(config.KYC_PAYMENT_AMOUNT || 500);

    const eligibility = {
      needsPayment: !validPayment,
      canSubmitKYC: validPayment ? validPayment.canSubmitKYCNow : false,
      hasExistingKYC: !!existingKYC,
      kycStatus: existingKYC?.kycStatus || 'not_started',
      paymentAmount: kycAmount,
      currentPayment: validPayment
        ? {
            transactionId: validPayment._id,
            amount: validPayment.amount,
            validUntil: validPayment.kycDetails.validUntil,
            remainingDays: validPayment.remainingValidityDays,
            isKYCSubmitted: validPayment.kycDetails.isKYCSubmitted,
          }
        : null,
    };

    res.status(200).json(new ApiResponse(200, eligibility, 'KYC payment eligibility checked'));
  } catch (error) {
    console.error('Check KYC payment eligibility error:', error);
    return next(new ApiError('Failed to check eligibility', 500));
  }
});

export async function createOrder(amount, currency = 'INR', receipt = null) {
  try {
    const options = {
      amount: amount * 100,
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    console.log('Order created:', order);
    return order;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

export async function createInstantPayment(customerData, amount) {
  try {
    // Create customer first (optional but recommended for tracking)
    const customer = await razorpay.customers.create({
      name: customerData.name,
      email: customerData.email,
      contact: customerData.phone,
    });

    // Create order
    const order = await createOrder(amount);

    // Create payment link with correct structure
    const paymentLinkOptions = {
      amount: amount * 100,
      currency: 'INR',
      accept_partial: false,
      description: 'Payment for order',
      customer_id: customer.id, // Use customer_id instead of customer object
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      callback_url: 'https://yoursite.com/payment-success',
      callback_method: 'get',
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);

    return { order, customer, paymentLink };
  } catch (error) {
    console.error('Error creating instant payment:', error);
    throw error;
  }
}

export const createSimplePaymentLink = async (req, res) => {
  try {
    const amount = 100;
    const currency = 'INR';
    const customer_name = 'Akash';
    const customer_email = 'cotsec14@gmail.com';
    const customer_phone = '9369201975';

    const paymentLinkOptions = {
      amount: amount * 100,
      currency: currency,
      accept_partial: false,
      expire_by: Math.floor(Date.now() / 1000) + 3600 * 24,
      reference_id: 'ORDER_REF_' + Date.now(), // Optional: Unique reference ID
      customer: {
        name: customer_name,
        email: customer_email,
        contact: customer_phone,
      },
      notify: {
        sms: false, // Optional: Notify customer via SMS
        email: false, // Optional: Notify customer via email
      },
      notes: {
        type: 'kyc_payment',
      },
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);
    return res.json(paymentLink);
  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({ error: error.message });
  }
};

// Step 6: Create UPI Payment
export const createUPIPayment = async (req, res) => {
  const amount = 100;
  const currency = 'INR';
  const customer_name = 'Akash';
  const customer_email = 'cotsec14@gmail.com';
  const customer_phone = '9369201975';
  const upi_id = '9369201975@ybl';
  try {
    const order = await createOrder(amount);

    // Create payment with UPI
    const payment = await razorpay.payments.create({
      amount: amount * 100,
      currency: 'INR',
      order_id: order.id,
      method: 'upi',
      upi: {
        vpa: upi_id, // Customer's UPI ID
      },
    });

    return { order, payment };
  } catch (error) {
    console.error('Error creating UPI payment:', error);
    throw error;
  }
};
