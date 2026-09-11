/**
 * 🔴 **ΤΟ ΑΔΙΕΞΟΔΟ ΤΗΣ ΑΡΝΗΣΗΣ** — κάθε οθόνη αποτυχίας **προσφέρει** την επόμενη κίνηση.
 * @related components/contact/GuestContactContent.tsx · FirstContactAwaitingProof.tsx · ADR-844
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΙΔΙΟ ΑΡΧΕΙΟ ΓΙΑ ΔΥΟ ΟΘΟΝΕΣ ΠΟΥ ΔΕΝ ΜΟΙΑΖΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Επειδή το ελάττωμα **δεν ήταν** δύο ελαττώματα — ήταν **ένα**, με δύο εμφανίσεις:
 *
 * | Οθόνη | Τι έλεγε | Τι έλειπε |
 * |---|---|---|
 * | `/contact/[token]` | *«Πατήστε ξανά «Πλησιάστε»»* | **ΤΟ ΔΕΔΟΜΕΝΟ** — η άρνηση δεν κουβαλούσε στόχο, άρα καμία διαδρομή πίσω |
 * | Διάλογος, `awaiting` | *«Κοιτάξτε το email σας»* | **Η ΠΡΑΞΗ** — κανένα κουμπί «ξαναστείλτε», ούτε καν όταν το email δεν έφτανε ποτέ |
 *
 * ⇒ *«Η οθόνη **περιγράφει** την επόμενη κίνηση αντί να την **προσφέρει**»* — πρότυπο
 * *dead-end recovery* (NN/g). Δύο αρχεία δοκιμών θα άφηναν τον επόμενο να διορθώσει
 * τη μία εμφάνιση και να αφήσει την άλλη· **εδώ κοκκινίζουν μαζί**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Σβήσε το `<SetbackExit …>` από το `GuestContactContent` → όλη η ομάδα **Α**.
 * 2. Γύρνα το `SetbackExit` να δίνει **πάντα** τη γενική διέξοδο → **Α2**.
 * 3. Δώσε στον `professional` μαντεμένο `/pro/${agencyCompanyId}` → **Α3**.
 * 4. Σβήσε το `<ResendRow …>` → όλη η ομάδα **Β**.
 * 5. Κάνε το `REFUSAL_ACTION['already-used']` `'reissue'` → **Β4**.
 * 6. Άφησε τον μετρητή αναμονής στο μηδέν από την αρχή → **Β1**.
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockUseAuthOptional = jest.fn();
const mockSubmitGuest = jest.fn();
const mockConfirmGuest = jest.fn();

jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => mockUseAuthOptional(),
}));

jest.mock('@/services/contact/first-contact.client', () => ({
  openFirstContactFromScreen: jest.fn(),
  submitGuestContact: (...args: unknown[]) => mockSubmitGuest(...args),
  confirmGuestContact: (...args: unknown[]) => mockConfirmGuest(...args),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// ⚠️ Ίδιος λόγος με το `first-contact-proven-channel.test.tsx`: το `citizen-session`
//    σέρνει `@/lib/firebase`, που τρέχει `initializeApp` **στο import**.
jest.mock('@/auth/citizen-session', () => ({
  adoptCitizenSession: jest.fn().mockResolvedValue({ kind: 'signed-in', uid: 'u' }),
}));

import { FirstContactDialog } from '../FirstContactDialog';
import { GuestContactContent } from '../GuestContactContent';
import type { GuestContactLinkView, GuestContactSetback } from '../guest-contact-view';
import { ACT_KEYS } from '../first-contact-labels';
import { GUEST_KEYS, LINK_KEYS } from '../first-contact-guest-labels';
import { FIRST_CONTACT_INVITATION_REFUSALS } from '@/types/first-contact-invitation';

const LISTING = { kind: 'listing', listingId: 'ownp_kalamaria' } as const;
const PROFESSIONAL = { kind: 'professional', agencyCompanyId: 'comp_0001' } as const;

// ===========================================================================
// Α — Η ΣΕΛΙΔΑ ΤΟΥ ΣΥΝΔΕΣΜΟΥ: ΚΑΜΙΑ ΑΡΝΗΣΗ ΧΩΡΙΣ ΔΡΟΜΟ
// ===========================================================================

/**
 * 🔴 **`Record` ΠΑΝΩ ΣΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ, ΟΧΙ ΧΕΙΡΟΓΡΑΦΟΣ ΠΙΝΑΚΑΣ.**
 *
 * Ένας πίνακας θα απαντούσε *«αυτές οι πέντε έχουν διέξοδο»* και θα σιωπούσε για την
 * **έκτη** — δηλαδή η άγκυρα θα έμενε **πράσινη** ακριβώς την ημέρα που γεννιόταν νέο
 * αδιέξοδο. Με `Record`, μια έκτη έκβαση **δεν μεταγλωττίζεται** μέχρι να μπει εδώ.
 */
