/**
 * ΑΓΚΥΡΕΣ — **ο μετρητής δεν μπορεί να μιλά για άλλο σύνολο από τις κάρτες**
 * (ADR-777 §8.62, Βήμα 2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΛΑΤΤΩΜΑ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ **ΑΟΡΑΤΟ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η γραμμή λέει *«14 ακίνητα · 11 στον χάρτη · 3 χωρίς δηλωμένη θέση»*. Ο αριθμός
 * ερχόταν από το `visible`· οι κάρτες από τη **διαμέριση** του `visible`. Συνέπιπταν
 * **κατά κατασκευή, όχι κατά δήλωση** — κανείς δεν τα είχε δέσει, απλώς κανείς δεν
 * είχε κόψει ακόμη.
 *
 * ⚠️ **Το `ledgerBalances` ΔΕΝ το έπιανε, και δεν ήταν χαλασμένο**: ρωτά αν η
 * λογιστική κλείνει **μέσα της** (`mapped + unmapped === total`). Ένα `{total: 14,
 * mapped: 11, unmapped: 3}` δίπλα σε **οκτώ** κάρτες κλείνει **τέλεια**. Δηλαδή ο
 * μετρητής μπορούσε να είναι ταυτόχρονα **συνεπής και ψεύτης**.
 *
 * 🔑 Το Βήμα 3 (φιλτράρισμα από το οπτικό πεδίο του χάρτη) **θα** κόψει. Αυτές οι
 * άγκυρες υπάρχουν για να **κοκκινίσουν τότε**, αντί να αποκλίνει η οθόνη σιωπηλά.
 *
 * ⚠️ **ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΙ ΤΙ ΟΧΙ, δηλωμένο**: το jsdom δεν έχει διάταξη ούτε
 * `content-visibility`. Οι Ομάδες Α-Γ ελέγχουν **αποφάσεις** (ποιος αριθμός, πότε
 * φωνάζει, πόσες κάρτες βγήκαν)· η Ομάδα Δ ελέγχει ότι η **δήλωση** της παράλειψης
 * βαφής υπάρχει στην πηγή. Η ίδια η επιτάχυνση μετρήθηκε στον περιηγητή (Chrome 151)
 * και είναι γραμμένη στο `ListingCard.module.css` — **δεν** αποδεικνύεται εδώ.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  // Η γκαλερί της κάρτας παράγει τον δείκτη φωτογραφίας από `IntersectionObserver`.
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

import { readFileSync } from 'fs';
import { join } from 'path';

import { ListingLedgerBar } from '../ListingLedgerBar';
import { ResultsList } from '../ResultsList';
import { ledgerCoversRendered, type ListingLedger } from '@/types/public-listing';
import { NO_LISTING_FOCUS } from '@/lib/listings/listing-focus';
import type { ListingSections } from '@/lib/listings/listing-price-sections';
/**
 * ⚠️ **ΔΑΝΕΙΣΜΕΝΟ ΕΡΓΟΣΤΑΣΙΟ, ΚΑΙ ΕΙΝΑΙ ΣΥΝΕΙΔΗΤΟ.** Η `PublicListing` έχει ~50
 * υποχρεωτικά πεδία· γράφοντάς τα εδώ θα γεννιόταν **δίδυμο** που το N.18 (jscpd)
 * πιάνει δικαίως. Το `demand-fixtures.listing()` είναι **ήδη** το κοινό εργοστάσιο
 * (το λέει το ίδιο: *«εξήχθη όταν το χρειάστηκε η δεύτερη σουίτα»*).
 *
 * 🔑 Το ότι ζει κάτω από `lib/demand/__tests__` είναι **λάθος διεύθυνση για κοινό
 * αγαθό** — αλλά η μετακόμισή του αγγίζει 7 σουίτες, άρα πάει στο
 * `.claude-rules/pending-ratchet-work.md` (N.0.2), όχι εδώ.
 */
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { PublicListing } from '@/types/public-listing';

const ledgerOf = (total: number, mapped: number): ListingLedger => ({
  total,
  mapped,
  unmapped: total - mapped,
});

/** Το κλειδί του συναγερμού, όπως το ζητά η γραμμή. */
const ALARM = /ledger\.imbalanced/;

