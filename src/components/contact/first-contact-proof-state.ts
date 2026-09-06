'use client';

/**
 * @fileoverview **Η ΛΟΓΙΚΗ ΤΗΣ ΑΠΟΔΕΙΞΗΣ** — τι συμβαίνει, χωρίς καμία γνώση οθόνης.
 * @related components/contact/FirstContactAwaitingProof.tsx (η οθόνη) · ADR-844 §11
 * @module components/contact/first-contact-proof-state
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΗΚΕ — Ν.7.1, ΚΑΙ Η ΡΑΦΗ ΗΤΑΝ ΗΔΗ ΜΙΣΟΤΡΑΒΗΓΜΕΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Με το κουμπί «ξαναστείλτε» και την αναμονή του (ADR-844 §11), το αρχείο της οθόνης
 * έφτασε τις **486** γραμμές — δηλαδή ένα αρχείο που ο **επόμενος δεν μπορεί να
 * αγγίξει** χωρίς να σπάσει το όριο των 500.
 *
 * ⛔ **Η ΕΝΑΛΛΑΚΤΙΚΗ ΠΟΥ ΑΠΟΡΡΙΦΘΗΚΕ**: τεμαχισμός του JSX σε μικρο-συστατικά *(πεδίο ·
 * ειδοποίηση · γραμμή επαναποστολής · υποσέλιδο)*. Θα ικανοποιούσε τον μετρητή και θα
 * σκόρπιζε **μία** οθόνη σε τέσσερα σημεία — **τρίμμα, όχι εξαγωγή**.
 *
 * ✅ **Η ΡΑΦΗ ΠΟΥ ΔΙΑΛΕΧΤΗΚΕ** είναι η μόνη που υπήρχε πραγματικά:
 *
 * | Ερώτηση | Πού ζει |
 * |---|---|
 * | *«τι απέγινε η απόδειξη;»* · *«τι μπορεί να κάνει;»* · *«πότε επιτρέπεται νέος σύνδεσμος;»* | **εδώ** |
 * | *«τι βλέπει ο άνθρωπος;»* | `FirstContactAwaitingProof.tsx` |
 *
 * ⚠️ **ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΕΔΩ.** Ούτε ένα `t()`, ούτε ένα κλειδί: το αρχείο απαντά *«τι
 * ισχύει»*, ποτέ *«τι γράφεται»*. Ο τεμαχιστής i18n είναι **key-level** και μετρά
 * κλήσεις `t()` — έτσι αυτός ο διαχωρισμός είναι **ουδέτερος** για κάθε slice
 * *(μετρημένο: το `/contact/[token]` δεν εισάγει καν αυτό το δέντρο)*.
 *
 * **Layering**: πελατική λογική — άγκιστρα React + καθαροί πίνακες. Καμία γνώση HTTP
 * πέρα από τον **υπάρχοντα** μεταφορέα, κανένα Firestore.
 */

import React from 'react';

import { useInterval } from '@/hooks/useInterval';
import { adoptCitizenSession } from '@/auth/citizen-session';
import {
  confirmGuestContact,
  type GuestConfirmResult,
  type OpenContactResult,
} from '@/services/contact/first-contact.client';
import type { FirstContactInvitationRefusal } from '@/types/first-contact-invitation';

/**
 * **ΤΙ ΜΠΟΡΕΙ ΝΑ ΚΑΝΕΙ Ο ΑΝΘΡΩΠΟΣ ΤΩΡΑ** — μία απάντηση, τρεις δυνατές τιμές.
 *
 * ⚠️ Οι τιμές είναι **ενέργειες**, όχι λόγοι: ο λόγος λέει *τι συνέβη* (το κάνει ο
 * πίνακας κειμένων της **οθόνης**), αυτό λέει *τι πατάει*. Δύο ερωτήσεις, δύο πίνακες.
 */
