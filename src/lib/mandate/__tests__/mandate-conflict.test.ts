/**
 * @fileoverview **Ο ΚΡΙΤΗΣ ΤΗΣ ΑΠΟΚΛΕΙΣΤΙΚΟΤΗΤΑΣ** — τα τρία σκέλη, χωριστά και μαζί.
 * @related lib/mandate/mandate-conflict.ts · types/listing-agreement.ts · άρθρο 200 §4 Ν.4072/2012
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ — ΚΑΙ ΓΙΑΤΙ ΤΑ ΤΡΙΑ ΣΚΕΛΗ ΔΟΚΙΜΑΖΟΝΤΑΙ **ΧΩΡΙΣΤΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ```
 * σύγκρουση = ίδιος πόρος ∧ επικάλυψη χρόνου ∧ ¬συμβατοί τρόποι
 * ```
 *
 * Μια σουίτα που δοκιμάζει μόνο *«δύο αποκλειστικές ⇒ όχι»* περνά **και** με
 * υλοποίηση που αγνοεί τον χρόνο, **και** με υλοποίηση που αγνοεί τον πόρο — δηλαδή
 * με τον **παλιό** κώδικα (`mandate.kind !== 'self'`), που απέρριπτε τα πάντα. Κάθε
 * σκέλος χρειάζεται δικό του **αρνητικό** παράδειγμα: μια περίπτωση που περνά
 * **ακριβώς επειδή** το σκέλος υπάρχει.
 *
 * 🔑 **Τα Δ1-Δ4 είναι οι τέσσερις περιπτώσεις που ο παλιός κώδικας έκρινε λάθος** —
 * τρεις άρνηση που έπρεπε να είναι δεκτή, μία που ήταν ήδη σωστή. Αν κάποια από τις
 * τρεις πρώτες κοκκινίσει, η παλινδρόμηση είναι **ακριβώς** το ελάττωμα που λύθηκε.
 */

import { EXCLUSIVE_RIGHT_TO_LEASE, EXCLUSIVE_RIGHT_TO_SELL, LISTING_AGREEMENTS, OPEN_LISTING } from '@/types/listing-agreement';

import {
  CANDIDATE_IS_EXCLUSIVE,
  EXISTING_IS_EXCLUSIVE,
  everyAgreementHasLockMode,
  mandateConflicts,
  type MandateOccupancy,
} from '../mandate-conflict';

const AGENCY_A = 'comp_aaaaaaaa';
const AGENCY_B = 'comp_bbbbbbbb';

/** Ιανουάριος → Ιούνιος 2027. Το **προεπιλεγμένο** παράθυρο των δοκιμών. */
const JAN = '2027-01-01T00:00:00.000Z';
const JUN = '2027-06-01T00:00:00.000Z';

function occupancy(over: Partial<MandateOccupancy> = {}): MandateOccupancy {
  return {
    agencyCompanyId: AGENCY_A,
    agreement: EXCLUSIVE_RIGHT_TO_SELL,
    scope: ['sell'],
    startsAt: JAN,
    expiresAt: JUN,
    ...over,
  };
}

// =============================================================================
// Δ — ΟΙ ΤΕΣΣΕΡΙΣ ΠΕΡΙΠΤΩΣΕΙΣ ΠΟΥ Ο ΠΑΛΙΟΣ ΚΩΔΙΚΑΣ ΕΚΡΙΝΕ (ΤΡΕΙΣ ΛΑΘΟΣ)
// =============================================================================

