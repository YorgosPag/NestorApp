import { Logger, LogLevel, DevNullOutput } from '../settings/telemetry/Logger';

// =============================================================================
// 🏢 ENTERPRISE LOGGER CONFIGURATION
// =============================================================================

/**
 * DxfFirestore Logger - Enterprise-grade logging with configurable levels
 *
 * In PRODUCTION: Only ERROR level logs (clean console)
 * In DEVELOPMENT: DEBUG level logs (verbose for debugging)
 *
 * @enterprise ADR - Centralized Logging System
 */
export const dxfLogger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  prefix: '[DxfFirestore]',
  // In production, use DevNullOutput for DEBUG/INFO to ensure zero noise
  output: process.env.NODE_ENV === 'production' ? new DevNullOutput() : undefined,
});

/**
 * Error classification for intelligent logging
 * @enterprise Pattern: Error categorization for appropriate log levels
 */
export const isExpectedError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  // These are expected scenarios (file doesn't exist, no permission for missing doc)
  return (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('does not exist') ||
    (message.includes('permission') && message.includes('missing'))
  );
};
