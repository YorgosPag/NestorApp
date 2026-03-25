/**
 * Internationalization utilities using native Intl APIs
 * Provides consistent formatting across the application
 *
 * Barrel re-export: all formatting functions are split across:
 *   - intl-formatting.ts (core Intl API wrappers)
 *   - intl-domain.ts     (domain-specific + backward compat aliases)
 */

// Lazy-load i18n to avoid pulling react-i18next -> React.createContext into server routes
let _i18n: { language?: string } | null = null;
function getI18n(): { language?: string } {
  if (_i18n === null) {
    try {

      _i18n = require('@/i18n/config').default ?? { language: 'el' };
    } catch {
      _i18n = { language: 'el' };
    }
  }
  return _i18n ?? { language: undefined };
}

/**
 * Get current locale from i18n instance (server-safe: falls back to 'el')
 */
export const getCurrentLocale = (): string => {
  return getI18n().language || 'el';
};

// Re-export all formatting functions (barrel pattern)
export * from './intl-formatting';
export * from './intl-domain';
