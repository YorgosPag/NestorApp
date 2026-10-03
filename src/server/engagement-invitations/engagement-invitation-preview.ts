import 'server-only';

/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΥΠΟΘΕΣΗΣ ΠΡΙΝ ΤΗΝ ΑΠΟΦΑΣΗ** — «ποιος με καλεί, για ποιο ακίνητο, με ποιον ρόλο,
 * τι θα βρω, ως πότε;»
 * @related ADR-901 Φ3 · §5.3 βήμα 5 · §5.6 · ADR-853 §5 #4 · §20 · `tour-capture-invitation-preview.ts` (το πρότυπο)
 * @module server/engagement-invitations/engagement-invitation-preview
 *
 * 🔑 **Ο ΙΔΙΟΣ δρόμος με την εξαργύρωση** (`readInvitationByToken` + `ENGAGEMENT_INVITATION_LOCATOR`). Χωρίς
 * παραλήπτη: η δέσμευση κρίνεται στην εξαργύρωση, την πράξη που **γράφει**. Η ανάγνωση **δεν** καίει την πρόσκληση.
 *
 * 🔒 **Μετρήσεις, όχι έγγραφα — και κανένα όνομα μέρους** (ADR-742 ελαχιστοποίηση): η όψη ανοίγει με το token,
 * χωρίς ταυτότητα· ένα προωθημένο email δεν πρέπει να δείχνει σε τρίτον ποιος αγοράζει ποιο σπίτι. Τα μέρη τα
 * βλέπει ο επαγγελματίας **μετά** την αποδοχή, μέσα στην υπόθεση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { sameChannelEmail } from '@/lib/contact/channel-email';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { engagementInvitationFromDocument } from '@/lib/conveyance/engagement-invitation-schema';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { markInvitationOpenedAt } from '@/server/invitations/invitation-lifecycle';
import { readInvitationByToken } from '@/server/invitations/invitation-redeem';
import { checklistForRole, engagementChecklistViewer } from '@/services/conveyance/conveyance-engagement-access.service';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type {
  EngagementInvitation,
  EngagementInvitationChecklist,
  EngagementInvitationPreview,
} from '@/types/engagement-invitation';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

import { ENGAGEMENT_INVITATION_LOCATOR } from './engagement-invitation-redeem';

const logger = createModuleLogger('engagement-invitation-preview');

export type EngagementInvitationPreviewOutcome =
  | {
      readonly kind: 'preview';
      readonly preview: EngagementInvitationPreview;
      /** Απευθύνεται στον συνδεδεμένο; `null` ⇒ κανείς συνδεδεμένος. **Υπόδειξη**, όχι απόφαση. */
      readonly addressedToViewer: boolean | null;
      /** Η σήμανση «ανοίχτηκε» — για το `after()`· **δεν** ταξιδεύει στο σύρμα, ποτέ δεν πετά. */
      readonly markOpened: () => Promise<void>;
    }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'unavailable' };

export type EngagementInvitationDescription = Pick<EngagementInvitationPreview, 'propertyLabel' | 'hostName' | 'checklist'>;

/** Οι μετρήσεις του καταλόγου **του ρόλου** — αποτυχία ⇒ `null`, ποτέ ψεύτικο «0». */
async function checklistOf(db: Firestore, invitation: EngagementInvitation): Promise<EngagementInvitationChecklist | null> {
  const record = parseConveyanceCase((await db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(invitation.caseId).get()).data());
  if (!record || record.companyId !== invitation.hostCompanyId) return null;
  const context = await loadConveyanceSubject(db, record.companyId, record.subject.propertyId);
  if (!context) return null;
  const { summary } = await checklistForRole(db, record, context, engagementChecklistViewer({ role: invitation.role, template: 'legal' }));
  return { applicable: summary.applicable, complete: summary.complete, missing: summary.missing };
}

/**
 * **Ποιο ακίνητο, ποιο γραφείο, τι θα βρει** — η **μία** περιγραφή, για όψη **και** email (ποτέ δύο αναγνώσεις που
 * μπορεί να διαφωνήσουν). Διαβάζεται **τώρα**. Κάθε αποτυχία ⇒ `null`, που η επιφάνεια ονομάζει από τα λόγια της.
 */
export async function describeEngagementInvitation(
  db: Firestore,
  invitation: EngagementInvitation,
): Promise<EngagementInvitationDescription> {
  const [subject, workspaceName, checklist] = await Promise.all([
    loadConveyanceSubject(db, invitation.hostCompanyId, invitation.propertyId).catch(() => null),
    readWorkspaceName(invitation.hostCompanyId).catch(() => ''),
    checklistOf(db, invitation).catch((error: unknown) => {
      logger.warn('Ο κατάλογος της πρόσκλησης δεν διαβάστηκε', { invitationId: invitation.id, error: String(error) });
      return null;
    }),
  ]);
  return {
    propertyLabel: subject?.propertyName ?? null,
    hostName: workspaceName.trim().length > 0 ? workspaceName.trim() : null,
    checklist,
  };
}

/** **Η όψη — ΧΩΡΙΣ ταυτότητα και ΧΩΡΙΣ κατανάλωση.** */
export async function previewEngagementInvitation(
  db: Firestore,
  input: { readonly token: string; readonly viewerEmail: string | null },
): Promise<EngagementInvitationPreviewOutcome> {
  const nowValue = nowISO();
  const found = await readInvitationByToken(db, ENGAGEMENT_INVITATION_LOCATOR, { token: input.token, nowValue, recipientEmail: null });
  if (found.kind === 'secret-missing') {
    logger.error('Λείπει το μυστικό των προσκλήσεων υπόθεσης — καμία όψη δεν μπορεί να δοθεί');
    return { kind: 'unavailable' };
  }
  if (found.kind === 'refused') return found;

  const invitation = engagementInvitationFromDocument(found.stored, found.invitationId);
  if (invitation === null) {
    logger.error('Πρόσκληση υπόθεσης που δεν διαβάζεται — δεν εμφανίζεται', { invitationId: found.invitationId });
    return { kind: 'unavailable' };
  }
  const { ref } = found.location;
  return {
    kind: 'preview',
    addressedToViewer: input.viewerEmail ? sameChannelEmail(input.viewerEmail, invitation.inviteeEmail) : null,
    markOpened: () => markInvitationOpenedAt(db, ref, nowISO()),
    preview: {
      ...(await describeEngagementInvitation(db, invitation)),
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      credentialHint: invitation.credentialHint,
      identityAssurance: 'declared',
    },
  };
}