type ProofAction =
  /** Η **ίδια** πρόσκληση ζει· λείπει σωστός κωδικός. */
  | 'retry-code'
  /** Αυτή η πρόσκληση **δεν ξαναδουλεύει** — χρειάζεται **νέα**. */
  | 'reissue'
  /** **Τίποτα**, και είναι σωστό: η πράξη έγινε ήδη ή η ταυτότητα είναι κλειστή. */
  | 'none';

/**
 * 🔴 **ΠΛΗΡΗΣ `Record`, ΚΑΙ ΑΝΤΙΚΑΤΕΣΤΗΣΕ ΧΕΙΡΟΓΡΑΦΟ ΥΠΟΣΥΝΟΛΟ.**
 *
 * Εδώ ζούσε `RETRYABLE_REFUSALS = ['code-wrong']` — **λίστα**, όχι πίνακας. Μια λίστα
 * απαντά *«ποιοι είναι μέσα;»* και σιωπά για τους υπόλοιπους: **όγδοη** άρνηση θα
 * γεννιόταν **σιωπηλά** ως «τίποτα να κάνεις», δηλαδή θα κληρονομούσε το ίδιο
 * αδιέξοδο που το ADR-844 θεραπεύει στη **σελίδα**. Το γειτονικό
 * {@link REJECTION_REMEDY} είχε ήδη το σωστό ιδίωμα — πλήρης `Record` με **ρητό**
 * «καμία διέξοδος». Αυτό είναι ο αδελφός του.
 *
 * ⇒ Νέος κωδικός άρνησης **δεν μεταγλωττίζεται** χωρίς απάντηση στο *«τι πατάει ο
 * άνθρωπος τότε;»*.
 *
 * ⚠️ **Το `already-used` είναι το ΜΟΝΟ `none`, και δεν είναι αδιαφορία**: εκεί η πράξη
 * **έγινε** — το κείμενο λέει *«δεν χρειάζεται τίποτα άλλο»*, και ένα κουμπί από κάτω
 * θα το διέψευδε. Το `identity` και το `failed` το παίρνουν από αλλού (δες
 * {@link actionOf}).
 *
 * ⚠️ **Το `superseded` ζητά ΝΕΑ πρόσκληση παρότι υπάρχει ζωντανή νεότερη**: το κείμενο
 * στέλνει πρώτα *«ψάξτε το πιο πρόσφατο email»*, αλλά αν εκείνο χάθηκε ο άνθρωπος θα
 * ήταν πάλι εγκλωβισμένος. Μια νέα πρόσκληση **αντικαθιστά** τη νεότερη με τον
 * υπάρχοντα μηχανισμό — κανένα δεύτερο ζωντανό κλειδί, μηδέν νέα εγγύηση.
 */
const REFUSAL_ACTION: Record<FirstContactInvitationRefusal, ProofAction> = {
  'link-invalid': 'reissue',
  'invitation-unknown': 'reissue',
  expired: 'reissue',
  'already-used': 'none',
  superseded: 'reissue',
  'code-wrong': 'retry-code',
  'code-exhausted': 'reissue',
};

/**
 * **Πόσο περιμένει ο άνθρωπος πριν ξαναζητήσει σύνδεσμο.**
 *
 * 🏆 **Είναι η πρακτική κάθε οθόνης εξαψήφιου κωδικού** *(Slack · Stripe · Airbnb)*,
 * και υπάρχει για **δύο** λόγους — ο δεύτερος είναι ο σοβαρός:
 *
 * 1. Κάθε πάτημα = **ένα email** και **μία** γραφή αντικατάστασης.
 * 2. 🔴 **Κάθε νέα πρόσκληση ΣΚΟΤΩΝΕΙ ΤΟΝ ΚΩΔΙΚΟ ΠΟΥ ΙΣΩΣ ΚΡΑΤΑΕΙ ΗΔΗ Ο ΑΝΘΡΩΠΟΣ.**
 *    Ανυπόμονο διπλοπάτημα ενώ το πρώτο email είναι στον αέρα τον αφήνει με **δύο**
 *    μηνύματα και **έναν** έγκυρο κωδικό — τον δεύτερο. Η αναμονή τον προστατεύει από
 *    τον εαυτό του, όχι εμάς από αυτόν.
 *
 * ⚠️ **Δεν είναι φρουρός πόρου**: εκείνος είναι το `withHeavyRateLimit` της διαδρομής
 * (10/λεπτό ανά IP), και **δεν παρακάμπτεται** από τον φυλλομετρητή. Αυτό εδώ είναι
 * **ευγένεια οθόνης** — γι' αυτό ζει στον πελάτη και μόνο.
 */
