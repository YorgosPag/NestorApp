/**
 * @fileoverview **Ο ΧΡΟΝΟΣ ΓΙΝΕΤΑΙ ΟΡΑΤΟΣ** — οι άγκυρες της Φ3 (ADR-835).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΚΑΘΕ ΣΚΕΛΟΣ ΕΧΕΙ ΠΑΡΟΝΟΜΑΣΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το handoff της Φ2 κατέγραψε ως **μετρημένη παγίδα**: *«Άγκυρα με ΕΝΑ σκέλος. Μια
 * δοκιμή που ελέγχει μόνο τη “μία θέση” περνά και με λάθος υλοποίηση. **Κάθε σκέλος
 * θέλει δικό του αρνητικό παράδειγμα (παρονομαστή).**»*
 *
 * Άρα κάθε ομάδα εδώ έχει **και** την περίπτωση που ΠΡΕΠΕΙ να συμβεί **και** εκείνη
 * που ΔΕΝ πρέπει — αλλιώς ένα `return { kind: 'free' }` θα περνούσε τα μισά.
 */

import {
  stayAvailabilityFor,
  saleExposureOf,
} from '@/lib/stay/stay-availability';
import { freeRunsWithin } from '@/lib/stay/stay-free-runs';
import {
  STAY_AVAILABILITY_KINDS,
  STAYABLE_AVAILABILITY_KINDS,
  isStayable,
  type StayCalendar,
  type StayQuery,
} from '@/lib/stay/stay-availability-vocabulary';
import type { Occupancy } from '@/lib/occupancy/occupancy-conflict';
import type { OfferKind } from '@/types/property-offers';
import type { PublicListing, PublicListingStay } from '@/types/public-listing';

// =============================================================================
// ΣΚΗΝΙΚΟ
// =============================================================================

const PROPERTY = 'prop_kalymma_1';

function listingOf(
  offerKinds: readonly OfferKind[],
  stay: PublicListingStay | null,
): PublicListing {
  return {
    id: PROPERTY,
    commercialStatus: 'for-rent',
    commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: 80 },
    stay,
    coverImage: null,
    type: 'apartment',
    areaSqm: 60,
    offerKinds,
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: 1,
    bedrooms: 2,
    authorship: 'owner-declared',
    agencyName: null,
    agencyId: null,
    title: 'Κατάλυμα',
    legality: [],
    projectedAt: '2026-08-01T00:00:00.000Z',
  } as PublicListing;
}

const STAY_TERMS: PublicListingStay = { minNights: null, maxGuests: 4, nextAvailableFrom: null };

/** Ένα κατάλυμα με δηλωμένους όρους — η βάση των περισσότερων ομάδων. */
const CALYMMA = listingOf(['leaseShort'], STAY_TERMS);

/** Μια κράτηση ως κατάληψη, χωρίς να χρειάζεται ολόκληρο `StayBooking`. */
function booking(id: string, from: string, to: string | null, spaceId: string | null = null): Occupancy<string> {
  return {
    occupancyId: id,
    holderId: `guest_${id}`,
    mode: 'exclusive',
    resources: [{ propertyId: PROPERTY, spaceId, kind: 'leaseShort' }],
    startsAt: from,
    expiresAt: to,
    source: id,
  };
}

const QUERY: StayQuery = { checkIn: '2026-08-10', checkOut: '2026-08-17', guests: 2 };
const DECLARED = (occupied: readonly Occupancy<string>[]): StayCalendar<string> => ({
  kind: 'declared',
  occupied,
});
const UNDECLARED: StayCalendar<string> = { kind: 'undeclared' };

// =============================================================================
// Α — ΤΟ ΛΕΞΙΛΟΓΙΟ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΚΑΙ ΠΛΗΡΕΣ
// =============================================================================

