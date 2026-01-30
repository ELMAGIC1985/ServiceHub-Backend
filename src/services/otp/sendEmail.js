import nodemailer from 'nodemailer';
import config from '../../config/config.js';

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

const sendEmail = async (data) => {
  const { to, subject, text } = data;
  const transporter = createTransporter();

  const mailOptions = {
    from: config.SENDER_EMAIL,
    to: to,
    subject: subject,
    text: text,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Email sent successfully!' };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      message: 'Failed to send email',
      error: error.message,
    };
  }
};

export default sendEmail;