describe('🔴 Δ — οι τέσσερις περιπτώσεις του παλιού `mandate.kind !== "self"`', () => {
  it('Δ1. ΑΠΛΗ εντολή σε ΔΕΥΤΕΡΟ γραφείο ΠΕΡΝΑ — είναι ο ορισμός της απλής', () => {
    // ⚠️ Ο παλιός κώδικας το απέρριπτε. Η «Απλή εντολή» στην οθόνη ήταν ετικέτα
    //    χωρίς συνέπεια — το μόνο είδος που υπάρχει ΓΙΑ ΝΑ επιτρέπεται.
    const existing = occupancy({ agreement: OPEN_LISTING, agencyCompanyId: AGENCY_A });
    const candidate = occupancy({ agreement: OPEN_LISTING, agencyCompanyId: AGENCY_B });

    expect(mandateConflicts(candidate, [existing]).kind).toBe('clear');
  });

  it('Δ2. Αποκλειστική ΠΩΛΗΣΗΣ + εντολή ΕΚΜΙΣΘΩΣΗΣ ΠΕΡΝΑ — άλλο «περιεχόμενο» (άρθρο 200 §4)', () => {
    // 🔑 Ο νόμος απαγορεύει εντολή «με το ΙΔΙΟ περιεχόμενο». Το RESO ξεχωρίζει
    //    `Right To Sell` από `…To Lease` ακριβώς γι' αυτό: δύο ΠΟΡΟΙ.
    const existing = occupancy({ scope: ['sell'], agencyCompanyId: AGENCY_A });
    const candidate = occupancy({
      agreement: EXCLUSIVE_RIGHT_TO_LEASE,
      scope: ['leaseOut'],
      agencyCompanyId: AGENCY_B,
    });

    expect(mandateConflicts(candidate, [existing]).kind).toBe('clear');
  });

  it('Δ3. ΔΙΑΔΟΧΙΚΕΣ εντολές ΠΕΡΝΟΥΝ — δεν συνυπάρχουν ποτέ, ούτε μία στιγμή', () => {
    // 🏆 Η δυνατότητα που ΚΑΝΕΝΑ MLS δεν προσφέρει: «η αποκλειστική λήγει 1/6 —
    //    κλείσε εντολή που αρχίζει 1/6». Ημι-ανοιχτά διαστήματα `[από, ως)`.
    const existing = occupancy({ startsAt: JAN, expiresAt: JUN, agencyCompanyId: AGENCY_A });
    const candidate = occupancy({
      startsAt: JUN,
      expiresAt: '2027-12-01T00:00:00.000Z',
      agencyCompanyId: AGENCY_B,
    });

    expect(mandateConflicts(candidate, [existing]).kind).toBe('clear');
  });

  it('🔴 Δ4. Δεύτερη ΑΠΟΚΛΕΙΣΤΙΚΗ στον ίδιο πόρο ΑΠΟΡΡΙΠΤΕΤΑΙ — το μόνο σωστό από τα τέσσερα', () => {
    const existing = occupancy({ agencyCompanyId: AGENCY_A });
    const candidate = occupancy({ agencyCompanyId: AGENCY_B });

    const verdict = mandateConflicts(candidate, [existing]);

    expect(verdict.kind).toBe('conflicts');
    if (verdict.kind !== 'conflicts') throw new Error('αναμενόταν σύγκρουση');
    expect(verdict.conflicts).toHaveLength(1);
    expect(verdict.conflicts[0]?.with.agencyCompanyId).toBe(AGENCY_A);
    expect(verdict.conflicts[0]?.resource).toBe('sell');
    expect(verdict.conflicts[0]?.reason).toBe(EXISTING_IS_EXCLUSIVE);
  });
});

// =============================================================================
// Τ — Ο ΠΙΝΑΚΑΣ ΣΥΜΒΑΤΟΤΗΤΑΣ, ΕΚΤΕΛΕΣΜΕΝΟΣ ΚΑΙ ΣΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ
// =============================================================================