describe('Α — εννέα ονόματα, κανένα ορφανό', () => {
  it('το κλειστό σύνολο έχει ακριβώς εννέα τιμές, χωρίς διπλότυπα', () => {
    expect(STAY_AVAILABILITY_KINDS).toHaveLength(9);
    expect(new Set(STAY_AVAILABILITY_KINDS).size).toBe(9);
  });

  it('🔴 ΜΟΝΟ `free` και `conditional` επιτρέπουν διαμονή — και ΚΑΝΕΝΑ άλλο', () => {
    // Το θετικό σκέλος…
    for (const kind of STAYABLE_AVAILABILITY_KINDS) expect(isStayable(kind)).toBe(true);
    // …και ο **παρονομαστής**: κάθε άλλη τιμή οφείλει να είναι `false`. Χωρίς αυτό,
    // ένα `isStayable = () => true` θα περνούσε.
    const rest = STAY_AVAILABILITY_KINDS.filter(
      (k) => !(STAYABLE_AVAILABILITY_KINDS as readonly string[]).includes(k),
    );
    expect(rest).toHaveLength(7);
    for (const kind of rest) expect(isStayable(kind)).toBe(false);
  });
});

// =============================================================================
// Β — «ΔΕΝ ΕΙΝΑΙ ΚΑΤΑΛΥΜΑ» ΔΕΝ ΕΙΝΑΙ ΑΠΟΤΥΧΙΑ (και το `stay` είναι δεμένο)
// =============================================================================

describe('Β — ο δεσμός `leaseShort` ⇄ `stay`, ΚΑΙ ΠΡΟΣ ΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ', () => {
  it('χωρίς `leaseShort` ⇒ `not-a-stay`, ΠΟΤΕ «κρατημένο» και ΠΟΤΕ εξαφάνιση', () => {
    const forSale = listingOf(['sell'], null);
    expect(stayAvailabilityFor(forSale, QUERY, DECLARED([]), null).kind).toBe('not-a-stay');
  });

  it('🔴 με `leaseShort` ΔΕΝ είναι `not-a-stay` — ο παρονομαστής του από πάνω', () => {
    expect(stayAvailabilityFor(CALYMMA, QUERY, DECLARED([]), null).kind).not.toBe('not-a-stay');
  });

  it('🔴 `leaseShort` με `stay: null` ⇒ `not-a-stay` — δεδομένο ασύμβατο με τον εαυτό του', () => {
    // Δεν πρέπει να παραχθεί ποτέ από τον γραφέα (`projectStay` τα δένει), αλλά ένα
    // σιωπηλό «ελεύθερο» εδώ θα ήταν κατάλυμα **χωρίς όρους** που δέχεται κρατήσεις.
    const broken = listingOf(['leaseShort'], null);
    expect(stayAvailabilityFor(broken, QUERY, DECLARED([]), null).kind).toBe('not-a-stay');
  });
});

// =============================================================================
// Γ — ΟΙ ΟΡΟΙ ΚΡΙΝΟΝΤΑΙ ΠΡΙΝ ΤΟ ΗΜΕΡΟΛΟΓΙΟ, ΚΑΙ «ΔΕΝ ΞΕΡΩ» ≠ «ΔΕΝ ΧΩΡΑΕΙ»
// =============================================================================

