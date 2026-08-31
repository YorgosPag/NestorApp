/**
 * @fileoverview **Ο ΕΝΑΣ ΚΡΙΤΗΣ, ΣΕ ΔΥΟ ΠΕΔΙΑ** — εντολές μεσίτη · κρατήσεις.
 * @related lib/occupancy/occupancy-conflict.ts · lib/mandate/mandate-conflict.ts ·
 *   lib/stay/stay-conflict.ts · ADR-835 §13 · ADR-832 §6
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΙΔΙΟ ΑΡΧΕΙΟ ΤΡΕΧΕΙ **ΔΥΟ** ΠΕΔΙΑ, ΚΑΙ ΟΧΙ ΔΥΟ ΑΡΧΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Ο κριτής είναι γενικός»* είναι **ισχυρισμός** όσο τον τρέχει ένας καταναλωτής.
 * Δύο ξεχωριστές σουίτες θα τον άφηναν ισχυρισμό: η καθεμιά θα περνούσε **και** με δύο
 * αντίγραφα του κανόνα που έχουν αρχίσει να αποκλίνουν — δηλαδή θα ήταν πράσινες
 * ακριβώς την ημέρα που η οθόνη διαφωνεί με τον διακομιστή.
 *
 * Ο πίνακας **Γ** παίρνει **ένα** σχήμα εισόδου, το εκφράζει στα δύο μοντέλα, και
 * απαιτεί **ταυτόσημη** ετυμηγορία. Ό,τι διαφέρει, διαφέρει **επειδή δηλώθηκε** —
 * και αυτό το φυλάει ο πίνακας **Π**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΜΕΤΑΛΛΑΞΕΩΝ — ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Μετάλλαξη | Πρέπει να κοκκινίσει |
 * |---|---|
 * | `intervalsOverlap`: `<` → `<=` | **Δ1** (διαδοχή) |
 * | `sameHolder` αγνοείται (πάντα `continue`) | **Π2** (κράτηση ίδιου επισκέπτη) |
 * | `sameHolder` αγνοείται (ποτέ `continue`) | **Π1** (ανανέωση εντολής) |
 * | `resourcesIntersect` → **ισότητα** `spaceId` | **Χ1** (ολόκληρο ∩ δωμάτιο) |
 * | `resourcesIntersect` → αγνοεί `propertyId` | **Χ4** (δύο ακίνητα) |
 * | `contestedResource` → ο ευρύτερος | **Χ2** (η σύγκρουση **με όνομα**) |
 * | `occupancyId` αγνοείται | **Τ1** (κράτηση vs ο εαυτός της) |
 * | `overlaps === null` → `continue` | **Γ7/Γ9** (βλάβη ⇒ `undetermined`) |
 * | `modesCompatible` → πάντα `true` | **Γ** (κάθε γραμμή `conflicts`) |
 *
 * **Εκτελέστηκαν 15 μεταλλάξεις, σκοτώθηκαν 14** *(508 έλεγχοι στον κύκλο)*.
 *
 * ⚠️ **Μία ΕΠΕΖΗΣΕ, και ελέγχθηκε — είναι ΙΣΟΔΥΝΑΜΗ, όχι κενό κάλυψης.** Το
 * `wholeProperty(ROOT, scope)` του `mandate-conflict.ts` αντικαταστάθηκε με
 * `spaceId: 'x'`: **μηδέν κόκκινα**. Και σωστά — **όλες** οι εντολές γράφουν τον ίδιο
 * χώρο, άρα `'x' ∩ 'x'` συμπεριφέρεται όπως `null ∩ null`, και ο `MandateConflict`
 * **ξεντύνει** τον πόρο πίσω σε σκέτη πράξη, δηλαδή το `spaceId` δεν φτάνει ποτέ σε
 * παρατηρητή.
 *
 * 🔴 **ΠΟΤΕ ΠΑΥΕΙ ΝΑ ΕΙΝΑΙ ΙΣΟΔΥΝΑΜΗ — γραμμένο ώστε να μην ξαναβρεθεί με κόπο**: την
 * ημέρα που **εντολή και κράτηση θα κριθούν ΜΑΖΙ** (§4.7 · Φ2β `StayManagementGrant`).
 * Τότε μια εντολή με `spaceId: 'x'` **δεν** θα έτεμνε κράτηση δωματίου, και μια εντολή
 * που καλύπτει ολόκληρο το ακίνητο θα φαινόταν να μην το καλύπτει. Ο μπαλαντέρ είναι
 * **σωστός σήμερα και αναγκαίος αύριο**.
 */

