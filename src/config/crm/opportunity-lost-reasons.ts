/**
 * @fileoverview **Λόγοι απώλειας ευκαιρίας — κλειστός κατάλογος** (ADR-929).
 * @module config/crm/opportunity-lost-reasons
 *
 * 🔑 **Λίστα, όχι ελεύθερο κείμενο** (πρακτική HubSpot/Pipedrive): το ελεύθερο κείμενο δεν μετριέται — «ακριβό»,
 *    «Ακριβό!», «τιμή» γίνονται τρεις λόγοι στην αναφορά. Η λεπτομέρεια πάει στο προαιρετικό σχόλιο.
 * 🔑 Αποθηκεύεται το αναγνωριστικό (snake_case)· η ετικέτα έρχεται από `crm:opportunities.lostReasons.<camelCase>`.
 */

import { toCatalogKey } from '@/lib/string/catalog-key';

export const OPPORTUNITY_LOST_REASONS = [
  'price',
  'financing',
  'location',
  'property_mismatch',
  'competitor',
  'timing',
  'no_response',
  'other',
] as const;

export type OpportunityLostReason = (typeof OPPORTUNITY_LOST_REASONS)[number];

export function isOpportunityLostReason(value: unknown): value is OpportunityLostReason {
  return typeof value === 'string' && (OPPORTUNITY_LOST_REASONS as readonly string[]).includes(value);
}

/** `no_response` → `noResponse` — κλειδί i18n (ADR-279: camelCase). */
export function lostReasonCatalogKey(reason: OpportunityLostReason): string {
  return toCatalogKey(reason);
}

/** Μέγιστο μήκος του προαιρετικού σχολίου απώλειας. */
export const LOST_REASON_NOTE_MAX = 500;