describe('Γ — χωρητικότητα και ελάχιστες νύχτες', () => {
  it('ζητά περισσότερους από όσους χωράει ⇒ `over-capacity`, **με τον αριθμό**', () => {
    const answer = stayAvailabilityFor(CALYMMA, { ...QUERY, guests: 6 }, DECLARED([]), null);
    expect(answer).toEqual({ kind: 'over-capacity', maxGuests: 4, asked: 6 });
  });

  it('🔴 ίσα άτομα με τη χωρητικότητα ΧΩΡΑΕΙ — «και το ίσον;» (παγίδα Φ2 #3)', () => {
    expect(stayAvailabilityFor(CALYMMA, { ...QUERY, guests: 4 }, DECLARED([]), null).kind).toBe('free');
  });

  it('🔴 αδήλωτη χωρητικότητα ⇒ `terms-unknown`, ΟΥΤΕ «χωράει» ΟΥΤΕ «δεν χωράει»', () => {
    const mute = listingOf(['leaseShort'], { minNights: null, maxGuests: null, nextAvailableFrom: null });
    expect(stayAvailabilityFor(mute, { ...QUERY, guests: 2 }, DECLARED([]), null).kind).toBe('terms-unknown');
  });

  it('🔴 …αλλά αν ΔΕΝ ρωτήθηκαν άτομα, η αδήλωτη χωρητικότητα δεν εμποδίζει', () => {
    // Ο παρονομαστής του από πάνω: το `terms-unknown` δεν είναι «λείπει πεδίο», είναι
    // «λείπει πεδίο **που ρωτήθηκε**».
    const mute = listingOf(['leaseShort'], { minNights: null, maxGuests: null, nextAvailableFrom: null });
    expect(stayAvailabilityFor(mute, { ...QUERY, guests: null }, DECLARED([]), null).kind).toBe('free');
  });

  it('λιγότερες νύχτες από το ελάχιστο ⇒ `below-min-nights` με το «πόσο»', () => {
    const strict = listingOf(['leaseShort'], { minNights: 10, maxGuests: 4, nextAvailableFrom: null });
    expect(stayAvailabilityFor(strict, QUERY, DECLARED([]), null)).toEqual({
      kind: 'below-min-nights',
      minNights: 10,
      asked: 7,
    });
  });

  it('🔴 ακριβώς όσες το ελάχιστο ΠΕΡΝΑ — «και το ίσον;»', () => {
    const strict = listingOf(['leaseShort'], { minNights: 7, maxGuests: 4, nextAvailableFrom: null });
    expect(stayAvailabilityFor(strict, QUERY, DECLARED([]), null).kind).toBe('free');
  });

  it('🔴 `minNights: null` ΔΕΝ γίνεται 1 — δεν υποσχόμαστε εκ μέρους του κατόχου', () => {
    const oneNight: StayQuery = { checkIn: '2026-08-10', checkOut: '2026-08-11', guests: 2 };
    expect(stayAvailabilityFor(CALYMMA, oneNight, DECLARED([]), null).kind).toBe('free');
  });
});

// =============================================================================
// Δ — «ΑΔΗΛΩΤΟ ΗΜΕΡΟΛΟΓΙΟ» ΔΕΝ ΕΙΝΑΙ «ΕΛΕΥΘΕΡΟ» (§4.6)
// =============================================================================

describe('Δ — το κενό ημερολόγιο και το ΑΔΗΛΩΤΟ είναι ΔΥΟ πράγματα', () => {
  it('🔴 `undeclared` ⇒ `unknown` — ποτέ «ελεύθερο»', () => {
    expect(stayAvailabilityFor(CALYMMA, QUERY, UNDECLARED, null).kind).toBe('unknown');
  });

  it('🔴 `declared` με ΚΕΝΟ πίνακα ⇒ `free` — ο παρονομαστής, και όλη η διάκριση', () => {
    // Αν τα δύο ισοπεδώνονταν, το ένα από τα δύο θα ήταν ψέμα: είτε «ελεύθερο» για
    // κατάλυμα που κανείς δεν κοίταξε, είτε «δεν ξέρω» για κατάλυμα που ρωτήσαμε.
    expect(stayAvailabilityFor(CALYMMA, QUERY, DECLARED([]), null).kind).toBe('free');
  });
});

// =============================================================================
// Ε — Ο ΚΡΙΤΗΣ ΚΑΛΕΙΤΑΙ ΑΥΤΟΥΣΙΟΣ, ΚΑΙ ΤΑ ΑΚΡΑ ΤΟΥ ΤΗΡΟΥΝΤΑΙ
// =============================================================================

