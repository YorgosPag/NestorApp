/**
 * =============================================================================
 * Η ΠΡΟΣΚΛΗΣΗ ΜΕ EMAIL — η πλευρά του ΟΙΚΟΔΕΣΠΟΤΗ (ADR-901 Φ3 · §5.3 · Ε-5)
 * =============================================================================
 *
 * - `inviteCaseProfessional`  — επαγγελματίας **χωρίς λογαριασμό** ⇒ πρόσκληση (Procore «Save & Send Invitation»)·
 *                               ξανά-κλήση = **επαναποστολή με ένα πάτημα** (νέο token, νέα λήξη, η παλιά ανακαλείται)
 * - `revokeCaseInvitation`    — ακύρωση της εκκρεμούς πρόσκλησης μιας θέσης
 *
 * ⚠️ Ο καλών (`offerCaseEngagement`) έχει **ήδη** κρίνει μισθωτή, δικαίωμα, κατάσταση υπόθεσης **και** συναινέσεις
 *    (Ε-3: καμία πρόσκληση πριν από τις δύο συναινέσεις του συμβολαιογράφου).
 * 🔑 Ίχνος στο **βιβλίο της υπόθεσης** (`conveyance_case`) — όπως η πρόσκληση χώρου γράφει στον **χώρο**: η
 *    πρόσκληση δεν είναι ακόμη συμμετοχή· γίνεται όταν (και αν) αποδεχτεί. ⛔ Ποτέ το token στο ίχνος.
 *
 * @module services/conveyance/conveyance-invitation-host.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { EntityAuditService } from '@/services/entity-audit.service';
import {
  issueEngagementInvitation,
  revokePendingCaseInvitations,
} from '@/server/engagement-invitations/engagement-invitation-issue';
import { notifyEngagementInvitation } from '@/server/engagement-invitations/engagement-invitation-notice';
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { EngagementConsent } from '@/types/engagement';
import type { CredentialHint } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import type { ConveyanceActor } from './conveyance-case.service';

/** Το ίχνος μιας πράξης πρόσκλησης στο βιβλίο της υπόθεσης — πεδίο ανά θέση, ώστε να διαβάζεται «ποια θέση». */
async function recordInvitationAudit(params: {
  readonly record: ConveyanceCase;
  readonly actor: ConveyanceActor;
  /** `null` ⇒ όλες οι θέσεις (κλείσιμο υπόθεσης). */
  readonly role: LegalProfessionalRole | null;
  readonly oldValue: string | null;
  readonly newValue: string;
  readonly entityName: string | null;
}): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'conveyance_case',
    entityId: params.record.id,
    entityName: params.entityName,
    action: 'updated',
    changes: [{ field: params.role === null ? 'invitation' : `invitation.${params.role}`, oldValue: params.oldValue, newValue: params.newValue }],
    performedBy: params.actor.uid,
    performedByName: params.actor.email,
    companyId: params.record.companyId,
  });
}

export interface CaseInvitationRequest {
  readonly projectId: string;
  readonly role: LegalProfessionalRole;
  readonly contactId: string;
  readonly email: string;
  readonly credentialHint: CredentialHint;
  readonly consents: readonly EngagementConsent[];
  readonly propertyName: string | null;
  readonly nowMs: number;
}

/**
 * **Έκδοση (ή επαναποστολή) πρόσκλησης** στη θέση. Η πρόσκληση γράφεται **πρώτα** (await — ορθότητα)· το email
 * φεύγει **μετά**, και η έκβασή του επιστρέφει **ονομασμένη** (`accepted` · `unaddressable` · `failed`) ώστε ο
 * οικοδεσπότης να δει «δεν στάλθηκε» αντί για σιωπή — η πρόσκληση μένει έγκυρη για επαναποστολή.
 */
export async function inviteCaseProfessional(
  db: Firestore,
  actor: ConveyanceActor,
  record: ConveyanceCase,
  request: CaseInvitationRequest,
): Promise<InvitationNoticeOutcome> {
  const issued = await issueEngagementInvitation(db, {
    hostCompanyId: record.companyId, projectId: request.projectId, caseId: record.id,
    propertyId: record.subject.propertyId, role: request.role, contactId: request.contactId, email: request.email,
    consents: request.consents, credentialHint: request.credentialHint, actorUid: actor.uid, nowMs: request.nowMs,
  });
  await recordInvitationAudit({
    record, actor, role: request.role, entityName: request.propertyName,
    oldValue: issued.supersededCount > 0 ? 'resent' : null,
    newValue: `invited:${issued.invitation.inviteeEmail}`,
  });
  return notifyEngagementInvitation(db, issued);
}

/** **Ακύρωση** της εκκρεμούς πρόσκλησης της θέσης — ιδεμποτής· `false` ⇒ δεν υπήρχε εκκρεμής. */
export async function revokeCaseInvitation(
  db: Firestore,
  actor: ConveyanceActor,
  record: ConveyanceCase,
  input: { readonly role: LegalProfessionalRole | null; readonly propertyName: string | null; readonly nowMs: number },
): Promise<boolean> {
  const revoked = await revokePendingCaseInvitations(db, {
    hostCompanyId: record.companyId, caseId: record.id, role: input.role,
    actorUid: actor.uid, nowValue: new Date(input.nowMs).toISOString(),
  });
  if (revoked > 0) {
    await recordInvitationAudit({
      record, actor, role: input.role, entityName: input.propertyName, oldValue: 'pending', newValue: 'revoked',
    });
  }
  return revoked > 0;
}
