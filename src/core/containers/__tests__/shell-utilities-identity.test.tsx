/**
 * ADR-809 — **Η ΓΩΝΙΑ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ**: λογαριασμός **Ή** πόρτα, ποτέ και τα δύο.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΜΙΑ ΜΑΤΙΑ ΣΤΗΝ ΟΘΟΝΗ.** Το ελάττωμα
 * που έκλεισε το ADR-809 ήταν ότι ο `PublicSiteHeader` ζωγράφιζε «Σύνδεση»
 * **άνευ όρων**, άρα και σε **ΣΥΝΔΕΔΕΜΕΝΟ** άνθρωπο. Ένα στιγμιότυπο αποδεικνύει
 * **μία** στιγμή· η άγκυρα αποδεικνύει τον **μηχανισμό**, και τον κρατά κλειστό.
 *
 * 🔴 **ΚΑΙ ΤΟ ΙΔΙΟ ΕΛΑΤΤΩΜΑ ΓΡΑΦΤΗΚΕ ΞΑΝΑ ΜΕΣΑ ΣΤΗ ΘΕΡΑΠΕΙΑ**: η πρώτη γραφή του
 * `ShellUtilities` απέδιδε το `signedOutAction` **δίπλα** στο `UserMenu`, άνευ
 * όρων ⇒ ο συνδεδεμένος θα έβλεπε μενού **ΚΑΙ** «Σύνδεση». Το `Κ2` είναι εκεί
 * ακριβώς γι' αυτό, και ήταν **κόκκινο** πριν μπει το `signedOut` prop.
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ `Κ1`**: χωρίς αυτό, ένα «δεν βρήκα Σύνδεση όταν
 * είσαι συνδεδεμένος» θα μπορούσε να σημαίνει «η πόρτα δεν αποδίδεται ΠΟΤΕ».
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { ShellUtilities } from '@/core/containers/ShellUtilities';

// ---------------------------------------------------------------------------
// Η ΜΟΝΗ είσοδος που μεταλλάσσεται: υπάρχει άνθρωπος;
// ---------------------------------------------------------------------------

let currentUser: { uid: string; email: string; displayName: string | null; photoURL: string | null } | null = null;

jest.mock('@/auth', () => ({
  useAuth: () => ({ user: currentUser, signOut: jest.fn() }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

/** Το i18n επιστρέφει **το κλειδί** — οι άγκυρες κλειδώνουν *ποια πρόταση
 *  ειπώθηκε*, όχι *πώς μεταφράστηκε σήμερα*. */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el', changeLanguage: jest.fn() } }),
}));
jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el', changeLanguage: jest.fn() } }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el', changeLanguage: jest.fn() } }),
}));
jest.mock('@/i18n/hooks/useLanguagePreference', () => ({
  useLanguagePreference: () => ({ changeLanguage: jest.fn(), isChanging: false }),
}));
/**
 * 🔴 **Ο ΚΛΑΔΟΣ ΠΟΥ ΣΠΑΕΙ, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΙΝΑΙ ΜΕΤΑΒΛΗΤΟΣ.** Το `<Tooltip>` του
 * `DeclaredOccupationBadge` ζει **μόνο** στον κλάδο «δηλωμένο επάγγελμα». Οι
 * άγκυρες `Κ1-Κ7` έτρεχαν με **αδήλωτο**, άρα κάλυπταν την περίπτωση που **δεν**
 * σπάει — και η ζωντανή βλάβη της 26/08 πέρασε από κάτω τους. Προεπιλογή
 * **αδήλωτο** ώστε καμία υπάρχουσα άγκυρα να μην αλλάξει νόημα.
 */
let declaredOccupation: {
  occupation: { profession: string; escoLabel: string | null; escoUri: string | null; iscoCode: string | null } | null;
  confidence: 'unknown' | 'declared' | 'verified';
  iscoCode: string | null;
} = { occupation: null, confidence: 'unknown', iscoCode: null };

jest.mock('@/hooks/useDeclaredOccupation', () => ({
  useDeclaredOccupation: () => declaredOccupation,
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: jest.fn() }),
}));

const SIGNED_OUT_DOOR = 'ΠΟΡΤΑ-ΣΥΝΔΕΣΗΣ';
const door = <a href="/login">{SIGNED_OUT_DOOR}</a>;

const ANONYMOUS = null;
const SIGNED_IN = {
  uid: 'usr_solo',
  email: 'ext.architect@solo.local',
  displayName: 'Αρχιτέκτονας',
  photoURL: null,
};

beforeEach(() => {
  currentUser = ANONYMOUS;
  declaredOccupation = { occupation: null, confidence: 'unknown', iscoCode: null };
});