describe('Ε — η κατάληψη κρίνεται από τον ΕΝΑΝ κριτή', () => {
  it('κράτηση μέσα στο παράθυρο ⇒ `occupied`', () => {
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', '2026-08-12', '2026-08-14')]), null);
    expect(answer.kind).toBe('occupied');
  });

  it('🔴 Η ΔΙΑΔΟΧΗ ΔΕΝ ΕΙΝΑΙ ΣΥΓΚΡΟΥΣΗ — κράτηση που ΛΗΓΕΙ την ημέρα άφιξης', () => {
    // Ημι-ανοιχτό `[in, out)`: η μέρα αναχώρησης ΕΙΝΑΙ μέρα άφιξης του επόμενου
    // (§16 · 832 §5.2). Ένα `<=` στον κριτή θα υποχρέωνε κενή νύχτα ανάμεσα.
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', '2026-08-03', '2026-08-10')]), null);
    expect(answer.kind).toBe('free');
  });

  it('🔴 …και η ΑΝΤΙΣΤΡΟΦΗ διαδοχή: κράτηση που ΑΡΧΙΖΕΙ την ημέρα αναχώρησης', () => {
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', '2026-08-17', '2026-08-20')]), null);
    expect(answer.kind).toBe('free');
  });

  it('🔴 ΚΡΑΤΗΣΗ ΔΩΜΑΤΙΟΥ ΕΜΠΟΔΙΖΕΙ ΤΟ «ΟΛΟΚΛΗΡΟ» (§4.12 — τομή, όχι ισότητα)', () => {
    const answer = stayAvailabilityFor(
      CALYMMA,
      QUERY,
      DECLARED([booking('b1', '2026-08-12', '2026-08-14', 'space_A')]),
      null,
    );
    expect(answer.kind).toBe('occupied');
  });

  it('🔴 κράτηση σε ΑΛΛΟ ακίνητο δεν εμποδίζει — ο παρονομαστής του πόρου', () => {
    const elsewhere: Occupancy<string> = {
      ...booking('b1', '2026-08-12', '2026-08-14'),
      resources: [{ propertyId: 'prop_allo', spaceId: null, kind: 'leaseShort' }],
    };
    expect(stayAvailabilityFor(CALYMMA, QUERY, DECLARED([elsewhere]), null).kind).toBe('free');
  });

  it('🔴 ΧΑΛΑΣΜΕΝΟ ημερολόγιο ⇒ `unreadable`, ΠΟΤΕ `free` (§6.4: «ελεύθερο εκεί ΕΙΝΑΙ το overbooking»)', () => {
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', 'ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ', '2026-08-14')]), null);
    expect(answer.kind).toBe('unreadable');
  });

  it('🔴 ΚΕΝΗ κατάληψη δεν τέμνει τίποτα (Ε-10) — `∅ ∩ X = ∅`', () => {
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', '2026-08-12', '2026-08-12')]), null);
    expect(answer.kind).toBe('free');
  });

  it('🔴 Ο ΙΔΙΟΣ ΚΑΤΟΧΟΣ ΣΥΓΚΡΟΥΕΤΑΙ — η πολιτική είναι `conflicts`, όχι `replaces`', () => {
    // Φυλάει τη σταθερά `ANONYMOUS_ENQUIRER`: αν η πολιτική γινόταν `'replaces'`, ένα
    // ερώτημα με κάτοχο που συμπίπτει θα «αντικαθιστούσε» υπαρκτή κράτηση.
    const same: Occupancy<string> = {
      ...booking('b1', '2026-08-12', '2026-08-14'),
      holderId: 'stay-availability-enquiry',
    };
    expect(stayAvailabilityFor(CALYMMA, QUERY, DECLARED([same]), null).kind).toBe('occupied');
  });
});

// =============================================================================
// ΣΤ — 🏆 Η ΔΙΕΞΟΔΟΣ: ΤΙ ΑΠΟΜΕΝΕΙ (το σημείο που η αγορά εξαφανίζει)
// =============================================================================