import { intervalShape } from '@/lib/date-local';
import {
  MANDATE_OCCUPANCY_POLICY,
  mandateConflicts,
  type MandateOccupancy,
} from '@/lib/mandate/mandate-conflict';
import {
  EXISTING_IS_EXCLUSIVE,
  occupancyConflicts,
  type Occupancy,
} from '@/lib/occupancy/occupancy-conflict';
import { STAY_OCCUPANCY_POLICY, stayConflicts } from '@/lib/stay/stay-conflict';
import { EXCLUSIVE_RIGHT_TO_LEASE, OPEN_LISTING } from '@/types/listing-agreement';
import {
  occupyingStays,
  stayOccupancyOf,
  type StayBooking,
  type StaySpaceRef,
} from '@/types/stay-booking';

// =============================================================================
// ΤΟ ΚΟΙΝΟ ΣΧΗΜΑ ΕΙΣΟΔΟΥ — ό,τι μπορούν να πουν **και τα δύο** μοντέλα
// =============================================================================

/**
 * Ό,τι εκφράζεται **και** ως εντολή **και** ως κράτηση: ποιος κρατά, από πότε ως πότε.
 *
 * ⚠️ **Οι χώροι λείπουν επίτηδες.** Μια εντολή μεσιτείας αφορά **πάντα** ολόκληρο το
 * ακίνητο (§4.12), άρα «δωμάτιο Α» δεν είναι κοινό σχήμα — είναι **επέκταση**, και
 * δοκιμάζεται στον πίνακα **Χ**, μόνο στις κρατήσεις.
 */
interface Spec {
  readonly holder: string;
  readonly from: string;
  readonly to: string;
}

const HOLDER_A = 'comp_aaaaaaaa';
const HOLDER_B = 'comp_bbbbbbbb';
const PROPERTY = 'ownp_nafplio01';

/** 10 → 17 Αυγούστου 2027. Το **προεπιλεγμένο** παράθυρο. */
const AUG_10 = '2027-08-10';
const AUG_12 = '2027-08-12';
const AUG_14 = '2027-08-14';
const AUG_17 = '2027-08-17';
const AUG_20 = '2027-08-20';

type Verdict = 'clear' | 'conflicts' | 'undetermined';

/** Ένα **πεδίο**: πώς γράφεται η κατάληψη εκεί, και ποιος τη ρωτά. */
interface Field {
  readonly name: string;
  readonly judge: (candidate: Spec, existing: readonly Spec[]) => Verdict;
}

function mandateOf(spec: Spec): MandateOccupancy {
  return {
    agencyCompanyId: spec.holder,
    // 🔑 **Αποκλειστική**, ώστε ο τρόπος να ταιριάζει με τον `exclusive` της κράτησης.
    //    Ο πίνακας συμβατότητας δοκιμάζεται χωριστά (ADR-832 §6, πίνακας Τ).
    agreement: EXCLUSIVE_RIGHT_TO_LEASE,
    scope: ['leaseShort'],
    startsAt: spec.from,
    expiresAt: spec.to,
  };
}

function bookingOf(
  spec: Spec,
  over: Partial<StayBooking> = {},
): StayBooking {
  return {
    id: `stay_${spec.holder}_${spec.from}_${spec.to}`,
    propertyId: PROPERTY,
    offerKind: 'leaseShort',
    covers: [{ propertyId: PROPERTY, spaceId: null }],
    checkIn: spec.from,
    checkOut: spec.to,
    holderUserId: spec.holder,
    guests: 2,
    lifecycle: 'confirmed',
    riskDisclosedAt: null,
    createdAt: '2027-01-01T00:00:00.000Z',
    updatedAt: '2027-01-01T00:00:00.000Z',
    ...over,
  };
}

