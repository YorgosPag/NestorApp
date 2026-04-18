// ============================================================================
// 🏢 ENTERPRISE SEED DATA MANAGEMENT SYSTEM
// ============================================================================

/**
 * 🚀 ENTERPRISE-GRADE SEED DATA CONFIGURATION
 *
 * Environment-based seed data management με proper separation of concerns:
 * - Development: Seed data enabled για testing
 * - Staging: Seed data disabled για realistic testing
 * - Production: Seed data disabled για clean database
 *
 * Τηρεί τα CLAUDE.md enterprise standards:
 * - Centralized configuration ✅
 * - Type-safe environment handling ✅
 * - Single source of truth ✅
 */

import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('seed-data-config');

// ============================================================================
// 🔧 ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * Enterprise-grade environment detection και validation
 */
export const SEED_DATA_CONFIG = {
  // Environment-based enabling/disabling
  ENABLED: process.env.NEXT_PUBLIC_ENABLE_SEED_DATA === 'true',

  // Environment detection
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_STAGING: process.env.VERCEL_ENV === 'preview',

  // Debug information
  DEBUG: process.env.NEXT_PUBLIC_DEBUG === 'true',
} as const;

/**
 * Type-safe configuration validator
 */
export const validateSeedConfig = (): boolean => {
  // Αν είμαστε σε production, το seeding πρέπει να είναι DISABLED
  if (SEED_DATA_CONFIG.IS_PRODUCTION && SEED_DATA_CONFIG.ENABLED) {
    logger.warn('WARNING: Seed data is ENABLED in PRODUCTION environment!');
    return false;
  }

  return true;
};

// ============================================================================
// 📊 SEED DATA DEFINITIONS
// ============================================================================

/**
 * 🚫 MOCK DATA ΠΛΗΡΩΣ ΑΦΑΙΡΕΜΕΝΑ - ΔΕΝ ΥΠΑΡΧΟΥΝ SEED DATA
 *
 * Στο production environment δεν χρειαζόμαστε sample data.
 * Η βάση δεδομένων ξεκινάει εντελώς καθαρή.
 */
export const ENTERPRISE_SEED_CONTACTS = [] as const;

// ============================================================================
// 🚀 ENTERPRISE HELPER FUNCTIONS
// ============================================================================

/**
 * Enterprise-grade function για conditional seeding
 */
export const shouldSeedDatabase = (): boolean => {
  // Validate configuration first
  if (!validateSeedConfig()) {
    return false;
  }

  // Return true μόνο αν είναι explicitly enabled
  return SEED_DATA_CONFIG.ENABLED;
};

/**
 * Get seed data με environment-specific customization
 */
export const getSeedData = () => {
  if (!shouldSeedDatabase()) {
    return [];
  }

  return ENTERPRISE_SEED_CONTACTS;
};

/**
 * Debug logging για development
 */
export const logSeedDataStatus = (): void => {
  if (SEED_DATA_CONFIG.DEBUG) {
    logger.info('Seed Data Configuration', {
      enabled: SEED_DATA_CONFIG.ENABLED,
      environment: process.env.NODE_ENV,
      shouldSeed: shouldSeedDatabase(),
      recordCount: getSeedData().length
    });
  }
};

// ============================================================================
// 📈 ANALYTICS & MONITORING (για μελλοντική επέκταση)
// ============================================================================

/**
 * Enterprise analytics για seed data usage
 */
export const trackSeedDataUsage = (action: 'seeded' | 'skipped' | 'error') => {
  if (SEED_DATA_CONFIG.DEBUG) {
    logger.info(`Seed Data Analytics: ${action} at ${nowISO()}`);
  }

  // Future: Send to analytics service
  // analytics.track('seed_data_action', { action, environment: process.env.NODE_ENV });
};

export default SEED_DATA_CONFIG;
