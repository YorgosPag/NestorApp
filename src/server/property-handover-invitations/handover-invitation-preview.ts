import 'server-only';

/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΑΓΟΡΑΣΤΗ ΠΡΙΝ ΤΗΝ ΑΠΟΦΑΣΗ** — «ποιος μου δίνει, ποιο σπίτι, πότε, ως πότε;»
 * @related ADR-916 Φ-Β2 · ADR-853 §5 #4 · §20 · `engagement-invitation-preview.ts` (το πρότυπο)
 * @module server/property-handover-invitations/handover-invitation-preview
 *
 * 🔑 **Ο ΙΔΙΟΣ δρόμος με την εξαργύρωση** (`readInvitationByToken` + `PROPERTY_HANDOVER_INVITATION_LOCATOR`). Χωρίς
 * παραλήπτη: η δέσμευση κρίνεται στην εξαργύρωση, την πράξη που **γράφει**. Η ανάγνωση **δεν** καίει την πρόσκληση.
 * 🔑 **Η ΙΔΙΑ περιγραφή με το email** (`describeHandoverInvitation`) — ποτέ δύο αναγνώσεις που διαφωνούν για το σπίτι.
 *
 * 🔒 **Κανένα όνομα μέρους, κανένα email** (ADR-742): η όψη ανοίγει με το token, χωρίς ταυτότητα· ένα προωθημένο
 * email δεν πρέπει να λέει σε τρίτον ποιος αγοράζει ποιο σπίτι.
 * ⚠️ Η «ζωντάνια» της **πώλησης** (ακυρώθηκε; έχει ήδη παραλήπτη;) **δεν** κρίνεται εδώ: ακύρωση ανακαλεί ατομικά την
 * πρόσκληση (⇒ `revoked` από τον πυρήνα), και ό,τι ξεφύγει πιάνεται μέσα στη συναλλαγή της αποδοχής (`handover-closed`).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO } from '@/lib/date-local';
import { propertyHandoverInvitationFromDocument } from '@/lib/property-handover/property-handover-invitation-schema';
import { createModuleLogger } from '@/lib/telemetry';
import { markInvitationOpenedAt } from '@/server/invitations/invitation-lifecycle';
import { readInvitationByToken } from '@/server/invitations/invitation-redeem';
import type { InvitationCoreRefusal } from '@/types/invitation-core';
import type { PropertyHandoverInvitationPreview } from '@/types/property-handover-invitation';

import { describeHandoverInvitation } from './handover-invitation-description';
import { PROPERTY_HANDOVER_INVITATION_LOCATOR } from './handover-invitation-kind';

const logger = createModuleLogger('handover-invitation-preview');

export type HandoverInvitationPreviewOutcome =
  | {
      readonly kind: 'preview';
      readonly preview: PropertyHandoverInvitationPreview;
      /** Απευθύνεται στον συνδεδεμένο; `null` ⇒ κανείς συνδεδεμένος. **Υπόδειξη**, όχι απόφαση. */
      readonly addressedToViewer: boolean | null;
      /** Η σήμανση «ανοίχτηκε» — για το `after()`· **δεν** ταξιδεύει στο σύρμα, ποτέ δεν πετά. */
      readonly markOpened: () => Promise<void>;
    }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'unavailable' };

/** **Η όψη — ΧΩΡΙΣ ταυτότητα και ΧΩΡΙΣ κατανάλωση.** */
export async function previewHandoverInvitation(
  db: Firestore,
  input: { readonly token: string; readonly viewerEmail: string | null },
): Promise<HandoverInvitationPreviewOutcome> {
  const found = await readInvitationByToken(db, PROPERTY_HANDOVER_INVITATION_LOCATOR, {
    token: input.token, nowValue: nowISO(), recipientEmail: null,
  });
  if (found.kind === 'secret-missing') {
    logger.error('Λείπει το μυστικό των προσκλήσεων αγοραστή — καμία όψη δεν μπορεί να δοθεί');
    return { kind: 'unavailable' };
  }
  if (found.kind === 'refused') return found;

  const invitation = propertyHandoverInvitationFromDocument(found.stored, found.invitationId);
  if (invitation === null) {
    logger.error('Πρόσκληση αγοραστή που δεν διαβάζεται — δεν εμφανίζεται', { invitationId: found.invitationId });
    return { kind: 'unavailable' };
  }
  const { ref } = found.location;
  return {
    kind: 'preview',
    addressedToViewer: input.viewerEmail ? sameChannelEmail(input.viewerEmail, invitation.inviteeEmail) : null,
    markOpened: () => markInvitationOpenedAt(db, ref, nowISO()),
    preview: {
      ...(await describeHandoverInvitation(db, invitation)),
      occasion: invitation.occasion,
      expiresAt: invitation.expiresAt,
    },
  };
}
