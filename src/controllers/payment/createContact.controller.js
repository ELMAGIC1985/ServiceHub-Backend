import config from '../../config/config.js';
import razorpay from '../../config/razorpay.config.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const createRazorpayContact = asyncHandler(async (req, res) => {
  const razorpayKey = config.RAZORPAY_KEY_ID;
  const razorpaySecret = config.RAZORPAY_SECRET;

  const url = 'https://api.razorpay.com/v1/contacts';
  const body = JSON.stringify({
    name: 'Akash Gupta',
    email: 'devkakash20606@gmail.com',
    contact: '9369201975',
    type: 'vendor',
    reference_id: 'Vendor123',
    notes: {
      notes_key_1: 'Tea, Earl Grey, Hot',
      notes_key_2: 'Tea, Earl Grey… decaf.',
    },
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString('base64')}`,
      },
      body: body,
    });

    const data = await response.json();

    if (response.ok) {
      const fundAccount = await razorpay.fundAccount.create({
        contact_id: data.id,
        account_type: 'bank_account',
        bank_account: {
          name: 'Akash Gupta',
          ifsc: 'IDIB000M709',
          account_number: '50436745083',
        },
      });

      res.json({
        message: 'Contact created successfully',
        data: data,
        fundAccount,
      });
    } else {
      console.log('Error:', data);
    }
  } catch (error) {
    console.error('Error creating contact:', error);
  }
});
