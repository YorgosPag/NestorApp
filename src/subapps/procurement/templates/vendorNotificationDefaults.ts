/**
 * Default email templates for post-award vendor notifications.
 * §5.V.3 — system defaults + placeholder interpolation.
 *
 * Two templates: 'winner' (accepted quotes) and 'rejection' (rejected quotes).
 * Placeholders (ICU, CHECK 3.9): {rfqTitle}, {rfqNumber}, {vendorName}, {quoteNumber},
 *   {senderName}, {companyName}, {date}
 *
 * 🔴 ADR-327 (2026-10-28): τα κείμενα ζούσαν εδώ ως σκληροκωδικοποιημένα ελληνικά (N.11) με δικό τους `{{x}}`
 * interpolator — ένας αγγλόφωνος PM έστελνε ελληνικό email. Τώρα ζουν στο `quotes.json`
 * (`rfqs.notify.defaults.*`), και η απόδοση περνά από τον μεταφραστή του καλούντα.
 *
 * @module subapps/procurement/templates/vendorNotificationDefaults
 * @see ADR-328 §5.V.3
 */

import type { TFunction } from 'i18next';

export type NotificationTemplate = 'winner' | 'rejection';

export interface TemplateContent {
  subject: string;
  body: string;
}

export interface TemplatePlaceholders {
  rfqTitle?: string;
  rfqNumber?: string;
  vendorName?: string;
  quoteNumber?: string;
  senderName?: string;
  companyName?: string;
  date?: string;
}

/** Τα κλειδιά του προεπιλεγμένου κειμένου ανά πρότυπο — κυριολεκτικά, ώστε το CHECK 3.8 να τα βλέπει. */
export const VENDOR_NOTIFICATION_TEMPLATE_KEYS: Readonly<Record<NotificationTemplate, Readonly<Record<keyof TemplateContent, string>>>> = {
  winner: { subject: 'rfqs.notify.defaults.winner.subject', body: 'rfqs.notify.defaults.winner.body' },
  rejection: { subject: 'rfqs.notify.defaults.rejection.subject', body: 'rfqs.notify.defaults.rejection.body' },
};

export function buildDefaultTemplate(
  templateType: NotificationTemplate,
  placeholders: TemplatePlaceholders,
  /** Ο μεταφραστής του namespace `quotes` (ίδια σύμβαση με το `quoteVendorLabel`). */
  t: TFunction,
): TemplateContent {
  const keys = VENDOR_NOTIFICATION_TEMPLATE_KEYS[templateType];
  return { subject: t(keys.subject, placeholders), body: t(keys.body, placeholders) };
}
