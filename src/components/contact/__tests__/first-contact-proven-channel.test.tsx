/**
 * 🔴 **Ο ΕΝΑΣ ΦΡΟΥΡΟΣ: «ΕΙΝΑΙ ΤΟ ΚΑΝΑΛΙ ΗΔΗ ΑΠΟΔΕΔΕΙΓΜΕΝΟ;»** (ADR-844 Β5, απόφαση #3)
 * @related components/contact/FirstContactDialog.tsx · services/contact/first-contact.client.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΜΙΑ ΔΙΑΚΛΑΔΩΣΗ, ΔΥΟ ΤΡΟΠΟΙ ΝΑ ΣΠΑΣΕΙ, ΚΑΙ ΟΙ ΔΥΟ ΣΙΩΠΗΛΟΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Αν ο φρουρός λέει… | Ενώ έπρεπε… | Τι παθαίνει ο άνθρωπος |
 * |---|---|---|
 * | **ΝΑΙ** (πάει κατευθείαν) | ΟΧΙ | ο ιδιοκτήτης παίρνει **ανεπαλήθευτο** κανάλι — ακριβώς η ανισότητα που γέννησε το ADR |
 * | **ΟΧΙ** (στέλνει πρόσκληση) | ΝΑΙ | ο Γιάννης, **συνδεδεμένος και επιβεβαιωμένος**, ξαφνικά περιμένει email για κάτι που έκανε πάντα με ένα κλικ |
 *
 * 🔑 **Καμία πύλη δεν βλέπει αυτή τη διακλάδωση**: δεν είναι τύπος *(και τα δύο σκέλη
 * μεταγλωττίζονται)*, δεν είναι i18n, δεν είναι μέγεθος. Ζει **μόνο** εδώ.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Σβήσε το `!user.emailVerified` → η ομάδα Β κοκκινίζει.
 * 2. Άλλαξε το `sameChannelEmail(...)` σε `true` → η Γ κοκκινίζει.
 * 3. Κάνε τον φρουρό να επιστρέφει πάντα `false` → η Α κοκκινίζει.
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
//    *«ποιον δρόμο διαλέγει ο φρουρός;»*, όχι *«σηκώνεται το Firebase;»*.
jest.mock('@/auth/citizen-session', () => ({
  adoptCitizenSession: jest.fn().mockResolvedValue({ kind: 'signed-in', uid: 'u' }),
}));

import { FirstContactDialog } from '../FirstContactDialog';
import { ACT_KEYS } from '../first-contact-labels';
import { GUEST_KEYS } from '../first-contact-guest-labels';

const TARGET = { kind: 'listing', listingId: 'ownp_0001' } as const;

/** Ο **Γιάννης**: συνδεδεμένος, επιβεβαιωμένος, γράφει το δικό του email. */
const PROVEN = {
  user: {
    uid: 'user-giannis',
    displayName: 'Γιάννης',
    email: 'giannis@example.gr',
    emailVerified: true,
  },
};

function renderDialog(): void {
  render(
    <FirstContactDialog target={TARGET} demandId={null} open onOpenChange={() => {}} />,
  );
}

/**
 * Γράφει το email που θα κρίνει ο φρουρός, και πατά «στείλε».
 *
 * ⚠️ **Το ΟΝΟΜΑ συμπληρώνεται πάντα, και δεν είναι θόρυβος**: ο ανώνυμος δεν έχει
 * προσυμπλήρωση, και το `contact-name-unset` θα σταματούσε την υποβολή **πριν** φτάσει
 * ποτέ στον φρουρό — δηλαδή η άγκυρα θα ήταν πράσινη για **λάθος λόγο**.
 */