const FIELDS: readonly Field[] = [
  {
    name: 'εντολή μεσίτη (ADR-832)',
    judge: (candidate, existing) =>
      mandateConflicts(mandateOf(candidate), existing.map(mandateOf)).kind,
  },
  {
    name: 'κράτηση διαμονής (ADR-835)',
    judge: (candidate, existing) =>
      stayConflicts(bookingOf(candidate), existing.map((s) => bookingOf(s))).kind,
  },
];

// =============================================================================
// Γ — ΤΟ ΙΔΙΟ ΣΧΗΜΑ ΕΙΣΟΔΟΥ ⇒ Η ΙΔΙΑ ΕΤΥΜΗΓΟΡΙΑ, ΚΑΙ ΣΤΑ ΔΥΟ ΠΕΔΙΑ
// =============================================================================

describe.each(FIELDS)('🔴 Γ — ο ΙΔΙΟΣ κριτής στο πεδίο: $name', (field) => {
  const cases: readonly (readonly [string, Spec, readonly Spec[], Verdict])[] = [
    [
      'Γ1. κανείς δεν κρατά ⇒ καθαρό (ο παρονομαστής — χωρίς αυτό, κριτής που απορρίπτει τα πάντα περνά)',
      { holder: HOLDER_A, from: AUG_10, to: AUG_17 },
      [],
      'clear',
    ],
    [
      'Γ2. άλλος κάτοχος, ΙΔΙΕΣ μέρες ⇒ σύγκρουση',
      { holder: HOLDER_B, from: AUG_10, to: AUG_17 },
      [{ holder: HOLDER_A, from: AUG_10, to: AUG_17 }],
      'conflicts',
    ],
    [
      'Γ3. άλλος κάτοχος, ΕΠΙΚΑΛΥΨΗ στη μέση ⇒ σύγκρουση',
      { holder: HOLDER_B, from: AUG_12, to: AUG_20 },
      [{ holder: HOLDER_A, from: AUG_10, to: AUG_17 }],
      'conflicts',
    ],
    [
      'Γ4. άλλος κάτοχος, ΞΕΝΑ διαστήματα ⇒ καθαρό',
      { holder: HOLDER_B, from: AUG_17, to: AUG_20 },
      [{ holder: HOLDER_A, from: AUG_10, to: AUG_14 }],
      'clear',
    ],
    [
      'Γ5. ΤΡΕΙΣ κάτοχοι, όλοι επικαλύπτονται ⇒ σύγκρουση (και ΟΛΕΣ — δες Γ6)',
      { holder: 'comp_zzzzzzzz', from: AUG_10, to: AUG_17 },
      [
        { holder: HOLDER_A, from: AUG_10, to: AUG_12 },
        { holder: HOLDER_B, from: AUG_14, to: AUG_20 },
      ],
      'conflicts',
    ],
    [
      '🔴 Γ7. ΜΗ ΑΝΑΓΝΩΣΙΜΗ ημερομηνία ⇒ `undetermined`, ΠΟΤΕ «καθαρό» (N.12)',
      { holder: HOLDER_B, from: AUG_10, to: AUG_17 },
      [{ holder: HOLDER_A, from: 'οχι-ημερομηνια', to: AUG_17 }],
      'undetermined',
    ],
    [
      '🔑 Γ8. Η ΑΠΟΔΕΙΓΜΕΝΗ σύγκρουση νικά τη βλάβη — απόδειξη, όχι εικασία',
      { holder: 'comp_zzzzzzzz', from: AUG_10, to: AUG_17 },
      [
        { holder: HOLDER_A, from: 'χαλασμενο', to: AUG_17 },
        { holder: HOLDER_B, from: AUG_10, to: AUG_17 },
      ],
      'conflicts',
    ],
    [
      '🔴 Γ9. ΑΝΑΠΟΔΟ διάστημα ⇒ `undetermined` — δεν περιγράφει διάστημα, δεν κρίνεται σιωπηλά',
      { holder: HOLDER_B, from: AUG_10, to: AUG_17 },
      [{ holder: HOLDER_A, from: AUG_17, to: AUG_10 }],
      'undetermined',
    ],
  ];

  it.each(cases)('%s', (_name, candidate, existing, expected) => {
    expect(field.judge(candidate, existing)).toBe(expected);
  });

  it('Γ6. ΟΛΕΣ οι συγκρούσεις, ποτέ η πρώτη — αλλιώς ο άνθρωπος τις συναντά μία-μία', () => {
    const candidate: Spec = { holder: 'comp_zzzzzzzz', from: AUG_10, to: AUG_17 };
    const existing: readonly Spec[] = [
      { holder: HOLDER_A, from: AUG_10, to: AUG_12 },
      { holder: HOLDER_B, from: AUG_14, to: AUG_20 },
    ];

    // Το πλήθος διαβάζεται από το **γενικό** σχήμα, ώστε η άγκυρα να μη γνωρίζει
    // ποιο πεδίο τρέχει — δηλαδή να μην μπορεί να περάσει «κατά λάθος» στο ένα.
    const verdict =
      field.name.includes('εντολή')
        ? mandateConflicts(mandateOf(candidate), existing.map(mandateOf))
        : stayConflicts(bookingOf(candidate), existing.map((s) => bookingOf(s)));

    if (verdict.kind !== 'conflicts') throw new Error('αναμενόταν συγκρούσεις');
    expect(verdict.conflicts).toHaveLength(2);
  });
});

