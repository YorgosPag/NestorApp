import 'server-only';

/**
 * @fileoverview **«Ποιος σας δίνει ποιο σπίτι»** — η ΜΙΑ περιγραφή της πρόσκλησης αγοραστή, για email **και** όψη.
 * @related ADR-916 Φ-Β · `engagement-invitation-preview.ts` (`describeEngagementInvitation` — το πρότυπο)
 * @module server/property-handover-invitations/handover-invitation-description
 *
 * 🔑 **Μία ανάγνωση, δύο επιφάνειες**: ποτέ δύο αναγνώσεις που μπορεί να διαφωνήσουν για το όνομα του σπιτιού ανάμεσα
 * στο email και στη σελίδα. Διαβάζεται **τώρα**. Κάθε αποτυχία ⇒ `null`, που η επιφάνεια ονομάζει από τα λόγια της.
 * 🔒 Κανένα όνομα μέρους (ADR-742): μόνο εταιρεία και σπίτι.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type { PropertyHandoverInvitationPreview } from '@/types/property-handover-invitation';

export type HandoverInvitationDescription = Pick<PropertyHandoverInvitationPreview, 'issuerName' | 'propertyLabel'>;

/** Το όνομα της εταιρείας και του σπιτιού — από τους **ίδιους** αναγνώστες με την υπόθεση μεταβίβασης (ADR-901). */
export async function describeHandoverInvitation(
  db: Firestore,
  subject: { readonly companyId: string; readonly propertyId: string },
): Promise<HandoverInvitationDescription> {
  const [property, workspaceName] = await Promise.all([
    loadConveyanceSubject(db, subject.companyId, subject.propertyId).catch(() => null),
    readWorkspaceName(subject.companyId).catch(() => ''),
  ]);
  const issuerName = workspaceName.trim();
  return {
    issuerName: issuerName.length > 0 ? issuerName : null,
    propertyLabel: property?.propertyName ?? null,
  };
}
