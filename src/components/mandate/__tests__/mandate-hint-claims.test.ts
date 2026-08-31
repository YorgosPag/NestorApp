/**
 * @fileoverview 🔴 **ΟΙ ΔΥΟ ΤΕΛΕΥΤΑΙΕΣ ΥΠΟΣΧΕΣΕΙΣ ΤΗΣ ΟΘΟΝΗΣ, ΕΚΤΕΛΕΣΜΕΝΕΣ.**
 * @related ADR-834 §6.5 · ADR-832 §5.3 · types/listing-agreement.ts · lib/mandate/mandate-conflict.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ: Ο ΠΙΝΑΚΑΣ ΤΩΝ ΤΕΣΣΑΡΩΝ ΕΚΛΕΙΣΕ ΜΕΧΡΙ ΤΗ ΜΕΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ζωντανή επαλήθευση του ADR-834 μέτρησε ότι στην **ίδια οθόνη** υπάρχουν **τέσσερις**
 * προτάσεις που ισχυρίζονται κάτι για τη **συμπεριφορά του κώδικα**, και **καμία δεν
 * ελεγχόταν ποτέ**. Δύο δέθηκαν *(`listingHint` §6.4.β · `expiresHint` §6.5.β)*.
 * **Αυτό το αρχείο δένει τις άλλες δύο** — και μαζί τους κλείνει ο πίνακας.
 *
 * ⚠️ **ΓΙΑΤΙ ΑΓΚΥΡΑ ΚΑΙ ΟΧΙ ΠΑΡΑΓΩΓΗ, ΟΠΩΣ ΣΤΟ `listingHint`.** Εκεί η πρόταση ήταν
 * **απαρίθμηση** ενός κλειστού συνόλου, άρα η λίστα μπορούσε να **παραχθεί** από αυτό
 * και η απόκλιση να γίνει δομικά αδύνατη. Εδώ οι δύο προτάσεις είναι **ποιοτικοί
 * ισχυρισμοί** *(«το είδος **καθορίζει**» · «δεν **εμποδίζει**»)* — δεν απαριθμούν
 * τίποτα, άρα δεν υπάρχει τι να παραχθεί. Παραγωγή εδώ θα ήταν **γεννήτρια κακών
 * ελληνικών** για μηδενικό κέρδος. Το ADR το είχε ήδη γράψει ως κανόνα: **άγκυρα ανά
 * ισχυρισμό, όχι πύλη ανά κατάληξη**.
 *
 * ⛔ **ΚΑΜΙΑ ΣΥΓΚΡΙΣΗ ΚΕΙΜΕΝΟΥ ΜΕ ΚΕΙΜΕΝΟ** — επιζεί κάθε μετάλλαξης *(ADR-834 §6.5)*.
 * Εδώ εκτελούνται τα **κατηγορήματα** που οι προτάσεις περιγράφουν.
 */

import {
  EXCLUSIVE_AGENCY,
  EXCLUSIVE_RIGHT_TO_LEASE,
  EXCLUSIVE_RIGHT_TO_SELL,
  LISTING_AGREEMENTS,
  OPEN_LISTING,
  statutoryTermLimitFor,
} from '@/types/listing-agreement';
import { defaultExpiryFor, exceedsStatutoryTerm } from '@/types/owner-property-mandate';
import { endOfDay, toDateInputValue } from '@/lib/mandate/mandate-term-window';
import { mandateConflicts, type MandateOccupancy } from '@/lib/mandate/mandate-conflict';

/** Η αφετηρία κάθε μέτρησης — σταθερή, ποτέ ρολόι. */
const FROM = '2026-08-31T00:00:00.000Z';

/** Μία ημέρα, σε χιλιοστά του δευτερολέπτου. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Η **τελευταία νόμιμη στιγμή** για αυτό το είδος, με τη γραφή του ίδιου του κριτή. */
function lastLawfulInstant(agreement: (typeof LISTING_AGREEMENTS)[number]): string {
  const latest = defaultExpiryFor(agreement, FROM);
  if (latest === null) throw new Error(`Είδος χωρίς όριο: ${agreement}`);
  return endOfDay(toDateInputValue(latest));
}

// ============================================================================
// Ν — «Το είδος καθορίζει το νόμιμο ανώτατο της διάρκειας.»  (agreementHint)
// ============================================================================

