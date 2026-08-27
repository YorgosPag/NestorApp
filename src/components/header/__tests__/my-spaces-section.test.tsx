/**
 * ADR-820 §5.1 — **ΟΙ ΧΩΡΟΙ ΜΟΥ**: η πόρτα υπάρχει, δείχνει **σωστά**, και ο
 * εταιρικός προορισμός **δεν κατασκευάζεται ΠΟΤΕ από τον πελάτη**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΙ ΑΓΚΥΡΕΣ ΕΛΕΓΧΟΥΝ **ΠΡΟΟΡΙΣΜΟ**, ΟΧΙ ΥΠΑΡΞΗ ΣΥΜΒΟΛΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 * Μετρήθηκε **2026-08-26**: μετάλλαξη που άλλαξε τον **προορισμό** ενός συνδέσμου
 * **επιβίωσε**, επειδή η άγκυρα ρωτούσε αν το σύμβολο **εισάγεται** — και το import
 * έμενε. Ένας έλεγχος ονόματος είναι **σβησμένος μάρτυρας**.
 *
 * Γι' αυτό ο `Link` του συνόρου εδώ αποδίδεται ως **πραγματικό `<a href>`**: κάθε
 * άγκυρα διαβάζει τη **διεύθυνση που θα πατήσει ο άνθρωπος**. Ίδιο πρότυπο με το
 * `workspace-segment.test.ts`, που ελέγχει το **JSX** και όχι το `toContain(όνομα)`.
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ Α1**: χωρίς αυτό, ένα «δεν βρήκα εταιρική εγγραφή
 * στον πολίτη» θα μπορούσε να σημαίνει «το τμήμα δεν αποδίδεται **ΠΟΤΕ**».
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { MySpacesSection } from '@/components/header/MySpacesSection';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ---------------------------------------------------------------------------
// ΟΙ ΔΥΟ ΜΟΝΕΣ ΕΙΣΟΔΟΙ ΠΟΥ ΜΕΤΑΛΛΑΣΣΟΝΤΑΙ: «έχω γραφείο;» και «πού είμαι;»
// ---------------------------------------------------------------------------

let currentCompanyId: string | null | undefined;
let currentPathname: string;

jest.mock('@/auth', () => ({
  useAuth: () => ({ user: { uid: 'usr_test', companyId: currentCompanyId } }),
}));

/**
 * 🔑 **Ο `Link` γίνεται ΠΡΑΓΜΑΤΙΚΟ `<a href>`** — αλλιώς οι άγκυρες προορισμού δεν
 * έχουν τι να διαβάσουν, και θα ήταν ακριβώς ο «σβησμένος μάρτυρας» του docblock.
 *
 * ⚠️ Το `usePathname` εδώ επιστρέφει διαδρομή **ήδη χωρίς πρόθεμα** — έτσι ακριβώς
 * τη δίνει το σύνορο (`navigation.tsx`: `stripWorkspace`). Ένα mock που επέστρεφε
 * `/o/alpha/dashboard` θα δοκίμαζε **κόσμο που δεν υπάρχει**.
 */
jest.mock('@/lib/workspace/navigation', () => ({
  usePathname: () => currentPathname,
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Το i18n επιστρέφει **το κλειδί**: κλειδώνουμε *ποια πρόταση ειπώθηκε*. */
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({ sm: 'h-4 w-4' }) }));
jest.mock('@/hooks/useLayoutClasses', () => ({
  useLayoutClasses: () => ({ cursorPointer: '', buttonIconSpacing: '' }),
}));

const PERSONAL = 'common-account:userMenu.spaces.personal';
const ORGANIZATION = 'common-account:userMenu.spaces.organization';

/** Η διεύθυνση του ιδιωτικού χώρου (`PRIVATE_SPACE_HOME` → `MY_OFFERS_ROUTE`). */
const PERSONAL_HREF = '/offers';
/** Η **μόνη** νόμιμη εταιρική διεύθυνση από τον πελάτη (`HOME_REDIRECT_ROUTE`). */
const SERVER_ANSWERED_HREF = '/home';

