import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  static transporter = null;
  static templateCache = new Map();

  static async initialize() {
    try {
      // Enhanced transporter configuration
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        secure: true,
        port: 465,
        auth: {
          user: config.SENDER_EMAIL,
          pass: config.EMAIL_APP_PASSWORD,
        },
        // Enhanced options for better reliability
        pool: true, // Use connection pooling
        maxConnections: 5, // Max concurrent connections
        maxMessages: 100, // Max messages per connection
        rateDelta: 1000, // Rate limiting: 1 second between messages
        rateLimit: 10, // Max 10 messages per rateDelta
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Verify transporter configuration
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');

      // Pre-load email templates
      await this.loadTemplates();
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      throw new Error(`Email service setup failed: ${error.message}`);
    }
  }

  static async loadTemplates() {
    try {
      const templateDir = path.join(__dirname, '../../templates/email');
      const templateFiles = await fs.readdir(templateDir);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs') || file.endsWith('.html')) {
          const templateName = path.parse(file).name;
          const templatePath = path.join(templateDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');

          this.templateCache.set(templateName, handlebars.compile(templateContent));
        }
      }

      console.log(`📧 Loaded ${this.templateCache.size} email templates`);
    } catch (error) {
      console.warn('⚠️ Warning: Could not load email templates:', error.message);
      // Continue without templates, fallback to text emails
    }
  }

  static async sendEmail({
    to,
    subject,
    text = null,
    html = null,
    template = null,
    templateData = {},
    attachments = [],
    priority = 'normal',
    replyTo = null,
  }) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not initialized. Call EmailService.initialize() first.');
      }

      // Validate required fields
      if (!to || !subject) {
        throw new Error('Email address and subject are required');
      }

      // Prepare email content
      let emailHtml = html;
      let emailText = text;

      // Use template if specified
      if (template && this.templateCache.has(template)) {
        const templateFunction = this.templateCache.get(template);
        emailHtml = templateFunction(templateData);

        // Generate text version from HTML if no text provided
        if (!emailText) {
          emailText = this.htmlToText(emailHtml);
        }
      }

      // Fallback to text if no HTML content
      if (!emailHtml && !emailText) {
        throw new Error('Email must have either text or HTML content');
      }

      // Prepare mail options
      const mailOptions = {
        from: {
          name: config.SENDER_NAME || 'Your Platform',
          address: config.SENDER_EMAIL,
        },
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text: emailText,
        html: emailHtml,
        replyTo: replyTo || config.REPLY_TO_EMAIL,

        // Email headers for better deliverability
        headers: {
          'X-Mailer': 'Your Platform Mailer',
          'X-Priority': this.getPriorityValue(priority),
          'List-Unsubscribe': `<${config.UNSUBSCRIBE_URL}>`,
        },

        // Attachments
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType || 'application/octet-stream',
        })),
      };

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      console.log(`✅ Email sent successfully to ${to}:`, {
        messageId: result.messageId,
        subject,
        template: template || 'custom',
      });

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId,
        envelope: result.envelope,
      };
    } catch (error) {
      console.error('❌ Email sending failed:', {
        error: error.message,
        to,
        subject,
        template,
      });

      return {
        success: false,
        message: 'Failed to send email',
        error: error.message,
      };
    }
  }

  static async sendVerificationOTP(email, otp, vendorName = null) {
    return this.sendEmail({
      to: email,
      subject: 'Verify Your Vendor Account - OTP Inside',
      template: 'vendor-verification',
      templateData: {
        vendorName: vendorName || 'Vendor',
        otp,
        expiryMinutes: 10,
        supportEmail: config.SUPPORT_EMAIL || config.SENDER_EMAIL,
        platformName: config.PLATFORM_NAME || 'Your Platform',
        dashboardUrl: config.VENDOR_DASHBOARD_URL || '#',
        year: new Date().getFullYear(),
      },
      priority: 'high',
    });
  }

  static async sendWelcomeEmail(vendor) {
    return this.sendEmail({
      to: vendor.email,
      subject: `Welcome to ${config.PLATFORM_NAME || 'Our Platform'}! 🎉`,
      template: 'vendor-welcome',
      templateData: {
        firstName: vendor.firstName,
        lastName: vendor.lastName,
        fullName: `${vendor.firstName} ${vendor.lastName}`,
        email: vendor.email,
        dashboardUrl: config.VENDOR_DASHBOARD_URL || '#',
        supportUrl: config.SUPPORT_URL || '#',
        platformName: config.PLATFORM_NAME || 'Your Platform',
        year: new Date().getFullYear(),
      },
    });
  }

  static async sendPasswordResetOTP(email, otp, vendorName = null) {
    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Security Code',
      template: 'password-reset',
      templateData: {
        vendorName: vendorName || 'User',
        otp,
        expiryMinutes: 10,
        supportEmail: config.SUPPORT_EMAIL || config.SENDER_EMAIL,
        platformName: config.PLATFORM_NAME || 'Your Platform',
        loginUrl: config.VENDOR_LOGIN_URL || '#',
        year: new Date().getFullYear(),
      },
      priority: 'high',
    });
  }

  static async sendAccountSuspensionEmail(vendor, reason) {
    return this.sendEmail({
      to: vendor.email,
      subject: 'Important: Account Status Update Required',
      template: 'account-suspension',
      templateData: {
        firstName: vendor.firstName,
        reason,
        supportEmail: config.SUPPORT_EMAIL || config.SENDER_EMAIL,
        appealUrl: config.APPEAL_URL || '#',
        platformName: config.PLATFORM_NAME || 'Your Platform',
        year: new Date().getFullYear(),
      },
      priority: 'high',
    });
  }

  static async sendBulkEmail(recipients, emailOptions) {
    const results = [];
    const batchSize = 10; // Send in batches to avoid rate limiting

    try {
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const batchPromises = batch.map((recipient) => {
          return this.sendEmail({
            ...emailOptions,
            to: recipient.email,
            templateData: {
              ...emailOptions.templateData,
              firstName: recipient.firstName,
              lastName: recipient.lastName,
            },
          });
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Wait between batches to respect rate limits
        if (i + batchSize < recipients.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      console.log(`📊 Bulk email results: ${successful} sent, ${failed} failed`);

      return {
        success: true,
        totalSent: successful,
        totalFailed: failed,
        details: results,
      };
    } catch (error) {
      console.error('❌ Bulk email sending failed:', error);
      return {
        success: false,
        message: 'Bulk email sending failed',
        error: error.message,
      };
    }
  }

  /**
   * Send test email (for debugging)
   */
  static async sendTestEmail(toEmail) {
    return this.sendEmail({
      to: toEmail,
      subject: 'Email Service Test',
      text: 'This is a test email to verify the email service is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Email Service Test</h2>
          <p>This is a test email to verify the email service is working correctly.</p>
          <p style="color: #7f8c8d; font-size: 12px;">
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      `,
    });
  }

  /**
   * Utility: Convert HTML to plain text
   */
  static htmlToText(html) {
    return html
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Utility: Get priority value for email headers
   */
  static getPriorityValue(priority) {
    const priorities = {
      low: '5',
      normal: '3',
      high: '1',
    };
    return priorities[priority] || '3';
  }

  /**
   * Utility: Delay function for rate limiting
   */
  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get email service status
   */
  static async getServiceStatus() {
    try {
      if (!this.transporter) {
        return {
          status: 'disconnected',
          message: 'Email service not initialized',
        };
      }

      await this.transporter.verify();
      return {
        status: 'connected',
        message: 'Email service is healthy',
        templatesLoaded: this.templateCache.size,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  /**
   * Close email service connections
   */
  static async close() {
    try {
      if (this.transporter) {
        this.transporter.close();
        console.log('📧 Email service connections closed');
      }
    } catch (error) {
      console.error('Error closing email service:', error);
    }
  }
}

export default EmailService;

export const sendEmail = async (subject, text, toEmail) => {
  try {
    // Initialize service if not already done
    if (!EmailService.transporter) {
      await EmailService.initialize();
    }

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      text,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      message: 'Failed to send email',
      error: error.message,
    };
  }
};
