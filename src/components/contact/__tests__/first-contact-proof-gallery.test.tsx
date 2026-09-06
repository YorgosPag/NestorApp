/**
 * 🔴 ΑΓΚΥΡΑ — **Η ΓΚΑΛΕΡΙ ΔΕΙΧΝΕΙ ΚΑΘΕ ΕΚΒΑΣΗ, ΚΑΙ ΔΕΝ ΤΗ ΘΥΜΑΤΑΙ ΑΝΘΡΩΠΟΣ** (ADR-844 §11).
 * @related components/contact/testing/FirstContactProofHarness.tsx · first-contact-proof-scenarios.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΠΟΥ ΚΑΜΙΑ ΓΚΑΛΕΡΙ STORIES ΔΕΝ ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το κενό του Storybook είναι **ονομασμένο από το ίδιο του το οικοσύστημα**: *«only the
 * states someone **thought to write a story for** … an **authorship** problem»*. Ένα
 * `.stories.tsx` είναι χειρόγραφη λίστα — η όγδοη άρνηση μεταγλωττίζεται μια χαρά και
 * απλώς δεν αποκτά ποτέ story, και το Chromatic διαφοροποιεί **μόνο όσα υπάρχουν**.
 *
 * ⇒ Εδώ η γκαλερί **παράγεται** από το κλειστό σύνολο, και **αυτό το αρχείο το
 * επιβάλλει**: η ομάδα **Α** ρωτά το `FIRST_CONTACT_INVITATION_REFUSALS` και απαιτεί
 * πάνελ για **κάθε** μέλος του. Χειρόγραφη αφαίρεση σκέλους **κοκκινίζει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΕΛΕΓΧΕΤΑΙ ΕΔΩ, ΚΑΙ ΠΟΥ ΖΕΙ — **ΓΡΑΜΜΕΝΟ ΓΙΑ ΝΑ ΜΗ ΓΡΑΦΤΕΙ ΔΕΥΤΕΡΗ ΦΟΡΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Η ΜΕΤΑΦΡΑΣΗ σώματος → ονομαστική έκβαση ΕΙΝΑΙ ΗΔΗ ΑΓΚΥΡΩΜΕΝΗ ΕΞΑΝΤΛΗΤΙΚΑ** στο
 * `services/contact/__tests__/first-contact-guest-client.test.ts` — σκέλη **Β2** *(βρόχος
 * πάνω στο ίδιο κλειστό σύνολο)*, **Β3** *(άγνωστος κωδικός)*, **Β6** *(`IDENTITY_REFUSED`)*,
 * **Β7** *(`WRITE_FAILED`)*. Δεύτερη διατύπωσή τους εδώ θα ήταν **ακριβώς** το διπλότυπο
 * που ο N.0.2 απαγορεύει, και θα «περνούσε» ακόμη κι όταν το πρωτότυπο έσπαγε.
 *
 * ⇒ Αυτό το αρχείο ρωτά **μόνο δύο** πράγματα που εκείνο **δεν μπορεί** να ρωτήσει:
 * *«υπάρχει πάνελ για κάθε έκβαση;»* και *«δείχνει το κάθε πάνελ ΤΟ ΔΙΚΟ ΤΟΥ κείμενο;»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Αντικατάστησε το `...FIRST_CONTACT_INVITATION_REFUSALS.map(…)` με χειρόγραφη
 *    λίστα που ξεχνά έναν λόγο → **Α1**.
 * 2. Σβήσε το σενάριο `pristine` → **Α2** *(και μαζί η θεραπεία του §11)*.
 * 3. Κάνε τον ψεύτικο μεταφορέα να αγνοεί το `invitationId` → **Β1** *(όλα τα πάνελ
 *    δείχνουν το ίδιο κείμενο)*.
 * 4. Άφησε το `useAutoProve` να τρέχει χωρίς το `armed` → **Β1** *(κανένα πάνελ δεν
 *    προλαβαίνει τον μεταφορέα)*.
 * 5. Γύρνα το `settle()` να **κρατά** το `failed` στην οθόνη → **Β2β**.
 * 6. Σβήσε την ένδειξη παράδοσης από το πάνελ → **Β2β**.
 * 7. Σβήσε το `<ResendRow …>` → **Β3**.
 */

