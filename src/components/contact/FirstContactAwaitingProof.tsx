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
import { adoptCitizenSession } from '@/auth/citizen-session';
import {
  confirmGuestContact,
  type GuestConfirmResult,
  type OpenContactResult,
} from '@/services/contact/first-contact.client';
import type { FirstContactInvitationRefusal } from '@/types/first-contact-invitation';

import { ACT_KEYS, FIRST_CONTACT_NS } from './first-contact-labels';
import { GUEST_KEYS, INVITATION_REFUSAL_KEYS } from './first-contact-guest-labels';

/**
 * 🔑 **ΜΟΝΟ ο λάθος κωδικός αφήνει τον άνθρωπο να ξαναδοκιμάσει, και είναι κλειστό
 * σύνολο ΟΧΙ κατά τύχη.** Οι υπόλοιπες έξι αρνήσεις είναι **γεγονότα του κόσμου**
 * *(έληξε, εξαργυρώθηκε, αντικαταστάθηκε, κλείδωσε)*: ένα πεδίο κωδικού από κάτω τους θα
 * ήταν πρόσκληση να δοκιμάσει κάτι που **δεν μπορεί** να πετύχει.
 *
 * ⚠️ Το `code-exhausted` είναι **ρητά έξω**: εκεί οι δοκιμές τελείωσαν — άλλη μία θα
 * ήταν ψέμα.
 */
const RETRYABLE_REFUSALS: readonly FirstContactInvitationRefusal[] = ['code-wrong'];

/** Ό,τι μπορεί να πάει στραβά **χωρίς** να έχει γεννηθεί πράξη. */
type ProofSetback =
  | { readonly kind: 'link'; readonly reason: FirstContactInvitationRefusal }
  | { readonly kind: 'identity' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

type ProofPhase =
  | { readonly kind: 'asking'; readonly setback: ProofSetback | null }
  | { readonly kind: 'checking' };

export interface FirstContactAwaitingProofProps {
  readonly invitationId: string;
  /** Η απόδειξη πέρασε **και** γεννήθηκε πράξη — ο γονιός αναλαμβάνει την ανακοίνωση. */
  readonly onProven: (result: OpenContactResult) => void;
  readonly onCancel: () => void;
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
}: FirstContactAwaitingProofProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const fieldId = React.useId();

  const [code, setCode] = React.useState('');
  const [phase, setPhase] = React.useState<ProofPhase>({ kind: 'asking', setback: null });

  const setback = phase.kind === 'asking' ? phase.setback : null;
  const closed = setback !== null && !isRetryable(setback);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
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

  return (
    // ⚠️ `noValidate`: ο κριτής είναι δικός μας, στη γλώσσα του ανθρώπου — ίδιο ιδίωμα
    //    με τη φόρμα δήλωσης, ίδιος λόγος (ο φυλλομετρητής μιλά αγγλικά).
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted-foreground">{t(GUEST_KEYS.why)}</p>

      {setback !== null && <SetbackNotice setback={setback} />}

      {!closed && (
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
          disabled={phase.kind === 'checking'}
          onChange={setCode}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={phase.kind === 'checking'}>
          {t(closed ? ACT_KEYS.closeAfterDone : ACT_KEYS.cancel)}
        </Button>
        {!closed && (
          <Button type="submit" disabled={phase.kind === 'checking' || code.trim() === ''}>
            {t(phase.kind === 'checking' ? GUEST_KEYS.submitting : GUEST_KEYS.submit)}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
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

function isRetryable(setback: ProofSetback): boolean {
  return setback.kind === 'link' && RETRYABLE_REFUSALS.includes(setback.reason);
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