const RESEND_COOLDOWN_MS = 30_000;

/** Ό,τι μπορεί να πάει στραβά **χωρίς** να έχει γεννηθεί πράξη. */
export type ProofSetback =
  | { readonly kind: 'link'; readonly reason: FirstContactInvitationRefusal }
  | { readonly kind: 'identity' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

type ProofPhase =
  | { readonly kind: 'asking'; readonly setback: ProofSetback | null }
  | { readonly kind: 'checking' };

/**
 * **Η ΑΠΟΔΕΙΞΗ** — τι απέγινε ο κωδικός, χωρίς καμία γνώση οθόνης.
 *
 * 🔑 **ΕΞΑΓΕΤΑΙ ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ΜΕ ΤΟ {@link useResendCooldown}**: το σώμα του
 * συστατικού απαντούσε **δύο** ερωτήματα ταυτόχρονα — *«τι συμβαίνει όταν υποβάλλει;»*
 * και *«τι βλέπει;»* — και είχε φτάσει τις **67** γραμμές κώδικα (N.7.1: όριο 40).
 *
 * ⛔ **Η ΕΝΑΛΛΑΚΤΙΚΗ ΠΟΥ ΑΠΟΡΡΙΦΘΗΚΕ**: τεμαχισμός του JSX σε τέσσερα μικρο-συστατικά
 * *(πεδίο · ειδοποίηση · γραμμή επαναποστολής · υποσέλιδο)*. Θα ικανοποιούσε τον
 * μετρητή και θα σκόρπιζε **μία** οθόνη σε τέσσερα σημεία — τρίμμα, όχι εξαγωγή. Η
 * σωστή ραφή είναι **λογική vs παρουσίαση**, και ήταν ήδη μισοτραβηγμένη.
 *
 * ⚠️ **Ο κωδικός ΔΕΝ ζει εδώ, και είναι σκόπιμο**: τον κατέχει το πεδίο *(ελεγχόμενη
 * είσοδος)*, και περνά ως **όρισμα** στην υποβολή. Ένα άγκιστρο που κρατούσε **και**
 * τον κωδικό θα ήταν το ίδιο συστατικό με άλλο όνομα.
 */
export function useCodeProof(
  invitationId: string,
  onProven: (result: OpenContactResult) => void,
): {
  readonly setback: ProofSetback | null;
  readonly checking: boolean;
  readonly submit: (event: React.FormEvent<HTMLFormElement>, code: string) => Promise<void>;
} {
  const [phase, setPhase] = React.useState<ProofPhase>({ kind: 'asking', setback: null });

  // ⚠️ **ΑΠΛΗ ΣΥΝΑΡΤΗΣΗ, ΟΧΙ `useCallback` — ΚΑΙ ΕΙΝΑΙ ΕΙΛΙΚΡΙΝΕΙΑ.** Το `onProven`
  //    φτάνει ως **ενσωματωμένο βέλος** από τον διάλογο, δηλαδή είναι νέο σε κάθε
  //    απόδοση: ένα `useCallback([invitationId, onProven])` θα ξαναχτιζόταν **ούτως ή
  //    άλλως**, υποσχόμενο σταθερότητα που δεν υπάρχει. Ψεύτικη σταθερότητα είναι
  //    χειρότερη από καθόλου — ο επόμενος θα τη ΒΑΣΙΣΤΕΙ σε πίνακα εξαρτήσεων.
  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    code: string,
  ): Promise<void> {
    event.preventDefault();
    if (code.trim() === '') return;

    setPhase({ kind: 'checking' });
    const outcome = await confirmGuestContact(invitationId, code);
    const act = await settle(outcome);

    if (act !== null) {
      onProven(act);
      return;
    }
    setPhase({ kind: 'asking', setback: setbackOf(outcome) });
  }

  return {
    setback: phase.kind === 'asking' ? phase.setback : null,
    checking: phase.kind === 'checking',
    submit,
  };
}