jest.mock('@/lib/api/enterprise-api-client', () => {
  const types = jest.requireActual('@/lib/api/api-client-types');
  return {
    // ⚠️ **Αντικείμενο, ΠΟΤΕ read-only mock**: το harness το **μπαλώνει** — αυτή είναι
    //    ολόκληρη η ραφή που ελέγχουμε. Ένα `jest.fn()` παγωμένο θα έκανε το μπάλωμα
    //    σιωπηλά άκυρο και το αρχείο θα ήταν πράσινο για λάθος λόγο.
    apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
    ApiClientError: types.ApiClientError,
    apiErrorBodyOf: types.apiErrorBodyOf,
  };
});

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ⚠️ Ίδιος λόγος με το `first-contact-dead-end.test.tsx`: το `citizen-session` σέρνει
//    `@/lib/firebase`, που τρέχει `initializeApp` **στο import**.
jest.mock('@/auth/citizen-session', () => ({
  adoptCitizenSession: jest.fn().mockResolvedValue({ kind: 'signed-in', uid: 'u' }),
}));

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { FirstContactProofHarness } from '../testing/FirstContactProofHarness';
import { PROOF_SCENARIOS } from '../testing/first-contact-proof-scenarios';
import { GUEST_KEYS, INVITATION_REFUSAL_KEYS } from '../first-contact-guest-labels';
import { FIRST_CONTACT_INVITATION_REFUSALS } from '@/types/first-contact-invitation';

const idOf = (scenario: { readonly id: string }): string => scenario.id;

/**
 * ⚠️ **ΤΑΒΑΝΙ, ΟΧΙ ΧΡΟΝΙΣΜΟΣ.** Η αναμονή σταματά στο **δηλωμένο σήμα της οθόνης**
 * *(εμφάνιση του `role="alert"`)*· αυτός ο αριθμός λέει μόνο *«πότε παραιτούμαστε»*.
 * Το προεπιλεγμένο **1s** είναι στενό όταν **19 σουίτες μοιράζονται 4 πυρήνες** — και
 * αυτό ακριβώς κοκκίνισε στο πλήρες τρέξιμο του §11.
 */
const SETTLE_TIMEOUT_MS = 8000;

// =============================================================================
// Α — Η ΕΞΑΝΤΛΗΤΙΚΟΤΗΤΑ: ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΓΡΑΦΕΙ ΤΗ ΛΙΣΤΑ
// =============================================================================

