import config from '../../config/config.js';
import crypto from 'crypto';

export const verifyPaymentDetails = async (razorpay_payment_id) => {
  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(config.RAZORPAY_KEY_ID + ':' + config.RAZORPAY_SECRET).toString('base64')}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to verify payment status with Razorpay');
      return false;
    }

    const paymentDetails = await response.json();

    if (paymentDetails.status !== 'captured') {
      return false;
    }

    return { status: true, paymentDetails };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
};

export const verifyPaymentFrontend = async (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  const generatedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    return false;
  }

  return true;
};
