/**
 * 🔴 **Ο ΕΝΑΣ ΤΑΞΙΝΟΜΗΤΗΣ: «ΑΠΟ ΠΟΙΟ ΚΑΝΑΛΙ ΦΕΥΓΕΙ;»** (ADR-844 Β5 · §12, απόφαση #3)
 * @related components/contact/FirstContactDialog.tsx · lib/contact/first-contact-channel.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΜΙΑ ΔΙΑΚΛΑΔΩΣΗ ΚΑΙ ΕΝΑ ΚΕΙΜΕΝΟ, ΚΑΙ ΟΦΕΙΛΟΥΝ ΝΑ ΣΥΜΦΩΝΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Αν ο δρόμος λέει… | Ενώ έπρεπε… | Τι παθαίνει ο άνθρωπος |
 * |---|---|---|
 * | **ΑΜΕΣΑ** | πρόσκληση | ο ιδιοκτήτης παίρνει **ανεπαλήθευτο** κανάλι — η ανισότητα που γέννησε το ADR |
 * | **πρόσκληση** | αμέσως | ο Γιάννης, **συνδεδεμένος και επιβεβαιωμένος**, περιμένει email για κάτι που έκανε πάντα με ένα κλικ |
 * | *(κείμενο)* «σύνδεσμος» | αμέσως | ο Γιάννης περιμένει email που **δεν θα έρθει ποτέ** — το γεγονός της 2026-09-11 |
 *
 * 🔑 **Καμία πύλη δεν βλέπει αυτή τη διακλάδωση**: δεν είναι τύπος, δεν είναι i18n, δεν
 * είναι μέγεθος. Ζει **μόνο** εδώ — και η ομάδα Ε ρωτά **και τα δύο** μαζί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Κάνε τον ταξινομητή να επιστρέφει πάντα `'proven'` → Β, Γ, Ε κοκκινίζουν.
 * 2. Βγάλε το `readOnly={emailLocked}` από τη φόρμα → Ζ1 κοκκινίζει.
 * 3. Δώσε στη φόρμα σταθερό `CHANNEL_NOTICE_KEYS.guest` → Ε κοκκινίζει.
 * 4. Κάνε το `effective` να διαβάζει την προσυμπλήρωση αντί για τον λογαριασμό → Ζ2 κοκκινίζει.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockUseAuthOptional = jest.fn();
const mockOpen = jest.fn();
const mockSubmitGuest = jest.fn();

jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => mockUseAuthOptional(),
}));

jest.mock('@/services/contact/first-contact.client', () => ({
  openFirstContactFromScreen: (...args: unknown[]) => mockOpen(...args),
  submitGuestContact: (...args: unknown[]) => mockSubmitGuest(...args),
  confirmGuestContact: jest.fn(),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// ⚠️ **ΑΝΑΓΚΑΙΟ, ΟΧΙ ΕΥΚΟΛΙΑ**: ο διάλογος εισάγει στατικά τον `FirstContactAwaitingProof`,
//    που εισάγει το `@/auth/citizen-session` → `@/lib/firebase`. Εκείνο τρέχει
//    `initializeApp` **στο import** και στήνει IndexedDB/emulator probes. Η άγκυρα ρωτά
//    *«ποιον δρόμο διαλέγει ο ταξινομητής;»*, όχι *«σηκώνεται το Firebase;»*.
jest.mock('@/auth/citizen-session', () => ({
  adoptCitizenSession: jest.fn().mockResolvedValue({ kind: 'signed-in', uid: 'u' }),
}));

import { FirstContactDialog } from '../FirstContactDialog';
import { ACT_KEYS, CHANNEL_EMAIL_HINT_KEYS, CHANNEL_NOTICE_KEYS } from '../first-contact-labels';
import { GUEST_KEYS } from '../first-contact-guest-labels';
import type { FirstContactChannel } from '@/lib/contact/first-contact-channel';

const TARGET = { kind: 'listing', listingId: 'ownp_0001' } as const;

/** Ο **Γιάννης**: συνδεδεμένος, επιβεβαιωμένος. */
const PROVEN = {
  user: {
    uid: 'user-giannis',
    displayName: 'Γιάννης',
    email: 'giannis@example.gr',
    emailVerified: true,
  },
};

const UNVERIFIED = { user: { ...PROVEN.user, emailVerified: false } };

/** Λογαριασμός **χωρίς** email — η μόνη πόρτα του `foreign-address` από αυτή τη φόρμα. */
const NO_ACCOUNT_EMAIL = { user: { ...PROVEN.user, email: null } };