// =============================================================================
// Δ — Η ΔΙΑΔΟΧΗ (μετάλλαξη `<` → `<=` ΠΡΕΠΕΙ να κοκκινίσει)
// =============================================================================

describe('🔴 Δ — η μέρα αναχώρησης ΕΙΝΑΙ μέρα άφιξης του επόμενου', () => {
  it.each(FIELDS)(
    'Δ1. [$name] `checkOut === checkIn` επόμενης ⇒ ΚΑΘΑΡΟ — ημι-ανοιχτό `[από, ως)`',
    (field) => {
      expect(
        field.judge({ holder: HOLDER_B, from: AUG_17, to: AUG_20 }, [
          { holder: HOLDER_A, from: AUG_10, to: AUG_17 },
        ]),
      ).toBe('clear');
    },
  );

  it('🔑 Δ2. Ο παρονομαστής της Δ1: ΜΙΑ μέρα νωρίτερα ΣΥΓΚΡΟΥΕΤΑΙ', () => {
    // Χωρίς αυτό, η Δ1 θα ήταν πράσινη και με κριτή που αγνοεί τελείως τον χρόνο.
    expect(
      stayConflicts(bookingOf({ holder: HOLDER_B, from: AUG_14, to: AUG_20 }), [
        bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }),
      ]).kind,
    ).toBe('conflicts');
  });
});

// =============================================================================
// Π — Η ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΚΑΤΟΧΟΥ: **η μία γενίκευση**
// =============================================================================

