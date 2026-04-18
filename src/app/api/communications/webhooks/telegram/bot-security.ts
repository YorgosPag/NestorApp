/**
 * 🔒 TELEGRAM BOT SECURITY & ACCESS CONTROL
 *
 * Security checks and rate limiting for Telegram bot.
 * Uses centralized templates for all user-facing messages.
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getTemplateResolver,
  type TelegramLocale
} from './templates/template-resolver';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('TelegramBotSecurity');

export const ALLOWED_COLLECTIONS = [
    COLLECTIONS.PROPERTIES,
    COLLECTIONS.BUILDINGS,
    COLLECTIONS.PROJECTS,
    COLLECTIONS.PARKING_SPACES,
    COLLECTIONS.STORAGE
];

export const FORBIDDEN_KEYWORDS = [
  'όλα', 'όλες', 'όλοι', 'όλων', 'λίστα', 'κατάλογος', 'πλήρης',
  'συνολικά', 'συνολική', 'συνολικό', 'database', 'βάση', 'δεδομένα',
  'export', 'εξαγωγή', 'dump', 'κέρδη', 'έσοδα', 'χρήματα', 'φπα', 'φόρος'
];

export const SECURITY_RULES = {
  MAX_RESULTS: 5,
  MAX_QUERIES_PER_MINUTE: 15, // Increased limit
  REQUIRE_MIN_CRITERIA: 1, // Relaxed criteria
};

export interface SecurityCheckResult {
  forbidden: boolean;
  type?: string;
  keyword?: string;
  message?: string;
}

export function containsForbiddenKeywords(
  text: string,
  locale: TelegramLocale = 'el'
): SecurityCheckResult {
  const t = getTemplateResolver(locale);
  const lowerText = text.toLowerCase();

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return {
        forbidden: true,
        type: 'mass_data_extraction',
        keyword,
        message: t.getText('security.forbidden')
      };
    }
  }
  return { forbidden: false };
}

export function isTooGeneric(searchCriteria: Record<string, unknown>): boolean {
    const criteriaCount = Object.keys(searchCriteria).length;
    return criteriaCount < SECURITY_RULES.REQUIRE_MIN_CRITERIA;
}

export function exceedsResultLimit(resultCount: number): boolean {
    return resultCount > SECURITY_RULES.MAX_RESULTS;
}

/**
 * Get security messages for specified locale
 * @enterprise PR1 - Zero hardcoded strings
 */
export function getSecurityMessages(locale: TelegramLocale = 'el') {
  const t = getTemplateResolver(locale);

  return {
    TOO_GENERIC: `🔍 ${t.getText('security.tooGeneric')}`,
    TOO_MANY_RESULTS: `📊 ${t.getText('security.tooManyResults')}`,
    ACCESS_DENIED: `🚫 ${t.getText('security.accessDenied')}`
  };
}

/**
 * @deprecated Use getSecurityMessages(locale) instead
 * Kept for backward compatibility during migration
 */
export const SECURITY_MESSAGES = getSecurityMessages('el');

export function logSecurityEvent(event: { type: string; query: string; reason: string; userId: string; }): void {
  logger.warn('Security Event', {
    timestamp: nowISO(),
    ...event
  });
}
