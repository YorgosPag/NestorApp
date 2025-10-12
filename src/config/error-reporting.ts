/**
 * 📊 ERROR REPORTING CONFIGURATION
 *
 * Enterprise error reporting configuration για GEO-ALERT system
 * Centralized config για ErrorTracker και external services
 *
 * Features:
 * - Environment-based configuration
 * - External service integration (Sentry, custom endpoints)
 * - Error filtering rules
 * - Performance monitoring settings
 * - User privacy controls
 */

import { type ErrorTrackerConfig } from '@/services/ErrorTracker';

// ============================================================================
// ENVIRONMENT-BASED CONFIGURATION
// ============================================================================

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'staging';

// ============================================================================
// ERROR REPORTING CONFIGURATION
// ============================================================================

export const errorReportingConfig: ErrorTrackerConfig = {
  // **🎯 Feature Flags**
  enabled: true,
  captureConsoleErrors: isDevelopment, // Only in development
  captureUnhandledPromises: true,
  captureNetworkErrors: true,

  // **🔢 Limits & Thresholds**
  maxErrorsPerSession: isProduction ? 50 : 100,
  maxStoredErrors: isProduction ? 30 : 50,

  // **🚫 Error Filtering**
  ignoredErrors: [
    // Browser/Extension Errors
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'Script error.',
    'Loading chunk',
    'Loading CSS chunk',

    // Chrome Extension Errors
    'Extension context invalidated',
    'Could not establish connection',

    // Network Errors (όχι κρίσιμα)
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',

    // Ad Blockers
    'blocked by ad blocker',
    'adblocker',

    // Development Hot Reload
    'HMR',
    'hot reload',

    // Map Tile Loading (αναμενόμενα)
    'tile load error',
    'map tile failed',

    // DXF Parser (αναμενόμενα για invalid files)
    'DXF parse error',
    'Invalid DXF format'
  ],

  ignoredUrls: [
    // Browser Extensions
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'edge-extension://',

    // Analytics & Social
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.net',
    'twitter.com',

    // Ad Networks
    'doubleclick.net',
    'googlesyndication.com',
    'amazon-adsystem.com'
  ],

  // **💾 Storage Settings**
  persistErrors: true,

  // **🌐 External Integration**
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  customEndpoint: process.env.NEXT_PUBLIC_ERROR_ENDPOINT,

  // **🐛 Debug Settings**
  debug: isDevelopment
};

// ============================================================================
// ENVIRONMENT-SPECIFIC OVERRIDES
// ============================================================================

export const getErrorConfig = (): ErrorTrackerConfig => {
  const baseConfig = { ...errorReportingConfig };

  if (isDevelopment) {
    return {
      ...baseConfig,
      debug: true,
      captureConsoleErrors: true,
      maxErrorsPerSession: 100,
      maxStoredErrors: 50
    };
  }

  if (isStaging) {
    return {
      ...baseConfig,
      debug: false,
      captureConsoleErrors: false,
      maxErrorsPerSession: 75,
      maxStoredErrors: 40
    };
  }

  if (isProduction) {
    return {
      ...baseConfig,
      debug: false,
      captureConsoleErrors: false,
      maxErrorsPerSession: 50,
      maxStoredErrors: 30,
      // Production-only: Αυστηρότερο filtering
      ignoredErrors: [
        ...baseConfig.ignoredErrors,
        'Non-critical production error',
        'Temporarily unavailable'
      ]
    };
  }

  return baseConfig;
};

// ============================================================================
// ERROR SEVERITY MAPPING
// ============================================================================

export const errorSeverityMapping = {
  // **🔴 Critical Errors** - Άμεση προσοχή
  critical: [
    'authentication failed',
    'authorization denied',
    'database connection lost',
    'payment processing error',
    'data corruption detected',
    'security breach detected'
  ],

  // **🟠 High Priority Errors** - Υψηλή προτεραιότητα
  error: [
    'api request failed',
    'component render error',
    'state update failed',
    'polygon validation error',
    'map initialization failed',
    'file upload error'
  ],

  // **🟡 Warnings** - Χαμηλότερη προτεραιότητα
  warning: [
    'deprecated api usage',
    'slow performance detected',
    'missing translation key',
    'invalid user input',
    'feature flag disabled',
    'cache miss'
  ],

  // **🔵 Info** - Ενημερωτικά
  info: [
    'user action completed',
    'feature accessed',
    'system status update',
    'analytics event',
    'debug information'
  ]
};

