import Otp from '../../models/otp_email.model.js'
import generateOTP from '../../utils/generateOTP.js'
import sendEmail from './sendEmail.js'

const sendOTP = async (email) => {
    const otpRecord = await Otp.findOne({ email })
    if (otpRecord) {
        await Otp.deleteOne({ email })
    }
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 90 * 1000)
    const newOtpRecord = new Otp({ email, otp, expiresAt })
    await newOtpRecord.save()

    const subject = 'OTP Verification'
    const message = `Your OTP is ${otp}`
    const emailOTP = await sendEmail(subject, message, email)

    if (emailOTP.success) {
        return { success: true, message: 'OTP sent successfully!' }
    }
    return { success: false, message: 'Failed to send OTP' }
}

export default sendOTP
