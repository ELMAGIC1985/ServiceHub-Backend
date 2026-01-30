import crypto from 'crypto';
import { ApiResponse, ApiError, asyncHandler } from '../../utils/index.js';
import config from '../../config/config.js';
import { CalculatorLead, Transaction } from '../../models/index.js';
import { createCalculatorAppointmentOrderRazorpay } from '../payment/utils/createRazorpayOrder.js';

export const submitCalculator = async (req, res, next) => {
  try {
    const lead = await CalculatorLead.create(req.body);

    const razorpayResponse = await bookCalculatorAppointment(req, lead._id, 'razorpay');

    return res.status(201).json({
      success: true,
      message: 'Calculator data submitted successfully',
      data: {
        ...lead.toObject(),
        ...razorpayResponse,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCalculatorLeads = async (req, res, next) => {
  try {
    const leads = await CalculatorLead.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: leads,
    });
  } catch (error) {
    next(error);
  }
};

export const getCalculatorLeadById = async (req, res, next) => {
  try {
    const lead = await CalculatorLead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCalculatorStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const lead = await CalculatorLead.findById(id);

    if (!lead) {
      return next(new ApiError(404, 'Lead not found'));
    }

    lead.status = status;

    await lead.save();

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

const generateBookingId = (userId) => {
  const rand = crypto.randomBytes(3).toString('hex');
  return `APT_${userId.toString().slice(0, 6)}_${rand}`;
};

const bookCalculatorAppointment = async (req, calculatorLeadId, paymentMethod) => {
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

  return {
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
  };
};
