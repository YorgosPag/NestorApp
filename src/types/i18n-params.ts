/**
 * 🏢 ENTERPRISE: Type-safe parameters for i18n translations
 *
 * This type defines the allowed parameter types for i18n translation functions.
 * NO 'any' types allowed - only string and number values for type safety.
 *
 * @created 2026-01-23
 * @enterprise This is a canonical type file, not auto-generated
 */

/**
 * Type-safe parameters for i18n translations
 * Only string and number values are allowed for translation parameters
 */
export type I18nParams = Readonly<Record<string, string | number>>;