/**
 * 🤖 TELEGRAM BOT TEMPLATE RESOLVER
 *
 * Server-side template resolution for Telegram bot API routes.
 * Reads from i18n JSON locale files directly (no React hooks).
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

// Import translations directly for server-side use
import telegramEl from '@/i18n/locales/el/telegram.json';
import telegramEn from '@/i18n/locales/en/telegram.json';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramTemplateResolver');

// ============================================================================
// TYPES
// ============================================================================

export type TelegramLocale = 'el' | 'en';

export interface TemplateParams {
  [key: string]: string | number | undefined;
}

// Type for nested translation object
/**
 * ⚠️ ADR-869 §13.2 — ο `string[]` ΛΕΙΠΕ, και τα JSON τον είχαν ανέκαθεν
 * (`help.tips.examples`). Τύπος που δεν περιγράφει τα δεδομένα δεν προστατεύει κανέναν:
 * ο μόνος καταναλωτής «έλυσε» τη διαφωνία με `as unknown as string[]` και το `/help` έσκαγε.
 */
type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationObject = { [key: string]: TranslationValue };

// ============================================================================
// TRANSLATIONS CACHE
// ============================================================================

const translations: Record<TelegramLocale, TranslationObject> = {
  el: telegramEl as unknown as TranslationObject,
  en: telegramEn as unknown as TranslationObject
};

// Default locale
const DEFAULT_LOCALE: TelegramLocale = 'el';

// ============================================================================
// TEMPLATE RESOLVER CLASS
// ============================================================================

/**
 * Server-side template resolver for Telegram bot
 *
 * Usage:
 * ```typescript
 * const resolver = new TelegramTemplateResolver('el');
 * const text = resolver.getText('start.welcome');
 * const textWithParams = resolver.getText('search.results.found', { count: 5 });
 * ```
 */
export class TelegramTemplateResolver {
  private locale: TelegramLocale;

  constructor(locale: TelegramLocale = DEFAULT_LOCALE) {
    this.locale = locale;
  }

  /**
   * Get template text by key with optional parameter interpolation
   *
   * @param key - Dot-notation key (e.g., 'start.welcome', 'search.results.found')
   * @param params - Optional parameters for interpolation (e.g., { count: 5 })
   * @returns Resolved template string
   */
  getText(key: string, params?: TemplateParams): string {
    const value = this.getNestedValue(key);

    if (typeof value !== 'string') {
      // 🏢 ENTERPRISE: Log missing key server-side, return safe generic message
      logger.error('MISSING_KEY', { key, locale: this.locale });

      // Return generic error message from translations if available, otherwise safe default
      const genericError = this.getNestedValue('errors.generic');
      if (typeof genericError === 'string') {
        return genericError;
      }
      // Ultimate fallback - safe for user display
      return this.locale === 'el'
        ? 'Παρουσιάστηκε σφάλμα.'
        : 'An error occurred.';
    }

    return this.interpolate(value, params);
  }

