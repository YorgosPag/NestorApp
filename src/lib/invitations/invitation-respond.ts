/**
 * @fileoverview **ΜΠΟΡΕΙ Ο ΘΕΑΤΗΣ ΝΑ ΑΠΑΝΤΗΣΕΙ ΤΩΡΑ;** — για κάθε σελίδα πρόσκλησης (χώρου · φωτογράφου).
 * @related ADR-853 §13 ε.δ · §20 · ADR-884 §4.5 (Κ3α — το δεύτερο είδος) · `types/workspace-invitation-view.ts`
 * @module lib/invitations/invitation-respond
 *
 * Εξήχθη από τη σελίδα `/invite/[token]` (2026-09-26) με την άφιξη της σελίδας φωτογράφου: **ίδια** ερώτηση, **ίδια**
 * απάντηση — ανώνυμος ⇒ σύνδεση με επιστροφή · **άλλος λογαριασμός ⇒ το λέμε ΠΡΙΝ το κλικ** (πρότυπο Google/Slack
 * «signed in as…») · αλλιώς έτοιμος. ⚠️ **Υπόδειξη, όχι απόφαση**: η δέσμευση παραλήπτη κρίνεται ξανά στην εξαργύρωση.
 *
 * 🔑 **Διακριτή ένωση, όχι `boolean` + προαιρετικό href**: «πρέπει να συνδεθεί» **δεν μπορεί** να υπάρξει χωρίς
 * διεύθυνση επιστροφής (ο μεταγλωττιστής το απαγορεύει).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις (μόνο `loginHref`, επίσης καθαρή).
 */

import { loginHref } from '@/lib/routes/return-path';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

export type InvitationRespond =
  | { readonly kind: 'ready' }
  /** `href` = `loginHref(...)` **από τον διακομιστή** — περνά από τον φρουρό `safeReturnPath`. */
  | { readonly kind: 'sign-in'; readonly href: string }
  /** `signedInAs` = το email του **θεατή** (δικό του) — του παραλήπτη δεν ταξιδεύει ποτέ. */
  | { readonly kind: 'other-account'; readonly signedInAs: string };

export function invitationRespondOf(
  addressedToViewer: boolean | null,
  viewerEmail: string | null,
  signInHref: string,
): InvitationRespond {
  if (viewerEmail === null) return { kind: 'sign-in', href: signInHref };
  if (addressedToViewer === false) return { kind: 'other-account', signedInAs: viewerEmail };
  return { kind: 'ready' };
}

/** Η όψη «preview» κάθε σελίδας πρόσκλησης — το σχήμα που ζωγραφίζει το client component. */
export interface InvitationPreviewView<P> {
  readonly kind: 'preview';
  readonly preview: P;
  readonly token: string;
  readonly respond: InvitationRespond;
  /** Σύνδεση με επιστροφή **στην ίδια** πρόσκληση — για «αλλαγή λογαριασμού». */
  readonly switchAccountHref: string;
}

/**
 * **Η στένωση της έκβασης `preview`** — κοινή για `/invite/[token]` και `/tour-invite/[token]` (CHECK 3.28:
 * ήταν δίδυμο 11 γραμμών). Η επιστροφή μετά τη σύνδεση είναι **πάντα** ο ίδιος ο σύνδεσμος της πρόσκλησης.
 * ⛔ Κανένα `invitationId` εδώ: ό,τι περνά σε client component γράφεται μέσα στο HTML.
 */
export function invitationPreviewViewOf<P>(args: {
  readonly preview: P;
  readonly addressedToViewer: boolean | null;
  readonly token: string;
  readonly viewerEmail: string | null;
  readonly invitationHref: string;
}): InvitationPreviewView<P> {
  const returnHere = loginHref(args.invitationHref);
  return {
    kind: 'preview',
    preview: args.preview,
    token: args.token,
    respond: invitationRespondOf(args.addressedToViewer, args.viewerEmail, returnHere),
    switchAccountHref: returnHere,
  };
}

/**
 * **Ποιες κοινές αρνήσεις σημαίνουν «αυτός ο σύνδεσμος δεν δείχνει πουθενά» ⇒ 404** (ADR-853 §18 Ε-Η) — ο ΕΝΑΣ
 * χάρτης για **κάθε** σελίδα πρόσκλησης (χώρου · φωτογράφου · υπόθεσης). Κάθε είδος **απλώνει** αυτόν και προσθέτει
 * τις δικές του αρνήσεις (όλες περιγράφουν υπαρκτή πρόσκληση ⇒ `false`). Εξήχθη 2026-10-03 (ADR-901 Φ3): ζούσε
 * δύο φορές, στις ετικέτες του χώρου και του φωτογράφου.
 * ⚠️ `Record` πάνω στο κλειστό σύνολο: νέα κοινή άρνηση δεν μεταγλωττίζεται μέχρι να ειπωθεί τι απαντά το δίκτυο.
 */
export const CORE_REFUSAL_IS_NOT_FOUND: Readonly<Record<InvitationCoreRefusal, boolean>> = {
  /** Η υπογραφή δεν στέκει — δεν υπάρχει πρόσκληση πίσω από αυτόν τον σύνδεσμο. */
  'link-invalid': true,
  /** Υπογεγραμμένος για **άλλο** περιβάλλον: σε **αυτόν** τον host δεν υπάρχει. */
  'link-foreign': true,
  /** Έγκυρος σύνδεσμος, **κανένα έγγραφο** — η κλασική περίπτωση 404. */
  'invitation-unknown': true,
  /** Οι επόμενες **υπάρχουν όλες**: το σώμα λέει την κατάστασή τους. */
  expired: false,
  'already-used': false,
  revoked: false,
  'wrong-recipient': false,
};
