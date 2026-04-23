/**
 * @fileoverview Single source of truth for rendering a PhoneInfo as a
 * user-facing string across the app (contact cards, relationship summaries,
 * audit activity rows, search results, etc.).
 *
 * Historical callers inlined ``${countryCode || '+30'} ${number}`` in several
 * places — once `PhoneInfo.extension` was introduced, duplicating that logic
 * would have left the extension invisible in most of the UI. This helper
 * centralises the format so every read-site picks up new fields automatically.
 *
 * @enterprise ADR-279 — Google-Grade i18n Governance (consumer, no new keys)
 */

import type { PhoneInfo } from '@/types/contacts';

export interface PhoneDisplayOptions {
  /**
   * Localized short label for the extension suffix (e.g. "εσωτ." / "ext.").
   * Callers resolve it from i18n (`contacts.display.extensionShort`) and pass
   * it in. Optional — when omitted the extension renders as a bare suffix
   * "(123)" which is still readable in non-localised contexts (logs, audit).
   */
  extensionShort?: string;
  /** Default country code when `phone.countryCode` is empty. Defaults to `+30`. */
  defaultCountryCode?: string;
  /** When true, skip the country code entirely (for compact card views). */
  omitCountryCode?: boolean;
}

type PhoneLike = Pick<PhoneInfo, 'number' | 'countryCode' | 'extension'>;

/**
 * Render a phone as "+30 2310 123456 εσωτ. 123".
 * Returns empty string when `number` is missing/blank so callers can fall
 * back to their own empty-state rendering.
 */
export function formatPhoneDisplay(
  phone: PhoneLike | null | undefined,
  options: PhoneDisplayOptions = {},
): string {
  if (!phone?.number) return '';

  const { extensionShort, defaultCountryCode = '+30', omitCountryCode } = options;

  const parts: string[] = [];
  if (!omitCountryCode) {
    parts.push((phone.countryCode || defaultCountryCode).trim());
  }
  parts.push(String(phone.number).trim());

  const ext = phone.extension?.trim();
  if (ext) {
    parts.push(extensionShort ? `${extensionShort} ${ext}` : `(${ext})`);
  }

  return parts.filter(Boolean).join(' ');
}