const SETBACKS: Record<
  GuestContactSetback['kind'],
  (target: GuestContactSetback['target']) => GuestContactSetback
> = {
  'link-refused': (target) => ({ kind: 'link-refused', reason: 'expired', target }),
  'contact-refused': (target) => ({ kind: 'contact-refused', reason: 'capacity-full', target }),
  invalid: (target) => ({ kind: 'invalid', violations: ['contact-no-name'], target }),
  'identity-refused': (target) => ({ kind: 'identity-refused', target }),
  unavailable: (target) => ({ kind: 'unavailable', target }),
};

const SETBACK_KINDS = Object.keys(SETBACKS) as (keyof typeof SETBACKS)[];

function renderView(view: GuestContactLinkView): void {
  render(<GuestContactContent view={view} />);
}

function exitLink(): HTMLElement | null {
  return screen.queryByRole('link', {
    name: new RegExp(`${LINK_KEYS.backToListing}|${LINK_KEYS.backToSearch}`),
  });
}

describe('Α — η σελίδα του συνδέσμου δεν είναι ποτέ αδιέξοδο', () => {
  it('🔑 Α0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ΕΠΙΤΥΧΙΑ δεν δείχνει διέξοδο άρνησης', () => {
    renderView({ kind: 'done', created: true, customToken: 'ct' });

    // ⚠️ Η επιτυχία **έχει** τη δική της συνέχεια («δείτε τις επαφές σας»). Μια
    //    «επιστροφή στην αγγελία» εκεί θα έστελνε τον άνθρωπο **πίσω** από κάτι που
    //    μόλις πέτυχε — και η άγκυρα θα ήταν πράσινη χωρίς να μετρά τίποτα.
    expect(exitLink()).toBeNull();
  });

  it('🔐 Α0β — επιτυχία ΧΩΡΙΣ κλειδί (2FA): λέει ΓΙΑΤΙ και δίνει την κανονική σύνδεση — ποτέ «σας συνδέουμε…» για πάντα', () => {
    // ADR-844 §13: το custom token δεν περνά από MFA, άρα **αρνηθήκαμε επίτηδες** — δεν
    // είναι το `signInFailed` (αποτυχία). Χωρίς αρχική φάση, η οθόνη θα έμενε στο
    // «σας συνδέουμε…» για σύνδεση που **δεν θα γίνει ποτέ**.
    renderView({ kind: 'done', created: true, customToken: null });

    expect(screen.getByText(LINK_KEYS.secondFactor)).toBeInTheDocument();
    expect(screen.queryByText(LINK_KEYS.signingIn)).toBeNull();
    expect(screen.queryByText(LINK_KEYS.signInFailed)).toBeNull();
    expect(screen.getByRole('link', { name: LINK_KEYS.signIn })).toBeInTheDocument();
  });

  it.each(SETBACK_KINDS)(
    '🔴 Α1 — «%s»: ο άνθρωπος έχει ΠΑΝΤΑ κάπου να πατήσει',
    (kind) => {
      renderView(SETBACKS[kind](LISTING));

      const link = exitLink();
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute('href', `/listing/${LISTING.listingId}`);
    },
  );

  it('🔴 Α2 — η διέξοδος δείχνει στην ΑΓΓΕΛΙΑ ΤΟΥ, όχι σε γενική σελίδα', () => {
    renderView(SETBACKS['link-refused']({ kind: 'listing', listingId: 'ownp_allo' }));

    expect(exitLink()).toHaveAttribute('href', '/listing/ownp_allo');
    expect(screen.getByRole('link', { name: LINK_KEYS.backToListing })).toBeInTheDocument();
  });

  it('🔶 Α3 — ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ δεν έχει δημόσια διεύθυνση ⇒ ΓΕΝΙΚΗ διέξοδος, ΠΟΤΕ μαντεψιά', () => {
    renderView(SETBACKS.unavailable(PROFESSIONAL));

    // 🔴 Δηλωμένο κενό ADR-844 §7.1: η βιτρίνα ζει σε `alias`, όχι σε `companyId`.
    //    Ένα μαντεμένο `/pro/comp_0001` θα ήταν **404** — αδιέξοδο **με** κουμπί,
    //    δηλαδή χειρότερο από αδιέξοδο χωρίς.
    const link = exitLink();
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent(LINK_KEYS.backToSearch);
    expect(screen.queryByRole('link', { name: new RegExp(PROFESSIONAL.agencyCompanyId) })).toBeNull();
  });

  it('🔴 Α4 — ΑΓΝΩΣΤΟΣ στόχος (πλαστός σύνδεσμος): γενική διέξοδος, όχι λευκή σελίδα', () => {
    renderView({ kind: 'link-refused', reason: 'link-invalid', target: null });

    expect(exitLink()).toHaveAttribute('href', '/');
  });
});

