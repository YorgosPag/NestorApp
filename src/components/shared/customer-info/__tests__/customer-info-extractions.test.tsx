/**
 * @jest-environment jsdom
 *
 * @fileoverview **ΟΙ ΤΡΕΙΣ ΕΞΑΓΩΓΕΣ ΤΟΥ `customer-info`** — ADR-841 Α21.1 (ο Πρόσκοπος).
 * @related components/shared/customer-info/components/{CustomerInfoCompact,UnifiedCustomerCard}
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΤΑ ΔΥΟ COMPONENTS ΕΙΧΑΝ **ΜΗΔΕΝ** ΚΑΛΥΨΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **CHECK 3.28** βρήκε **τρεις** κλώνους *(μετρημένα **προϋπάρχοντες**: βγαίνουν
 * και στα ανάλλαχτα αρχεία του `HEAD`)*. Η εξαγωγή τους είναι αλλαγή **απόδοσης**, και
 * πράσινα tests αλλού **δεν αποδεικνύουν** ότι μια οθόνη ζωγραφίζει το ίδιο.
 *
 * ⇒ Οι άγκυρες **δεν** περιγράφουν τα components· καρφώνουν **ακριβώς ό,τι μετακόμισε**.
 *
 * 🔑 **Ο κλώνος Γ ΔΕΝ ΗΤΑΝ ΑΙΣΘΗΤΙΚΟΣ**: η ενεργοποίηση με **πληκτρολόγιο** ζούσε σε
 * δύο αντίγραφα, ένα ανά παραλλαγή. Η ομάδα «Γ» παρακάτω το κάνει **εκτελέσιμο**: ρωτά
 * **και τις δύο** παραλλαγές με το **ίδιο** ερώτημα.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * 🔑 **Ο ΜΟΝΟΣ ΨΕΥΤΗΣ ΕΙΝΑΙ Η ΠΗΓΗ ΔΕΔΟΜΕΝΩΝ** — τα components αποδίδονται **αληθινά**.
 *
 * ⚠️ Το `jest.mock` ανυψώνεται πάνω από τα `import`, άρα το εργοστάσιο **δεν** μπορεί
 * να δει μεταβλητές αυτού του αρχείου· γι' αυτό τα δεδομένα ζουν **μέσα** του.
 *
 * ⚠️ Το `UnifiedCustomerCard` επιστρέφει **`null`** όταν δεν έχει `displayInfo`
 * *(`extendedInfo || customerInfo`)*, οπότε ένα κενό mock θα έδινε **άδεια οθόνη** και
 * οι άγκυρες της ομάδας Γ θα κοκκίνιζαν για **λάθος λόγο** — μετρημένο στην πρώτη
 * εκτέλεση αυτού του αρχείου.
 */
const mockCustomerInfo: { current: unknown } = {
  current: {
    contactId: 'c1',
    displayName: 'Παπαδόπουλος Νέστωρ',
    primaryPhone: '2101234567',
    primaryEmail: 'nestor@example.gr',
    status: 'active',
    avatarUrl: undefined,
  },
};