const INSIDE_WORKSPACE = '/dashboard';
const OUTSIDE_WORKSPACE = '/offers';

beforeEach(() => {
  currentCompanyId = undefined;
  currentPathname = OUTSIDE_WORKSPACE;
});

function linkFor(label: string): HTMLAnchorElement {
  return screen.getByText(label).closest('a') as HTMLAnchorElement;
}

/**
 * Το τμήμα **μέσα στο πραγματικό μενού**, ανοιχτό.
 *
 * ⚠️ **Κανένα mock του Radix.** Το `DropdownMenuItem` απαιτεί το context του `Menu`,
 * και ένας διπλός του θα έκρυβε ακριβώς ό,τι θέλουμε να δοκιμάσουμε: ότι το
 * `asChild` παραδίδει τα props στο **δικό μας `<a>`**. Με mock, το `href` θα
 * περνούσε «σωστά» ακόμη κι αν το πραγματικό μενού το κατάπινε.
 *
 * ⚠️ `modal={false}`: το modal Radix κλειδώνει την εστίαση και τυλίγει το σώμα με
 * `aria-hidden`, που κάνει τις queries της testing-library να μη βλέπουν τίποτα.
 */
function renderInMenu(): void {
  render(
    <DropdownMenu open modal={false}>
      <DropdownMenuTrigger>μενού</DropdownMenuTrigger>
      <DropdownMenuContent>
        <MySpacesSection />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe('ADR-820 §5.1 — οι χώροι μου', () => {
  // -------------------------------------------------------------------------
  // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
  // -------------------------------------------------------------------------

  test('Α1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο πολίτης ΒΛΕΠΕΙ τον προσωπικό του χώρο', () => {
    // Χωρίς αυτό, κάθε «δεν βρήκα Χ» παρακάτω μπορεί να σημαίνει
    // «το τμήμα δεν αποδίδεται ποτέ» — «πράσινο επειδή κανείς δεν κοίταξε».
    currentCompanyId = undefined;
    renderInMenu();
    expect(screen.getByText(PERSONAL)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΙ — «ο άνθρωπος έχει ΠΑΝΤΑ προσωπικό και ΙΣΩΣ εταιρικό»
  // -------------------------------------------------------------------------

  test('Α2 — ο πολίτης ΔΕΝ βλέπει εταιρικό χώρο (δεν υπάρχει να τον δει)', () => {
    currentCompanyId = undefined;
    renderInMenu();
    expect(screen.queryByText(ORGANIZATION)).not.toBeInTheDocument();
  });

  test('Α3 — Ο ΑΥΤΟΝΟΜΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ είναι ΚΑΙ ΑΥΤΟΣ χωρίς γραφείο', () => {
    // 🔑 Το ζεύγος `ext.architect` / `int.architect` είναι ΟΛΟ το πείραμα:
    // **ίδιο επάγγελμα, άλλος χώρος**. Το επάγγελμα (ADR-798) ΔΕΝ δίνει χώρο —
    // «ΠΟΤΕ δεν δίνει δικαίωμα» (ADR-798 §4). Εδώ αποδεικνύεται ότι η πόρτα
    // ρωτά **χώρο**, όχι ιδιότητα.
    currentCompanyId = null;
    renderInMenu();
    expect(screen.getByText(PERSONAL)).toBeInTheDocument();
    expect(screen.queryByText(ORGANIZATION)).not.toBeInTheDocument();
  });

  test('Α4 — ΚΕΝΗ συμβολοσειρά ΔΕΝ είναι οργανισμός (fail-closed, όπως ο server)', () => {
    // Η ΜΟΝΗ περίπτωση όπου η απάντηση δεν είναι προφανής — και ακριβώς εκεί
    // αποκλίνει ένας χειρόγραφος έλεγχος `!= null`. Το `extractCustomClaims`
    // απορρίπτει το `companyId.length === 0`· η οθόνη οφείλει να συμφωνεί.
    currentCompanyId = '';
    renderInMenu();
    expect(screen.queryByText(ORGANIZATION)).not.toBeInTheDocument();
  });

  test('Α5 — ο υπάλληλος γραφείου βλέπει ΚΑΙ ΤΟΥΣ ΔΥΟ χώρους', () => {
    currentCompanyId = 'comp_alpha_emulator';
    renderInMenu();
    expect(screen.getByText(PERSONAL)).toBeInTheDocument();
    expect(screen.getByText(ORGANIZATION)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // ΟΙ ΠΡΟΟΡΙΣΜΟΙ — ΤΟ ΚΡΙΣΙΜΟ
  // -------------------------------------------------------------------------

  test('Α6 — ο εταιρικός χώρος ρωτά ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ, ποτέ κατασκευασμένο /o/<ψευδώνυμο>', () => {
    // 🔴 ΑΓΚΥΡΑ Λ2 (ADR-787): «ο πελάτης ΜΑΝΤΕΥΕ τον χώρο· ο διακομιστής τον
    //    ΕΠΑΛΗΘΕΥΕΙ. Claim που ανακλήθηκε δίνει σύνδεσμο προς γραφείο όπου δεν
    //    είσαι μέλος.» Αυτή η άγκυρα είναι ο φύλακας εκείνης της απαγόρευσης.
    currentCompanyId = 'comp_alpha_emulator';
    currentPathname = INSIDE_WORKSPACE;
    renderInMenu();

    const href = linkFor(ORGANIZATION).getAttribute('href');
    expect(href).toBe(SERVER_ANSWERED_HREF);
    expect(href).not.toContain('/o/');
    expect(href).not.toContain('comp_alpha_emulator');
  });

  test('Α7 — ο προσωπικός χώρος έχει ΣΤΑΘΕΡΗ διεύθυνση, ίδια για όλους', () => {
    currentCompanyId = 'comp_alpha_emulator';
    currentPathname = INSIDE_WORKSPACE;
    renderInMenu();
    expect(linkFor(PERSONAL)).toHaveAttribute('href', PERSONAL_HREF);
  });

  // -------------------------------------------------------------------------
  // ΠΟΙΟΣ ΕΙΝΑΙ Ο ΤΡΕΧΩΝ
  // -------------------------------------------------------------------------

  test('Α8 — ΜΕΣΑ σε χώρο, τρέχων είναι ο ΕΤΑΙΡΙΚΟΣ', () => {
    currentCompanyId = 'comp_alpha_emulator';
    currentPathname = INSIDE_WORKSPACE;
    renderInMenu();
    expect(linkFor(ORGANIZATION)).toHaveAttribute('aria-current', 'true');
    expect(linkFor(PERSONAL)).not.toHaveAttribute('aria-current');
  });

  test('Α9 — ΕΚΤΟΣ χώρου, τρέχων είναι ο ΠΡΟΣΩΠΙΚΟΣ', () => {
    currentCompanyId = 'comp_alpha_emulator';
    currentPathname = OUTSIDE_WORKSPACE;
    renderInMenu();
    expect(linkFor(PERSONAL)).toHaveAttribute('aria-current', 'true');
    expect(linkFor(ORGANIZATION)).not.toHaveAttribute('aria-current');
  });

  test('Α10 — ο ΤΡΕΧΩΝ παραμένει ΣΥΝΔΕΣΜΟΣ, ποτέ αδιέξοδο', () => {
    // Ένας ανενεργός τρέχων θα ήταν το «Επιστροφή στη σύνδεση» σε ήδη
    // συνδεδεμένο (ADR-819 §8) σε νέα θέση: το μόνο κουμπί που δεν πάει πουθενά.
    currentCompanyId = 'comp_alpha_emulator';
    currentPathname = INSIDE_WORKSPACE;
    renderInMenu();
    expect(linkFor(ORGANIZATION)).toHaveAttribute('href', SERVER_ANSWERED_HREF);
  });
});
