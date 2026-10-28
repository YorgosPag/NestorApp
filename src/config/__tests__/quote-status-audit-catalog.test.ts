/**
 * @fileoverview Η κατάσταση της προσφοράς στο ιστορικό (ADR-327 §8.5.4 · ADR-195).
 *
 * Ζωντανά 2026-10-28: «Κατάσταση: Πρόχειρο → under_review» — η προσφορά δεν είχε μητρώο πεδίων, η `status` έπεφτε στη
 * γενική εφεδρεία `common:audit.values` όπου υπήρχε μόνο το `draft`.
 *
 * Κ1 το μητρώο της οντότητας `quote` δηλώνει κατάλογο για τη `status` ·
 * Κ2 ΚΑΘΕ τιμή του `QUOTE_STATUSES` (ο κλειστός τύπος, όχι δείγμα) λύνεται στον κατάλογο σε el ΚΑΙ en, με τη
 *    γέφυρα snake→camel του resolver (`under_review` → `underReview`).
 */

import el from '@/i18n/locales/el/quotes.json';
import en from '@/i18n/locales/en/quotes.json';
import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import { QUOTE_STATUSES } from '@/subapps/procurement/types/quote';

const camel = (value: string) => value.replace(/[_-]([a-z])/g, (_, c: string) => c.toUpperCase());

function at(root: unknown, path: string): Record<string, unknown> {
  const node = path.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), root);
  return (node && typeof node === 'object' ? node : {}) as Record<string, unknown>;
}

describe('quote status — κατάλογος ιστορικού', () => {
  const def = getTrackedFieldsForEntityAuditType('quote')?.status;

  it('Κ1 το μητρώο `quote` δηλώνει κατάλογο για τη `status`', () => {
    expect(def?.kind === 'scalar' ? def.enumCatalog : undefined).toEqual({ ns: 'quotes', path: 'quotes.auditStatuses' });
  });

  it.each([['el', el], ['en', en]] as const)('Κ2 κάθε κατάσταση λύνεται (%s)', (_lang, locale) => {
    const catalog = at(locale, 'quotes.auditStatuses');
    const missing = QUOTE_STATUSES.filter((s) => typeof catalog[camel(s)] !== 'string' || catalog[camel(s)] === '');
    expect(missing).toEqual([]);
  });
});