jest.mock('../hooks/useCustomerInfo', () => ({
  useCustomerInfo: jest.fn(() => ({
    customerInfo: mockCustomerInfo.current,
    extendedInfo: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

import { TooltipProvider } from '@/components/ui/tooltip';
import { CustomerInfoCompact } from '../components/CustomerInfoCompact';
import { UnifiedCustomerCard } from '../components/UnifiedCustomerCard';

/**
 * 🔴 **ΤΟ ΠΡΟΤΥΠΟ ΤΩΝ ΠΡΑΓΜΑΤΙΚΩΝ ΓΡΑΜΜΩΝ** — και η πρώτη εκτέλεση αυτού του αρχείου
 * απέδειξε ότι το σφάλμα/κενό είχαν **ΑΛΛΟ** (`2fr_1.2fr_1.5fr`). Δηλαδή σε πίνακα με
 * μία αποτυχημένη σειρά, **οι στήλες της μετατοπίζονταν** σε σχέση με τις γειτονικές.
 * Ενοποιήθηκε σε **μία** σταθερά· η άγκυρα το κρατά ενοποιημένο.
 */
const WITH_CUSTOMER = mockCustomerInfo.current;

/** 🔑 Καμία ομάδα δεν κληρονομεί την κατάσταση της προηγούμενης. */
afterEach(() => {
  mockCustomerInfo.current = WITH_CUSTOMER;
});

const GRID = 'grid-cols-[2fr_1fr_1.8fr_auto_auto]';

/**
 * ⚠️ **Τα components αποδίδονται ΑΛΗΘΙΝΑ, με τα κουμπιά τους** — γι' αυτό χρειάζονται
 * τον `TooltipProvider` του Radix *(«Tooltip must be used within TooltipProvider»)*.
 *
 * 🔑 Η εναλλακτική θα ήταν `showActions={false}`, δηλαδή να **αφαιρεθεί** μέρος της
 * οθόνης για να περάσει το test. Τότε όμως το πλέγμα των **πέντε** στηλών —που είναι
 * ακριβώς αυτό που φυλά η ομάδα Α— δεν θα δοκιμαζόταν ποτέ ολόκληρο.
 */
const inProvider = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

// =============================================================================
// Α — ΟΙ ΔΥΟ ΣΚΕΛΕΤΟΙ ΚΑΤΑΣΤΑΣΗΣ (12 γραμμές / 51 tokens)
// =============================================================================

describe('Α — σφάλμα και «κανένας πελάτης» μοιράζονται ΕΝΑ πλέγμα', () => {
  // ⚠️ `contactId=''` ⇒ ο hook δεν καλείται και το `displayInfo` μένει κενό, που
  //    είναι ακριβώς η κατάσταση «κανένας πελάτης» που θέλει να δει η ομάδα Α.
  const renderRow = (props: Record<string, unknown>) =>
    inProvider(
      <CustomerInfoCompact contactId="" context="project" variant="table" {...props} />,
    );

  it('🔴 ΟΛΕΣ οι καταστάσεις της γραμμής έχουν ΤΟ ΙΔΙΟ πρότυπο στηλών', () => {
    // Αυτό είναι ΟΛΟΣ ο λόγος της εξαγωγής — και **δεν ήταν αληθές πριν από αυτήν**:
    // σφάλμα και «κανένας πελάτης» είχαν `2fr_1.2fr_1.5fr`, ενώ δεδομένα και φόρτωση
    // `2fr_1fr_1.8fr`. Σε πίνακα, μια αποτυχημένη σειρά ΜΕΤΑΤΟΠΙΖΕ τις στήλες της.
    const { container: err } = renderRow({ error: 'boom' });

    // 🔴 ΧΩΡΙΣ ΑΥΤΟ Η ΑΓΚΥΡΑ ΕΙΝΑΙ ΨΕΥΤΙΚΗ: με δεδομένα στον hook, το «κενό» θα
    //    ζωγράφιζε τη γραμμή ΔΕΔΟΜΕΝΩΝ και ο κλάδος «κανένας πελάτης» δεν θα
    //    εκτελούνταν ΠΟΤΕ — κάλυψη σε νεκρό δίδυμο δεν είναι κάλυψη.
    mockCustomerInfo.current = null;
    const { container: empty } = renderRow({});
    // ⚠️ Ελέγχεται το **κλειδί**, όχι το κείμενο: σε jsdom το i18n δεν φορτώνει
    //    πακέτα (`addResourceBundle is not a function`) και ο `t` επιστρέφει το
    //    κλειδί. Αυτό αρκεί — η ερώτηση εδώ είναι «ΠΟΙΟΣ ΚΛΑΔΟΣ έτρεξε;», όχι «τι
    //    γράφει». Το κείμενο το φυλά αλλού το CHECK 3.8.
    expect(empty.textContent).toContain('noCustomer');
    expect(empty.textContent).not.toContain('Παπαδόπουλος Νέστωρ');
    mockCustomerInfo.current = WITH_CUSTOMER;

    const { container: data } = renderRow({
      customerData: { displayName: 'Παπαδόπουλος', phone: '210', email: 'a@b.gr' },
    });
    const { container: busy } = renderRow({ loading: true });

    for (const c of [err, empty, data, busy]) {
      expect(c.firstElementChild?.className).toContain(GRID);
    }
  });

  it('🔴 ΚΑΙ ΟΙ ΔΥΟ γραμμές έχουν ΑΚΡΙΒΩΣ 5 κελιά', () => {
    // Το πλέγμα είναι CSS grid, όχι `<table>`: ένα κελί λιγότερο ΜΕΤΑΤΟΠΙΖΕΙ
    // όλες τις επόμενες στήλες — δεν αφήνει απλώς ένα κενό.
    const { container: err } = renderRow({ error: 'boom' });
    mockCustomerInfo.current = null;
    const { container: empty } = renderRow({});

    expect(err.firstElementChild?.children).toHaveLength(5);
    expect(empty.firstElementChild?.children).toHaveLength(5);
  });

  it('⚠️ ο ΤΟΝΟΣ όμως ΔΙΑΦΕΡΕΙ — βλάβη ≠ κατάσταση', () => {
    // Η εξαγωγή ενοποίησε τη ΔΟΜΗ, όχι το νόημα. Αν κάποιος «απλοποιήσει»
    // περνώντας ίδιο τόνο, το «δεν υπάρχει πελάτης» θα διαβάζεται ως σφάλμα.
    const { container: err } = renderRow({ error: 'boom' });
    mockCustomerInfo.current = null;
    const { container: empty } = renderRow({});

    expect(err.firstElementChild?.className).toContain('text-destructive');
    expect(empty.firstElementChild?.className).not.toContain('text-destructive');
  });
});

// =============================================================================
// Β — ΤΟ ΚΕΛΙ «ΤΙΜΗ, Ή ΠΑΥΛΑ» (10 γραμμές / 52 tokens)
// =============================================================================

describe('Β — τηλέφωνο και email ρωτούν ΤΟΝ ΙΔΙΟ κανόνα', () => {
  const renderRow = (customerData: Record<string, unknown>) =>
    inProvider(
      <CustomerInfoCompact
        contactId="c1"
        context="project"
        variant="table"
        customerData={customerData}
      />,
    );

  it('η τιμή εμφανίζεται όταν υπάρχει', () => {
    renderRow({ displayName: 'Παπαδόπουλος', phone: '2101234567', email: 'a@b.gr' });
    expect(screen.getByText('2101234567')).toBeInTheDocument();
    expect(screen.getByText('a@b.gr')).toBeInTheDocument();
  });

  it('🔴 η ΑΠΟΥΣΙΑ δίνει παύλα — και στα ΔΥΟ κελιά, με τον ίδιο τρόπο', () => {
    // Πριν την εξαγωγή αυτό ήταν γραμμένο δύο φορές: μια αλλαγή στην εμφάνιση της
    // απουσίας γινόταν στο ένα και ξεχνιόταν στο άλλο.
    renderRow({ displayName: 'Παπαδόπουλος', phone: null, email: null });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('μεικτή περίπτωση: τηλέφωνο ναι, email όχι', () => {
    renderRow({ displayName: 'Παπαδόπουλος', phone: '2101234567', email: null });
    expect(screen.getByText('2101234567')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Γ — Η ΕΝΕΡΓΟΠΟΙΗΣΗ ΤΗΣ ΚΑΡΤΑΣ (11 γραμμές / 65 tokens) — ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ
// =============================================================================

describe('Γ — 🔴 ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ ΔΟΥΛΕΥΕΙ ΣΕ **ΚΑΘΕ** ΠΑΡΑΛΛΑΓΗ', () => {
  const VARIANTS = ['card', 'inline'] as const;

  /**
   * ⚠️ **Ο ΠΕΡΙΤΥΛΙΓΜΟΣ, ΟΧΙ ΤΟ `getByRole('button')`** — και το δίδαξε μια αποτυχία:
   * η κάρτα περιέχει **και δικά της κουμπιά ενεργειών**, οπότε το ερώτημα κατά ρόλο
   * βρίσκει **πολλά** στοιχεία. Εμάς μας ενδιαφέρει το **ίδιο το δοχείο** — αυτό που
   * κουβαλά τα τέσσερα props που μετακόμισαν.
   */
  const wrapperOf = (variant: (typeof VARIANTS)[number], onClick?: () => void) =>
    inProvider(
      <UnifiedCustomerCard
        contactId="c1"
        context="project"
        variant={variant}
        onClick={onClick}
      />,
    ).container.firstElementChild as HTMLElement;

  it.each(VARIANTS)('η παραλλαγή %s ανακοινώνεται ως κουμπί όταν είναι πατήσιμη', (variant) => {
    const wrapper = wrapperOf(variant, jest.fn());
    expect(wrapper.getAttribute('role')).toBe('button');
    expect(wrapper.getAttribute('tabindex')).toBe('0');
  });

  it.each(VARIANTS)('🔴 η παραλλαγή %s ενεργοποιείται με Enter ΚΑΙ με Space', (variant) => {
    // Αυτό ήταν γραμμένο ΔΥΟ φορές, μία ανά παραλλαγή. Η άγκυρα ρωτά και τις δύο με
    // το ΙΔΙΟ ερώτημα — που είναι ακριβώς ό,τι η διπλοτυπία δεν εγγυόταν.
    const onEnter = jest.fn();
    fireEvent.keyDown(wrapperOf(variant, onEnter), { key: 'Enter' });
    expect(onEnter).toHaveBeenCalledTimes(1);

    const onSpace = jest.fn();
    fireEvent.keyDown(wrapperOf(variant, onSpace), { key: ' ' });
    expect(onSpace).toHaveBeenCalledTimes(1);
  });

  it.each(VARIANTS)('η παραλλαγή %s ΔΕΝ μπαίνει στη σειρά πλοήγησης όταν δεν κάνει τίποτα', (variant) => {
    // ⚠️ Ένα `tabIndex={0}` σε κάρτα χωρίς `onClick` βάζει στη διαδρομή του
    //    πληκτρολογίου έναν σταθμό **χωρίς προορισμό**.
    const wrapper = wrapperOf(variant, undefined);
    expect(wrapper.getAttribute('role')).toBeNull();
    expect(wrapper.getAttribute('tabindex')).toBeNull();
  });

  it.each(VARIANTS)('η παραλλαγή %s αγνοεί άσχετα πλήκτρα', (variant) => {
    const onClick = jest.fn();
    const wrapper = wrapperOf(variant, onClick);
    fireEvent.keyDown(wrapper, { key: 'a' });
    fireEvent.keyDown(wrapper, { key: 'Tab' });
    expect(onClick).not.toHaveBeenCalled();
  });
});