/**
 * **Πόσα δευτερόλεπτα μένουν** — μετρημένα από **προθεσμία**, ποτέ από μετρητή.
 *
 * 🔴 **ΓΙΑΤΙ ΠΡΟΘΕΣΜΙΑ ΚΑΙ ΟΧΙ `setSeconds(n - 1)`**: ο φυλλομετρητής **στραγγαλίζει**
 * τα χρονόμετρα σε καρτέλα που δεν βλέπει *(≈1 τικ/λεπτό στο Chrome)* — και αυτή
 * ακριβώς είναι η στιγμή που ο άνθρωπος **έχει αλλάξει καρτέλα για να δει το email
 * του**. Ένας μετρητής θα τον έβρισκε γυρίζοντας στο «26» ενώ πέρασαν δύο λεπτά, και
 * το κουμπί θα έμενε κλειδωμένο **χωρίς λόγο**. Η προθεσμία δεν έχει τι να χάσει: ο
 * χρόνος περνά ούτως ή άλλως, το ρολόι απλώς **ρωτιέται**.
 *
 * ⚠️ **Το χρονόμετρο σταματά μόνο του** *(`enabled: now < readyAt`)* — καμία
 * εκκρεμότητα σε αδρανή οθόνη, κανένα τικ που δεν αλλάζει τίποτα.
 *
 * ⚠️ **Ξεκινά με την προσάρτηση, και είναι σωστό**: η οθόνη εμφανίζεται τη στιγμή που
 * το πρώτο email **μόλις έφυγε**. Μηδέν αναμονή εκεί θα σήμαινε «ξαναστείλε» πριν
 * προλάβει να φτάσει το πρώτο.
 *
 * ⚠️ **Το `Date.now()` στην αρχική τιμή δεν κινδυνεύει από ασυμφωνία ενυδάτωσης**: ο
 * διάλογος φορτώνεται **τεμπέλικα και χωρίς SSR** *(CHECK 3.34)*, άρα αυτό το δέντρο
 * **δεν αποδίδεται ποτέ** στον διακομιστή.
 */
export function useResendCooldown(): { readonly secondsLeft: number; readonly restart: () => void } {
  const [readyAt, setReadyAt] = React.useState(() => Date.now() + RESEND_COOLDOWN_MS);
  const [now, setNow] = React.useState(() => Date.now());

  useInterval(() => setNow(Date.now()), 1000, now < readyAt);

  const restart = React.useCallback(() => {
    const at = Date.now();
    setNow(at);
    setReadyAt(at + RESEND_COOLDOWN_MS);
  }, []);

  return { secondsLeft: Math.max(0, Math.ceil((readyAt - now) / 1000)), restart };
}

