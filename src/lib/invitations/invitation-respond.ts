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

import { loginHref, type LoginEntry } from '@/lib/routes/return-path';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

/**
 * **ΤΟ ΒΗΜΑ ΛΟΓΑΡΙΑΣΜΟΥ** (ADR-915 §39, 2026-11-14) — «με ποιο email; έχω ήδη λογαριασμό;».
 *
 * Το κρίνει ο διακομιστής (`server/invitations/invitation-account-step.ts`) **μόνο** για κάτοχο έγκυρου συνδέσμου:
 * ο σύνδεσμος έφτασε **στο κουτί** του παραλήπτη, άρα το «υπάρχει λογαριασμός;» για **αυτή** τη διεύθυνση δεν είναι
 * μαντείο απαρίθμησης (πρότυπο Procore: ο υπάρχων χρήστης **δεν** καλείται να φτιάξει κωδικό). Η διεύθυνση ταξιδεύει
 * **μόνο καλυμμένη**. Προαιρετικό: είδος που δεν το δίνει ακόμη αποδίδεται όπως πριν.
 */
export interface InvitationAccountStep {
  /** `create` ⇒ κανένας λογαριασμός με τη διεύθυνση· `sign-in` ⇒ υπάρχει (ή δεν μάθαμε — ασφαλής προεπιλογή). */
  readonly kind: 'create' | 'sign-in';
  readonly maskedEmail: string;
  /** Λογαριασμός Google (υπάρχων πάροχος ή διεύθυνση Gmail) ⇒ «Συνέχεια με Google» πρώτο. */
  readonly googleSuggested: boolean;
}

export type InvitationRespond =
  | { readonly kind: 'ready' }
  /** `href` = `loginHref(...)` **από τον διακομιστή** — περνά από τον φρουρό `safeReturnPath`. */
  | { readonly kind: 'sign-in'; readonly href: string; readonly account?: InvitationAccountStep }
  /** `signedInAs` = το email του **θεατή** (δικό του) — του παραλήπτη ταξιδεύει μόνο καλυμμένο, στο `account`. */
  | { readonly kind: 'other-account'; readonly signedInAs: string; readonly account?: InvitationAccountStep };

export function invitationRespondOf(
  addressedToViewer: boolean | null,
  viewerEmail: string | null,
  signInHref: string,
  account?: InvitationAccountStep,
): InvitationRespond {
  const withAccount = account ? { account } : {};
  if (viewerEmail === null) return { kind: 'sign-in', href: signInHref, ...withAccount };
  if (addressedToViewer === false) return { kind: 'other-account', signedInAs: viewerEmail, ...withAccount };
  return { kind: 'ready' };
}

/** Η είσοδος που ταιριάζει στο βήμα: νέος ⇒ **Εγγραφή**, υπάρχων ⇒ **Σύνδεση** — πάντα με την καλυμμένη διεύθυνση. */
function loginEntryOf(account: InvitationAccountStep | undefined): LoginEntry | undefined {
  if (!account) return undefined;
  return { mode: account.kind === 'create' ? 'signup' : 'signin', invitedAs: account.maskedEmail };
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
  readonly account?: InvitationAccountStep;
}): InvitationPreviewView<P> {
  const returnHere = loginHref(args.invitationHref, loginEntryOf(args.account));
  return {
    kind: 'preview',
    preview: args.preview,
    token: args.token,
    respond: invitationRespondOf(args.addressedToViewer, args.viewerEmail, returnHere, args.account),
    switchAccountHref: returnHere,
  };
}

/** Η έκβαση κάθε αναγνώστη όψης (`preview*Invitation`) — όσο χρειάζεται η σελίδα για να διαλέξει οθόνη. */
export type InvitationPageOutcome<P, R extends string> =
  | { readonly kind: 'preview'; readonly preview: P; readonly addressedToViewer: boolean | null }
  | { readonly kind: 'refused'; readonly reason: R }
  | { readonly kind: 'unavailable' };

/** Ό,τι ζωγραφίζει το client component κάθε σελίδας πρόσκλησης. ⛔ Κανένα `markOpened` εδώ — δεν ταξιδεύει. */
export type InvitationPageView<P, R extends string> =
  | InvitationPreviewView<P>
  | { readonly kind: 'refused'; readonly reason: R }
  | { readonly kind: 'unavailable' };

/**
 * **Έκβαση → όψη σελίδας** — κοινή για `/tour-invite` · `/case-invite` · `/handover-invite` (ADR-916 Φ-Β2, CHECK 3.28:
 * θα ήταν τρίτο δίδυμο). Ρητή αναδόμηση, ποτέ `...outcome`: το `markOpened` είναι συνάρτηση διακομιστή.
 */
export function invitationPageViewOf<P, R extends string>(
  outcome: InvitationPageOutcome<P, R>,
  page: {
    readonly token: string;
    readonly viewerEmail: string | null;
    readonly invitationHref: string;
    readonly account?: InvitationAccountStep;
  },
): InvitationPageView<P, R> {
  switch (outcome.kind) {
    case 'preview':
      return invitationPreviewViewOf({ preview: outcome.preview, addressedToViewer: outcome.addressedToViewer, ...page });
    case 'refused':
      return { kind: 'refused', reason: outcome.reason };
    case 'unavailable':
      return { kind: 'unavailable' };
  }
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
