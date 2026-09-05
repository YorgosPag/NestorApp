/**
 * 🔴 **ΤΟ ΚΟΥΜΠΙ ΡΩΤΑΕΙ ΠΡΙΝ ΒΑΦΤΕΙ — ΚΑΙ ΡΩΤΑΕΙ ΜΟΝΟ ΟΤΑΝ ΥΠΑΡΧΕΙ ΚΑΠΟΙΟΣ ΝΑ ΡΩΤΗΣΕΙ.**
 * @related ADR-843 §10.18 · components/contact/FirstContactAction.tsx · FirstContactStandIn.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΔΥΟ ΥΠΟΣΧΕΣΕΙΣ ΠΟΥ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΒΛΕΠΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | # | Υπόσχεση | Τι σπάει αν χαθεί |
 * |---|---|---|
 * | 1 | **Ο ανώνυμος ΔΕΝ ρωτά ποτέ** | ένα **βέβαιο 401** ανά προβολή δημόσιας αγγελίας — δηλαδή αίτημα δικτύου για **κάθε** επισκέπτη, με μηδέν πληροφορία |
 * | 2 | **Άγνωστο ⇒ δείχνουμε το κουμπί** *(fail-open, N.12)* | μια πεσμένη ανάγνωση θα **έκρυβε την πράξη** από αθώο άνθρωπο — βλάβη μας που φοριέται ως απαγόρευση |
 *
 * 🔑 Και οι δύο είναι **συμπεριφορά**, όχι τύπος, όχι i18n, όχι μέγεθος: **καμία** από
 * τις πύλες δεν τις βλέπει. *«Ένα anchor χωρίς gate δεν είναι anchor»* — εδώ ισχύει το
 * αντίστροφο: χωρίς **αυτό** το αρχείο, οι δύο αποφάσεις ζουν μόνο σε σχόλιο (§10.14).
 *
 * ⚠️ **Ο κριτής ΔΕΝ δοκιμάζεται εδώ** — τον φυλά το `first-contact-admission.test.ts`.
 * Εδώ δοκιμάζεται **τι κάνει η οθόνη με την ετυμηγορία**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Σβήσε το `if (uid === null) { … return; }` → η ομάδα Α κοκκινίζει.
 * 2. Κάνε το `standIn` να πιάνει και το `unknown` → η ομάδα Β κοκκινίζει.
 * 3. Γύρνα το `standIn` σε `null` πάντα *(«απλώς κρύψε το κουμπί»)* → η Γ κοκκινίζει.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockUseAuthOptional = jest.fn();
const mockAsk = jest.fn();

jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => mockUseAuthOptional(),
}));

jest.mock('@/services/contact/first-contact.client', () => ({
  askContactAdmission: (...args: unknown[]) => mockAsk(...args),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Το σύνορο πλοήγησης διαβάζει `usePathname` — εδώ δεν υπάρχει router.
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { FirstContactAction } from '../FirstContactAction';
import { ACT_KEYS, REJECTION_KEYS } from '../first-contact-labels';

const TARGET = { kind: 'listing', listingId: 'ownp_0001' } as const;

const SIGNED_IN = { user: { uid: 'user-nikos', displayName: 'Νίκος', email: 'n@example.gr' } };

beforeEach(() => {
  mockUseAuthOptional.mockReset();
  mockAsk.mockReset();
  mockAsk.mockResolvedValue({ kind: 'open' });
});

// ===========================================================================
// Α — Ο ΑΝΩΝΥΜΟΣ ΔΕΝ ΡΩΤΑ ΠΟΤΕ
// ===========================================================================

describe('§10.18 Α — ο ανώνυμος δεν πληρώνει αίτημα', () => {
  it('χωρίς ταυτότητα: καμία ήσυχη ερώτηση, και το κουμπί είναι εκεί', async () => {
    mockUseAuthOptional.mockReturnValue(null);

    render(<FirstContactAction target={TARGET} />);

    expect(await screen.findByRole('button', { name: ACT_KEYS.cta })).toBeInTheDocument();
    // ⚠️ Το `waitFor` δεν περιμένει να **εμφανιστεί** κάτι — δίνει στο effect χρόνο να
    //    τρέξει, ώστε η απουσία κλήσης να είναι **μετρημένη**, όχι πρόωρη.
    await waitFor(() => expect(mockAsk).not.toHaveBeenCalled());
  });

  it('με ταυτότητα: ρωτά ΜΙΑ φορά, με τον στόχο', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);

    render(<FirstContactAction target={TARGET} />);

    await waitFor(() => expect(mockAsk).toHaveBeenCalledTimes(1));
    expect(mockAsk).toHaveBeenCalledWith(TARGET);
  });
});

// ===========================================================================
// Β — ΑΓΝΩΣΤΟ ⇒ ΤΟ ΚΟΥΜΠΙ (fail-open)
// ===========================================================================

describe('§10.18 Β — «δεν μάθαμε» ΔΕΝ είναι «δεν επιτρέπεσαι»', () => {
  it.each([['open'], ['unknown']])('ετυμηγορία «%s» ⇒ το κουμπί μένει', async (kind) => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({ kind });

    render(<FirstContactAction target={TARGET} />);

    await waitFor(() => expect(mockAsk).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: ACT_KEYS.cta })).toBeInTheDocument();
  });
});

// ===========================================================================
// Γ — Η ΑΝΤΙΚΑΤΑΣΤΑΣΗ (απόφαση Giorgio: ΟΧΙ σκέτη απόκρυψη)
// ===========================================================================

describe('§10.18 Γ — στη θέση του κουμπιού μπαίνει ΚΑΤΙ ΧΡΗΣΙΜΟ', () => {
  it('«είναι δικό σου» ⇒ η δήλωση ΚΑΙ ο δρόμος προς την επεξεργασία', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({
      kind: 'refused',
      reason: 'contact-own-target',
      manageHref: '/offers/ownp_0001',
    });

    render(<FirstContactAction target={TARGET} />);

    expect(await screen.findByText(ACT_KEYS.ownListingTitle)).toBeInTheDocument();
    expect(screen.getByText(ACT_KEYS.ownListingLead)).toBeInTheDocument();

    const manage = screen.getByRole('link', { name: ACT_KEYS.ownListingAction });
    expect(manage).toHaveAttribute('href', '/offers/ownp_0001');

    // 🔴 ΚΑΙ ΤΟ ΚΟΥΜΠΙ ΕΦΥΓΕ — αλλιώς ο ιδιοκτήτης εξακολουθεί να μπορεί να υποβάλει.
    expect(screen.queryByRole('button', { name: ACT_KEYS.cta })).not.toBeInTheDocument();
  });

  it('εταιρικός χώρος: η δήλωση μένει, ο σύνδεσμος λείπει ΔΗΛΩΜΕΝΑ', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({
      kind: 'refused',
      reason: 'contact-own-target',
      manageHref: null,
    });

    render(<FirstContactAction target={TARGET} />);

    expect(await screen.findByText(ACT_KEYS.ownListingTitle)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: ACT_KEYS.ownListingAction })).not.toBeInTheDocument();
  });

  it('η βιτρίνα μιλά για ΒΙΤΡΙΝΑ, όχι για αγγελία', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({
      kind: 'refused',
      reason: 'contact-own-target',
      manageHref: null,
    });

    render(
      <FirstContactAction
        target={{ kind: 'professional', agencyCompanyId: 'comp_0001' }}
        variant="professional"
      />,
    );

    expect(await screen.findByText(ACT_KEYS.ownProTitle)).toBeInTheDocument();
    expect(screen.queryByText(ACT_KEYS.ownListingTitle)).not.toBeInTheDocument();
  });

  it('«την έχεις ήδη ανοιχτή» είναι ΚΑΤΑΣΤΑΣΗ, με δρόμο προς τις επαφές του', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({ kind: 'already' });

    render(<FirstContactAction target={TARGET} />);

    expect(await screen.findByText(ACT_KEYS.alreadySentTitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ACT_KEYS.seeMine })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACT_KEYS.cta })).not.toBeInTheDocument();
  });

  it('κάθε ΑΛΛΗ άρνηση περνά από τον ΕΝΑ πίνακα αρνήσεων, χωρίς νέο λεξιλόγιο', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({ kind: 'refused', reason: 'target-not-live', manageHref: null });

    render(<FirstContactAction target={TARGET} />);

    expect(await screen.findByText(REJECTION_KEYS['target-not-live'])).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACT_KEYS.cta })).not.toBeInTheDocument();
  });
});