/**
 * **Η πράξη, αν γεννήθηκε** — αλλιώς `null` και ο ξενιστής μένει.
 *
 * 🔴 **Η ΣΥΝΔΕΣΗ ΓΙΝΕΤΑΙ ΕΔΩ, ΚΑΙ ΑΝΑΜΕΝΕΤΑΙ.** Ο επόμενος πειρασμός είναι
 * fire-and-forget *(«η πράξη έγινε, τι μας νοιάζει;»)*: θα άφηνε τον άνθρωπο να δει
 * *«Δείτε τις επαφές σας»* και να πατήσει **πριν** στηθεί το cookie — δηλαδή θα τον
 * έστελνε σε **401** αμέσως μετά από επιτυχία.
 *
 * ⚠️ **Και η αποτυχία της ΔΕΝ αλλάζει τίποτα**: το `adoptCitizenSession` δεν πετά ποτέ,
 * και η πράξη είναι ήδη γραμμένη. Ο άνθρωπος βλέπει «Στάλθηκε» — που είναι **αληθές**.
 */
async function settle(outcome: GuestConfirmResult): Promise<OpenContactResult | null> {
  switch (outcome.kind) {
    case 'opened':
      await adoptCitizenSession(outcome.customToken);
      return { kind: 'opened', contact: outcome.contact, created: outcome.created };
    case 'refused':
      return { kind: 'refused', reason: outcome.reason };
    case 'invalid':
      return { kind: 'invalid', violations: outcome.violations };
    case 'failed':
      return { kind: 'failed' };
    case 'link-refused':
    case 'identity-refused':
    case 'unavailable':
      return null;
  }
}

/** Το συμπλήρωμα του {@link settle} — **εξαντλητικά**, χωρίς `default`. */
function setbackOf(outcome: GuestConfirmResult): ProofSetback {
  switch (outcome.kind) {
    case 'link-refused':
      return { kind: 'link', reason: outcome.reason };
    case 'identity-refused':
      return { kind: 'identity' };
    case 'unavailable':
      return { kind: 'unavailable' };
    // 🔑 Οι υπόλοιπες **ανέβηκαν** στον γονιό· αν φτάσουν εδώ, κάποιος χάλασε το
    //    {@link settle} — και το «δεν μάθαμε» είναι η μόνη τίμια απάντηση (N.12).
    case 'opened':
    case 'refused':
    case 'invalid':
    case 'failed':
      return { kind: 'failed' };
  }
}

/**
 * **Τι πατάει ο άνθρωπος** — εξαντλητικά, και το `null` έχει τη δική του απάντηση.
 *
 * 🔑 **Καμία άρνηση ⇒ `retry-code`**: η πρόσκληση μόλις στάλθηκε και **ζει**. Ο
 * άνθρωπος γράφει τον κωδικό — ή, αν δεν του ήρθε ποτέ, ζητά νέο σύνδεσμο.
 *
 * ⚠️ **Το `failed` μένει `retry-code` επίτηδες**: *«δεν μπορέσαμε να ελέγξουμε τον
 * κωδικό»* σημαίνει ότι **δεν μάθαμε** (N.12) — η πρόσκληση πιθανότατα ζει ακόμη, και
 * μια νέα θα σκότωνε **έγκυρο** κωδικό για δικό **μας** πρόβλημα.
 *
 * ⚠️ **Το `unavailable` ζητά ΝΕΑ πρόσκληση**, γιατί η παλιά έχει **ήδη σφραγιστεί**
 * *(δηλωμένο όριο #2 του ADR-844)*. Το κείμενό του το λέει ήδη — τώρα υπάρχει και το
 * κουμπί που το εκτελεί, αντί για οδηγία που ο άνθρωπος έπρεπε να εκτελέσει μόνος.
 *
 * ⛔ **Το `identity` δεν έχει καμία πράξη**: ο λογαριασμός είναι κλειστός, και **καμία**
 * νέα πρόσκληση δεν το αλλάζει. Κουμπί εκεί θα ήταν ψέμα με ωραία εμφάνιση.
 */
export function actionOf(setback: ProofSetback | null): ProofAction {
  if (setback === null) return 'retry-code';

  switch (setback.kind) {
    case 'link':
      return REFUSAL_ACTION[setback.reason];
    case 'identity':
      return 'none';
    case 'unavailable':
      return 'reissue';
    case 'failed':
      return 'retry-code';
  }
}