function dialog(): React.JSX.Element {
  return <FirstContactDialog target={TARGET} demandId={null} open onOpenChange={() => {}} />;
}

function emailField(): HTMLInputElement {
  return screen.getByLabelText(new RegExp(ACT_KEYS.emailLabel)) as HTMLInputElement;
}

/**
 * Γράφει όνομα (και email, **όπου επιτρέπεται**) και πατά «στείλε».
 *
 * ⚠️ **Το ΟΝΟΜΑ συμπληρώνεται πάντα, και δεν είναι θόρυβος**: ο ανώνυμος δεν έχει
 * προσυμπλήρωση, και το `contact-name-unset` θα σταματούσε την υποβολή **πριν** φτάσει
 * ποτέ στον ταξινομητή — δηλαδή η άγκυρα θα ήταν πράσινη για **λάθος λόγο**.
 *
 * ⚠️ Το δεμένο email **δεν αγγίζεται**: είναι `readOnly`, και ό,τι γράφεται στη Ζ1.
 */
async function submitWith(email: string | null): Promise<void> {
  const user = userEvent.setup();

  const name = screen.getByLabelText(new RegExp(ACT_KEYS.nameLabel));
  await user.clear(name);
  await user.type(name, 'Μαρία Δ.');

  const field = emailField();
  if (email !== null && !field.readOnly) {
    await user.clear(field);
    if (email !== '') await user.type(field, email);
  }

  await user.click(screen.getByRole('button', { name: ACT_KEYS.submit }));
}

/** Η **δήλωση** που έφυγε — από όποιον δρόμο κι αν έφυγε. */
function sentEmail(): unknown {
  const call = mockOpen.mock.calls[0] ?? mockSubmitGuest.mock.calls[0];
  return (call?.[0] as { disclosure: { email: unknown } } | undefined)?.disclosure.email;
}

beforeEach(() => {
  mockUseAuthOptional.mockReset();
  mockOpen.mockReset();
  mockSubmitGuest.mockReset();
  mockOpen.mockResolvedValue({ kind: 'opened', contact: {}, created: true });
  mockSubmitGuest.mockResolvedValue({
    kind: 'sent',
    invitationId: 'fcin_1',
    maskedEmail: 'μ***α@gmail.com',
  });
});

// ===========================================================================
// Α — ΤΟ ΑΠΟΔΕΔΕΙΓΜΕΝΟ ΚΑΝΑΛΙ ΠΕΡΝΑ ΚΑΤΕΥΘΕΙΑΝ (ο ΠΑΡΟΝΟΜΑΣΤΗΣ)
// ===========================================================================

describe('Α — ο Γιάννης δεν βλέπει καμία αλλαγή στη ΡΟΗ', () => {
  it('🔑 Α1 — συνδεδεμένος + επιβεβαιωμένος ⇒ Η ΠΡΑΞΗ, χωρίς πρόσκληση', async () => {
    // ⚠️ **Ο παρονομαστής όλου του αρχείου.** Χωρίς αυτόν, ένας ταξινομητής που δεν
    //    λέει ποτέ `proven` θα περνούσε κάθε άλλο σκέλος — και **κάθε** συνδεδεμένος
    //    χρήστης θα περίμενε email για κάτι που έκανε πάντα με ένα κλικ.
    mockUseAuthOptional.mockReturnValue(PROVEN);
    render(dialog());

    await submitWith(null);

    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(mockSubmitGuest).not.toHaveBeenCalled();
  });

  it('🔑 Α2 — και η δήλωση κουβαλά το email του ΛΟΓΑΡΙΑΣΜΟΥ', async () => {
    mockUseAuthOptional.mockReturnValue(PROVEN);
    render(dialog());

    await submitWith(null);

    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(sentEmail()).toBe('giannis@example.gr');
  });
});

// ===========================================================================
// Β — Η ΣΥΝΔΕΣΗ ΔΕΝ ΕΙΝΑΙ ΑΠΟΔΕΙΞΗ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟΥ
// ===========================================================================

describe('Β — ο ΑΝΕΠΙΒΕΒΑΙΩΤΟΣ λογαριασμός ΔΕΝ είναι αποδεδειγμένο κανάλι', () => {
  it('🔴 Β1 — `emailVerified: false` ⇒ ΠΡΟΣΚΛΗΣΗ, στο δικό του email', async () => {
    // 🔴 **Ο όρος που ο επόμενος θα θελήσει να σβήσει** *(«μα είναι συνδεδεμένος!»)*.
    //    Η σύνδεση αποδεικνύει ότι κάποιος ξέρει τον **κωδικό**, όχι ότι διαβάζει το
    //    **γραμματοκιβώτιο** — και το μήνυμα πάει στο γραμματοκιβώτιο.
    mockUseAuthOptional.mockReturnValue(UNVERIFIED);
    render(dialog());

    await submitWith(null);

    await waitFor(() => expect(mockSubmitGuest).toHaveBeenCalledTimes(1));
    expect(mockOpen).not.toHaveBeenCalled();
    expect(sentEmail()).toBe('giannis@example.gr');
  });
});

