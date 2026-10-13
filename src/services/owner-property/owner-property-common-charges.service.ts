/**
 * @fileoverview **Ο γραφέας των κοινοχρήστων του ιδιώτη** (ADR-777 §8.93) — ποσό τον μήνα και τι περιλαμβάνουν.
 * @related `lib/common-charges/common-charges.ts` (σχήμα · διόρθωση · αναγνώστης) · `owner-property-amendment.ts`
 *   (η κοινή συναλλαγή) · `app/api/owner-properties/[ownerPropertyId]/route.ts`
 * @module services/owner-property/owner-property-common-charges.service
 *
 * 🔑 **Πράξη μετά τη δημοσίευση, όχι πεδίο των 8** (ADR-842 Α2): η `/offers/new` δεν μεγαλώνει.
 * 🔑 **Μερική διόρθωση**: αλλάζουν **μόνο** τα κλειδιά που στάλθηκαν· ρητό `null` = «σβήσε την απάντηση».
 * 🔑 **Καμία άρνηση με ρολόι ή I/O**: ό,τι κρίνεται, κρίνεται από το σχήμα στη διαδρομή — εδώ μόνο εφαρμόζεται.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { applyCommonChargesPatch, type CommonChargesPatch } from '@/lib/common-charges/common-charges';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { amendOwnerProperty } from '@/services/owner-property/owner-property-amendment';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';

const logger = createModuleLogger('owner-property-common-charges.service');

/** **Τα κοινόχρηστα** σε υπάρχουσα αγγελία ιδιώτη. Η διόρθωση έχει ήδη περάσει το `commonChargesPatchSchema`. */
export function setOwnerPropertyCommonCharges(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  patch: CommonChargesPatch,
  actor: ListingActor,
): Promise<OwnerPropertyWriteResult> {
  return amendOwnerProperty(adminDb, {
    ownerPropertyId,
    actor,
    logger,
    failureMessage: 'Τα κοινόχρηστα δεν αποθηκεύτηκαν',
    amend: (existing) => ({
      kind: 'amend',
      fields: { commonCharges: applyCommonChargesPatch(existing.commonCharges, patch) },
    }),
  });
}
