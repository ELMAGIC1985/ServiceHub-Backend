import crypto from 'crypto';
import Transaction from '../../models/transaction.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { CalculatorLead } from '../../models/calculatorLead.model.js';
import { createCalculatorAppointmentOrderRazorpay } from './utils/createRazorpayOrder.js';
import config from '../../config/config.js';

const generateBookingId = (userId) => {
  const rand = crypto.randomBytes(3).toString('hex');
  return `APT_${userId.toString().slice(0, 6)}_${rand}`;
};

export const bookCalculatorAppointment = asyncHandler(async (req, res, next) => {
  const { calculatorLeadId, paymentMethod } = req.body;
  const userId = req.user._id;
  const userType = req.userType;

  const lead = await CalculatorLead.findById(calculatorLeadId);
  if (!lead) {
    return next(new ApiError(404, 'Calculator lead not found'));
  }

  if (lead.payment?.paymentStatus === 'paid') {
    return next(new ApiError(400, 'Appointment already paid'));
  }

  // 💰 Appointment fee (can come from settings later)
  const appointmentAmount = 199; // example ₹199

  lead.appointmentId = generateBookingId(userId);
  lead.payment = {
    amount: appointmentAmount,
    paymentMethod,
    paymentStatus: paymentMethod === 'cash' ? 'paid' : 'pending',
    paidAt: paymentMethod === 'cash' ? new Date() : null,
  };

  // 🧾 Create transaction
  const transaction = new Transaction({
    amount: appointmentAmount,
    currency: 'INR',
    transactionType: 'debit',
    status: paymentMethod === 'cash' ? 'success' : 'pending',
    paymentMethod,

    transactionFor: 'appointment_booking',

    paymentDetails: {
      paymentStatus: lead.payment.paymentStatus,
      paymentDate: new Date(),
    },

    relatedEntity: {
      entityType: 'CalculatorLead',
      entityId: lead._id,
    },

    user: {
      userType,
      userId,
    },

    metadata: {
      description: `Appointment booking for calculator lead`,
      channel: 'web',
    },

    references: {
      referenceId: `TXN_APT_${Date.now()}`,
    },

    statusHistory: [
      {
        status: lead.payment.paymentStatus,
        timestamp: new Date(),
      },
    ],
  });

  let razorpayOrder = null;
  console.log('Calculator lead:', lead);
  // 💳 Razorpay flow
  if (paymentMethod === 'razorpay') {
    const data = await createCalculatorAppointmentOrderRazorpay({
      totalAmount: appointmentAmount,
      orderId: lead.appointmentId,
      orderMongoId: lead._id.toString(),
      userId,
      userType,
      transactionId: transaction._id.toString(),
      customer: {
        name: lead.user.name,
        email: lead.user.email,
        contact: lead.user.phone,
      },
    });

    lead.payment.razorpayOrderId = data.razorpayOrder.id;

    razorpayOrder = data.razorpayOrder;

    transaction.paymentDetails.gateway = {
      name: 'razorpay',
      orderId: data.razorpayOrder.id,
    };
  }

  await Promise.all([lead.save(), transaction.save()]);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        appointmentId: lead.appointmentId,
        paymentMethod,
        amount: appointmentAmount,
        razorpayOrder,
        transactionId: transaction._id,
        razorpayConfig: {
          key: config.RAZORPAY_KEY_ID,
          name: 'Appointment Booking',
          description: 'Book an appointment',
          orderId: razorpayOrder.id,
        },
      },
      'Appointment booked successfully'
    )
  );
});
