import winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

// Initialize Logtail only in production
const logtail = process.env.LOGTAIL_SOURCE_TOKEN ? new Logtail(process.env.LOGTAIL_SOURCE_TOKEN) : null;

// ---------- CUSTOM FORMATS ----------
const prettyJsonFormat = winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
  return JSON.stringify(
    {
      timestamp,
      level,
      message,
      stack,
      ...meta,
    },
    null,
    2
  );
});

const consoleFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const metaPretty = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${level}]: ${message}${metaPretty}`;
});

// ---------- TRANSPORTS ARRAY ----------
const transports = [];

// Add file transports for development/local environments
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.json(),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.json(),
    })
  );
}

// Add Logtail transport for production (cloud logging)
if (process.env.NODE_ENV === 'production' && logtail) {
  transports.push(new LogtailTransport(logtail));
}

// Always add console transport
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      consoleFormat
    ),
  })
);

// ---------- CREATE LOGGER ----------
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    prettyJsonFormat
  ),
  transports,
});

// ---------- HELPERS ----------
export const formatValidationError = (err) => ({
  message: err.message,
  field: err.details?.[0]?.path?.join('.') || null,
  details: err.details?.map((d) => ({
    field: d.path.join('.'),
    message: d.message,
  })),
});

// Booking Logging Wrapper
export const logBookingEvent = (event, data = {}) => {
  logger.info(`Booking Event: ${event}`, {
    event,
    category: 'booking',
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// Vendor Logging Wrapper
export const logVendorEvent = (event, data = {}) => {
  logger.info(`Vendor Event: ${event}`, {
    event,
    category: 'vendor',
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// Notification Logging Wrapper
export const logNotificationEvent = (event, data = {}) => {
  logger.info(`Notification Event: ${event}`, {
    event,
    category: 'notification',
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export default logger;
