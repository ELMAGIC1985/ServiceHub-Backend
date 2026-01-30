import Otp from '../../models/otp_email.model';

class OtpService {
  static generateOTP(length = 6) {
    return crypto.randomInt(100000, 999999).toString();
  }

  static async generateAndSend({ email, type, userId }) {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save OTP to database
      await Otp.findOneAndUpdate(
        { email: email.toLowerCase(), type },
        {
          otp: otp,
          expiresAt,
          attempts: 0,
          userId,
          createdAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // Send email based on type
      let emailResult;
      switch (type) {
        case 'EMAIL_VERIFICATION':
          emailResult = await EmailService.sendVerificationOTP(email, otp);
          break;
        case 'PASSWORD_RESET':
          emailResult = await EmailService.sendPasswordResetOTP(email, otp);
          break;
        default:
          throw new Error('Invalid OTP type');
      }

      if (!emailResult.success) {
        logger.error('Failed to send OTP email', { email, type, error: emailResult.error });
        return { success: false, message: 'Failed to send OTP email' };
      }

      logger.info('OTP generated and sent successfully', { email, type });
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      logger.error('Error generating and sending OTP', { error: error.message, email, type });
      return { success: false, message: 'Failed to generate OTP' };
    }
  }

  static async verify({ email, otp, type }) {
    try {
      const otpRecord = await Otp.findOne({
        email: email.toLowerCase(),
        type,
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        return { success: false, message: 'OTP not found or expired' };
      }

      // Check attempt limit
      if (otpRecord.attempts >= 5) {
        await Otp.deleteOne({ _id: otpRecord._id });
        return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
      }

      // Verify OTP
      if (otpRecord.otp !== otp) {
        await Otp.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
        return { success: false, message: 'Invalid OTP' };
      }

      // OTP is valid - delete the record
      await Otp.deleteOne({ _id: otpRecord._id });

      logger.info('OTP verified successfully', { email, type });
      return {
        success: true,
        message: 'OTP verified successfully',
        userId: otpRecord.userId,
      };
    } catch (error) {
      logger.error('Error verifying OTP', { error: error.message, email, type });
      return { success: false, message: 'OTP verification failed' };
    }
  }
}