describe('🔴 Π — ο ΙΔΙΟΣ κάτοχος: αντικαθιστά (εντολή) ή συγκρούεται (κράτηση);', () => {
  /** Ο **ίδιος** κάτοχος, **επικαλυπτόμενα** διαστήματα. Ένα σχήμα, δύο απαντήσεις. */
  const SAME_HOLDER: Spec = { holder: HOLDER_A, from: AUG_12, to: AUG_20 };
  const EXISTING: readonly Spec[] = [{ holder: HOLDER_A, from: AUG_10, to: AUG_17 }];

  it('Π1. ΕΝΤΟΛΗ ⇒ `clear` — νέοι όροι προς το ίδιο γραφείο είναι ΑΝΑΝΕΩΣΗ', () => {
    // Χωρίς αυτό, κάθε ανανέωση αποκλειστικής θα μπλόκαρε στην ίδια της την προηγούμενη.
    expect(mandateConflicts(mandateOf(SAME_HOLDER), EXISTING.map(mandateOf)).kind).toBe(
      'clear',
    );
  });

  it('🔴 Π2. ΚΡΑΤΗΣΗ ⇒ `conflicts` — δύο διαμονές είναι ΔΥΟ ΔΙΑΜΟΝΕΣ', () => {
    // Ο ίδιος επισκέπτης δεν «αντικαθιστά» τη διαμονή του κρατώντας δεύτερη πάνω της.
    // Χωρίς αυτό: **σιωπηλή διπλοκράτηση από τον ίδιο άνθρωπο**.
    expect(
      stayConflicts(
        bookingOf(SAME_HOLDER),
        EXISTING.map((s) => bookingOf(s)),
      ).kind,
    ).toBe('conflicts');
  });

  it('🔴 Π3. ΕΝΑΣ ΚΟΙΝΟΣ ΚΑΝΟΝΑΣ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΠΕΡΑΣΕΙ ΚΑΙ ΤΑ ΔΥΟ — εκτελεσμένο', () => {
    // Η Π1 και η Π2 δίνουν **αντίθετες** απαντήσεις στο **ίδιο** σχήμα εισόδου. Άρα ο
    // κριτής ΔΕΝ μπορεί να έχει σιωπηλό κανόνα: η διαφορά είναι **δηλωμένη**, ή δεν
    // υπάρχει. Αυτή η άγκυρα το λέει ρητά, ώστε μια «απλοποίηση» να το ανατρέψει.
    expect(MANDATE_OCCUPANCY_POLICY.sameHolder).toBe('replaces');
    expect(STAY_OCCUPANCY_POLICY.sameHolder).toBe('conflicts');
    expect(MANDATE_OCCUPANCY_POLICY.sameHolder).not.toBe(
      STAY_OCCUPANCY_POLICY.sameHolder,
    );
  });
});

// =============================================================================
// Χ — Ο ΠΟΡΟΣ ΩΣ ΣΥΝΟΛΟ ΧΩΡΩΝ: **η δεύτερη γενίκευση** (§4.12)
// =============================================================================

