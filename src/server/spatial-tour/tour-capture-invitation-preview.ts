import 'server-only';

/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΦΩΤΟΓΡΑΦΟΥ ΠΡΙΝ ΤΗΝ ΑΠΟΦΑΣΗ** — «ποιος με καλεί, για ποιο ακίνητο, ως πότε;»
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · ADR-853 §5 #4 · §20 · `workspace-invitation-preview.ts` (το πρότυπο)
 * @module server/spatial-tour/tour-capture-invitation-preview
 *
 * 🔑 **Ο ΙΔΙΟΣ δρόμος με την εξαργύρωση** (`readInvitationByToken` + `TOUR_CAPTURE_INVITATION_LOCATOR`):
 * υπογραφή → λήξη → έγγραφο → «ανήκει ακόμη εδώ;» → κατάσταση · λήξη · nonce. Χωρίς παραλήπτη: εδώ δεν
 * υπάρχει ακόμη ταυτότητα — η δέσμευση κρίνεται στην εξαργύρωση, την πράξη που **γράφει** (ADR-853 §7.5).
 *
 * 🔑 **Η ανάγνωση ΔΕΝ καίει την πρόσκληση** — `pending` μένει `pending`. Η σήμανση «ανοίχτηκε» δίνεται ως
 * **αναβαλλόμενη** πράξη (`markOpened`) για το `after()` της σελίδας: η προ-φόρτωση ενός πελάτη email δεν
 * περιμένει τίποτα, και η διαδρομή της πρόσκλησης **δεν** φεύγει ποτέ από τον server.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO } from '@/lib/date-local';
import { tourCaptureInvitationFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { markInvitationOpenedAt } from '@/server/invitations/invitation-lifecycle';
import { readInvitationByToken } from '@/server/invitations/invitation-redeem';
import type { InvitationCoreRefusal } from '@/types/invitation-core';
import type { TourCaptureInvitation, TourCaptureInvitationPreview } from '@/types/spatial-tour';

import { TOUR_CAPTURE_INVITATION_LOCATOR } from './tour-capture-invitation-redeem';
import { locateSpatialTour } from './tour-locate';

const logger = createModuleLogger('tour-capture-invitation-preview');

export type TourCaptureInvitationPreviewOutcome =
  | {
      readonly kind: 'preview';
      readonly preview: TourCaptureInvitationPreview;
      /** Απευθύνεται στον συνδεδεμένο; `null` ⇒ κανείς συνδεδεμένος. **Υπόδειξη**, όχι απόφαση. */
      readonly addressedToViewer: boolean | null;
      /** Η σήμανση «ανοίχτηκε» — για το `after()`· **δεν** ταξιδεύει στο σύρμα, ποτέ δεν πετά. */
      readonly markOpened: () => Promise<void>;
    }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  /** «Δεν μπόρεσα»: λείπει το μυστικό **μας**, ή το έγγραφο δεν διαβάζεται — ποτέ «πλαστός σύνδεσμος». */
  | { readonly kind: 'unavailable' };

/**
 * **Ποιο ακίνητο, ποιο γραφείο** — η **μία** περιγραφή της πρόσκλησης, για την όψη **και** το email (ποτέ δύο
 * αναγνώσεις που μπορεί να διαφωνήσουν). Διαβάζεται **τώρα**, όχι στιγμιότυπο της έκδοσης. Κάθε αποτυχία ⇒ `null`,
 * που η επιφάνεια ονομάζει από τα λόγια της («ο ιδιοκτήτης» · «της αγγελίας») — ποτέ ωμό id.
 */
export async function describeTourCaptureInvitation(
  db: Firestore,
  invitation: TourCaptureInvitation,
): Promise<Pick<TourCaptureInvitationPreview, 'propertyLabel' | 'hostName'>> {
  const [location, workspaceName] = await Promise.all([
    locateSpatialTour(db, invitation.subject).catch(() => null),
    invitation.companyId === undefined ? Promise.resolve('') : readWorkspaceName(invitation.companyId).catch(() => ''),
  ]);
  return {
    propertyLabel: location?.kind === 'found' ? location.label : null,
    hostName: workspaceName.trim().length > 0 ? workspaceName.trim() : null,
  };
}

/** **Η όψη — ΧΩΡΙΣ ταυτότητα και ΧΩΡΙΣ κατανάλωση.** */
export async function previewTourCaptureInvitation(
  db: Firestore,
  input: { readonly token: string; readonly viewerEmail: string | null },
): Promise<TourCaptureInvitationPreviewOutcome> {
  const nowValue = nowISO();
  const found = await readInvitationByToken(db, TOUR_CAPTURE_INVITATION_LOCATOR, {
    token: input.token, nowValue, recipientEmail: null,
  });
  if (found.kind === 'secret-missing') {
    logger.error('Λείπει το μυστικό των προσκλήσεων φωτογράφου — καμία όψη δεν μπορεί να δοθεί');
    return { kind: 'unavailable' };
  }
  if (found.kind === 'refused') return found;

  const invitation = tourCaptureInvitationFromDocument(found.stored, found.invitationId);
  if (invitation === null) {
    logger.error('Πρόσκληση φωτογράφου που δεν διαβάζεται — δεν εμφανίζεται', { invitationId: found.invitationId });
    return { kind: 'unavailable' };
  }
  const described = await describeTourCaptureInvitation(db, invitation);
  const { ref } = found.location;
  return {
    kind: 'preview',
    addressedToViewer: input.viewerEmail ? sameChannelEmail(input.viewerEmail, invitation.inviteeEmail) : null,
    markOpened: () => markInvitationOpenedAt(db, ref, nowISO()),
    preview: {
      ...described,
      reason: invitation.reason,
      grantExpiresAt: invitation.grantExpiresAt,
      expiresAt: invitation.expiresAt,
      identityAssurance: 'declared',
    },
  };
}