describe('ΣΤ — τα ελεύθερα υποδιαστήματα, που κανείς δεν δίνει', () => {
  it('🏆 κράτηση 12–14/08 μέσα σε αίτημα 10–17/08 ⇒ ΔΥΟ ελεύθερα κομμάτια', () => {
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', '2026-08-12', '2026-08-14')]), null);
    expect(answer).toEqual({
      kind: 'occupied',
      nextFreeFrom: '2026-08-14',
      freeRuns: [
        { from: '2026-08-10', to: '2026-08-12', nights: 2 },
        { from: '2026-08-14', to: '2026-08-17', nights: 3 },
      ],
    });
  });

  it('🔴 γεμάτο παράθυρο ⇒ ΚΑΝΕΝΑ κομμάτι — ο παρονομαστής του από πάνω', () => {
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', '2026-08-05', '2026-08-20')]), null);
    expect(answer).toEqual({ kind: 'occupied', nextFreeFrom: '2026-08-20', freeRuns: [] });
  });

  it('🔴 ΔΥΟ ΔΙΑΔΟΧΙΚΕΣ κρατήσεις δεν γεννούν κομμάτι ΜΗΔΕΝ νυχτών', () => {
    const runs = freeRunsWithin('2026-08-10', '2026-08-17', [
      booking('b1', '2026-08-11', '2026-08-13'),
      booking('b2', '2026-08-13', '2026-08-15'),
    ]);
    expect(runs).toEqual([
      { from: '2026-08-10', to: '2026-08-11', nights: 1 },
      { from: '2026-08-15', to: '2026-08-17', nights: 2 },
    ]);
  });

  it('🔴 ΕΠΙΚΑΛΥΠΤΟΜΕΝΕΣ κρατήσεις ενώνονται — ποτέ διπλομέτρηση', () => {
    const runs = freeRunsWithin('2026-08-10', '2026-08-20', [
      booking('b1', '2026-08-12', '2026-08-16'),
      booking('b2', '2026-08-14', '2026-08-18'),
    ]);
    expect(runs).toEqual([
      { from: '2026-08-10', to: '2026-08-12', nights: 2 },
      { from: '2026-08-18', to: '2026-08-20', nights: 2 },
    ]);
  });

  it('🔴 ΑΝΟΙΧΤΗ διάρκεια κόβει τα πάντα ως το τέλος, και `nextFreeFrom` είναι `null`', () => {
    const answer = stayAvailabilityFor(CALYMMA, QUERY, DECLARED([booking('b1', '2026-08-12', null)]), null);
    expect(answer).toEqual({
      kind: 'occupied',
      nextFreeFrom: null,
      freeRuns: [{ from: '2026-08-10', to: '2026-08-12', nights: 2 }],
    });
  });

  it('🔴 ΑΝΑΠΟΔΟ ζητούμενο ⇒ `null`, ΟΧΙ κενός πίνακας — «δεν κοίταξα» ≠ «τίποτα»', () => {
    expect(freeRunsWithin('2026-08-17', '2026-08-10', [])).toBeNull();
    expect(freeRunsWithin('2026-08-10', '2026-08-10', [])).toBeNull();
  });

  it('🔴 …ενώ ΓΝΗΣΙΟ ζητούμενο χωρίς καταλήψεις δίνει ΕΝΑ κομμάτι — ο παρονομαστής', () => {
    expect(freeRunsWithin('2026-08-10', '2026-08-17', [])).toEqual([
      { from: '2026-08-10', to: '2026-08-17', nights: 7 },
    ]);
  });

  it('🔴 μία αδιάβαστη κατάληψη μολύνει ΟΛΗ την απάντηση (fail-closed)', () => {
    const runs = freeRunsWithin('2026-08-10', '2026-08-17', [
      booking('b1', '2026-08-12', '2026-08-13'),
      booking('b2', 'ΣΚΟΥΠΙΔΙ', '2026-08-15'),
    ]);
    expect(runs).toBeNull();
  });
});