describe('🔴 Ν — `agreementHint`: «το ΕΙΔΟΣ καθορίζει το ΝΟΜΙΜΟ ΑΝΩΤΑΤΟ»', () => {
  it('🔑 Ν0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχουν πολλά είδη να «καθορίσουν» κάτι', () => {
    // Με ένα μόνο είδος, η πρόταση θα ήταν κενή ακόμη κι αν όλα τα υπόλοιπα περνούσαν.
    expect(LISTING_AGREEMENTS.length).toBeGreaterThan(1);
  });

  it('Ν1 — ΟΛΟΤΗΤΑ: κάθε είδος έχει όριο, και το όριο είναι πραγματικό', () => {
    // ⚠️ Ο τύπος `Record<ListingAgreement, …>` το εγγυάται στη μεταγλώττιση — αλλά ο
    //    N.17 απαγορεύει `tsc` στον πράκτορα, άρα μόνο **εκτελούμενη** άγκυρα το λέει
    //    σήμερα (ίδιο σκεπτικό με το `mandate-request-labels.test.ts`).
    const broken = LISTING_AGREEMENTS.filter((agreement) => {
      const limit = statutoryTermLimitFor(agreement);
      return limit === undefined || !(limit.maxMonths > 0);
    });
    expect(broken).toEqual([]);
  });

  it('🔴 Ν2 — «ΚΑΘΟΡΙΖΕΙ»: τα όρια ΔΕΝ είναι όλα ίδια', () => {
    // 🔑 **Η ΓΡΑΜΜΗ ΠΟΥ ΚΑΝΕΙ ΤΗΝ ΠΡΟΤΑΣΗ ΝΑ ΣΗΜΑΙΝΕΙ ΚΑΤΙ.** Αν κάθε είδος είχε το
    //    ίδιο ανώτατο, το «το είδος **καθορίζει**» θα ήταν **διακόσμηση**: ο άνθρωπος
    //    θα διάβαζε ότι η επιλογή του μετράει, ενώ δεν θα μετρούσε. Μετρημένο σήμερα:
    //    αποκλειστικές **8** μήνες (άρθρο 200 §4) · απλή **12** (§3).
    const distinct = new Set(
      LISTING_AGREEMENTS.map((agreement) => statutoryTermLimitFor(agreement).maxMonths),
    );
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('🔴 Ν3 — «ΑΝΩΤΑΤΟ»: το όριο είναι ΟΡΟΦΗ, όχι συμβουλή', () => {
    // Για **κάθε** είδος: η τελευταία νόμιμη στιγμή περνά· η επόμενη ημέρα **όχι**.
    // ⇒ Ο αριθμός του `STATUTORY_TERM_LIMITS` είναι αυτός που **επιβάλλεται**, όχι
    //    ένας δεύτερος που απλώς κάθεται δίπλα (ADR-749: «τρεις αριθμοί, ένα ερώτημα»).
    const failures: string[] = [];
    for (const agreement of LISTING_AGREEMENTS) {
      const lawful = lastLawfulInstant(agreement);
      const dayAfter = new Date(Date.parse(lawful) + ONE_DAY_MS).toISOString();

      if (exceedsStatutoryTerm(agreement, FROM, lawful)) failures.push(`${agreement}: ΤΟ ΟΡΙΟ ΑΠΟΡΡΙΠΤΕΤΑΙ`);
      if (!exceedsStatutoryTerm(agreement, FROM, dayAfter)) failures.push(`${agreement}: ΤΟ ΟΡΙΟ ΔΕΝ ΦΥΛΑΓΕΤΑΙ`);
    }
    expect(failures).toEqual([]);
  });

  it('🔴 Ν4 — «ΝΟΜΙΜΟ»: κάθε όριο δηλώνει τη ΔΙΑΤΑΞΗ του', () => {
    // Η λέξη «νόμιμο» είναι **ισχυρισμός για πηγή**. Όριο χωρίς διάταξη είναι αριθμός
    // που κάποιος διάλεξε — και η πρόταση θα τον παρουσίαζε ως νόμο.
    const unsourced = LISTING_AGREEMENTS.filter((agreement) => {
      const limit = statutoryTermLimitFor(agreement);
      return limit.authority.trim() === '' || limit.jurisdiction.trim() === '';
    });
    expect(unsourced).toEqual([]);
  });
});

// ============================================================================
// Ξ — «Δεσμεύει μόνο όσες επιλέξετε. Αποκλειστική πώλησης δεν εμποδίζει
//      ενοικίαση αλλού.»  (scopeHint)
// ============================================================================

const AGENCY_A = 'comp_alfa';
const AGENCY_B = 'comp_beta';

/**
 * Μία κατάληψη — τα **πέντε** πεδία που κρίνει ο κριτής, τίποτε άλλο.
 *
 * 🔴 **ΤΟ `startsAt` ΕΛΕΙΠΕ ΣΤΗΝ ΠΡΩΤΗ ΓΡΑΦΗ, ΚΑΙ Η ΑΓΚΥΡΑ ΤΟ ΕΠΙΑΣΕ.** Ο κριτής δεν
 * απάντησε «σύγκρουση» ούτε «καθαρό» — απάντησε **`undetermined`**, δηλαδή *«δεν
 * μπόρεσα να διαβάσω»*, ακριβώς όπως ορίζει ο τύπος του. ⚠️ Το ίδιο θα το είχε πιάσει
 * ο μεταγλωττιστής, αλλά ο **N.17** απαγορεύει `tsc` στον πράκτορα: **μόνο
 * εκτελούμενη άγκυρα το λέει σήμερα** — και το είπε.
 *
 * 🔑 Και είναι μάθημα για τον **σχεδιασμό του κριτή**, όχι μόνο για το fixture: επειδή
 * το `undetermined` είναι **δικός του κωδικός** και όχι `false`, το κενό εμφανίστηκε ως
 * *«άγνωστο»* αντί να μεταμφιεστεί σε *«καθαρό»* — που θα ήταν **πράσινο πάνω σε ψέμα**.
 */
function occupancy(
  agencyCompanyId: string,
  agreement: (typeof LISTING_AGREEMENTS)[number],
  scope: MandateOccupancy['scope'],
): MandateOccupancy {
  return {
    agencyCompanyId,
    agreement,
    scope,
    startsAt: FROM,
    expiresAt: '2027-04-30T23:59:59.999Z',
  };
}

describe('🔴 Ξ — `scopeHint`: «δεσμεύει ΜΟΝΟ όσες επιλέξετε»', () => {
  it('🔑 Ξ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο κριτής ΜΠΟΡΕΙ να πει «όχι»', () => {
    // 🔴 **Χωρίς αυτό, όλα τα παρακάτω είναι κενά.** Ένας κριτής που επιστρέφει
    //    **πάντα** `clear` θα έκανε κάθε «δεν εμποδίζει» πράσινο — δηλαδή η άγκυρα θα
    //    επιβεβαίωνε την πρόταση **χωρίς να την έχει δοκιμάσει** (ADR-749 §5).
    const verdict = mandateConflicts(
      occupancy(AGENCY_B, EXCLUSIVE_RIGHT_TO_SELL, ['sell']),
      [occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_SELL, ['sell'])],
    );
    expect(verdict.kind).toBe('conflicts');
  });

  it('🔴 Ξ1 — ΑΛΛΗ πράξη ⇒ καμία σύγκρουση («μόνο όσες επιλέξετε»)', () => {
    // Η υπάρχουσα δεσμεύει **πώληση**· ο υποψήφιος ζητά **ενοικίαση**. Αν εδώ
    // εμφανιζόταν σύγκρουση, η πρόταση θα ήταν ψευδής και ο ιδιοκτήτης θα εμποδιζόταν
    // σε πράξη που **κανείς δεν κράτησε**.
    const verdict = mandateConflicts(
      occupancy(AGENCY_B, EXCLUSIVE_RIGHT_TO_LEASE, ['leaseOut']),
      [occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_SELL, ['sell'])],
    );
    expect(verdict.kind).toBe('clear');
  });

  it('🔴 Ξ2 — Η ΠΡΟΤΑΣΗ ΚΑΤΑ ΛΕΞΗ: «αποκλειστική πώλησης δεν εμποδίζει ενοικίαση ΑΛΛΟΥ»', () => {
    // ⚠️ **«Αλλού» = ΑΛΛΟ γραφείο**, και είναι ουσιώδες: το ίδιο γραφείο δεν
    //    συγκρούεται με τον εαυτό του για άλλον λόγο (αντικατάσταση, όχι δεύτερη
    //    κατάληψη). Η δοκιμή με **δύο** γραφεία είναι η μόνη που δοκιμάζει την πρόταση.
    const verdict = mandateConflicts(
      occupancy(AGENCY_B, EXCLUSIVE_RIGHT_TO_LEASE, ['leaseOut']),
      [occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_SELL, ['sell'])],
    );
    expect(verdict).toEqual({ kind: 'clear' });
  });

  it('Ξ3 — και η ΤΡΙΤΗ πράξη μένει κι αυτή ελεύθερη (αντιπαροχή)', () => {
    // Το λεξιλόγιο έχει **τρεις** πράξεις· μια υλοποίηση που ξεχνά τη μία θα ήταν
    // σωστή στα δύο δείγματα και λάθος στο τρίτο.
    const verdict = mandateConflicts(
      occupancy(AGENCY_B, EXCLUSIVE_AGENCY, ['exchange']),
      [occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_SELL, ['sell'])],
    );
    expect(verdict.kind).toBe('clear');
  });

  it('🔑 Ξ4 — ΕΠΙΚΑΛΥΨΗ: κοινή πράξη μέσα σε πολλαπλό `scope` ΠΙΑΝΕΤΑΙ', () => {
    // 🔴 Το συμμετρικό του Ξ1, και **απαραίτητο**: μια υλοποίηση που κοιτά μόνο το
    //    **πρώτο** στοιχείο του `scope` θα περνούσε τα Ξ1-Ξ3 και θα άφηνε τον ιδιοκτήτη
    //    να ζητήσει πράξη που **είναι** κατειλημμένη.
    const verdict = mandateConflicts(
      occupancy(AGENCY_B, EXCLUSIVE_RIGHT_TO_LEASE, ['leaseOut']),
      [occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_SELL, ['sell', 'leaseOut'])],
    );
    expect(verdict.kind).toBe('conflicts');
    if (verdict.kind === 'conflicts') {
      // Και **ονομαστικά στη σωστή πράξη** — ποτέ μια «γενική» σύγκρουση.
      expect(verdict.conflicts.map((conflict) => conflict.resource)).toEqual(['leaseOut']);
    }
  });

  it('🔑 Ξ6 — ΚΑΙ Η ΕΠΙΚΑΛΥΨΗ ΑΠΟ ΤΗΝ ΑΛΛΗ ΠΛΕΥΡΑ: πολλαπλός `scope` στον ΥΠΟΨΗΦΙΟ', () => {
    // 🔴 **ΤΟ ΒΡΗΚΕ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΕΠΕΖΗΣΕ, ΟΧΙ Η ΑΝΑΓΝΩΣΗ.** Το `Ξ4` βάζει τη δεύτερη
    //    πράξη στην **υπάρχουσα** κατάληψη — άρα ένας κόφτης `scope.slice(0, 1)` πάνω
    //    στον **υποψήφιο** περνούσε αθέατος. Η τομή έχει **δύο** πλευρές· μία δοκιμή
    //    ελέγχει **μία**. Εδώ η κοινή πράξη είναι **δεύτερη στον υποψήφιο**.
    const verdict = mandateConflicts(
      occupancy(AGENCY_B, EXCLUSIVE_AGENCY, ['exchange', 'leaseOut']),
      [occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_LEASE, ['leaseOut'])],
    );
    expect(verdict.kind).toBe('conflicts');
    if (verdict.kind === 'conflicts') {
      expect(verdict.conflicts.map((conflict) => conflict.resource)).toEqual(['leaseOut']);
    }
  });

  it('Ξ5 — «ΑΛΛΟΥ»: το ΙΔΙΟ γραφείο ΔΕΝ κρίνεται από αυτόν τον κριτή', () => {
    // Απόδειξη ότι το «αλλού» της πρότασης δεν είναι διακοσμητικό: με το **ίδιο**
    // γραφείο και **ίδια** πράξη ο κριτής λέει `clear`, γιατί το ερώτημα είναι
    // **αντικατάσταση όρων** και το απαντά άλλος (`judgeAgainstHistory`).
    const verdict = mandateConflicts(
      occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_SELL, ['sell']),
      [occupancy(AGENCY_A, EXCLUSIVE_RIGHT_TO_SELL, ['sell'])],
    );
    expect(verdict.kind).toBe('clear');
  });
});

