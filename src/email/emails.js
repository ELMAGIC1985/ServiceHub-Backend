import nodemailer from 'nodemailer';

import {
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  EMAIL_VERIFICATION_TEMPLATE,
} from './template.js';
import config from '../config/config.js';
import { ORDER_CREATED_TEMPLATE } from './templates/productOrderTemplate.js';

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    port: 465,
    auth: {
      user: config.SENDER_EMAIL,
      pass: config.EMAIL_APP_PASSWORD,
    },
  });
};

const getMailOptions = (toEmail, subject, html) => {
  return {
    from: config.SENDER_EMAIL,
    to: toEmail,
    subject: subject,
    html: html,
  };
};

const sendEmail = async (email, subject, template, templateData) => {
  const transporter = createTransporter();

  const templates = {
    ORDER_CONFIRMATION: (data) => ORDER_CREATED_TEMPLATE(data.orderId, data.name, data.products, data.totalAmount),
    PASSWORD_RESET: (data) => PASSWORD_RESET_REQUEST_TEMPLATE(data.resetUrl),
    PASSWORD_RESET_SUCCESS: () => PASSWORD_RESET_SUCCESS_TEMPLATE(),
    EMAIL_VERIFICATION: (data) => EMAIL_VERIFICATION_TEMPLATE(data.verificationUrl),
    WELCOME: (data) => WELCOME_USER_TEMPLATE(data.name),
  };

  const templateGenerator = templates[template];
  if (!templateGenerator) {
    return {
      success: false,
      message: `Template "${template}" not found`,
    };
  }

  const emailContent = templateGenerator(templateData);

  const mailOptions = getMailOptions(email, subject, emailContent);

  try {
    await transporter.sendMail(mailOptions);
    return {
      success: true,
      message: `${subject} email sent successfully!`,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      message: `Failed to send ${subject.toLowerCase()} email`,
      error: error.message,
    };
  }
};

export const sendWelcomeEmail = async (email, name) => {
  return sendEmail(email, 'Welcome to our platform', 'WELCOME', { name });
};

export const sendOrderConfirmationEmail = async (email, name, orderId, products, totalAmount) => {
  return sendEmail(email, 'Order Confirmation', 'ORDER_CONFIRMATION', {
    orderId,
    name,
    products,
    totalAmount,
  });
};

export const sendForgotPasswordEmail = async (email, resetUrl) => {
  return sendEmail(email, 'Password Reset Request', 'PASSWORD_RESET', { resetUrl });
};

export const sendEmailVerificationEmail = async (email, verificationUrl) => {
  return sendEmail(email, 'Email Verification', 'EMAIL_VERIFICATION', { verificationUrl });
};

