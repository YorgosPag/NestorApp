import 'server-only';

/**
 * @fileoverview ADR-915 §45 Φ3 · Φ5 — **η ενεργή συμμετοχή του επαγγελματία στον χώρο μιας ανάθεσης**: ο ΕΝΑΣ δρόμος για
 *   τον σύνδεσμο της υπενθύμισης (email) **και** για τον παραλήπτη της ειδοποίησης «λήγει αύριο».
 * @related issuance-delivery-reminder.ts (η σάρωση) · issuance-delivery-notifier.ts (οι ειδοποιήσεις)
 * @module server/issuance-invitations/issuance-active-engagement
 *
 * 🔑 Χωριστό module ώστε σάρωση και notifier να το μοιράζονται **χωρίς** κύκλο εισαγωγών (CHECK 3.80).
 * 🔑 Ποτέ δεν πετά: χωρίς βεβαιότητα (δεν μπήκε · ανενεργή · βλάβη ανάγνωσης) ⇒ `null`.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { readEngagementForSubject } from '@/lib/auth/engagement-read';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import { createModuleLogger } from '@/lib/telemetry';
import { latestIssuanceSpaceInvitations } from '@/server/engagement-invitations/engagement-invitation-issue';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';

const logger = createModuleLogger('issuance-active-engagement');

export type ActiveIssuanceEngagement = NonNullable<Awaited<ReturnType<typeof readEngagementForSubject>>['engagement']>;

export async function activeIssuanceEngagementOf(
  db: Firestore,
  assignment: Pick<DocumentIssuanceAssignment, 'id' | 'companyId' | 'propertyId' | 'documentKind'>,
  registry: DocumentRegistryResponse,
  nowIso: string,
): Promise<ActiveIssuanceEngagement | null> {
  if (registry.issuanceSpaces?.[issuanceKeyOf(assignment.propertyId, assignment.documentKind)]?.kind !== 'entered') return null;
  try {
    const latest = (await latestIssuanceSpaceInvitations(db, assignment.companyId, nowIso)).byAssignment.get(assignment.id);
    if (latest === undefined || latest.resolvedByUid === null) return null;
    const read = await readEngagementForSubject(db, {
      hostCompanyId: assignment.companyId, projectId: latest.projectId, uid: latest.resolvedByUid,
      subject: { kind: 'document_issuance', assignmentId: assignment.id },
    });
    return read.outcome === 'found' && read.engagement !== null && read.engagement.state === 'active' ? read.engagement : null;
  } catch (error: unknown) {
    logger.warn('Η συμμετοχή στον χώρο δεν βρέθηκε', { assignmentId: assignment.id, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
