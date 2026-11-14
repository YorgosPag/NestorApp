import 'server-only';

/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΠΡΙΝ ΤΗΝ ΑΠΟΦΑΣΗ** — «ποιος με καλεί, για ποιο ακίνητο, σε τι, τι θα βρω, ως πότε;»
 * @related ADR-901 Φ3 · §5.3 βήμα 5 · §5.6 · ADR-853 §5 #4 · §20 · ADR-862 §5.3.11 · `tour-capture-invitation-preview.ts`
 * @module server/engagement-invitations/engagement-invitation-preview
 *
 * 🔑 **Ο ΙΔΙΟΣ δρόμος με την εξαργύρωση** (`readInvitationByToken` + `ENGAGEMENT_INVITATION_LOCATOR`). Χωρίς
 * παραλήπτη: η δέσμευση κρίνεται στην εξαργύρωση, την πράξη που **γράφει**. Η ανάγνωση **δεν** καίει την πρόσκληση.
 * 🔑 **Ό,τι διαφέρει ανά είδος** (υπόθεση μεταβίβασης · ανάθεση έκδοσης) το λέει ο οικοδεσπότης του είδους — εδώ
 *    δεν υπάρχει καμία διακλάδωση «αν είναι μεταβίβαση».
 *
 * 🔒 **Μετρήσεις, όχι έγγραφα — και κανένα όνομα μέρους** (ADR-742 ελαχιστοποίηση): η όψη ανοίγει με το token,
 * χωρίς ταυτότητα· ένα προωθημένο email δεν πρέπει να δείχνει σε τρίτον ποιος αγοράζει ποιο σπίτι.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { engagementInvitationFromDocument } from '@/lib/auth/engagement-invitation-schema';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { invitationHost } from '@/server/engagements/engagement-hosts';
import { addressedInvitationPreview, type AddressedInvitationPreviewOutcome } from '@/server/invitations/invitation-preview-outcome';
import { readInvitationByToken } from '@/server/invitations/invitation-redeem';
import type { EngagementInvitationPreview } from '@/types/engagement-invitation';

import { ENGAGEMENT_INVITATION_LOCATOR } from './engagement-invitation-redeem';

const logger = createModuleLogger('engagement-invitation-preview');

export type EngagementInvitationPreviewOutcome = AddressedInvitationPreviewOutcome<EngagementInvitationPreview>;

/** **Η όψη — ΧΩΡΙΣ ταυτότητα και ΧΩΡΙΣ κατανάλωση.** */
export async function previewEngagementInvitation(
  db: Firestore,
  input: { readonly token: string; readonly viewerEmail: string | null },
): Promise<EngagementInvitationPreviewOutcome> {
  const nowValue = nowISO();
  const found = await readInvitationByToken(db, ENGAGEMENT_INVITATION_LOCATOR, { token: input.token, nowValue, recipientEmail: null });
  if (found.kind === 'secret-missing') {
    logger.error('Λείπει το μυστικό των προσκλήσεων συμμετοχής — καμία όψη δεν μπορεί να δοθεί');
    return { kind: 'unavailable' };
  }
  if (found.kind === 'refused') return found;

  const invitation = engagementInvitationFromDocument(found.stored, found.invitationId);
  if (invitation === null) {
    logger.error('Πρόσκληση συμμετοχής που δεν διαβάζεται — δεν εμφανίζεται', { invitationId: found.invitationId });
    return { kind: 'unavailable' };
  }
  const host = invitationHost(invitation);
  const credentialAuthority = host.credentialAuthority();
  if (credentialAuthority === null) {
    // Η υπόθεση δεν ξέρει σε ποιο μητρώο δηλώνεται ο αριθμός ⇒ η αποδοχή θα αρνιόταν· η όψη δεν υπόσχεται τίποτα.
    logger.error('Πρόσκληση χωρίς μητρώο ιδιότητας — δεν εμφανίζεται', { invitationId: invitation.id });
    return { kind: 'unavailable' };
  }
  return addressedInvitationPreview(input, invitation, {
    opened: { db, ref: found.location.ref, observe: host.signal(db) },
    preview: {
      ...(await host.describe(db)),
      expiresAt: invitation.expiresAt,
      credentialHint: invitation.credentialHint,
      credentialAuthority,
      identityAssurance: 'declared',
    },
  });
}
