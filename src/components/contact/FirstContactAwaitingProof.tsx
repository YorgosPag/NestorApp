'use client';

/**
 * @fileoverview **«ΚΟΙΤΑΞΤΕ ΤΟ EMAIL ΣΑΣ»** — η στιγμή ανάμεσα στη δήλωση και την πράξη.
 * @related components/contact/FirstContactDialog.tsx (ο ξενιστής) · ADR-844 Β5
 * @module components/contact/FirstContactAwaitingProof
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΜΟΝΗ ΟΘΟΝΗ ΤΟΥ ΣΥΣΤΗΜΑΤΟΣ ΠΟΥ ΛΕΕΙ «ΔΕΝ ΕΓΙΝΕ ΤΙΠΟΤΑ ΑΚΟΜΗ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος μόλις πάτησε «Στείλτε τα στοιχεία μου» και **περιμένει να έχει τελειώσει**.
 * Δεν έχει. Αν αυτή η οθόνη δεν το πει **ρητά**, θα κλείσει την καρτέλα και θα περιμένει
 * απάντηση από ιδιοκτήτη που **δεν έμαθε ποτέ ότι υπήρξε** — η χειρότερη δυνατή έκβαση,
 * γιατί κανείς από τους δύο δεν ξέρει ότι κάτι πήγε στραβά.
 *
 * ⇒ Γι' αυτό το `why` *(«μέχρι τότε δεν έχει σταλεί τίποτα»)* είναι **κείμενο οθόνης**,
 * όχι σχόλιο κώδικα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚖️ ΤΙ ΚΡΑΤΑΕΙ ΕΔΩ ΚΑΙ ΤΙ ΑΝΕΒΑΖΕΙ ΣΤΟΝ ΓΟΝΙΟ — ΚΑΙ ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **«Έγινε η πράξη;»**
 *
 * | Έκβαση | Πού πάει | Γιατί |
 * |---|---|---|
 * | `opened` | ⬆️ γονιός | Έγινε — και η ειδοποίηση είναι **ταυτόσημη** με του συνδεδεμένου |
 * | `refused` · `invalid` · `failed` | ⬆️ γονιός | Ίδιο σχήμα με την κανονική υποβολή· ο {@link FirstContactOutcomeNotice} τα ξέρει ήδη |
 * | `code-wrong` | 🔒 εδώ | Ο άνθρωπος **ξαναγράφει** — η οθόνη δεν φεύγει από κάτω του |
 * | οι άλλες 6 αρνήσεις συνδέσμου · `identity-refused` · `unavailable` | 🔒 εδώ | **Δεν υπάρχουν** στο λεξιλόγιο της πράξης· είναι εκβάσεις της **απόδειξης** |
 *
 * ⛔ **ΜΗΝ αντιγράψεις εδώ τα κείμενα άρνησης της πράξης.** Ο γονιός τα αποδίδει με τον
 * υπάρχοντα πίνακα· δεύτερο αντίγραφο θα ξεχνούσε τον **έκτο** κωδικό.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { HintedField } from '@/components/ui/hinted-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { OpenContactResult } from '@/services/contact/first-contact.client';

import { ACT_KEYS, FIRST_CONTACT_NS } from './first-contact-labels';
import { GUEST_KEYS, INVITATION_REFUSAL_KEYS } from './first-contact-guest-labels';
// 🔑 **Η ΛΟΓΙΚΗ ΖΕΙ ΔΙΠΛΑ, ΟΧΙ ΕΔΩ** *(ADR-844 §11.8)*: αυτό το αρχείο απαντά **μόνο**
//    στο *«τι βλέπει ο άνθρωπος;»*.
import {
  actionOf,
  useCodeProof,
  useResendCooldown,
  type ProofSetback,
} from './first-contact-proof-state';

export interface FirstContactAwaitingProofProps {
  readonly invitationId: string;
  /** Η απόδειξη πέρασε **και** γεννήθηκε πράξη — ο γονιός αναλαμβάνει την ανακοίνωση. */
  readonly onProven: (result: OpenContactResult) => void;
  readonly onCancel: () => void;
  /**
   * 🔴 **ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΕΛΕΙΠΕ — ΚΑΙ Η ΠΡΑΞΗ ΤΟΥ ΑΝΗΚΕΙ ΣΤΟΝ ΓΟΝΙΟ, ΟΧΙ ΕΔΩ.**
   *
   * Αυτή η οθόνη ξέρει **μόνο** ένα `invitationId`. Η νέα πρόσκληση χρειάζεται
   * ολόκληρη τη **δήλωση** *(όνομα, email, τηλέφωνο, στόχο, ζήτηση)*, που ζει στον
   * διάλογο. Αν την ξανάχτιζε εδώ, θα ήταν **δεύτερη κατασκευή** του ίδιου σώματος —
   * ακριβώς αυτό που ο διάλογος αποφεύγει ρητά *(«δύο χωριστές κατασκευές θα
   * απέκλιναν στην πρώτη προσθήκη πεδίου — σιωπηλά, γιατί το zod αφαιρεί ό,τι δεν
   * δηλώθηκε»)*.
   *
   * ⇒ Εδώ ζει η **στιγμή** *(πότε επιτρέπεται)*· εκεί η **πράξη** *(τι στέλνεται)*.
   */
  readonly onResend: () => void;
  /** Ο γονιός στέλνει — το κουμπί λέει «Στέλνεται…» και δεν ξαναπατιέται. */
  readonly resending: boolean;
}

