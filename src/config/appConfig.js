const APP_CONFIG = {
  IS_DEV_MODE: process.env.NODE_ENV !== 'production',

  DEV: {
    OTP: '12345',
    SMS_SIMULATION: true,
    RELAXED_RATE_LIMITS: true,
    DEBUG_LOGGING: true,
    BYPASS_COOLDOWNS: true,
    OTP_EXPIRY: 300, // 5 minutes (same as prod for consistency)
    RATE_LIMITS: {
      OTP_HOURLY: 20,
      OTP_DAILY: 50,
      RESEND_COOLDOWN: 10, // seconds
      IP_REQUESTS_PER_15MIN: 100,
      IP_VERIFY_PER_15MIN: 200,
    },
  },

  // ============ PRODUCTION SETTINGS ============
  PROD: {
    ACTUAL_SMS: true,
    STRICT_RATE_LIMITS: true,
    MINIMAL_LOGGING: false, // Keep some logging for debugging
    OTP_EXPIRY: 300, // 5 minutes
    RATE_LIMITS: {
      OTP_HOURLY: 8,
      OTP_DAILY: 10,
      RESEND_COOLDOWN: 60, // seconds
      IP_REQUESTS_PER_15MIN: 20,
      IP_VERIFY_PER_15MIN: 50,
    },
  },

  // ============ COMMON SETTINGS ============
  COMMON: {
    OTP_LENGTH: 6,
    MAX_ATTEMPTS: 3,
    PHONE_REGEX: /^[6-9]\d{9}$/,
    TOKEN_EXPIRY: {
      ACCESS: process.env.ACCESS_TOKEN_EXPIRY || '15m',
      REFRESH: process.env.REFRESH_TOKEN_EXPIRY || '30d',
    },
    COOKIE_OPTIONS: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  },
};

// ============ COMPUTED CONFIGURATION ============
const CONFIG = {
  // Mode info
  isDevelopment: APP_CONFIG.IS_DEV_MODE,
  isProduction: !APP_CONFIG.IS_DEV_MODE,
  mode: APP_CONFIG.IS_DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION',

  // OTP settings
  otp: {
    devOtp: APP_CONFIG.IS_DEV_MODE ? APP_CONFIG.DEV.OTP : null,
    length: APP_CONFIG.COMMON.OTP_LENGTH,
    maxAttempts: APP_CONFIG.COMMON.MAX_ATTEMPTS,
    expirySeconds: APP_CONFIG.IS_DEV_MODE ? APP_CONFIG.DEV.OTP_EXPIRY : APP_CONFIG.PROD.OTP_EXPIRY,
    useActualSMS: APP_CONFIG.IS_DEV_MODE ? !APP_CONFIG.DEV.SMS_SIMULATION : APP_CONFIG.PROD.ACTUAL_SMS,
  },

  // Rate limiting
  rateLimits: APP_CONFIG.IS_DEV_MODE ? APP_CONFIG.DEV.RATE_LIMITS : APP_CONFIG.PROD.RATE_LIMITS,

  // Logging
  logging: {
    debug: APP_CONFIG.IS_DEV_MODE ? APP_CONFIG.DEV.DEBUG_LOGGING : false,
    minimal: APP_CONFIG.IS_DEV_MODE ? false : APP_CONFIG.PROD.MINIMAL_LOGGING,
  },

  // Common settings
  common: APP_CONFIG.COMMON,
};

// ============ UTILITY FUNCTIONS ============
const getEnvironmentInfo = () => ({
  nodeEnv: process.env.NODE_ENV,
  isDevelopment: CONFIG.isDevelopment,
  isProduction: CONFIG.isProduction,
  mode: CONFIG.mode,
  timestamp: new Date().toISOString(),
});

const logModeInfo = () => {
  console.log('🚀 === APPLICATION STARTUP ===');
  console.log(`🔧 Environment: ${CONFIG.mode}`);
  console.log(`📱 Dev OTP: ${CONFIG.otp.devOtp || 'N/A (Production)'}`);
  console.log(`📧 Use Actual SMS: ${CONFIG.otp.useActualSMS}`);
  console.log(`⏱️ Rate Limits: ${JSON.stringify(CONFIG.rateLimits)}`);
  console.log('🚀 === CONFIG LOADED ===\n');
};

// ============ VALIDATION FUNCTIONS ============
const validateConfig = () => {
  const errors = [];

  // Validate environment variables in production
  if (CONFIG.isProduction) {
    if (!process.env.SMS_API_KEY) {
      errors.push('SMS_API_KEY is required in production mode');
    }
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET is required in production mode');
    }
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required in production mode');
    }
  }

  // Validate OTP settings
  if (CONFIG.otp.length < 4 || CONFIG.otp.length > 8) {
    errors.push('OTP length must be between 4 and 8 digits');
  }

  if (CONFIG.otp.maxAttempts < 1 || CONFIG.otp.maxAttempts > 10) {
    errors.push('Max OTP attempts must be between 1 and 10');
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach((error) => console.error(`   - ${error}`));
    throw new Error('Invalid application configuration');
  }

  console.log('✅ Configuration validation passed');
};

// ============ MODE SWITCHING HELPERS ============
const switchToDevMode = () => {
  if (CONFIG.isDevelopment) {
    console.log('⚠️ Already in development mode');
    return;
  }

  console.log('🔄 Switching to development mode...');
  // Note: This would require application restart in most cases
  APP_CONFIG.IS_DEV_MODE = true;
  console.log('✅ Mode switched to development (restart required)');
};

const switchToProdMode = () => {
  if (CONFIG.isProduction) {
    console.log('⚠️ Already in production mode');
    return;
  }

  console.log('🔄 Switching to production mode...');
  // Note: This would require application restart in most cases
  APP_CONFIG.IS_DEV_MODE = false;
  console.log('✅ Mode switched to production (restart required)');
};

// Initialize configuration on load
validateConfig();
logModeInfo();

export { CONFIG, APP_CONFIG, getEnvironmentInfo, logModeInfo, validateConfig, switchToDevMode, switchToProdMode };

export default CONFIG;
