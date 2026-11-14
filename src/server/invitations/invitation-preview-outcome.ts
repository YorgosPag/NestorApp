import 'server-only';

/**
 * @fileoverview **Η ΕΚΒΑΣΗ ΤΗΣ ΟΨΗΣ ΜΙΑΣ ΠΡΟΣΚΛΗΣΗΣ ΜΕ ΠΑΡΑΛΗΠΤΗ** — ο τύπος και ο κατασκευαστής, μία φορά.
 * @related ADR-915 §39.6 · ADR-853 §5 #4 · `invitation-account-step.ts` · `invitation-page-request.ts`
 * @module server/invitations/invitation-preview-outcome
 *
 * Εξήχθη 2026-11-14 (ADR-915 §39.6, CHECK 3.28): υπόθεση · φωτογράφος · αγοραστής · προμηθευτής έγραφαν τον **ίδιο** τύπο
 * έκβασης και το **ίδιο** σώμα «υπόδειξη παραλήπτη + σήμανση ανοίγματος + βήμα λογαριασμού». Το είδος δίνει μόνο ό,τι
 * είναι δικό του: την όψη (`preview`), τη διεύθυνση του παραλήπτη και πού γράφεται «ανοίχτηκε» (`opened`).
 * 🔒 Η διεύθυνση του παραλήπτη **δεν** ταξιδεύει: μένει σε κλείσιμο (`accountStep`), και η υπόδειξη είναι boolean.
 * ⚠️ Η πρόσκληση χώρου (`workspace-invitation-preview.ts`) έχει άλλο σχήμα (`invitationId`, όχι `markOpened`) — μένει εκεί.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO } from '@/lib/date-local';
import type { InvitationAccountStep } from '@/lib/invitations/invitation-respond';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

import { invitationAccountStepOf } from './invitation-account-step';
import { markInvitationOpenedAt, type InvitationTxObserver } from './invitation-lifecycle';

/** Η όψη, έτοιμη για τη σελίδα. */
export interface AddressedInvitationPreview<P> {
  readonly kind: 'preview';
  readonly preview: P;
  /** Απευθύνεται στον συνδεδεμένο; `null` ⇒ κανείς συνδεδεμένος. **Υπόδειξη**, όχι απόφαση (κρίνεται στην εξαργύρωση). */
  readonly addressedToViewer: boolean | null;
  /** Η σήμανση «ανοίχτηκε» — για το `after()`· **δεν** ταξιδεύει στο σύρμα, ποτέ δεν πετά. */
  readonly markOpened: () => Promise<void>;
  /** ADR-915 §39.6 — το βήμα λογαριασμού ως **κλείσιμο**: η αναζήτηση γίνεται μόνο αν τη ζητήσει η σελίδα. */
  readonly accountStep: () => Promise<InvitationAccountStep>;
}

/** Όψη · ονομασμένη άρνηση του πυρήνα · «δεν μπόρεσα» (λείπει το μυστικό **μας** — ποτέ «πλαστός σύνδεσμος»). */
export type AddressedInvitationPreviewOutcome<P> =
  | AddressedInvitationPreview<P>
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'unavailable' };

/** Πού γράφεται «ανοίχτηκε»: το έγγραφο της πρόσκλησης, και (προαιρετικά) ποιος παρατηρεί τη συναλλαγή (σήμα είδους). */
export interface InvitationOpenedTarget {
  readonly db: Firestore;
  readonly ref: DocumentReference;
  readonly observe?: InvitationTxObserver;
}

/**
 * **Ο κατασκευαστής** — το είδος δίνει την όψη του· η υπόδειξη, η σήμανση «ανοίχτηκε» και το βήμα παράγονται εδώ,
 * πάντα με τον ίδιο τρόπο. `viewerEmail` = ο θεατής (από το αίτημα)· `inviteeEmail` = ο παραλήπτης (από το έγγραφο).
 */
export function addressedInvitationPreview<P>(
  viewer: { readonly viewerEmail: string | null },
  invitee: { readonly inviteeEmail: string },
  args: { readonly opened: InvitationOpenedTarget; readonly preview: P },
): AddressedInvitationPreview<P> {
  const { viewerEmail } = viewer;
  const { inviteeEmail } = invitee;
  const { db, ref, observe } = args.opened;
  return {
    kind: 'preview',
    preview: args.preview,
    addressedToViewer: viewerEmail ? sameChannelEmail(viewerEmail, inviteeEmail) : null,
    markOpened: () => markInvitationOpenedAt(db, ref, nowISO(), observe),
    accountStep: () => invitationAccountStepOf(inviteeEmail),
  };
}
