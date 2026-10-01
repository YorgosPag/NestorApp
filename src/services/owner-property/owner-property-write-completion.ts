/**
 * @fileoverview **Η μία συνέχεια κάθε γραφής αγγελίας ιδιώτη** — ίχνος ελέγχου, μετά επαναπροβολή.
 * @related `owner-property-write.service.ts` (`persist`) · `owner-property-declarations.service.ts` (ADR-898 Φ3β) ·
 *   `owner-property-audit.ts` · `owner-property-publication.service.ts`
 * @module services/owner-property/owner-property-write-completion
 *
 * ⚠️ **Εξήχθη από τον γραφέα (ADR-898 Φ3β, N.0.2)**: απέκτησε **δεύτερο** καλούντα, τον γραφέα των δηλώσεων, που
 * γράφει μέσα σε συναλλαγή. Δεύτερο αντίγραφο της σειράς «ίχνος → προβολή» θα ήταν δύο σειρές που αποκλίνουν.
 *
 * 🔴 **Η σειρά είναι συμβόλαιο (ADR-864 Φ1β)**: το ίχνος καταγράφεται **μετά** την επιτυχή γραφή και **πριν** την
 * επαναπροβολή (παράγωγο) — ποτέ για γραφή που απέτυχε.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { recordOwnerPropertyWrite, type OwnerPropertyAuditContext } from '@/services/owner-property/owner-property-audit';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import type { Logger } from '@/lib/telemetry';
import type { OwnerProperty } from '@/types/owner-property';

/** Ίχνος → επαναπροβολή, **μετά** από γραφή που έγινε. */
export async function completeWrite(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  audit: OwnerPropertyAuditContext,
): Promise<OwnerPropertyWriteResult> {
  await recordOwnerPropertyWrite(property, audit);

  const republished = await republishOwnerProperty(adminDb, property);
  return { kind: 'saved', property: republished.property, publish: republished.publish };
}

/** **Η γραφή δεν έφτασε** — καταγραφή με την ταυτότητα, και η ονομασμένη αποτυχία προς τον καλούντα. */
export function writeFailure(
  logger: Logger,
  what: string,
  ownerPropertyId: string,
  error: unknown,
): { readonly kind: 'failed'; readonly message: string } {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(what, { data: { ownerPropertyId }, error: message });
  return { kind: 'failed', message };
}