// ════════════════════════════════════════════════════════════════════════════
describe('Α — `ledgerCoversRendered`: «είναι ο αριθμός ΤΟΥ ΙΔΙΟΥ συνόλου;»', () => {
  it('συμφωνία ⇒ αληθές', () => {
    expect(ledgerCoversRendered(ledgerOf(14, 11), 14)).toBe(true);
  });

  it('🔴 λιγότερες κάρτες από τον αριθμό ⇒ ψευδές — το σενάριο του Βήματος 3', () => {
    expect(ledgerCoversRendered(ledgerOf(14, 11), 8)).toBe(false);
  });

  it('🔴 ΚΑΙ Η ΑΝΤΙΘΕΤΗ ΚΑΤΕΥΘΥΝΣΗ: περισσότερες κάρτες ⇒ ψευδές', () => {
    // Δεν είναι θεωρητικό: μια μελλοντική «συγχώνευση» δύο πηγών στη λίστα θα
    // ζωγράφιζε ΠΑΝΩ απ' όσα μέτρησε η λογιστική. Ένας έλεγχος `>=` θα το άφηνε
    // να περάσει — γι' αυτό είναι ισότητα.
    expect(ledgerCoversRendered(ledgerOf(8, 5), 14)).toBe(false);
  });

  it('το μηδέν με μηδέν κάρτες είναι **κάλυψη**, όχι σφάλμα', () => {
    expect(ledgerCoversRendered(ledgerOf(0, 0), 0)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Β — η γραμμή φωνάζει, και φωνάζει για ΔΥΟ ανεξάρτητες αιτίες', () => {
  it('συμφωνία ⇒ τυπώνει τη σύνοψη ΧΩΡΙΣ συναγερμό', () => {
    render(<ListingLedgerBar ledger={ledgerOf(14, 11)} rendered={14} />);
    expect(screen.getByText(/ledger\.summary/)).toBeInTheDocument();
    expect(screen.queryByText(ALARM)).not.toBeInTheDocument();
  });

  it('🔴 ο αριθμός λέει 14 ενώ ζωγραφίστηκαν 8 ⇒ ΣΥΝΑΓΕΡΜΟΣ', () => {
    render(<ListingLedgerBar ledger={ledgerOf(14, 11)} rendered={8} />);
    expect(screen.getByText(ALARM)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('η ΠΑΛΙΑ αιτία (εσωτερική ανισορροπία) εξακολουθεί να φωνάζει — δεν αντικαταστάθηκε', () => {
    // `mapped + unmapped !== total`, ενώ η κάλυψη είναι μια χαρά. Αν το §8.62 είχε
    // ΑΝΤΙΚΑΤΑΣΤΗΣΕΙ τον παλιό φρουρό αντί να τον συμπληρώσει, αυτό θα ήταν πράσινο.
    render(<ListingLedgerBar ledger={{ total: 14, mapped: 11, unmapped: 1 }} rendered={14} />);
    expect(screen.getByText(ALARM)).toBeInTheDocument();
  });

  it('το άδειο σύνολο τυπώνει το «0» και ΔΕΝ φωνάζει', () => {
    render(<ListingLedgerBar ledger={ledgerOf(0, 0)} rendered={0} />);
    expect(screen.getByText(/ledger\.summary/)).toBeInTheDocument();
    expect(screen.queryByText(ALARM)).not.toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Γ — η λίστα ζωγραφίζει **ΟΛΑ** όσα της δόθηκαν', () => {
  const mapped = (n: number): PublicListing[] =>
    Array.from({ length: n }, (_, i) =>
      listing({ id: `prop_cov_${i}`, title: `Αγγελία ${i}` })
    );

  /**
   * ⚠️ **Η λίστα παίρνει ΤΜΗΜΑΤΑ** (ADR-777 §8.60.14). Εδώ δίνεται **ένα** τμήμα χωρίς
   * επιγραφή — ακριβώς ό,τι παράγει ο `orderResultsListings` για ομοιογενή
   * αποτελέσματα — ώστε η ομάδα Γ να κρίνει **μόνο** αυτό που δηλώνει: ότι
   * ζωγραφίζονται **όλα** όσα δόθηκαν.
   */
  function drawSections(sections: ListingSections) {
    return render(
      <ResultsList
        sections={sections}
        unmapped={[]}
        focus={NO_LISTING_FOCUS}
        onHover={() => {}}
        filterQuery=""
        undeclaredLabelsFor={() => []}
      />
    );
  }

  function drawList(listings: readonly PublicListing[]) {
    return drawSections([{ heading: null, items: listings }]);
  }

  it('🔴 41 αγγελίες ⇒ 41 κάρτες στο DOM — κανένα σιωπηλό ταβάνι', () => {
    // Η άγκυρα του **Δρόμου Α**: επιλέχθηκε ρητά να ΜΗΝ υπάρχει όριο. Ένα μελλοντικό
    // `.slice(0, N)` μέσα στη `ResultsList` κοκκινίζει ΕΔΩ.
    //
    // 🔴 **41 ΚΑΙ ΟΧΙ 40, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ.** Η πρώτη εκδοχή αυτής της
    //    άγκυρας χρησιμοποιούσε **40** — που είναι ακριβώς το `PRICE_MARKER_LIMIT`,
    //    δηλαδή ο **πιο πιθανός** αριθμός που θα αντέγραφε κάποιος εδώ «για συνέπεια»
    //    (το λάθος που το §8.60 απέρριψε γραπτά). Με 40 δείγματα, ένα
    //    `.slice(0, PRICE_MARKER_LIMIT)` θα επέστρεφε **ακριβώς 40** και η άγκυρα θα
    //    ήταν **πράσινη πάνω στο ίδιο ελάττωμα που υπάρχει για να πιάσει**. Με 41,
    //    κάθε ταβάνι ≤40 κοκκινίζει.
    const { container } = drawList(mapped(41));
    expect(container.querySelectorAll('[data-listing-id]')).toHaveLength(41);
  });

  it('κάθε κάρτα κουβαλά τη ΔΙΚΗ της ταυτότητα — όχι απλώς σωστό πλήθος', () => {
    const { container } = drawList(mapped(3));
    const ids = Array.from(container.querySelectorAll('[data-listing-id]')).map((el) =>
      el.getAttribute('data-listing-id')
    );
    expect(ids).toEqual(['prop_cov_0', 'prop_cov_1', 'prop_cov_2']);
  });

  it('🔑 το στοιχείο με την ταυτότητα είναι ΤΟ ΙΔΙΟ που φοράει την παράλειψη βαφής', () => {
    // Ο χάρτης βρίσκει την κάρτα με `querySelector('[data-listing-id=…]')`. Αν η κλάση
    // έμπαινε σε εσωτερικό `<div>`, το στοιχείο που «κρατά το κουτί του» θα ήταν άλλο
    // από αυτό που ψάχνεται — και η ρύθμιση θα δούλευε **κατά τύχη**.
    // (Το `cssModuleStub` επιστρέφει το όνομα του κλειδιού, άρα `styles.card === 'card'`.)
    const { container } = drawList(mapped(1));
    const card = container.querySelector('[data-listing-id="prop_cov_0"]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('card');
  });

  it('🔴 ΜΕ ΤΜΗΜΑΤΑ: ζωγραφίζονται ΟΛΕΣ οι κάρτες ΟΛΩΝ των τμημάτων — η λογιστική κλείνει', () => {
    // Το §8.62 εγγυάται ότι ο μετρητής μετρά **ό,τι ακριβώς** ζωγραφίζεται. Η
    // διαμέριση του §8.60.14 είναι η πρώτη φορά που η λίστα έχει **περισσότερα από ένα**
    // δοχεία — δηλαδή η πρώτη ευκαιρία να ξεχαστεί ένα.
    const { container } = drawSections([
      { heading: 'sale', items: mapped(2) },
      { heading: 'nightly', items: [listing({ id: 'prop_stay_0', title: 'Διαμονή' })] },
    ]);

    expect(container.querySelectorAll('[data-listing-id]')).toHaveLength(3);
    expect(container.querySelectorAll('section[aria-labelledby] > h2')).toHaveLength(2);

    // 🔴 **Η ΕΠΙΓΡΑΦΗ ΕΙΝΑΙ ΠΑΝΩ ΑΠΟ ΤΙΣ ΚΑΡΤΕΣ, ΟΧΙ ΔΙΠΛΑ ΤΟΥΣ.** Ο τίτλος κάθε κάρτας
    //    είναι `<h3>`· μια επιγραφή στο ίδιο επίπεδο θα έκανε την κλάση **αδελφό** των
    //    μελών της. Η πρώτη γραφή το είχε λάθος και το έπιασε αυτή η άγκυρα.
    expect(container.querySelectorAll('h2')).toHaveLength(2);
  });

  it('🔴 ΧΩΡΙΣ επιγραφή δεν γεννιέται ΚΑΜΙΑ — μία κλάση δεν ανακοινώνεται', () => {
    // Φυλάει τη ρητή απόφαση: επιγραφή πάνω από ομοιογενή λίστα θα επαναλάμβανε ό,τι
    // λέει ήδη η μονάδα κάθε κάρτας (§8.60.11).
    const { container } = drawList(mapped(3));
    expect(container.querySelectorAll('h2')).toHaveLength(0);
    expect(container.querySelectorAll('section[aria-labelledby]')).toHaveLength(0);
    // …και δεν «εξαφανίστηκαν» οι κάρτες μαζί με την επιγραφή:
    expect(container.querySelectorAll('[data-listing-id]')).toHaveLength(3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Δ — η δήλωση της παράλειψης βαφής υπάρχει στην πηγή', () => {
  // ⚠️ Διαβάζεται το **αρχείο**, γιατί το jsdom δεν εφαρμόζει CSS modules. Ίδιο
  //    ιδίωμα με το `results-layout-authority.test.ts`, που διαβάζει το αδελφό module.
  const CSS = readFileSync(join(__dirname, '..', 'ListingCard.module.css'), 'utf8');

  it('δηλώνει `content-visibility: auto`', () => {
    expect(CSS).toMatch(/content-visibility:\s*auto/);
  });

  it('🔴 το `contain-intrinsic-size` έχει τη λέξη `auto` — «θυμήσου το ΠΡΑΓΜΑΤΙΚΟ ύψος»', () => {
    // Χωρίς το `auto`, κάθε κάρτα εκτός οθόνης θα ανέφερε **για πάντα** το εφεδρικό
    // ύψος: η μπάρα κύλισης θα έλεγε ψέματα ακόμη και για κάρτες που ο άνθρωπος ΕΧΕΙ
    // δει. Μετρήθηκε (Chrome 151): με `auto`, κάρτα που ζωγραφίστηκε ανέφερε 379px —
    // το αληθινό της — ενώ κάρτα που δεν ζωγραφίστηκε ποτέ ανέφερε το εφεδρικό.
    expect(CSS).toMatch(/contain-intrinsic-size:\s*auto\s+\d+px/);
  });

  it('⛔ ΚΑΝΕΝΑ ΧΡΩΜΑ ΕΔΩ — η αρχή του χρώματος είναι τα tokens (CHECK 3.42/3.43)', () => {
    // Ίδιος κανόνας με το `ResultsSheet.module.css`, που τον γράφει ρητά.
    //
    // 🔴 **ΤΑ ΣΧΟΛΙΑ ΒΓΑΙΝΟΥΝ ΠΡΩΤΑ, ΚΑΙ ΤΟ ΠΛΗΡΩΣΑ.** Η πρώτη εκδοχή έτρεξε το μοτίβο
    //    πάνω σε **ΟΛΟ** το αρχείο και κοκκίνισε στο «#283846» — τον **αριθμό του
    //    WebKit bug** μέσα σε σχόλιο, που μοιάζει με hex χρώμα. Ακριβώς η κλάση
    //    «η δικλείδα πιάνει σχόλια» που το ίδιο το έργο έχει ήδη καταγράψει. Μια
    //    δικλείδα που κοκκινίζει στην τεκμηρίωση εκπαιδεύει να **σβήνεις γιατί**.
    const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(/);
    // …και η δικλείδα δεν έγινε άχρηστη: εξακολουθεί να βλέπει τις δηλώσεις.
    expect(declarations).toMatch(/content-visibility/);
  });
});