// =============================================================================
// Ζ — Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ ΔΕΝ ΙΣΟΠΕΔΩΝΕΤΑΙ (§4.7)
// =============================================================================

describe('Ζ — `conditional`: ούτε `free`, ούτε `occupied`', () => {
  const BOTH = listingOf(['sell', 'leaseShort'], STAY_TERMS);

  it('🔴 πώληση + βραχυχρόνια, ελεύθερες μέρες ⇒ `conditional` — ΟΧΙ `free`', () => {
    const answer = stayAvailabilityFor(BOTH, QUERY, DECLARED([]), saleExposureOf(BOTH));
    expect(answer).toEqual({ kind: 'conditional', conditionalFrom: null });
  });

  it('🔴 …και ΟΧΙ `occupied`: ο κάτοχος δεν χάνει το εισόδημα (το δεύτερο σκέλος)', () => {
    const answer = stayAvailabilityFor(BOTH, QUERY, DECLARED([]), saleExposureOf(BOTH));
    expect(answer.kind).not.toBe('occupied');
    expect(isStayable(answer.kind)).toBe(true);
  });

  it('🔴 ΧΩΡΙΣ πώληση ⇒ `free` — ο παρονομαστής της αίρεσης', () => {
    expect(saleExposureOf(CALYMMA)).toBeNull();
    expect(stayAvailabilityFor(CALYMMA, QUERY, DECLARED([]), saleExposureOf(CALYMMA)).kind).toBe('free');
  });

  it('🔴 ακίνητο ΜΟΝΟ προς πώληση δεν παράγει αίρεση — χρειάζονται ΚΑΙ ΤΑ ΔΥΟ', () => {
    expect(saleExposureOf(listingOf(['sell'], null))).toBeNull();
  });

  it('🔴 Η ΚΑΤΑΛΗΨΗ ΝΙΚΑ ΤΗΝ ΑΙΡΕΣΗ: κρατημένο + πώληση ⇒ `occupied`', () => {
    // Η αίρεση αφορά **ελεύθερες** μέρες. Ένα `conditional` πάνω σε κρατημένο θα
    // έλεγε «διαθέσιμο υπό αίρεση» για νύχτες που **δεν υπάρχουν**.
    const answer = stayAvailabilityFor(
      BOTH,
      QUERY,
      DECLARED([booking('b1', '2026-08-12', '2026-08-14')]),
      saleExposureOf(BOTH),
    );
    expect(answer.kind).toBe('occupied');
  });
});

// =============================================================================
// Η — ⛔ ΚΑΝΕΝΑ ΗΜΕΡΟΛΟΓΙΟ ΣΤΗ ΔΗΜΟΣΙΑ ΠΡΟΒΟΛΗ (§4.5) — άγκυρα στο ΚΛΕΙΣΤΟ ΣΧΗΜΑ
// =============================================================================

describe('Η — το `PublicListing.stay` έχει ΤΡΙΑ πεδία, και κανένα δεν είναι ημερολόγιο', () => {
  it('⛔ ακριβώς `minNights` · `maxGuests` · `nextAvailableFrom` — τίποτα άλλο', () => {
    expect(Object.keys(STAY_TERMS).sort()).toEqual(['maxGuests', 'minNights', 'nextAvailableFrom']);
  });

  it('⛔ καμία σειρά/πίνακας δεν ταξιδεύει στο `stay` — ένα σημείο, ποτέ ημερολόγιο', () => {
    // Ο φρουρός του §4.5: αν κάποιος προσθέσει `blockedDates: string[]`, εδώ σπάει.
    for (const value of Object.values(STAY_TERMS)) {
      expect(Array.isArray(value)).toBe(false);
    }
  });
});