// ===========================================================================
// Β — Ο ΔΙΑΛΟΓΟΣ: ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΔΕΝ ΠΕΡΙΜΕΝΕΙ ΣΦΑΛΜΑ
// ===========================================================================

const SENT_FIRST = { kind: 'sent', invitationId: 'fcin_1', maskedEmail: 'μ***α@gmail.com' };
const SENT_SECOND = { kind: 'sent', invitationId: 'fcin_2', maskedEmail: 'μ***α@gmail.com' };

function resendButton(): HTMLElement | null {
  return screen.queryByRole('button', {
    name: new RegExp(`${GUEST_KEYS.resend}|${GUEST_KEYS.resendWait}|${GUEST_KEYS.resending}`),
  });
}

/** **Η οθόνη ησύχασε** — η υποβολή τελείωσε και ο άνθρωπος μπορεί ξανά να ενεργήσει. */
async function settled(): Promise<void> {
  // 🔴 **ΠΕΡΙΜΕΝΕΙ ΓΕΓΟΝΟΣ, ΟΧΙ ΚΥΚΛΟΥΣ — ΚΑΙ ΤΟ ΜΑΘΗΜΑ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ.** Η πρώτη
  //    εκδοχή άδειαζε **σταθερό πλήθος** μικροεργασιών *(η υποβολή έχει `await
  //    confirmGuestContact(…)` **και** `await settle(…)`)*. Πέρασε μόνη της και
  //    **κοκκίνισε στο πλήρες τρέξιμο**, όπου 19 σουίτες μοιράζονται τους 4 πυρήνες:
  //    ένας σταθερός αριθμός κύκλων είναι **στοίχημα στον χρόνο**, όχι άγκυρα.
  //
  // 🔑 Το σήμα ησυχίας είναι **δηλωμένο στην οθόνη**: το κουμπί «φύγε» φοράει
  //    `disabled={busy}` — δηλαδή ξαναζωντανεύει **ακριβώς** όταν πέφτει το `busy`.
  await waitFor(() => {
    expect(
      screen.getByRole('button', {
        name: new RegExp(`${ACT_KEYS.cancel}|${ACT_KEYS.closeAfterDone}`),
      }),
    ).toBeEnabled();
  });
}