  /**
   * **Λίστα** κειμένων για ένα κλειδί που κρατά πίνακα — π.χ. `help.tips.examples`.
   *
   * 🔴 ADR-869 §13.2 — γιατί υπάρχει: ο μόνος καταναλωτής έγραφε
   * `t.getText('help.tips.examples') as unknown as string[]` και μετά `examples.map(…)`.
   * Το `getText` όμως **απαιτεί string**: σε πίνακα γύριζε το γενικό μήνυμα σφάλματος,
   * άρα το `.map()` έτρεχε πάνω σε **string** ⇒ `TypeError` ⇒ η εντολή `/help` του bot
   * **έσκαγε**. Η διπλή μετατροπή (`as unknown as`) ήταν ακριβώς ο λόγος που ο compiler
   * δεν το είπε ποτέ — ο κανόνας «όχι `as any`» αφορά **και** αυτήν.
   *
   * Κενός πίνακας όταν το κλειδί λείπει ή δεν είναι πίνακας κειμένων: μια λίστα που
   * λείπει αφήνει κενό, δεν ρίχνει την απάντηση.
   */
  getList(key: string): string[] {
    const value = this.getNestedValue(key);
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      return value as string[];
    }
    logger.error('MISSING_LIST_KEY', { key, locale: this.locale });
    return [];
  }

  /**
   * Get nested value from translations using dot notation
   */
  private getNestedValue(key: string): TranslationValue | undefined {
    const keys = key.split('.');
    let current: TranslationValue | undefined = translations[this.locale];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = (current as TranslationObject)[k];
      } else {
        // Try fallback to default locale
        if (this.locale !== DEFAULT_LOCALE) {
          return this.getFallbackValue(key);
        }
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get fallback value from default locale
   */
  private getFallbackValue(key: string): TranslationValue | undefined {
    const keys = key.split('.');
    let current: TranslationValue | undefined = translations[DEFAULT_LOCALE];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = (current as TranslationObject)[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 🔴 ΜΙΑ ΣΥΜΒΑΣΗ ΠΑΡΕΜΒΟΛΗΣ: **μονά** άγκιστρα — `{param}` (ADR-869 §13).
   *
   * Ήταν `/\{\{(\w+)\}\}/g`, δηλαδή **διπλά**. Τα ίδια τα `locales/{el,en}/telegram.json`
   * όμως γράφουν **μονά** (`"Βρέθηκαν {count} ακίνητα"`) — γιατί αυτό **απαιτεί η CHECK 3.9**
   * (ICU: `{variable}`, ποτέ `{{variable}}`). Άρα **καμία** παράμετρος δεν αντικαθίστατο
   * ποτέ, και ο πελάτης έβλεπε ωμό `{count}` μέσα στο Telegram.
   *
   * ⚠️ Δύο κανόνες που ήταν **και οι δύο σωστοί**, σε δύο αρχεία που κανείς δεν διάβασε
   * μαζί. Μετρημένο 2026-09-20 εκτελώντας τον resolver, όχι διαβάζοντάς τον — και τα
   * **μηδέν** `{{` στα δύο JSON (επαληθευμένο σε άγκυρα) λένε ότι η μία πλευρά ήταν
   * ανέκαθεν μόνη της.
   *
   * Παράμετρος που λείπει αφήνει το μοτίβο **ορατό** (`{count}`) αντί για `undefined`:
   * ένα ορατό κενό είναι αναφέρσιμο σφάλμα· ένα «undefined» μοιάζει με κείμενο.
   */
  private interpolate(template: string, params?: TemplateParams): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, paramName) => {
      const value = params[paramName];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get current locale
   */
  getLocale(): TelegramLocale {
    return this.locale;
  }

  /**
   * Set locale
   */
  setLocale(locale: TelegramLocale): void {
    this.locale = locale;
  }

  /**
   * Check if key exists
   */
  hasKey(key: string): boolean {
    const value = this.getNestedValue(key);
    return typeof value === 'string';
  }

  /**
   * Get all keys for a section (for debugging)
   */
  getSectionKeys(section: string): string[] {
    const value = this.getNestedValue(section);
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value);
    }
    return [];
  }
}

// ============================================================================
// SINGLETON INSTANCE & FACTORY
// ============================================================================

// Default instance cache
let defaultResolver: TelegramTemplateResolver | null = null;

/**
 * Get or create default template resolver
 */
export function getTemplateResolver(locale: TelegramLocale = DEFAULT_LOCALE): TelegramTemplateResolver {
  if (!defaultResolver || defaultResolver.getLocale() !== locale) {
    defaultResolver = new TelegramTemplateResolver(locale);
  }
  return defaultResolver;
}

/**
 * Create new template resolver instance
 */
export function createTemplateResolver(locale: TelegramLocale = DEFAULT_LOCALE): TelegramTemplateResolver {
  return new TelegramTemplateResolver(locale);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick template text getter (uses default locale)
 */
export function t(key: string, params?: TemplateParams, locale: TelegramLocale = DEFAULT_LOCALE): string {
  return getTemplateResolver(locale).getText(key, params);
}

// 🏢 ENTERPRISE: Locale mapping for Intl.NumberFormat
const LOCALE_MAP: Record<TelegramLocale, string> = {
  el: 'el-GR',
  en: 'en-US'
};

/**
 * Format currency for display
 * Uses Intl.NumberFormat with proper locale mapping
 */
export function formatTelegramCurrency(amount: number, locale: TelegramLocale = DEFAULT_LOCALE): string {
  const resolver = getTemplateResolver(locale);
  const currencySymbol = resolver.getText('formatting.currency');
  const intlLocale = LOCALE_MAP[locale] || LOCALE_MAP.el;

  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);

  return `${currencySymbol}${formatted}`;
}

/**
 * Format area for display
 */
export function formatArea(area: number, locale: TelegramLocale = DEFAULT_LOCALE): string {
  const resolver = getTemplateResolver(locale);
  const unit = resolver.getText('formatting.areaUnit');
  return `${area} ${unit}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TelegramTemplateResolver;