// ===========================================================================
// Γ — ΑΝΕΠΑΛΗΘΕΥΤΟ ΚΑΝΑΛΙ ⇒ ΠΡΟΣΚΛΗΣΗ
// ===========================================================================

describe('Γ — όποιος δεν έχει αποδεδειγμένο κανάλι παίρνει πρόσκληση', () => {
  it('🔴 Γ1 — λογαριασμός ΧΩΡΙΣ email που γράφει διεύθυνση ⇒ ΠΡΟΣΚΛΗΣΗ + «κοιτάξτε το email σας»', async () => {
    // 🔴 **Η μισή ανισότητα του ADR-844.** Το `first-contact-body.ts` δέχεται
    //    `email: z.string().max(320).nullable()` — **δεν ελέγχεται καν ως email**.
    mockUseAuthOptional.mockReturnValue(NO_ACCOUNT_EMAIL);
    render(dialog());

    await submitWith('kapoios.allos@example.gr');

    await waitFor(() => expect(mockSubmitGuest).toHaveBeenCalledTimes(1));
    expect(mockOpen).not.toHaveBeenCalled();
    // Η οθόνη **αλλάζει**: ο άνθρωπος δεν πρέπει να φύγει νομίζοντας ότι τελείωσε.
    expect(await screen.findByText(GUEST_KEYS.title)).toBeInTheDocument();
  });

  it('🔴 Γ2 — Ο ΑΝΩΝΥΜΟΣ: καμία ταυτότητα ⇒ ΠΡΟΣΚΛΗΣΗ (ήταν 401 → «κάτι πήγε στραβά»)', async () => {
    mockUseAuthOptional.mockReturnValue(null);
    render(dialog());

    await submitWith('maria@example.gr');

    await waitFor(() => expect(mockSubmitGuest).toHaveBeenCalledTimes(1));
    expect(mockOpen).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Δ — Η ΦΟΡΜΑ ΔΕΝ ΣΤΕΛΝΕΙ ΧΩΡΙΣ EMAIL, ΑΠΟ ΚΑΝΕΝΑΝ ΔΡΟΜΟ
// ===========================================================================

describe('Δ — κενό email δεν φεύγει καν από την οθόνη', () => {
  it('🔴 Δ1 — ο ανώνυμος με κενό email: ΚΑΜΙΑ κλήση, ούτε πρόσκληση ούτε πράξη', async () => {
    mockUseAuthOptional.mockReturnValue(null);
    render(dialog());

    await submitWith('');

    expect(mockSubmitGuest).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Ε — ΤΟ ΚΕΙΜΕΝΟ ΛΕΕΙ ΑΚΡΙΒΩΣ ΤΟΝ ΔΡΟΜΟ ΠΟΥ ΘΑ ΠΑΡΘΕΙ (ADR-844 §12)
// ===========================================================================

type Scenario = {
  readonly who: string;
  readonly auth: unknown;
  readonly email: string | null;
  readonly channel: FirstContactChannel;
  readonly path: 'open' | 'invite';
};

const SCENARIOS: readonly Scenario[] = [
  { who: 'Γιάννης (επιβεβαιωμένος)', auth: PROVEN, email: null, channel: 'proven', path: 'open' },
  { who: 'ανεπιβεβαίωτος', auth: UNVERIFIED, email: null, channel: 'unverified-account', path: 'invite' },
  { who: 'ανώνυμος', auth: null, email: 'maria@example.gr', channel: 'guest', path: 'invite' },
  { who: 'χωρίς email λογαριασμού', auth: NO_ACCOUNT_EMAIL, email: 'x@example.gr', channel: 'foreign-address', path: 'invite' },
];

describe('🔴 Ε — η σημείωση που ΦΑΙΝΕΤΑΙ και ο δρόμος που ΚΑΛΕΙΤΑΙ είναι το ίδιο κανάλι', () => {
  it('🔑 Ε0 — ο παρονομαστής: τα σενάρια καλύπτουν ΚΑΘΕ κανάλι', () => {
    // ⚠️ Χωρίς αυτό, ένα πέμπτο κανάλι θα έμενε **αδοκίμαστο** και η Ε θα ήταν πράσινη.
    expect(new Set(SCENARIOS.map((s) => s.channel)).size).toBe(
      Object.keys(CHANNEL_NOTICE_KEYS).length,
    );
  });

  it.each(SCENARIOS)('🔴 Ε1 — $who: σημείωση `$channel` ⇒ δρόμος `$path`', async (s) => {
    mockUseAuthOptional.mockReturnValue(s.auth);
    render(dialog());

    // Η οθόνη λέει **αυτό** το κανάλι — και **κανένα άλλο**.
    expect(screen.getByText(CHANNEL_NOTICE_KEYS[s.channel])).toBeInTheDocument();
    for (const [other, key] of Object.entries(CHANNEL_NOTICE_KEYS)) {
      if (other !== s.channel) expect(screen.queryByText(key)).not.toBeInTheDocument();
    }
    expect(screen.getByText(CHANNEL_EMAIL_HINT_KEYS[s.channel])).toBeInTheDocument();

    await submitWith(s.email);

    const [taken, skipped] = s.path === 'open' ? [mockOpen, mockSubmitGuest] : [mockSubmitGuest, mockOpen];
    await waitFor(() => expect(taken).toHaveBeenCalledTimes(1));
    expect(skipped).not.toHaveBeenCalled();
  });

  it.each(SCENARIOS)('🔑 Ε2 — $who: το κουμπί ΠΕΡΙΓΡΑΦΕΤΑΙ από τη σημείωση', (s) => {
    // 🔑 Ο αναγνώστης οθόνης ακούει τη συνέπεια **τη στιγμή της απόφασης**.
    mockUseAuthOptional.mockReturnValue(s.auth);
    render(dialog());

    expect(screen.getByRole('button', { name: ACT_KEYS.submit })).toHaveAccessibleDescription(
      CHANNEL_NOTICE_KEYS[s.channel],
    );
  });
});

// ===========================================================================
// Ζ — ΤΟ EMAIL ΤΟΥ ΣΥΝΔΕΔΕΜΕΝΟΥ ΕΙΝΑΙ ΔΕΜΕΝΟ (πρότυπο Airbnb/LinkedIn)
// ===========================================================================

describe('🔴 Ζ — ο συνδεδεμένος δεν μπορεί να στείλει ΞΕΝΗ διεύθυνση', () => {
  it('🔴 Ζ1 — το πεδίο είναι `readOnly` με το email του λογαριασμού — και η πληκτρολόγηση δεν το αλλάζει', async () => {
    // 🔴 Όσο ήταν ελεύθερο, μια αλλαγή του έγραφε την επαφή σε **άλλον** λογαριασμό και
    //    **άλλαζε τη συνεδρία** μετά την επιβεβαίωση — χωρίς λέξη στην οθόνη.
    mockUseAuthOptional.mockReturnValue(PROVEN);
    render(dialog());

    const field = emailField();
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveValue('giannis@example.gr');

    await userEvent.setup().type(field, 'kapoios.allos@example.gr');
    expect(field).toHaveValue('giannis@example.gr');
  });

  it('🔴 Ζ2 — Η ΚΟΥΡΣΑ: διάλογος που άνοιξε ΠΡΙΝ φτάσει η ταυτότητα δένεται μόλις φτάσει', async () => {
    // ⚠️ Η προσυμπλήρωση γράφει **μία** φορά, στο άνοιγμα. Αν ο λογαριασμός φτάσει μετά,
    //    μόνο η **παραγόμενη** τιμή τον βλέπει — χωρίς αυτήν, ο άνθρωπος θα έγραφε ό,τι
    //    ήθελε σε ελεύθερο πεδίο, ενώ είναι πλέον συνδεδεμένος.
    mockUseAuthOptional.mockReturnValue(null);
    const { rerender } = render(dialog());
    expect(emailField()).not.toHaveAttribute('readonly');

    mockUseAuthOptional.mockReturnValue(PROVEN);
    rerender(dialog());

    expect(emailField()).toHaveAttribute('readonly');
    expect(emailField()).toHaveValue('giannis@example.gr');
    expect(screen.getByText(CHANNEL_NOTICE_KEYS.proven)).toBeInTheDocument();

    await submitWith(null);
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(sentEmail()).toBe('giannis@example.gr');
  });

  it('🔑 Ζ3 — ο ανώνυμος γράφει ελεύθερα: το δέσιμο αφορά ΜΟΝΟ τον συνδεδεμένο', () => {
    mockUseAuthOptional.mockReturnValue(null);
    render(dialog());

    expect(emailField()).not.toHaveAttribute('readonly');
  });
});