describe('🔴 Χ — ο πόρος είναι ΣΥΝΟΛΟ ΧΩΡΩΝ: τομή, όχι ισότητα', () => {
  const WHOLE: StaySpaceRef = { propertyId: PROPERTY, spaceId: null };
  const ROOM_A: StaySpaceRef = { propertyId: PROPERTY, spaceId: 'room-a' };
  const ROOM_B: StaySpaceRef = { propertyId: PROPERTY, spaceId: 'room-b' };

  /** Κράτηση με **δηλωμένους** χώρους. */
  const staying = (spec: Spec, covers: readonly StaySpaceRef[]): StayBooking =>
    bookingOf(spec, { covers });

  it('🔴 Χ1. ΟΛΟΚΛΗΡΟ 10–17 + ΔΩΜΑΤΙΟ Α 12–14 ⇒ ΣΥΓΚΡΟΥΣΗ (με ισότητα θα ήταν «clear»)', () => {
    // Το σενάριο του §4.12 κατά λέξη: δύο οικογένειες στην πόρτα.
    const verdict = stayConflicts(
      staying({ holder: HOLDER_B, from: AUG_12, to: AUG_14 }, [ROOM_A]),
      [staying({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, [WHOLE])],
    );

    expect(verdict.kind).toBe('conflicts');
  });

  it('🔴 Χ2. Η σύγκρουση έχει ΟΝΟΜΑ: ποιος χώρος, από ποιον, ως πότε', () => {
    const verdict = stayConflicts(
      staying({ holder: HOLDER_B, from: AUG_12, to: AUG_14 }, [ROOM_A]),
      [staying({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, [WHOLE])],
    );

    if (verdict.kind !== 'conflicts') throw new Error('αναμενόταν σύγκρουση');
    const [conflict] = verdict.conflicts;

    // 🔑 Ο **στενότερος** των δύο: ο άνθρωπος ζήτησε δωμάτιο, όχι ακίνητο.
    expect(conflict?.resource.spaceId).toBe('room-a');
    expect(conflict?.resource.kind).toBe('leaseShort');
    expect(conflict?.reason).toBe(EXISTING_IS_EXCLUSIVE);
    // «Ως πότε» — η κατάληψη που εμποδίζει ταξιδεύει ολόκληρη.
    expect(conflict?.with.source.checkOut).toBe(AUG_17);
    expect(conflict?.with.source.holderUserId).toBe(HOLDER_A);
  });

  it('🔑 Χ3. ΔΩΜΑΤΙΟ Α + ΔΩΜΑΤΙΟ Β, ίδιες μέρες ⇒ ΚΑΘΑΡΟ — αλλιώς η τομή θα ήταν «πάντα»', () => {
    // Ο παρονομαστής της Χ1: η σχέση **δεν** είναι «όλα με όλα».
    expect(
      stayConflicts(staying({ holder: HOLDER_B, from: AUG_10, to: AUG_17 }, [ROOM_B]), [
        staying({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, [ROOM_A]),
      ]).kind,
    ).toBe('clear');
  });

  it('🔴 Χ4. ΟΛΟΚΛΗΡΟ σε ΑΛΛΟ ακίνητο ⇒ ΚΑΘΑΡΟ — το μπαλαντέρ έχει σύνορο', () => {
    // Χωρίς `propertyId` στον πόρο, `null ∩ null` θα συγκρουόταν σε ΟΛΟΚΛΗΡΟ τον
    // κατάλογο: κάθε κράτηση ολόκληρου θα έκλεινε κάθε άλλο ακίνητο.
    const other: StaySpaceRef = { propertyId: 'ownp_alloakinito', spaceId: null };

    expect(
      stayConflicts(staying({ holder: HOLDER_B, from: AUG_10, to: AUG_17 }, [other]), [
        staying({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, [WHOLE]),
      ]).kind,
    ).toBe('clear');
  });

  it('Χ5. ΟΛΟΚΛΗΡΟ vs ΔΥΟ δωμάτια ⇒ ΔΥΟ εγγραφές, μία ανά χώρο', () => {
    // «Εμποδίζεσαι στο Α αλλά όχι στο Β» είναι πληροφορία — μία «γενική» τη σβήνει.
    const verdict = stayConflicts(
      staying({ holder: HOLDER_B, from: AUG_10, to: AUG_17 }, [WHOLE]),
      [
        staying({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, [ROOM_A]),
        staying({ holder: 'comp_cccccccc', from: AUG_10, to: AUG_17 }, [ROOM_B]),
      ],
    );

    if (verdict.kind !== 'conflicts') throw new Error('αναμενόταν συγκρούσεις');
    expect(verdict.conflicts.map((c) => c.resource.spaceId).sort()).toEqual([
      'room-a',
      'room-b',
    ]);
  });

  it('Χ6. ΚΕΝΟ σύνολο χώρων δεν καταλαμβάνει τίποτα', () => {
    expect(
      stayConflicts(staying({ holder: HOLDER_B, from: AUG_10, to: AUG_17 }, []), [
        staying({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, [WHOLE]),
      ]).kind,
    ).toBe('clear');
  });

  it('Χ7. ΑΛΛΗ ΠΡΑΞΗ στον ίδιο χώρο ⇒ καθαρό — ο πόρος είναι (χώρος × ΠΡΑΞΗ)', () => {
    // Μια εντολή **πώλησης** δεν εμποδίζει διανυκτέρευση: άλλο «περιεχόμενο» (άρθρο 200 §4).
    const sale: Occupancy<string> = {
      occupancyId: null,
      holderId: HOLDER_A,
      mode: 'exclusive',
      resources: [{ propertyId: PROPERTY, spaceId: null, kind: 'sell' }],
      startsAt: AUG_10,
      expiresAt: AUG_17,
      source: 'πώληση',
    };
    const stay: Occupancy<string> = {
      occupancyId: null,
      holderId: HOLDER_B,
      mode: 'exclusive',
      resources: [{ propertyId: PROPERTY, spaceId: null, kind: 'leaseShort' }],
      startsAt: AUG_10,
      expiresAt: AUG_17,
      source: 'διαμονή',
    };

    expect(occupancyConflicts(stay, [sale], STAY_OCCUPANCY_POLICY).kind).toBe('clear');
  });
});

// =============================================================================
// Τ — Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΕΓΓΡΑΦΗΣ (≠ ταυτότητα κατόχου)
// =============================================================================

describe('🔴 Τ — τίποτα δεν συγκρούεται με τον ΕΑΥΤΟ του', () => {
  it('Τ1. Η ίδια κράτηση μέσα στο σύνολο των υπαρχουσών ⇒ ΚΑΘΑΡΟ', () => {
    // Με `sameHolder: "conflicts"` και χωρίς ταυτότητα, η επανεπιβεβαίωση μιας
    // κράτησης θα απορριπτόταν **επειδή υπάρχει**.
    const booking = bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 });

    expect(stayConflicts(booking, [booking]).kind).toBe('clear');
  });

  it('🔑 Τ2. ΔΥΟ ΑΓΝΩΣΤΕΣ ταυτότητες (`null`) ΔΕΝ είναι «η ίδια» — N.12', () => {
    // Οι εντολές δεν έχουν ταυτότητα. Αν το `null === null` μετρούσε ως ταυτότητα,
    // **καμία** εντολή δεν θα συγκρουόταν ποτέ με καμία.
    expect(
      mandateConflicts(mandateOf({ holder: HOLDER_B, from: AUG_10, to: AUG_17 }), [
        mandateOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }),
      ]).kind,
    ).toBe('conflicts');
  });

  it('Τ3. ΑΛΛΗ ταυτότητα, ίδιος κάτοχος, ίδιες μέρες ⇒ σύγκρουση (ο παρονομαστής της Τ1)', () => {
    const first = bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 });
    const second = { ...first, id: 'stay_deytero' };

    expect(stayConflicts(second, [first]).kind).toBe('conflicts');
  });
});

