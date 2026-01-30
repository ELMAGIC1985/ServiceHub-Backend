import {
  createBookingOrderQrRazorpay,
  createBookingOrderRazorpay,
} from '../../controllers/payment/utils/createRazorpayOrder.js';

class PaymentGatewayService {
  async createOrder({ totalAmount, orderId, orderMongoId, userId, userType, transactionId, customer }) {
    try {
      return await createBookingOrderRazorpay({
        totalAmount,
        orderId,
        orderMongoId,
        userId,
        userType,
        transactionId,
        customer,
      });
    } catch (error) {
      throw new PaymentGatewayError(`Razorpay order creation failed: ${error.message}`);
    }
  }
  async createQrOrder({ totalAmount, orderId, orderMongoId, userId, userType, transactionId, customer }) {
    try {
      return await createBookingOrderQrRazorpay({
        totalAmount,
        orderId,
        orderMongoId,
        userId,
        userType,
        transactionId,
        customer,
      });
    } catch (error) {
      throw new PaymentGatewayError(`Razorpay order creation failed: ${error.message}`);
    }
  }
}

class PaymentGatewayError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

export { PaymentGatewayService };