async function submitWith(email: string): Promise<void> {
  const user = userEvent.setup();

  const name = screen.getByLabelText(new RegExp(ACT_KEYS.nameLabel));
  await user.clear(name);
  await user.type(name, 'Μαρία Δ.');

  const field = screen.getByLabelText(new RegExp(ACT_KEYS.emailLabel));
  await user.clear(field);
  if (email !== '') await user.type(field, email);

  await user.click(screen.getByRole('button', { name: ACT_KEYS.submit }));
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

describe('Α — ο Γιάννης δεν βλέπει καμία αλλαγή', () => {
  it('🔑 Α1 — συνδεδεμένος + επιβεβαιωμένος + ίδιο email ⇒ Η ΠΡΑΞΗ, χωρίς πρόσκληση', async () => {
    // ⚠️ **Ο παρονομαστής όλου του αρχείου.** Χωρίς αυτόν, ένας φρουρός που επιστρέφει
    //    πάντα `false` θα περνούσε κάθε άλλο σκέλος — και **κάθε** συνδεδεμένος χρήστης
    //    θα περίμενε email για κάτι που έκανε πάντα με ένα κλικ.
    mockUseAuthOptional.mockReturnValue(PROVEN);
    renderDialog();

    await submitWith('giannis@example.gr');

    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(mockSubmitGuest).not.toHaveBeenCalled();
  });

  it('🔑 Α2 — και η ΜΟΡΦΗ δεν μετράει: κεφαλαία/κενά είναι η ΙΔΙΑ διεύθυνση', async () => {
    // ⚠️ Μια ωμή `===` εδώ θα έστελνε περιττή πρόσκληση σε άνθρωπο που απλώς έγραψε
    //    κεφαλαίο πρώτο γράμμα — δες `lib/contact/channel-email.ts`.
    mockUseAuthOptional.mockReturnValue(PROVEN);
    renderDialog();

    await submitWith('  Giannis@Example.GR  ');

    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(mockSubmitGuest).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Β — Ο ΤΡΙΤΟΣ ΟΡΟΣ: Η ΣΥΝΔΕΣΗ ΔΕΝ ΕΙΝΑΙ ΑΠΟΔΕΙΞΗ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟΥ
// ===========================================================================

describe('Β — ο ΑΝΕΠΙΒΕΒΑΙΩΤΟΣ λογαριασμός ΔΕΝ είναι αποδεδειγμένο κανάλι', () => {
  it('🔴 Β1 — ίδιο email αλλά `emailVerified: false` ⇒ ΠΡΟΣΚΛΗΣΗ', async () => {
    // 🔴 **Ο όρος που ο επόμενος θα θελήσει να σβήσει** *(«μα είναι συνδεδεμένος!»)*.
    //    Η σύνδεση αποδεικνύει ότι κάποιος ξέρει τον **κωδικό**, όχι ότι διαβάζει το
    //    **γραμματοκιβώτιο** — και το μήνυμα πάει στο γραμματοκιβώτιο.
    mockUseAuthOptional.mockReturnValue({
      user: { ...PROVEN.user, emailVerified: false },
    });
    renderDialog();

    await submitWith('giannis@example.gr');

    await waitFor(() => expect(mockSubmitGuest).toHaveBeenCalledTimes(1));
    expect(mockOpen).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Γ — ΑΛΛΗ ΔΙΕΥΘΥΝΣΗ = ΑΝΕΠΑΛΗΘΕΥΤΟ ΚΑΝΑΛΙ, ΚΑΙ ΑΣ ΕΙΝΑΙ ΣΥΝΔΕΔΕΜΕΝΟΣ
// ===========================================================================

describe('Γ — ο συνδεδεμένος που γράφει ΞΕΝΗ διεύθυνση', () => {
  it('🔴 Γ1 — άλλο email ⇒ ΠΡΟΣΚΛΗΣΗ, και η οθόνη λέει «κοιτάξτε το email σας»', async () => {
    // 🔴 **Η μισή ανισότητα του ADR-844.** Το `first-contact-body.ts` δέχεται
    //    `email: z.string().max(320).nullable()` — **δεν ελέγχεται καν ως email** — και
    //    **καμία** σύγκριση με τον λογαριασμό δεν υπήρχε πουθενά στο `src/`.
    mockUseAuthOptional.mockReturnValue(PROVEN);
    renderDialog();

    await submitWith('kapoios.allos@example.gr');

    await waitFor(() => expect(mockSubmitGuest).toHaveBeenCalledTimes(1));
    expect(mockOpen).not.toHaveBeenCalled();
    // Η οθόνη **αλλάζει**: ο άνθρωπος δεν πρέπει να φύγει νομίζοντας ότι τελείωσε.
    expect(await screen.findByText(GUEST_KEYS.title)).toBeInTheDocument();
  });

  it('🔴 Γ2 — Ο ΑΝΩΝΥΜΟΣ: καμία ταυτότητα ⇒ ΠΡΟΣΚΛΗΣΗ (ήταν 401 → «κάτι πήγε στραβά»)', async () => {
    mockUseAuthOptional.mockReturnValue(null);
    renderDialog();

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
    // ⚠️ Το `contact-email-unset` προλαβαίνει **και τους δύο** δρόμους. Χωρίς αυτό, η
    //    πόρτα θα απαντούσε `EMAIL_REQUIRED` μετά από γύρο δικτύου, μακριά από το πεδίο.
    mockUseAuthOptional.mockReturnValue(null);
    renderDialog();

    await submitWith('');

    expect(mockSubmitGuest).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