// ============================================================================
// PERFORMANCE MONITORING CONFIG
// ============================================================================

export const performanceConfig = {
  // **⏱️ Performance Thresholds**
  thresholds: {
    // Page Load Performance
    pageLoadTime: 3000,        // 3 seconds
    firstContentfulPaint: 1500, // 1.5 seconds
    largestContentfulPaint: 2500, // 2.5 seconds

    // Component Performance
    componentRenderTime: 100,   // 100ms
    mapRenderTime: 500,        // 500ms
    polygonDrawTime: 200,      // 200ms

    // Network Performance
    apiResponseTime: 2000,     // 2 seconds
    fileUploadTime: 10000,     // 10 seconds

    // Memory Usage
    memoryUsage: 100 * 1024 * 1024, // 100MB

    // Error Frequency
    errorRate: 0.05            // 5% error rate threshold
  },

  // **📊 Metrics Collection**
  enableMetrics: isProduction || isStaging,
  metricsInterval: 30000, // 30 seconds

  // **🎯 Sampling Rates**
  samplingRates: {
    development: 1.0,  // 100% sampling
    staging: 0.5,      // 50% sampling
    production: 0.1    // 10% sampling
  }
};

// ============================================================================
// USER PRIVACY CONFIGURATION
// ============================================================================

export const privacyConfig = {
  // **🔒 PII Protection**
  scrubPII: true,
  piiPatterns: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,          // Credit Card
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,                     // SSN
    /\b\d{10,}\b/g                                           // Phone Numbers
  ],

  // **🍪 Cookie Consent**
  requireConsent: isProduction,
  consentKey: 'geo_alert_error_tracking_consent',

  // **📊 Data Retention**
  dataRetentionDays: isProduction ? 30 : 7,

  // **🌍 GDPR Compliance**
  enableGDPRMode: isProduction,
  allowUserOptOut: true
};

// ============================================================================
// NOTIFICATION CONFIGURATION
// ============================================================================

export const notificationConfig = {
  // **🔔 Alert Conditions**
  alertOn: {
    criticalErrors: true,
    highErrorRate: true,
    performanceIssues: isProduction,
    newErrorTypes: true
  },

  // **📧 Notification Channels**
  channels: {
    email: process.env.NEXT_PUBLIC_ALERT_EMAIL,
    webhook: process.env.NEXT_PUBLIC_ALERT_WEBHOOK,
    slack: process.env.NEXT_PUBLIC_SLACK_WEBHOOK
  },

  // **⏰ Rate Limiting**
  rateLimits: {
    maxAlertsPerHour: 10,
    maxAlertsPerDay: 50,
    cooldownPeriod: 300000 // 5 minutes
  }
};

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Get configuration for current environment
 */
export const getCurrentConfig = () => ({
  errorReporting: getErrorConfig(),
  performance: performanceConfig,
  privacy: privacyConfig,
  notifications: notificationConfig
});

/**
 * Check if error should be reported based on environment
 */
export const shouldReportError = (error: Error): boolean => {
  const config = getErrorConfig();

  if (!config.enabled) return false;

  // Check ignored errors
  const isIgnored = config.ignoredErrors.some(pattern =>
    error.message.toLowerCase().includes(pattern.toLowerCase())
  );

  if (isIgnored) return false;

  // Check privacy settings
  if (privacyConfig.requireConsent) {
    const hasConsent = localStorage.getItem(privacyConfig.consentKey) === 'true';
    if (!hasConsent) return false;
  }

  return true;
};

/**
 * Get sampling rate for current environment
 */
export const getSamplingRate = (): number => {
  if (isDevelopment) return performanceConfig.samplingRates.development;
  if (isStaging) return performanceConfig.samplingRates.staging;
  return performanceConfig.samplingRates.production;
};

/**
 * Check if user has opted out of error tracking
 */
export const hasUserOptedOut = (): boolean => {
  if (!privacyConfig.allowUserOptOut) return false;
  return localStorage.getItem('geo_alert_error_tracking_opt_out') === 'true';
};

// ============================================================================
// EXPORT DEFAULTS
// ============================================================================

export default {
  errorReporting: errorReportingConfig,
  performance: performanceConfig,
  privacy: privacyConfig,
  notifications: notificationConfig,
  getCurrentConfig,
  shouldReportError,
  getSamplingRate,
  hasUserOptedOut
};