describe('🔑 Τ — ο πίνακας shared/exclusive είναι ΣΥΜΜΕΤΡΙΚΟΣ', () => {
  const cases: readonly (readonly [string, string, 'clear' | 'conflicts'])[] = [
    [OPEN_LISTING, OPEN_LISTING, 'clear'],
    [OPEN_LISTING, EXCLUSIVE_RIGHT_TO_SELL, 'conflicts'],
    [EXCLUSIVE_RIGHT_TO_SELL, OPEN_LISTING, 'conflicts'],
    [EXCLUSIVE_RIGHT_TO_SELL, EXCLUSIVE_RIGHT_TO_SELL, 'conflicts'],
  ];

  it.each(cases)('Τ. υποψήφια %s vs υπάρχουσα %s ⇒ %s', (candidateAgreement, existingAgreement, expected) => {
    const verdict = mandateConflicts(
      occupancy({
        agreement: candidateAgreement as MandateOccupancy['agreement'],
        agencyCompanyId: AGENCY_B,
      }),
      [occupancy({ agreement: existingAgreement as MandateOccupancy['agreement'], agencyCompanyId: AGENCY_A })],
    );

    expect(verdict.kind).toBe(expected);
  });

  it('🔴 Τ5. Η ΣΕΙΡΑ ΔΕΝ ΑΛΛΑΖΕΙ ΤΗΝ ΑΠΑΝΤΗΣΗ — αλλιώς το δικαίωμα θα το όριζε το ποιος πάτησε πρώτος', () => {
    const open = occupancy({ agreement: OPEN_LISTING, agencyCompanyId: AGENCY_A });
    const exclusive = occupancy({ agreement: EXCLUSIVE_RIGHT_TO_SELL, agencyCompanyId: AGENCY_B });

    expect(mandateConflicts(open, [exclusive]).kind).toBe('conflicts');
    expect(mandateConflicts(exclusive, [open]).kind).toBe('conflicts');
  });

  it('Τ6. Ο λόγος ΞΕΧΩΡΙΖΕΙ ποιος αποκλείει — γιατί η θεραπεία είναι άλλη', () => {
    // υπάρχουσα ΑΠΛΗ + υποψήφια ΑΠΟΚΛΕΙΣΤΙΚΗ ⇒ ο άνθρωπος μπορεί να ζητήσει απλή.
    const verdict = mandateConflicts(
      occupancy({ agreement: EXCLUSIVE_RIGHT_TO_SELL, agencyCompanyId: AGENCY_B }),
      [occupancy({ agreement: OPEN_LISTING, agencyCompanyId: AGENCY_A })],
    );

    if (verdict.kind !== 'conflicts') throw new Error('αναμενόταν σύγκρουση');
    expect(verdict.conflicts[0]?.reason).toBe(CANDIDATE_IS_EXCLUSIVE);
  });
});

// =============================================================================
// Χ — ΤΑ ΑΚΡΑ ΤΟΥ ΧΡΟΝΟΥ
// =============================================================================

describe('Χ — τα άκρα του διαστήματος', () => {
  it('Χ1. Επικάλυψη ΜΙΑΣ στιγμής ΣΥΓΚΡΟΥΕΤΑΙ — το `[από, ως)` δεν σημαίνει «χαλαρό»', () => {
    const existing = occupancy({ startsAt: JAN, expiresAt: JUN, agencyCompanyId: AGENCY_A });
    const candidate = occupancy({
      startsAt: '2027-05-31T23:59:59.999Z',
      expiresAt: '2027-12-01T00:00:00.000Z',
      agencyCompanyId: AGENCY_B,
    });

    expect(mandateConflicts(candidate, [existing]).kind).toBe('conflicts');
  });

  it('Χ2. ΑΝΟΙΧΤΗ διάρκεια (`expiresAt: null`) καταλαμβάνει το μέλλον', () => {
    const existing = occupancy({ startsAt: JAN, expiresAt: null, agencyCompanyId: AGENCY_A });
    const candidate = occupancy({
      startsAt: '2099-01-01T00:00:00.000Z',
      expiresAt: null,
      agencyCompanyId: AGENCY_B,
    });

    expect(mandateConflicts(candidate, [existing]).kind).toBe('conflicts');
  });

  it('🔴 Χ3. ΜΗ ΑΝΑΓΝΩΣΙΜΗ ημερομηνία ⇒ `undetermined`, ΠΟΤΕ `clear` (N.12)', () => {
    // Ένα `clear` εδώ θα επέτρεπε δεύτερη αποκλειστική επειδή δεν διαβάσαμε την πρώτη.
    const existing = occupancy({ expiresAt: 'όχι-ημερομηνία', agencyCompanyId: AGENCY_A });
    const candidate = occupancy({ agencyCompanyId: AGENCY_B });

    const verdict = mandateConflicts(candidate, [existing]);

    expect(verdict.kind).toBe('undetermined');
    if (verdict.kind !== 'undetermined') throw new Error('αναμενόταν αβεβαιότητα');
    expect(verdict.unreadable).toHaveLength(1);
  });

  it('🔑 Χ4. Η ΑΠΟΔΕΙΓΜΕΝΗ σύγκρουση νικά τη βλάβη — απόδειξη, όχι εικασία', () => {
    const broken = occupancy({ expiresAt: 'χαλασμένο', agencyCompanyId: 'comp_cccccccc' });
    const realConflict = occupancy({ agencyCompanyId: AGENCY_A });
    const candidate = occupancy({ agencyCompanyId: AGENCY_B });

    expect(mandateConflicts(candidate, [broken, realConflict]).kind).toBe('conflicts');
  });
});

