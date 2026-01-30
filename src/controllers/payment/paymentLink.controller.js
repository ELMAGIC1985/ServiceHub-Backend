// Core reusable function to create payment links
export const createPaymentLink = async (options) => {
  try {
    const {
      amount,
      currency = 'INR',
      customer,
      acceptPartial = false,
      expiryHours = 24,
      referenceId,
      notes = {},
      notify = { sms: false, email: false },
      description,
      callbackUrl,
      callbackMethod = 'get',
    } = options;

    if (!amount || amount <= 0) {
      throw new Error('Amount is required and must be greater than 0');
    }

    if (!customer || !customer.name || !customer.email) {
      throw new Error('Customer name and email are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      throw new Error('Invalid email format');
    }

    // Validate phone if provided
    if (customer.contact && !/^\d{10}$/.test(customer.contact.replace(/\D/g, ''))) {
      throw new Error('Invalid phone number format');
    }

    const paymentLinkOptions = {
      amount: Math.round(amount * 100), // Convert to paise and ensure integer
      currency: currency.toUpperCase(),
      accept_partial: acceptPartial,
      expire_by: Math.floor(Date.now() / 1000) + expiryHours * 3600,
      reference_id: referenceId || `ORDER_REF_${Date.now()}`,
      customer: {
        name: customer.name.trim(),
        email: customer.email.toLowerCase().trim(),
        ...(customer.contact && { contact: customer.contact.replace(/\D/g, '') }),
      },
      notify,
      notes: {
        created_at: new Date().toISOString(),
        ...notes,
      },
    };

    // Add optional fields if provided
    if (description) {
      paymentLinkOptions.description = description;
    }

    if (callbackUrl) {
      paymentLinkOptions.callback_url = callbackUrl;
      paymentLinkOptions.callback_method = callbackMethod;
    }

    const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);

    return {
      success: true,
      data: paymentLink,
      paymentUrl: paymentLink.short_url || paymentLink.url,
    };
  } catch (error) {
    console.error('Error creating payment link:', error);
    return {
      success: false,
      error: error.message,
      code: error.code || 'PAYMENT_LINK_ERROR',
    };
  }
};

// Express.js controller wrapper
export const createPaymentLinkController = async (req, res) => {
  try {
    const result = await createPaymentLink(req.body);

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Payment link controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

export const createSimplePaymentLink = async (req, res) => {
  const options = {
    amount: 100,
    currency: 'INR',
    customer: {
      name: 'Akash',
      email: 'cotsec14@gmail.com',
      contact: '9369201975',
    },
    notes: {
      type: 'kyc_payment',
    },
  };

  return createPaymentLinkController({ body: options }, res);
};

// Utility function for KYC payments
export const createKycPaymentLink = async (customerData, amount = 100) => {
  return createPaymentLink({
    amount,
    customer: customerData,
    notes: {
      type: 'kyc_payment',
      category: 'verification',
    },
    expiryHours: 24,
    notify: {
      sms: false,
      email: true,
    },
  });
};

// Utility function for subscription payments
export const createSubscriptionPaymentLink = async (customerData, planDetails) => {
  const { amount, planId, planName, billingCycle } = planDetails;

  return createPaymentLink({
    amount,
    customer: customerData,
    description: `Subscription payment for ${planName}`,
    notes: {
      type: 'subscription_payment',
      plan_id: planId,
      plan_name: planName,
      billing_cycle: billingCycle,
    },
    expiryHours: 72, // 3 days for subscription payments
    notify: {
      sms: true,
      email: true,
    },
  });
};