/** Φτάνει στην κατάσταση «κοιτάξτε το email σας», όπως ο ανώνυμος επισκέπτης. */
async function reachAwaiting(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  render(<FirstContactDialog target={LISTING} demandId={null} open onOpenChange={() => {}} />);

  await user.type(screen.getByLabelText(new RegExp(ACT_KEYS.nameLabel)), 'Μαρία Δ.');
  await user.type(screen.getByLabelText(new RegExp(ACT_KEYS.emailLabel)), 'maria@example.com');
  await user.click(screen.getByRole('button', { name: ACT_KEYS.submit }));
  // ⚠️ Το πεδίο κωδικού **είναι** η απόδειξη ότι η οθόνη άλλαξε — και ό,τι χρειάζεται
  //    ο επόμενος βοηθός.
  await screen.findByLabelText(new RegExp(GUEST_KEYS.codeLabel));
}

/** Γράφει κωδικό και υποβάλλει — η διαδρομή που γεννά τις αρνήσεις της απόδειξης. */
async function tryCode(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(new RegExp(GUEST_KEYS.codeLabel)), '123456');
  await user.click(screen.getByRole('button', { name: GUEST_KEYS.submit }));
  await settled();
}

describe('Β — ο διάλογος της απόδειξης δίνει πάντα πράξη', () => {
  beforeEach(() => {
    // 🔑 **Ψεύτικα χρονόμετρα ΚΑΙ ψεύτικο ρολόι**: ο μετρητής αναμονής μετρά από
    //    **προθεσμία** (`Date.now()`), όχι από τικ — μια δοκιμή που προωθούσε μόνο τα
    //    χρονόμετρα θα έμενε **για πάντα** στα 30″ και θα φαινόταν σπασμένη ενώ ο
    //    κώδικας είναι σωστός.
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    mockUseAuthOptional.mockReset().mockReturnValue({ user: null });
    mockSubmitGuest.mockReset().mockResolvedValue(SENT_FIRST);
    mockConfirmGuest.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setupUser(): ReturnType<typeof userEvent.setup> {
    return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  }

  it('🔴 Β1 — ΧΩΡΙΣ ΚΑΝΕΝΑ ΣΦΑΛΜΑ ο άνθρωπος έχει «ξαναστείλτε» — και μαθαίνει ΠΟΣΟ περιμένει', async () => {
    // 🔴 Το χειρότερο αδιέξοδο **δεν είχε μήνυμα**: το email χάθηκε στα ανεπιθύμητα,
    //    και η μόνη διέξοδος ήταν το «Άκυρο».
    await reachAwaiting(setupUser());

    const button = resendButton();
    expect(button).not.toBeNull();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(GUEST_KEYS.resendWait);
  });

  it('🔴 Β2 — μετά την αναμονή ΣΤΕΛΝΕΙ ΞΑΝΑ, με την ΙΔΙΑ δήλωση', async () => {
    const user = setupUser();
    await reachAwaiting(user);
    expect(mockSubmitGuest).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(resendButton()).toBeEnabled();

    mockSubmitGuest.mockResolvedValue(SENT_SECOND);
    await user.click(resendButton() as HTMLElement);
    await settled();

    expect(mockSubmitGuest).toHaveBeenCalledTimes(2);
    // 🔑 **ΤΟ ΙΔΙΟ ΣΩΜΑ, ΟΧΙ ΔΕΥΤΕΡΗ ΚΑΤΑΣΚΕΥΗ.** Αν η επαναποστολή έχτιζε δική της
    //    δήλωση, θα απέκλινε στην πρώτη προσθήκη πεδίου — **σιωπηλά**, γιατί το zod
    //    αφαιρεί ό,τι δεν δηλώθηκε.
    expect(mockSubmitGuest.mock.calls[1][0]).toEqual(mockSubmitGuest.mock.calls[0][0]);
  });

  it('🔴 Β3 — ληγμένη πρόσκληση: ΚΑΝΕΝΑ πεδίο κωδικού, αλλά ΥΠΑΡΧΕΙ διέξοδος', async () => {
    const user = setupUser();
    await reachAwaiting(user);
    mockConfirmGuest.mockResolvedValue({ kind: 'link-refused', reason: 'expired' });
    await tryCode(user);

    // Το πεδίο φεύγει — άλλη δοκιμή στον ίδιο κωδικό **δεν μπορεί** να πετύχει…
    expect(screen.queryByLabelText(new RegExp(GUEST_KEYS.codeLabel))).toBeNull();
    // …αλλά ο άνθρωπος **δεν** μένει με μόνο κουμπί το «κλείσιμο».
    expect(resendButton()).not.toBeNull();
  });

  it('🔑 Β4 — «ΕΓΙΝΕ ΗΔΗ»: ΚΑΜΙΑ πράξη, και είναι σωστό', async () => {
    const user = setupUser();
    await reachAwaiting(user);
    mockConfirmGuest.mockResolvedValue({ kind: 'link-refused', reason: 'already-used' });
    await tryCode(user);

    // 🔑 Η πράξη **έγινε**. Ένα «ξαναστείλτε» εδώ θα διέψευδε το ίδιο το κείμενο
    //    (*«δεν χρειάζεται τίποτα άλλο»*) και θα ξόδευε δεύτερη πρόσκληση για το τίποτα.
    expect(resendButton()).toBeNull();
    expect(screen.queryByLabelText(new RegExp(GUEST_KEYS.codeLabel))).toBeNull();
  });

  it('🔑 Β5 — ΛΑΘΟΣ κωδικός: ΚΑΙ ξαναγράφει ΚΑΙ μπορεί να ζητήσει νέον', async () => {
    const user = setupUser();
    await reachAwaiting(user);
    mockConfirmGuest.mockResolvedValue({ kind: 'link-refused', reason: 'code-wrong' });
    await tryCode(user);

    // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ του Β3: εδώ η πρόσκληση **ζει** — το πεδίο μένει.
    expect(screen.getByLabelText(new RegExp(GUEST_KEYS.codeLabel))).toBeInTheDocument();
    expect(resendButton()).not.toBeNull();
  });

  /**
   * 🔴 **Η ΙΔΙΟΤΗΤΑ, ΠΑΝΩ ΣΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ** — και είναι **ακριβώς** ο ορισμός του
   * αδιεξόδου: *«ο άνθρωπος έμεινε με μοναδικό κουμπί το «Άκυρο»»*.
   *
   * ⚠️ **ΤΙ ΔΕΝ ΠΙΑΝΕΙ, ρητά**: μια **λάθος κρίση** στον `REFUSAL_ACTION` *(νέος λόγος
   * που κατά λάθος δηλώθηκε `'none'`)* περνά, γιατί τότε η οθόνη λέει τίμια «κλείσιμο».
   * Εκείνο είναι σφάλμα **κρίσης**, όχι **δομής** — και το φυλά ο μεταγλωττιστής
   * απαιτώντας γραμμή, όχι αυτή η άγκυρα. Ό,τι φυλά **εδώ** είναι το άλλο: λόγος που
   * γεννήθηκε και **κανείς δεν του έδωσε πράξη**.
   */
  it.each(FIRST_CONTACT_INVITATION_REFUSALS)(
    '🔴 Β6 — «%s»: ο άνθρωπος ΠΟΤΕ δεν μένει με μόνο κουμπί το «Άκυρο»',
    async (reason) => {
      const user = setupUser();
      await reachAwaiting(user);
      mockConfirmGuest.mockResolvedValue({ kind: 'link-refused', reason });
      await tryCode(user);

      const closeAfterDone = screen.queryByRole('button', { name: ACT_KEYS.closeAfterDone });
      expect(resendButton() !== null || closeAfterDone !== null).toBe(true);
    },
  );
});
