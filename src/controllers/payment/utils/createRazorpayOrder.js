import razorpay from '../../../config/razorpay.config.js';
import { ApiError } from '../../../utils/index.js';
import { transformQrDataToOrder } from './transformQrDataToOrder.js';

export const createRazorpayOrder = async (orderData) => {
  try {
    const { amount, currency = 'INR', receipt, notes = {}, customer = {}, createPaymentLink = true } = orderData;

    if (!amount || !receipt) {
      throw new ApiError(400, 'Amount and receipt are required for Razorpay order creation');
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes: {
        ...notes,
        created_at: new Date().toISOString(),
      },
    });

    let paymentLink = null;

    if (createPaymentLink && customer.name && customer.email) {
      try {
        paymentLink = await razorpay.paymentLink.create({
          amount: Math.round(amount * 100),
          currency,
          accept_partial: false,
          expire_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // Expires in 24 hours
          reference_id: receipt,
          description: `Payment for order ${receipt}`,
          customer: {
            name: customer.name,
            email: customer.email,
            contact: customer.contact || '',
          },
          notify: {
            sms: customer.contact ? true : false,
            email: true,
          },
          reminder_enable: true,
          notes: {
            ...notes,
            order_id: razorpayOrder.id,
            created_at: new Date().toISOString(),
          },
        });
      } catch (linkError) {
        console.error('Payment link creation failed:', linkError);
      }
    }

    // console.log('Razorpay order created:', razorpayOrder, paymentLink, customer);

    return {
      razorpayOrder,
      paymentLink,
      ...razorpayOrder,
    };
  } catch (error) {
    if (error.statusCode) {
      throw new ApiError(
        error.statusCode,
        `Razorpay order creation failed: ${error.error?.description || error.message}`
      );
    }

    throw new ApiError(500, `Razorpay order creation failed: ${error.message}`);
  }
};

export const createRazorpayQRDirect = async (orderData) => {
  try {
    const { amount, currency = 'INR', receipt, notes = {}, customer = {} } = orderData;

    if (!razorpay.qrCode) {
      throw new ApiError(400, 'Razorpay QR Code API not available. Use payment link with QR instead.');
    }

    const qrCode = await razorpay.qrCode.create({
      type: 'upi_qr',
      name: customer.name || 'Payment QR',
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: Math.round(amount * 100),
      description: `Payment for ${receipt}`,
      customer_id: customer.customerId || undefined,
      notes: {
        ...notes,
        receipt,
        created_at: new Date().toISOString(),
      },
      close_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    });

    // console.log('Razorpay QR Code created:', qrCode, {
    //   qrCodeId: qrCode.id,
    //   qrCodeUrl: qrCode.image_url,
    //   paymentUrl: qrCode.payment_url,
    //   status: qrCode.status,
    // });

    return transformQrDataToOrder(qrCode);
  } catch (error) {
    console.error('Razorpay QR creation failed:', error);
    throw new ApiError(500, `Razorpay QR creation failed: ${error.message}`);
  }
};

export const createProductOrderRazorpay = async ({
  totalAmount,
  orderId,
  orderMongoId,
  userId,
  userType,
  transactionId,
  customer,
}) => {
  const orderData = {
    amount: totalAmount,
    currency: 'INR',
    receipt: orderId,
    customer,
    notes: {
      type: 'product_order',
      orderId: orderMongoId,
      userId: userId,
      userType: userType,
      transactionId: transactionId,
      orderType: 'product',
    },
  };

  await createRazorpayQRDirect(orderData);

  return await createRazorpayOrder(orderData);
};

export const createKYCOrder = async ({ vendorId, customer = {}, totalAmount, orderId, userType, transactionId }) => {
  const orderData = {
    amount: totalAmount,
    currency: 'INR',
    receipt: orderId,
    customer,
    notes: {
      type: 'kyc_payment',
      vendorId,
      userId: vendorId,
      userType: userType,
      transactionId,
      orderType: 'kyc',
    },
  };

  console.log('orderdata', orderData);
  return await createRazorpayOrder(orderData);
};

export const createMembershipOrderRazorpay = async ({
  totalAmount,
  orderId,
  orderMongoId,
  userId,
  userType,
  transactionId,
  customer,
}) => {
  const orderData = {
    amount: totalAmount,
    currency: 'INR',
    receipt: orderId,
    customer,
    notes: {
      type: 'membership_purchase',
      orderId,
      orderMongoId,
      userId,
      userType,
      transactionId,
      orderType: 'membership',
    },
  };

  return await createRazorpayOrder(orderData);
};

export const createWalletTopupOrderRazorpay = async ({
  totalAmount,
  orderId,
  orderMongoId, // This should be the wallet._id, not an order ID
  userId,
  userType,
  transactionId,
  customer,
}) => {
  const orderData = {
    amount: totalAmount,
    currency: 'INR',
    receipt: orderId,
    customer,
    notes: {
      type: 'wallet_topup',
      orderId,
      orderMongoId,
      userId,
      userType,
      transactionId,
      orderType: 'wallet',
    },
  };

  return await createRazorpayOrder(orderData);
};

export const createBookingOrderRazorpay = async ({
  totalAmount,
  orderId,
  orderMongoId,
  userId,
  userType,
  transactionId,
  customer,
  bookingDetails = {},
}) => {
  const orderData = {
    amount: totalAmount,
    currency: 'INR',
    receipt: orderId,
    customer,
    notes: {
      type: 'booking_payment',
      orderId,
      orderMongoId,
      userId,
      userType,
      transactionId,
      orderType: 'booking',
      serviceTemplateId: bookingDetails.serviceTemplateId || '',
      categoryId: bookingDetails.categoryId || '',
      vendorId: bookingDetails.vendorId || '',
      bookingDate: bookingDetails.bookingDate || '',
      timeSlot: bookingDetails.timeSlot || '',
    },
  };

  return await createRazorpayOrder(orderData);
};

export const createCalculatorAppointmentOrderRazorpay = async ({
  totalAmount,
  orderId,
  orderMongoId,
  userId,
  userType,
  transactionId,
  customer,
}) => {
  const orderData = {
    amount: totalAmount,
    currency: 'INR',
    receipt: orderId,
    customer,
    notes: {
      type: 'appointment_payment',
      orderId,
      orderMongoId,
      userId,
      userType,
      transactionId,
      orderType: 'appointment',
    },
  };

  return await createRazorpayOrder(orderData);
};

export const updateTransactionWithRazorpay = (transaction, razorpayOrder) => {
  if (!transaction.paymentDetails) {
    transaction.paymentDetails = {};
  }

  transaction.paymentDetails.gateway = {
    name: 'razorpay',
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    receipt: razorpayOrder.receipt,
    status: razorpayOrder.status,
    createdAt: new Date(razorpayOrder.created_at * 1000),
  };

  return transaction;
};

export const createBookingOrderQrRazorpay = async ({
  totalAmount,
  orderId,
  orderMongoId,
  userId,
  userType,
  transactionId,
  customer,
  bookingDetails = {},
}) => {
  const orderData = {
    amount: totalAmount,
    currency: 'INR',
    receipt: orderId,
    customer,
    notes: {
      type: 'booking_payment',
      orderId,
      orderMongoId,
      userId,
      userType,
      transactionId,
      orderType: 'booking',
      serviceTemplateId: bookingDetails.serviceTemplateId || '',
      categoryId: bookingDetails.categoryId || '',
      vendorId: bookingDetails.vendorId || '',
      bookingDate: bookingDetails.bookingDate || '',
      timeSlot: bookingDetails.timeSlot || '',
    },
  };

  return await createRazorpayQRDirect(orderData);
};