describe('Α — κάθε έκβαση έχει πάνελ, και κανείς δεν τη θυμήθηκε', () => {
  it('🔴 Α1 — ΚΑΘΕ λόγος άρνησης του κλειστού συνόλου έχει το ΔΙΚΟ του σενάριο', () => {
    // 🔴 **Ο αναμενόμενος αριθμός ΠΑΡΑΓΕΤΑΙ, δεν γράφεται.** Ένα `toHaveLength(7)` θα
    //    ήταν σταθερά που η όγδοη άρνηση θα έκανε **ψεύτικη** — και θα κοκκίνιζε
    //    ζητώντας να **ανέβει ο αριθμός**, δηλαδή θα δίδασκε ακριβώς το λάθος πράγμα.
    const linkIds = PROOF_SCENARIOS.map(idOf).filter((id) => id.startsWith('link-'));

    expect(linkIds).toHaveLength(FIRST_CONTACT_INVITATION_REFUSALS.length);

    for (const reason of FIRST_CONTACT_INVITATION_REFUSALS) {
      expect(linkIds).toContain(`link-${reason}`);
    }
  });

  it('🔴 Α2 — και οι ΤΕΣΣΕΡΙΣ εκβάσεις που ΔΕΝ είναι άρνηση συνδέσμου', () => {
    // ⚠️ Το `pristine` είναι το σκέλος που **γέννησε** το §11: ο άνθρωπος του οποίου το
    //    email δεν ήρθε ποτέ δεν παίρνει **καμία** άρνηση — και μέχρι πρότινος **καμία
    //    πράξη**. Αν λείψει από τη γκαλερί, λείπει ακριβώς η οθόνη που θεραπεύτηκε.
    const ids = PROOF_SCENARIOS.map(idOf);

    expect(ids).toEqual(
      expect.arrayContaining(['pristine', 'identity-refused', 'unavailable', 'failed']),
    );
  });

  it('🔑 Α3 — καμία ταυτότητα δεν εμφανίζεται δύο φορές (ο μεταφορέας δρομολογεί σε αυτήν)', () => {
    const ids = PROOF_SCENARIOS.map(idOf);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

// =============================================================================
// Β — Η ΟΘΟΝΗ: ΚΑΘΕ ΠΑΝΕΛ ΔΕΙΧΝΕΙ ΤΟ ΔΙΚΟ ΤΟΥ ΚΕΙΜΕΝΟ
// =============================================================================

describe('Β — η γκαλερί δεν δείχνει έντεκα φορές την ίδια οθόνη', () => {
  it('🔴 Β1 — ΚΑΘΕ άρνηση συνδέσμου βγάζει ΤΟ ΔΙΚΟ ΤΗΣ κλειδί, στο ΔΙΚΟ ΤΗΣ πάνελ', async () => {
    render(<FirstContactProofHarness />);

    // 🔴 **ΑΝΑΜΟΝΗ ΣΕ ΔΗΛΩΜΕΝΟ ΣΗΜΑ ΤΗΣ ΟΘΟΝΗΣ, ΟΧΙ ΣΕ ΑΡΙΘΜΟ ΚΥΚΛΩΝ.** Το μάθημα
    //    είναι μετρημένο (ADR-844 §11): `for (i<4) await act(…)` πέρασε μόνο του και
    //    κοκκίνισε στο πλήρες τρέξιμο, όπου 19 σουίτες μοιράζονται 4 πυρήνες.
    for (const reason of FIRST_CONTACT_INVITATION_REFUSALS) {
      const panel = screen.getByTestId(`proof-panel-link-${reason}`);

      await waitFor(
        () => {
          expect(within(panel).getByRole('alert')).toHaveTextContent(
            INVITATION_REFUSAL_KEYS[reason],
          );
        },
        { timeout: SETTLE_TIMEOUT_MS },
      );
    }
  });

  it('🔴 Β2 — οι ΔΥΟ εκβάσεις που ΜΕΝΟΥΝ στην οθόνη λένε η καθεμία το δικό της', async () => {
    render(<FirstContactProofHarness />);

    const expected = [
      ['identity-refused', GUEST_KEYS.identityRefused],
      ['unavailable', GUEST_KEYS.writeFailed],
    ] as const;

    for (const [id, key] of expected) {
      const panel = screen.getByTestId(`proof-panel-${id}`);

      await waitFor(
        () => {
          expect(within(panel).getByRole('alert')).toHaveTextContent(key);
        },
        { timeout: SETTLE_TIMEOUT_MS },
      );
    }
  });

  it('🔴 Β2β — το `failed` ΦΕΥΓΕΙ από την οθόνη, και το πάνελ το ΛΕΕΙ', async () => {
    // 🔴 **ΤΟ ΕΥΡΗΜΑ ΤΗΣ ΠΡΩΤΗΣ ΕΚΤΕΛΕΣΗΣ ΤΗΣ ΓΚΑΛΕΡΙ.** Το `settle()` επιστρέφει
    //    **πράξη** για το `failed` *(όπως και για `refused`/`invalid`)* ⇒ ανεβαίνει
    //    στον γονιό, που το ζωγραφίζει με τον `FirstContactOutcomeNotice`. Το πάνελ
    //    ήταν **οπτικά ταυτόσημο με το `pristine`** — δύο ονόματα, μία εικόνα, δηλαδή
    //    γκαλερί που **λέει ψέματα**.
    //
    // ⚠️ **ΑΥΤΟ ΤΟ ΣΚΕΛΟΣ ΕΙΝΑΙ ΔΙΠΛΟΣ ΦΡΟΥΡΟΣ**: κοκκινίζει και αν κάποιος αλλάξει το
    //    `settle` ώστε να **κρατά** το `failed` εδώ *(τότε θα εμφανιστεί ειδοποίηση
    //    αντί για παράδοση)*, και αν κάποιος σβήσει την ένδειξη παράδοσης.
    render(<FirstContactProofHarness />);

    const panel = screen.getByTestId('proof-panel-failed');

    await waitFor(
      () => {
        expect(screen.getByTestId('proof-handoff-failed')).toHaveTextContent('failed');
      },
      { timeout: SETTLE_TIMEOUT_MS },
    );

    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('🔴 Β3 — το `pristine` πάνελ ΔΕΝ έχει άρνηση, ΚΑΙ ΟΜΩΣ προσφέρει διέξοδο', () => {
    // 🔴 **Η ΚΑΡΔΙΑ ΤΟΥ §11.** Ο άνθρωπος που δεν έλαβε ποτέ email δεν παίρνει κανένα
    //    μήνυμα σφάλματος — η οθόνη δεν του είπε **τίποτα λάθος**, απλώς δεν του έδινε
    //    **τίποτα να κάνει**. Το «ξαναστείλτε» είναι **μόνιμο**, όχι αποτέλεσμα άρνησης
    //    (πρότυπο Slack/Stripe/Airbnb). Αν κάποιος το κρύψει πίσω από σφάλμα, εδώ.
    render(<FirstContactProofHarness />);

    const panel = screen.getByTestId('proof-panel-pristine');

    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(panel).getByText(GUEST_KEYS.resendHint, { exact: false })).toBeInTheDocument();
  });
});