// =============================================================================
// Ι — Ο ΙΔΙΟΣ ΚΑΤΟΧΟΣ, ΚΑΙ ΤΑ ΠΟΛΛΑΠΛΑ ΕΥΡΗΜΑΤΑ
// =============================================================================

describe('Ι — ταυτότητα κατόχου και πληρότητα αναφοράς', () => {
  it('🔴 Ι1. Το ΙΔΙΟ γραφείο δεν συγκρούεται με τον εαυτό του — αλλιώς καμία ανανέωση δεν περνά', () => {
    const existing = occupancy({ agencyCompanyId: AGENCY_A });
    const renewal = occupancy({
      agencyCompanyId: AGENCY_A,
      expiresAt: '2027-09-01T00:00:00.000Z',
    });

    expect(mandateConflicts(renewal, [existing]).kind).toBe('clear');
  });

  it('Ι2. ΟΛΕΣ οι συγκρούσεις, ποτέ η πρώτη — αλλιώς ο άνθρωπος τις συναντά μία-μία', () => {
    const verdict = mandateConflicts(occupancy({ agencyCompanyId: 'comp_zzzzzzzz' }), [
      occupancy({ agencyCompanyId: AGENCY_A }),
      occupancy({ agencyCompanyId: AGENCY_B }),
    ]);

    if (verdict.kind !== 'conflicts') throw new Error('αναμενόταν συγκρούσεις');
    expect(verdict.conflicts).toHaveLength(2);
  });

  it('Ι3. ΜΙΑ εγγραφή ΑΝΑ ΠΡΑΞΗ — «εμποδίζεσαι στην πώληση αλλά όχι στην εκμίσθωση» είναι πληροφορία', () => {
    const existing = occupancy({ scope: ['sell', 'leaseOut'], agencyCompanyId: AGENCY_A });
    const candidate = occupancy({ scope: ['sell', 'leaseOut'], agencyCompanyId: AGENCY_B });

    const verdict = mandateConflicts(candidate, [existing]);

    if (verdict.kind !== 'conflicts') throw new Error('αναμενόταν συγκρούσεις');
    expect(verdict.conflicts.map((c) => c.resource).sort()).toEqual(['leaseOut', 'sell']);
  });

  it('Ι4. ΚΕΝΟ `scope` δεν καταλαμβάνει τίποτα', () => {
    const existing = occupancy({ scope: [], agencyCompanyId: AGENCY_A });

    expect(mandateConflicts(occupancy({ agencyCompanyId: AGENCY_B }), [existing]).kind).toBe('clear');
  });

  it('Ι5. Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: καμία υπάρχουσα ⇒ καθαρό', () => {
    // Χωρίς αυτό, κριτής που απορρίπτει ΤΑ ΠΑΝΤΑ θα περνούσε κάθε άλλη άγκυρα.
    expect(mandateConflicts(occupancy(), []).kind).toBe('clear');
  });
});

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ (CHECK 3.54 — άγκυρα που ΕΚΤΕΛΕΙ)
// =============================================================================

describe('Π — κάθε είδος εντολής έχει δηλωμένο τρόπο κατάληψης', () => {
  it('Π1. Το κλειστό σύνολο είναι πλήρως χαρτογραφημένο — και ΕΚΤΕΛΕΙΤΑΙ, δεν μεταγλωττίζεται μόνο', () => {
    expect(everyAgreementHasLockMode(LISTING_AGREEMENTS)).toBe(true);
  });

  it('Π2. Οι ΤΡΕΙΣ αποκλειστικές αποκλείουν, η ΜΙΑ απλή μοιράζεται', () => {
    const shared = LISTING_AGREEMENTS.filter(
      (agreement) =>
        mandateConflicts(occupancy({ agreement, agencyCompanyId: AGENCY_B }), [
          occupancy({ agreement: OPEN_LISTING, agencyCompanyId: AGENCY_A }),
        ]).kind === 'clear',
    );

    expect(shared).toEqual([OPEN_LISTING]);
  });
});