// ============================================================================
// Ο — ΤΟ ΚΛΕΙΣΙΜΟ ΤΟΥ ΠΙΝΑΚΑ
// ============================================================================

describe('🏆 Ο — ο πίνακας των τεσσάρων υπόπτων ΕΚΛΕΙΣΕ', () => {
  it('Ο1 — και οι τέσσερις ισχυρισμοί έχουν πλέον εκτελούμενο κατηγόρημα', () => {
    // 🔑 Δεν είναι διακοσμητικό: αυτή η γραμμή είναι ο **κατάλογος** που ο επόμενος
    //    διαβάζει για να δει τι φυλάγεται **και από πού**. Ένας πέμπτος ισχυρισμός
    //    αύριο δεν θα κοκκινίσει εδώ — θα κοκκινίσει στη **σκέψη** εκείνου που θα
    //    διαβάσει ότι ο πίνακας δηλώνεται «κλειστός» (ADR-834 §6.5).
    const bound = {
      listingHint: 'components/mandate/__tests__/listing-eligibility.test.ts',
      expiresHint: 'lib/mandate/__tests__/mandate-term-day.test.ts',
      agreementHint: 'Ν0-Ν4, εδώ',
      scopeHint: 'Ξ0-Ξ5, εδώ',
    } as const;
    expect(Object.values(bound).filter((where) => where.trim() === '')).toEqual([]);
    expect(Object.keys(bound)).toHaveLength(4);
  });
});
