/**
 * ============================================================================
 * 🏢 ENTERPRISE BUSINESS RULES UTILITIES
 * ============================================================================
 *
 * Κεντρικοποιημένες business rules που αντικαθιστούν hardcoded values
 * Χρησιμοποιεί το Enterprise Configuration Management System
 *
 * Microsoft/Google/Apple enterprise pattern:
 * - Configuration-driven business logic
 * - Type-safe constants extraction
 * - Fallback to sensible defaults
 * - Single source of truth
 *
 * ============================================================================
 */

import { DEFAULT_SYSTEM_CONFIG } from './enterprise-config-management';
import type { SystemConfiguration } from './enterprise-config-management';

// ============================================================================
// 🎯 OBLIGATIONS BUSINESS RULES
// ============================================================================

export interface ObligationsBusinessRules {
  readonly qualityThreshold: number;
  readonly progressThresholds: {
    readonly excellent: number;
    readonly good: number;
    readonly moderate: number;
  };
  readonly wordCountThresholds: {
    readonly minimum: number;
    readonly excellent: number;
  };
  readonly defaultReadingSpeed: number;
}

/**
 * Εξάγει τα obligations business rules από το configuration system
 * Χρησιμοποιεί fallback στα defaults αν δεν υπάρχει configuration
 */
export function getObligationsBusinessRules(config?: SystemConfiguration): ObligationsBusinessRules {
  const systemConfig = config || DEFAULT_SYSTEM_CONFIG;
  return systemConfig.businessRules.obligations;
}

/**
 * Εξάγει το quality threshold από το configuration
 */
export function getQualityThreshold(config?: SystemConfiguration): number {
  return getObligationsBusinessRules(config).qualityThreshold;
}

/**
 * Εξάγει τα progress thresholds από το configuration
 */
export function getProgressThresholds(config?: SystemConfiguration) {
  return getObligationsBusinessRules(config).progressThresholds;
}

/**
 * Εξάγει τα word count thresholds από το configuration
 */
export function getWordCountThresholds(config?: SystemConfiguration) {
  return getObligationsBusinessRules(config).wordCountThresholds;
}

/**
 * Εξάγει την default reading speed από το configuration
 */
export function getDefaultReadingSpeed(config?: SystemConfiguration): number {
  return getObligationsBusinessRules(config).defaultReadingSpeed;
}

// ============================================================================
// 🚀 CONVENIENCE EXPORTS FOR COMMON USAGE
// ============================================================================

/**
 * Άμεσος export των συνηθέστερων constants για εύκολη χρήση
 * Αυτά θα χρησιμοποιηθούν στα modular files
 */
export const QUALITY_THRESHOLD = getQualityThreshold();
export const PROGRESS_THRESHOLDS = getProgressThresholds();
export const WORD_COUNT_THRESHOLDS = getWordCountThresholds();
export const DEFAULT_READING_SPEED = getDefaultReadingSpeed();