/**
 * ⚠️ **Το `μ***α@gmail.com` ΔΕΝ αποδίδεται εδώ, και είναι σκόπιμο**: ζει στην
 * **περιγραφή του διαλόγου** (`DialogDescription`), που ο αναγνώστης οθόνης διαβάζει
 * **μία φορά** όταν αλλάζει η κατάσταση. Ένα δεύτερο αντίγραφο στο σώμα θα το
 * ανακοίνωνε **δύο φορές** — και θα ήταν δεύτερο σημείο να ξεχαστεί όταν αλλάξει.
 */
export function FirstContactAwaitingProof({
  invitationId,
  onProven,
  onCancel,
  onResend,
  resending,
}: FirstContactAwaitingProofProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const fieldId = React.useId();

  const [code, setCode] = React.useState('');
  // 🔑 **ΔΥΟ ΑΓΚΙΣΤΡΑ, ΔΥΟ ΕΡΩΤΗΜΑΤΑ**: *«τι απέγινε η απόδειξη;»* και *«πότε
  //    επιτρέπεται νέος σύνδεσμος;»*. Ό,τι μένει εδώ είναι **παρουσίαση**.
  const proof = useCodeProof(invitationId, onProven);
  const cooldown = useResendCooldown();

  const action = actionOf(proof.setback);
  const busy = proof.checking || resending;

  return (
    // ⚠️ `noValidate`: ο κριτής είναι δικός μας, στη γλώσσα του ανθρώπου — ίδιο ιδίωμα
    //    με τη φόρμα δήλωσης, ίδιος λόγος (ο φυλλομετρητής μιλά αγγλικά).
    <form onSubmit={(event) => void proof.submit(event, code)} noValidate className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted-foreground">{t(GUEST_KEYS.why)}</p>

      {proof.setback !== null && <SetbackNotice setback={proof.setback} />}

      {action === 'retry-code' && (
        <HintedField
          id={`${fieldId}-code`}
          label={t(GUEST_KEYS.codeLabel)}
          hint={t(GUEST_KEYS.codeHint)}
          // 🔑 **`inputMode` ΚΑΙ `autoComplete="one-time-code"`**: το πρώτο ανοίγει
          //    αριθμητικό πληκτρολόγιο στο κινητό, το δεύτερο επιτρέπει στο iOS/Android
          //    να **προτείνουν** τον κωδικό από την ειδοποίηση — ο άνθρωπος δεν αλλάζει
          //    εφαρμογή. ⛔ ΜΗΝ βάλεις `type="number"`: κόβει τα κενά που τυπώνει το
          //    email (`472 913`) και εμφανίζει βελάκια αύξησης σε κωδικό.
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          disabled={busy}
          onChange={setCode}
        />
      )}

      {action !== 'none' && (
        <ResendRow
          primary={action === 'reissue'}
          secondsLeft={cooldown.secondsLeft}
          sending={resending}
          onResend={() => {
            cooldown.restart();
            onResend();
          }}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          {t(action === 'none' ? ACT_KEYS.closeAfterDone : ACT_KEYS.cancel)}
        </Button>
        {action === 'retry-code' && (
          <Button type="submit" disabled={busy || code.trim() === ''}>
            {t(proof.checking ? GUEST_KEYS.submitting : GUEST_KEYS.submit)}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

/**
 * **«Δεν έλαβα τίποτα»** — η διέξοδος που **ΔΕΝ** περίμενε άρνηση για να εμφανιστεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΧΕΙΡΟΤΕΡΟ ΑΔΙΕΞΟΔΟ ΑΥΤΗΣ ΤΗΣ ΟΘΟΝΗΣ ΔΕΝ ΕΙΧΕ ΚΑΝ ΜΗΝΥΜΑ ΣΦΑΛΜΑΤΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος του οποίου το email **δεν φτάνει ποτέ** *(τυπογραφικό στη διεύθυνση,
 * ανεπιθύμητα, καθυστέρηση παρόχου)* δεν παίρνει **καμία** έκβαση: κάθεται μπροστά σε
 * πεδίο κωδικού που δεν μπορεί να συμπληρώσει, με μοναδικό κουμπί το «Άκυρο». Η οθόνη
 * δεν του είπε **τίποτα λάθος** — απλώς δεν του έδωσε **τίποτα να κάνει**. Ίδια κλάση
 * με τη σελίδα της άρνησης, χωρίς καν κείμενο να την προδώσει.
 *
 * 🏆 Γι' αυτό το «Resend» των Slack/Stripe/Airbnb είναι **μόνιμο** στην οθόνη του
 * εξαψήφιου κωδικού, όχι αποτέλεσμα σφάλματος.
 *
 * ⚠️ **ΕΝΑ κουμπί, δύο βάρη** *(`primary`)*: όσο η πρόσκληση **ζει** είναι δευτερεύον
 * — η κύρια πράξη είναι ο κωδικός· όταν εκείνη **πεθάνει** γίνεται η **μόνη** πράξη
 * και το δείχνει. Δύο σημεία απόδοσης θα ήταν δύο σημεία να ξεχαστεί το ένα.
 */
function ResendRow({
  primary,
  secondsLeft,
  sending,
  onResend,
}: {
  readonly primary: boolean;
  readonly secondsLeft: number;
  readonly sending: boolean;
  readonly onResend: () => void;
}): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const waiting = secondsLeft > 0;

  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {t(GUEST_KEYS.resendHint)}
      <Button
        type="button"
        variant={primary ? 'default' : 'ghost'}
        size="sm"
        disabled={sending || waiting}
        onClick={onResend}
      >
        {/*
          ⚠️ **Η αναμονή λέει ΠΟΣΟ, όχι σκέτο «περιμένετε».** Ανενεργό κουμπί χωρίς
             αριθμό διαβάζεται ως **χαλασμένο**: ο άνθρωπος το πατά ξανά και ξανά και
             συμπεραίνει ότι η οθόνη τον αγνοεί. Ο μετρητής μετατρέπει την άρνηση σε
             **υπόσχεση** — πρότυπο κάθε οθόνης κωδικού.
        */}
        {sending && t(GUEST_KEYS.resending)}
        {!sending && waiting && t(GUEST_KEYS.resendWait, { seconds: secondsLeft })}
        {!sending && !waiting && t(GUEST_KEYS.resend)}
      </Button>
    </p>
  );
}

/**
 * ⚠️ **`role="alert"` ΕΔΩ, σε αντίθεση με τη γραμμή EDPB της φόρμας**: εκεί το κείμενο
 * υπάρχει από την αρχή· εδώ **μόλις συνέβη** κάτι που ο άνθρωπος περίμενε να πετύχει.
 * Ο χρήστης αναγνώστη οθόνης πατά «Επιβεβαίωση» και πρέπει να **ακούσει** το αποτέλεσμα.
 */
function SetbackNotice({ setback }: { readonly setback: ProofSetback }): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  return (
    <p role="alert" className="m-0 rounded-md border-2 border-destructive p-3 text-sm">
      {t(setbackKey(setback))}
    </p>
  );
}

function setbackKey(setback: ProofSetback): string {
  switch (setback.kind) {
    case 'link':
      return INVITATION_REFUSAL_KEYS[setback.reason];
    case 'identity':
      return GUEST_KEYS.identityRefused;
    case 'unavailable':
      return GUEST_KEYS.writeFailed;
    case 'failed':
      return GUEST_KEYS.failed;
  }
}
