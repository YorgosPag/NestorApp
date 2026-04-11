/**
 * @fileoverview Shared i18n resolver for service/contact form renderers.
 *
 * Why this module exists
 * ----------------------
 * Service forms and their tabbed variant pull labels from three different
 * namespaces: `contacts` (field names), `contacts-form` (option catalogs like
 * `options.serviceCategories.*`) and `forms` (shared section titles). Earlier
 * inline implementations only translated keys prefixed with `contacts.`, which
 * caused option catalogs under `options.*` to render as raw keys in the UI.
 * This module is the single source of truth for the resolution contract so
 * that `ServiceFormRenderer` and `ServiceFormTabRenderer` cannot drift apart
 * again.
 *
 * Resolution contract
 * -------------------
 *   1. Non-string or empty values pass through unchanged.
 *   2. Strings without a dot are treated as literal text and returned as-is.
 *   3. Dotted strings are resolved against SERVICE_FORM_NAMESPACES, in order,
 *      via `i18next.exists()` → `t()`.
 *   4. For backwards compatibility, a key prefixed with `contacts.` that does
 *      not resolve directly will be retried with the prefix stripped.
 *   5. Unresolved keys log a dev-mode warning and return the original value so
 *      the failure is visible in the UI rather than silently swallowed.
 *
 * @enterprise ADR-279 — Google-Grade i18n Governance
 */

import i18next from 'i18next';

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('service-form-i18n');

/**
 * Namespaces scanned when resolving service form labels.
 *
 * Order matters — i18next returns the first namespace that contains the key.
 * Do not add namespaces lightly: each entry expands the surface every
 * `translateFieldValue` call must walk.
 */
export const SERVICE_FORM_NAMESPACES = [
  'contacts',
  'contacts-form',
  'forms',
] as const;

export type ServiceFormNamespace = (typeof SERVICE_FORM_NAMESPACES)[number];

/**
 * Minimal subset of the react-i18next `t` signature used by this resolver.
 *
 * We intentionally avoid importing the full `TFunction` type from react-i18next
 * to keep this module usable from plain TypeScript tests that mock the
 * dependency with a plain function.
 */
export type FieldTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;

const NS_OPTION: { ns: readonly ServiceFormNamespace[] } = {
  ns: SERVICE_FORM_NAMESPACES,
};

/**
 * Resolve a label/placeholder/helpText value against the service form
 * namespace set.
 *
 * @param value - The candidate i18n key or literal string.
 * @param t - react-i18next translator bound to {@link SERVICE_FORM_NAMESPACES}.
 * @returns Translated string, or the original value when no translation is
 *          available (so the rendering surface fails visibly).
 */
export function translateFieldValue(
  value: string | undefined,
  t: FieldTranslator,
): string | undefined {
  if (!value || typeof value !== 'string') return value;
  if (!value.includes('.')) return value;

  if (i18next.exists(value, NS_OPTION)) {
    return t(value, NS_OPTION);
  }

  if (value.startsWith('contacts.')) {
    const stripped = value.slice('contacts.'.length);
    if (i18next.exists(stripped, NS_OPTION)) {
      return t(stripped, NS_OPTION);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.warn('Translation missing for key', {
      key: value,
      namespaces: SERVICE_FORM_NAMESPACES,
    });
  }
  return value;
}