describe('ADR-809 — η γωνία της ταυτότητας', () => {
  test('Κ1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ανώνυμος ΒΛΕΠΕΙ την πόρτα', () => {
    // Χωρίς αυτό, το Κ2 θα μπορούσε να είναι πράσινο επειδή η πόρτα δεν
    // αποδίδεται ΠΟΤΕ — δηλαδή «δεν κοίταξα», όχι «διορθώθηκε».
    currentUser = ANONYMOUS;
    render(<ShellUtilities signedOutAction={door} />);
    expect(screen.getByText(SIGNED_OUT_DOOR)).toBeInTheDocument();
  });

  test('Κ2 — Ο ΣΥΝΔΕΔΕΜΕΝΟΣ ΔΕΝ ΒΛΕΠΕΙ ΤΗΝ ΠΟΡΤΑ (το ελάττωμα του ADR-809)', () => {
    currentUser = SIGNED_IN;
    render(<ShellUtilities signedOutAction={door} />);
    expect(screen.queryByText(SIGNED_OUT_DOOR)).not.toBeInTheDocument();
  });

  test('Κ3 — και στη θέση της βλέπει ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ ΤΟΥ', () => {
    // «Δεν βλέπει την πόρτα» μόνο του θα ήταν ικανοποιημένο και από μια γωνία
    // που έμεινε **ΚΕΝΗ** — δηλαδή από αφαίρεση δυνατότητας, όχι θεραπεία.
    //
    // ⚠️ **Η άγκυρα κρίνει τη ΣΚΑΝΔΑΛΗ, όχι το περιεχόμενο του μενού.** Η πρώτη
    // γραφή ζητούσε το `displayName` και ήταν **κόκκινη**: το Radix αποδίδει το
    // περιεχόμενο του dropdown **μόνο ανοιχτό**, οπότε το test θα απαιτούσε
    // *άνοιγμα μενού* για να αποδείξει *παρουσία χειριστηρίου* — δύο διαφορετικά
    // πράγματα. Το ερώτημα του ADR-809 είναι «υπάρχει η πόρτα του λογαριασμού;».
    currentUser = SIGNED_IN;
    render(<ShellUtilities signedOutAction={door} />);
    expect(screen.getByText('userMenu.menuLabel')).toBeInTheDocument();
  });

  test('Κ3β — ο ΑΝΩΝΥΜΟΣ δεν παίρνει σκανδάλη λογαριασμού (ο άλλος κλάδος)', () => {
    currentUser = ANONYMOUS;
    render(<ShellUtilities signedOutAction={door} />);
    expect(screen.queryByText('userMenu.menuLabel')).not.toBeInTheDocument();
  });

  test('Κ4 — οι ΤΡΕΙΣ δυνατότητες, με ΣΤΑΘΕΡΗ ΣΕΙΡΑ (το μόνο που απαιτεί το WCAG)', () => {
    // 🔑 Το **SC 3.2.3** (AA) απαιτεί «the same relative order each time» — και
    // αυτό είναι **ΟΛΟ** όσο δίνει το πρότυπο (το SC 3.2.6 λέει ρητά ότι η
    // **απουσία** δεν είναι παραβίαση). Άρα η σειρά είναι το μόνο που αξίζει
    // κλείδωμα από το WCAG, και κλειδώνεται **εδώ, μία φορά, για κάθε κέλυφος**.
    //
    // ⚠️ Η πρώτη γραφή έλεγχε μόνο **παρουσία** ενώ ονόμαζε «σειρά» — φρουρός
    // που δεν κρίνει αυτό που δηλώνει (σχήμα CHECK 3.50).
    currentUser = SIGNED_IN;
    const { container } = render(<ShellUtilities />);

    const labels = [...container.querySelectorAll('button')]
      .map((b) => b.textContent ?? '')
      .join(' ');
    const at = (needle: string) => labels.indexOf(needle);

    expect(at('header.changeLanguage')).toBeGreaterThan(-1);
    expect(at('theme.toggle')).toBeGreaterThan(-1);
    expect(at('userMenu.menuLabel')).toBeGreaterThan(-1);
    // γλώσσα → θέμα → λογαριασμός
    expect(at('header.changeLanguage')).toBeLessThan(at('theme.toggle'));
    expect(at('theme.toggle')).toBeLessThan(at('userMenu.menuLabel'));
  });

  test('Κ5 — ΧΩΡΙΣ δηλωμένη πόρτα, ο ανώνυμος δεν παίρνει τίποτα στη θέση της', () => {
    // Το `(auth)` και το `(app)` καλούν έτσι: ένας σύνδεσμος «Σύνδεση» πάνω στην
    // ίδια την οθόνη σύνδεσης θα ήταν σύνδεσμος προς τον εαυτό της.
    currentUser = ANONYMOUS;
    render(<ShellUtilities />);
    expect(screen.queryByText(SIGNED_OUT_DOOR)).not.toBeInTheDocument();
  });
});

describe('ADR-813 — οι προϋποθέσεις ανήκουν στον ιδιοκτήτη', () => {
  test('Κ8 — με ΔΗΛΩΜΕΝΟ επάγγελμα και ΧΩΡΙΣ περιβάλλοντα TooltipProvider δεν σκάει', () => {
    // 🔴 Ζωντανή βλάβη 2026-08-26: «`Tooltip` must be used within
    //    `TooltipProvider`» ⇒ ολόκληρη η διαδρομή έπεφτε στο `global-error`.
    //    Οι `(light)` και `(me)` **δεν** έχουν provider στο layout τους, και
    //    ακριβώς εκεί έβαλε το ADR-809 τα utilities.
    currentUser = SIGNED_IN;
    declaredOccupation = {
      occupation: { profession: 'αρχιτέκτονας', escoLabel: 'αρχιτέκτονας', escoUri: null, iscoCode: '2161' },
      confidence: 'declared',
      iscoCode: '2161',
    };
    expect(() => render(<ShellUtilities />)).not.toThrow();
  });

  test('Κ8β — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο κλάδος όντως αποδίδει το επάγγελμα', () => {
    // Χωρίς αυτό, το Κ8 θα ήταν πράσινο και αν ο κλάδος δεν αποδιδόταν ΠΟΤΕ —
    // δηλαδή «δεν κοίταξα», όχι «δεν σκάει».
    currentUser = SIGNED_IN;
    declaredOccupation = {
      occupation: { profession: 'αρχιτέκτονας', escoLabel: 'αρχιτέκτονας', escoUri: null, iscoCode: '2161' },
      confidence: 'declared',
      iscoCode: '2161',
    };
    render(<ShellUtilities />);
    expect(screen.getAllByText('αρχιτέκτονας').length).toBeGreaterThan(0);
  });
});