// =============================================================================
// Ο — ΤΑ ΟΡΙΑ ΠΟΥ ΔΗΛΩΝΟΝΤΑΙ, ΩΣΤΕ ΝΑ ΜΗΝ ΕΙΝΑΙ ΑΤΥΧΗΜΑ
// =============================================================================

describe('Ο — δηλωμένα όρια', () => {
  it('🔴 Ο1. ΜΗΔΕΝ νύχτες καταλαμβάνουν ΤΙΠΟΤΑ — ΣΥΝΕΠΩΣ, σε κάθε θέση (Ε-10)', () => {
    // 🔴 **ΙΣΤΟΡΙΚΟ**: ως 2026-08-31 αυτή η άγκυρα κατέγραφε **ασυνέπεια** — η ίδια
    //    μηδενική διαμονή συγκρουόταν όταν έπεφτε ΜΕΣΑ σε άλλη και όχι όταν έπεφτε
    //    στην ΑΚΡΗ της, γιατί ο τελεστής είχε τον τύπο του Joda-Time. Το **Ε-10**
    //    το έκλεισε: το κενό σύνολο **δεν τέμνει τίποτα** (θεωρία συνόλων · PostgreSQL
    //    `empty && x = false`). Οι τρεις θέσεις μαζί είναι ο κανόνας.
    const zeroNight = { holder: HOLDER_B, from: AUG_12, to: AUG_12 };

    for (const existing of [
      { holder: HOLDER_A, from: AUG_10, to: AUG_17 }, // ΜΕΣΑ  — η θέση που ήταν λάθος
      { holder: HOLDER_A, from: AUG_12, to: AUG_17 }, // ΑΡΧΗ
      { holder: HOLDER_A, from: AUG_10, to: AUG_12 }, // ΤΕΛΟΣ
    ]) {
      expect(stayConflicts(bookingOf(zeroNight), [bookingOf(existing)]).kind).toBe(
        'clear',
      );
    }

    // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: **μία** νύχτα συγκρούεται κανονικά. Χωρίς αυτό, κριτής που
    //    απαντά «καθαρό» σε όλα θα περνούσε τον βρόχο παραπάνω.
    expect(
      stayConflicts(bookingOf({ holder: HOLDER_B, from: AUG_12, to: AUG_14 }), [
        bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }),
      ]).kind,
    ).toBe('conflicts');
  });

  it('🔴 Ο1α. …και ΑΚΡΙΒΩΣ γι\' αυτό το κενό πρέπει να το πιάνει ΑΛΛΟΣ φρουρός', () => {
    // ⚠️ Η συνέπεια έχει τίμημα: «καθαρό» για μηδενική διαμονή είναι **σωστό** και
    //    **άχρηστο** — κανείς δεν ρώτησε τίποτα. Γι' αυτό το `intervalShape` δίνει
    //    ΟΝΟΜΑ στο σχήμα, και ο τομέας το κάνει παραβίαση: οι εντολές το κάνουν ήδη
    //    (`mandate-term-empty`), οι κρατήσεις στη ροή αιτήματος (Φ5).
    expect(intervalShape(AUG_12, AUG_12)).toBe('empty');
    expect(intervalShape(AUG_12, AUG_14)).toBe('proper');
  });

  it('🔴 Ο2. Το `requested` ΔΕΝ καταλαμβάνει — και το φιλτράρει ο ΚΑΛΩΝ', () => {
    // Αν καταλάμβανε, κακόβουλος «κλειδώνει» ολόκληρο καλοκαίρι με αιτήματα (§6.1).
    const requested = bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, {
      lifecycle: 'requested',
    });
    const candidate = bookingOf({ holder: HOLDER_B, from: AUG_10, to: AUG_17 });

    expect(occupyingStays([requested])).toHaveLength(0);
    expect(stayConflicts(candidate, occupyingStays([requested])).kind).toBe('clear');

    // 🔑 Ο παρονομαστής: **αφιλτράριστο** το ίδιο αίτημα ΣΥΓΚΡΟΥΕΤΑΙ. Δηλαδή το
    //    φίλτρο κάνει δουλειά, και η παράλειψή του έχει συνέπεια.
    expect(stayConflicts(candidate, [requested]).kind).toBe('conflicts');
  });

  it('Ο3. `cancelled` δεν καταλαμβάνει · `completed` ΚΑΤΑΛΑΜΒΑΝΕΙ', () => {
    // Μια διαμονή που **έγινε** κρατά τις νύχτες της: αλλιώς το ιστορικό θα επέτρεπε
    // αναδρομική διπλοκράτηση.
    const cancelled = bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, {
      lifecycle: 'cancelled',
    });
    const completed = bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 }, {
      lifecycle: 'completed',
      id: 'stay_completed',
    });

    expect(occupyingStays([cancelled, completed]).map((b) => b.lifecycle)).toEqual([
      'completed',
    ]);
  });

  it('🔑 Ο4. Η μετάφραση κράτησης→κατάληψης είναι ΠΙΣΤΗ — αλλιώς ο κριτής κρίνει άλλο πράγμα', () => {
    const booking = bookingOf({ holder: HOLDER_A, from: AUG_10, to: AUG_17 });
    const occupancy = stayOccupancyOf(booking);

    expect(occupancy.occupancyId).toBe(booking.id);
    expect(occupancy.holderId).toBe(HOLDER_A);
    expect(occupancy.mode).toBe('exclusive');
    expect(occupancy.startsAt).toBe(AUG_10);
    expect(occupancy.expiresAt).toBe(AUG_17);
    expect(occupancy.resources).toEqual([
      { propertyId: PROPERTY, spaceId: null, kind: 'leaseShort' },
    ]);
    expect(occupancy.source).toBe(booking);
  });

  it('Ο5. Ο ΤΡΟΠΟΣ μετράει ακόμη: δύο ΑΠΛΕΣ εντολές χωράνε, μία αποκλειστική όχι', () => {
    // Το τρίτο σκέλος δεν χάθηκε στη γενίκευση — και η κράτηση δεν το χρειάζεται
    // μόνο επειδή ζει ολόκληρη στο `exclusive`.
    const open = (holder: string): MandateOccupancy => ({
      ...mandateOf({ holder, from: AUG_10, to: AUG_17 }),
      agreement: OPEN_LISTING,
    });

    expect(mandateConflicts(open(HOLDER_B), [open(HOLDER_A)]).kind).toBe('clear');
    expect(
      mandateConflicts(mandateOf({ holder: HOLDER_B, from: AUG_10, to: AUG_17 }), [
        open(HOLDER_A),
      ]).kind,
    ).toBe('conflicts');
  });
});
