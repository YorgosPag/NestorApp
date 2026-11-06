/**
 * @fileoverview **Τι λέγεται σήμερα για τη λήξη μιας μάρκας** (ADR-923 §16, κενό «ειδοποίηση πριν τη λήξη»). Καθαρό.
 * @module subapps/catalog/public/supplier-brand-expiry
 *
 * 🔑 Τα σκαλιά (30 · 7 · σήμερα · έληξε) **δεν** ορίζονται εδώ: τα δίνει η μία κρίση του μητρώου λήξεων
 *    (`expiryStageOfDate`, ADR-915 Φ5α), ώστε «πόσο νωρίς προειδοποιούμε» να ζει σε ένα σημείο.
 * 🔑 Ένα μήνυμα ανά σκαλί, ποτέ το ίδιο δύο φορές (το «ήδη ειπωμένο» ζει στο `grant.expiryNotice`), αντί για καθημερινές
 *    υπενθυμίσεις: λίγα, κλιμακούμενα μηνύματα πριν από τη λήξη, όπως οι ειδοποιήσεις λήξης του AWS Certificate Manager.
 * ⚠️ Χωριστό από το `supplier-brand-claim-rules.ts`, που φορτώνεται και στον browser: η κρίση λήξης τη χρειάζεται μόνο η
 *    σάρωση του διακομιστή.
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { expiryStageOfDate, isMoreUrgentExpiryStage } from '@/lib/document-validity/expiry-alert-stage';

import type { BrandExpiryNoticeStage, SupplierBrandGrant } from '../types/supplier-brand-claim';

/** Πόσες ημέρες μετά τη λήξη λέγεται ακόμη «έληξε»: η σάρωση που έχασε μέρες το προλαβαίνει, η παλιά λήξη σιωπά. */
export const BRAND_EXPIRED_NOTICE_DAYS = 7;

/** Η πιο μακρινή λήξη που μπορεί να έχει κάτι να πει σήμερα: το πρώτο σκαλί του μητρώου λήξεων. */
export const BRAND_EXPIRY_NOTICE_HORIZON_DAYS = 30;

/** Η ημέρα λήξης (`YYYY-MM-DD`). Το `validUntil` είναι το τέλος της ημέρας σε UTC (`validUntilOfDate`). */
export const brandExpiryDateOf = (grant: Pick<SupplierBrandGrant, 'validUntil'>): string => grant.validUntil.slice(0, 10);

/**
 * Τι πρέπει να ειπωθεί **σήμερα** (`asOf`, `YYYY-MM-DD`) για αυτό το δικαίωμα, ή `null`. Μόνο σκαλί **πιο επείγον** από το
 * ήδη ειπωμένο. Ληγμένο πάνω από {@link BRAND_EXPIRED_NOTICE_DAYS} ημέρες ⇒ σιωπή.
 */
export function brandExpiryNoticeDue(grant: SupplierBrandGrant | null, asOf: string): BrandExpiryNoticeStage | null {
  if (grant === null) return null;
  const expiresOn = brandExpiryDateOf(grant);
  const stage = expiryStageOfDate(expiresOn, asOf, null);
  if (stage === null || stage === 'lead') return null;
  if (stage === 'expired') {
    const latest = addDaysToDateKey(expiresOn, BRAND_EXPIRED_NOTICE_DAYS);
    if (latest === null || latest < asOf) return null;
  }
  return isMoreUrgentExpiryStage(stage, grant.expiryNotice ?? null) ? stage : null;
}

/** Το ίδιο δικαίωμα με σημειωμένο το σκαλί που ειπώθηκε. Μόνο προς το πιο επείγον: δύο σαρώσεις δεν το γυρίζουν πίσω. */
export function withBrandExpiryNotice(grant: SupplierBrandGrant, stage: BrandExpiryNoticeStage): SupplierBrandGrant {
  return isMoreUrgentExpiryStage(stage, grant.expiryNotice ?? null) ? { ...grant, expiryNotice: stage } : grant;
}
