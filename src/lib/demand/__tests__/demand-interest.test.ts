/**
 * Άγκυρες — **ΤΟ ΔΟΛΩΜΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** (ADR-777 Α9 · Α12 · SPEC-777B §12.6 · §12.7).
 *
 * Έξι ομάδες, και η καθεμία υπάρχει για **μετρημένο** λόγο:
 *
 * **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ.** Αποδεικνύει ότι το πρόβλημα που λύνει αυτό το αρχείο είναι
 * **πραγματικό**: ο αφελής βρόχος πάνω στην υπάρχουσα μηχανή απαντά **0 για κάθε
 * ζήτηση** σε κλειστό ακίνητο. Χωρίς αυτή την ομάδα, η {@link INTEREST_STANCES} θα
 * ήταν φρουρός **χωρίς απόδειξη ζωής** (ADR-749 §5, 606 αδρανείς) — και το σχόλιο που
 * τη δικαιολογεί θα ήταν ισχυρισμός.
 *
 * **Σ — ΣΤΑΣΗ.** Κάθε μία από τις τρεις τιμές παράγεται από **πραγματική** είσοδο.
 * Στάση που καμία είσοδος δεν παράγει είναι κάδος που δεν μπορεί να πυροδοτήσει.
 *
 * **Κ — ΚΑΤΑΛΗΞΗ.** Κάθε ονομασμένη κατάληξη παράγεται· και η **σειρά** ταξινόμησης
 * ελέγχεται εκεί ακριβώς όπου έχει σημασία.
 *
 * **Λ — ΛΟΓΙΣΤΙΚΗ.** Κλειστή, fail-closed.
 *
 * **Π — ΠΟΛΙΤΙΚΗ.** Ότι εφαρμόζεται το κατώφλι του **`place-owner`** και **όχι** του
 * `area-market`. Είναι η άγκυρα που κάνει τον μηχανισμό **συνδεδεμένο**: ως τις
 * 2026-08-12 η πολιτική είχε **μηδέν** καταναλωτές.
 *
 * **Α — ΑΣΦΑΛΕΙΑ.** Ότι η **λογιστική δεν ταξιδεύει** δίπλα στη λογοκριμένη τιμή.
 */

import {
  DEMAND_INTEREST_OUTCOMES,
  INTEREST_STANCES,
  classifyDemandInterest,
  discloseInterest,
  placeInterestCensusBalances,
  stanceOfListing,
  type InterestStance,
} from '../demand-interest';
import { DEMAND_DISCLOSURE } from '../demand-aggregate';
import { matchDemandAgainstListing } from '../demand-matching';
import { NO_DEMAND_FEATURES, type PropertyDemand } from '@/types/property-demand';
import { NOW_ISO, TODAY, demand, facts, listing } from './demand-fixtures';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ — τρία ακίνητα, μία ανά στάση
// =============================================================================

/** Το κλειστό κατάστημα του §12.6: **καμία** διάθεση, **καμία** τιμή. */
const DORMANT = facts({
  listing: listing({
    commercialStatus: 'unavailable',
    commercial: { askingPrice: null, finalPrice: null, rentPrice: null },
    offerKinds: [],
  }),
});

/** Ακίνητο **στην αγορά** — δηλωμένο πλήρως. */
const OFFERED = facts();

/**
 * Το παλαιό έγγραφο: **χωρίς** είδος διάθεσης, **με** τιμή από τα προ-Α20 πεδία.
 * ⚠️ Δεν είναι τεχνητό — δες τη μετανάστευση `commercial` (ADR-777 §8.5α α, ανοιχτή).
 */
const PARTIAL = facts({
  listing: listing({
    commercialStatus: 'unavailable',
    commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: null },
    offerKinds: [],
  }),
});

/** N ζητήσεις που, σε δηλωμένο ακίνητο, θα ταίριαζαν όλες. */
function seekers(count: number): PropertyDemand[] {
  return Array.from({ length: count }, (_, index) => demand({ id: `dmnd_${index}` }));
}

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: ΤΟ «0» ΗΤΑΝ ΠΡΑΓΜΑΤΙΚΟ
// =============================================================================

describe('🔴 Μ0 — ο αφελής βρόχος απαντά ΠΑΝΤΑ 0 σε κλειστό ακίνητο', () => {
  it('η υπάρχουσα μηχανή λέει `no-match` σε ΚΑΘΕ ζήτηση, με εμπόδιο `offer-kind`', () => {
    for (const one of seekers(5)) {
      const match = matchDemandAgainstListing(one, DORMANT, TODAY);
      expect(match.verdict).toBe('no-match');
      expect(match.blockers).toContain('offer-kind');
    }
  });

  it('🔑 και ΓΙ΄ ΑΥΤΟ η στάση υπάρχει: το ίδιο ακίνητο, ίδιες ζητήσεις ⇒ 5', () => {
    const { interest } = discloseInterest(DORMANT, seekers(5), NOW_ISO, TODAY);
    expect(interest.stance).toBe('dormant');
    expect(interest.disclosure.count).toBe(5);
  });

  it('⚠️ σε ΔΗΛΩΜΕΝΟ ακίνητο τίποτα δεν συγχωρείται — η μηχανή κρίνει ολόκληρη', () => {
    // Ζητά ενοικίαση· το ακίνητο πωλείται. Πραγματική ασυμφωνία, ΟΧΙ αδήλωτος άξονας.
    const renters = [demand({ seeks: ['leaseOut'] })];
    const { interest, census } = discloseInterest(OFFERED, renters, NOW_ISO, TODAY);
    expect(interest.disclosure.count).toBeNull();
    expect(census.mismatch).toBe(1);
    expect(census.undeclaredAxes).toEqual([]);
  });
});

// =============================================================================
// Σ — ΣΤΑΣΗ: ΚΑΘΕ ΤΙΜΗ ΕΧΕΙ ΑΠΟΔΕΙΞΗ ΖΩΗΣ
// =============================================================================

describe('Σ — η στάση, κάθε τιμή από πραγματική είσοδο', () => {
  const PRODUCED: Readonly<Record<InterestStance, () => InterestStance>> = {
    offered: () => stanceOfListing(OFFERED.listing),
    partial: () => stanceOfListing(PARTIAL.listing),
    dormant: () => stanceOfListing(DORMANT.listing),
  };

  it.each(INTEREST_STANCES)('η στάση «%s» παράγεται από πραγματικό ακίνητο', (stance) => {
    expect(PRODUCED[stance]()).toBe(stance);
  });

  it('🔴 το `partial` ΚΡΙΝΕΙ την τιμή — δεν τη συγχωρεί', () => {
    // Προϋπολογισμός 150.000 έναντι τιμής 200.000: αληθινή ασυμφωνία.
    const tight = [demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 150_000 } })];
    const { census } = discloseInterest(PARTIAL, tight, NOW_ISO, TODAY);
    expect(census.mismatch).toBe(1);
  });

  it('🔴 το `dormant` ΔΕΝ έχει τιμή να κρίνει — ο ίδιος άνθρωπος μετράει', () => {
    const tight = [demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 150_000 } })];
    const { census } = discloseInterest(DORMANT, tight, NOW_ISO, TODAY);
    expect(census.interested).toBe(1);
  });
});

// =============================================================================
// Κ — ΚΑΤΑΛΗΞΗ: ΟΝΟΜΑΣΜΕΝΗ, ΚΑΙ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('Κ — η κατάληξη κάθε ζήτησης', () => {
  it.each(DEMAND_INTEREST_OUTCOMES)('η κατάληξη «%s» παράγεται', (outcome) => {
    const cases: Record<string, () => string> = {
      interested: () => classifyDemandInterest(demand(), OFFERED, 'offered', NOW_ISO, TODAY),
      'not-countable': () =>
        classifyDemandInterest(
          demand({ lifecycle: 'withdrawn' }),
          OFFERED,
          'offered',
          NOW_ISO,
          TODAY,
        ),
      mismatch: () =>
        classifyDemandInterest(
          demand({ seeks: ['leaseOut'] }),
          OFFERED,
          'offered',
          NOW_ISO,
          TODAY,
        ),
    };
    expect(cases[outcome]()).toBe(outcome);
  });

  it('🔴 αποσυρμένη ΚΑΙ ασύμφωνη ⇒ `not-countable`, ΠΟΤΕ `mismatch`', () => {
    // Η σειρά είναι συμβόλαιο: αλλιώς η αναφορά λέει «δέκα δεν το θέλησαν» ενώ οι
    // οκτώ βρήκαν σπίτι — και ο ιδιοκτήτης ρίχνει τιμή που δεν χρειάζεται.
    const gone = demand({ lifecycle: 'withdrawn', seeks: ['leaseOut'] });
    expect(classifyDemandInterest(gone, OFFERED, 'offered', NOW_ISO, TODAY)).toBe(
      'not-countable',
    );
  });

  it('🔴 ανεπιβεβαίωτη ζήτηση μεσίτη ΔΕΝ φουσκώνει το δόλωμα', () => {
    const brokered = demand({
      mandate: {
        kind: 'brokered',
        clientContactId: 'cont_1',
        confirmation: 'pending',
        confirmedByUserId: null,
      },
    });
    const { interest, census } = discloseInterest(DORMANT, [brokered], NOW_ISO, TODAY);
    expect(census.notCountable).toBe(1);
    expect(interest.disclosure.count).toBeNull();
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ
// =============================================================================

describe('Λ — κλειστή λογιστική, fail-closed', () => {
  it('interested + notCountable + mismatch === considered, σε ανάμεικτη δεξαμενή', () => {
    const pool = [
      ...seekers(3),
      demand({ id: 'x1', lifecycle: 'paused' }),
      demand({ id: 'x2', seeks: ['leaseOut'] }),
      demand({ id: 'x3', affirmedAt: '2020-01-01T00:00:00.000Z' }),
    ];
    const { census } = discloseInterest(OFFERED, pool, NOW_ISO, TODAY);

    expect(placeInterestCensusBalances(census)).toBe(true);
    expect(census.considered).toBe(6);
    expect(census.interested).toBe(3);
    expect(census.notCountable).toBe(2);
    expect(census.mismatch).toBe(1);
  });

  it('ο φρουρός ισορροπίας πιάνει χαλασμένη λογιστική', () => {
    expect(
      placeInterestCensusBalances({
        interested: 1,
        notCountable: 0,
        mismatch: 0,
        considered: 2,
        undeclaredAxes: [],
      }),
    ).toBe(false);
  });
});

// =============================================================================
// Π — Η ΠΟΛΙΤΙΚΗ ΕΧΕΙ ΕΠΙΤΕΛΟΥΣ ΚΑΤΑΝΑΛΩΤΗ
// =============================================================================

describe('🔴 Π — εφαρμόζεται το κατώφλι του `place-owner`, ΟΧΙ του `area-market`', () => {
  it('ΕΝΑΣ άνθρωπος αρκεί — απόφαση Giorgio 2026-08-11 «από τον 1ο»', () => {
    const { interest } = discloseInterest(DORMANT, seekers(1), NOW_ISO, TODAY);
    expect(interest.disclosure.count).toBe(1);
    expect(interest.disclosure.audience).toBe('place-owner');
    expect(interest.disclosure.minCount).toBe(DEMAND_DISCLOSURE['place-owner'].minCount);
  });

  it('⚠️ με το κατώφλι του `area-market` (5) ο ΕΝΑΣ θα σιωπούσε — η διαφορά ΕΙΝΑΙ η Ζ3', () => {
    expect(DEMAND_DISCLOSURE['area-market'].minCount).toBeGreaterThan(1);
    const { interest } = discloseInterest(DORMANT, seekers(4), NOW_ISO, TODAY);
    expect(interest.disclosure.count).toBe(4);
  });

  it('κανένας ⇒ `null`, και το `null` ΔΕΝ είναι «κανένας» — είναι «δεν το λέμε»', () => {
    const { interest } = discloseInterest(DORMANT, [], NOW_ISO, TODAY);
    expect(interest.disclosure.count).toBeNull();
  });
});

// =============================================================================
// Α — Η ΛΟΓΙΣΤΙΚΗ ΔΕΝ ΤΑΞΙΔΕΥΕΙ ΔΙΠΛΑ ΣΤΗ ΛΟΓΟΚΡΙΜΕΝΗ ΤΙΜΗ
// =============================================================================

describe('🔴 Α — τι φεύγει προς τον ιδιοκτήτη', () => {
  it('το `interest` έχει ΑΚΡΙΒΩΣ δύο πεδία — καμία ταυτότητα, κανένας ωμός αριθμός', () => {
    const { interest } = discloseInterest(DORMANT, seekers(3), NOW_ISO, TODAY);
    expect(Object.keys(interest).sort()).toEqual(['disclosure', 'stance']);
    expect(Object.keys(interest.disclosure).sort()).toEqual([
      'audience',
      'count',
      'minCount',
    ]);
  });

  it('η λογιστική επιστρέφεται ΧΩΡΙΣΤΑ, ώστε ο καλών να πρέπει να τη ΔΙΑΛΕΞΕΙ', () => {
    const result = discloseInterest(DORMANT, seekers(3), NOW_ISO, TODAY);
    expect(Object.keys(result).sort()).toEqual(['census', 'interest']);
  });
});

// =============================================================================
// Ο — ΤΟ ΟΡΘΟΓΩΝΙΟ ΚΕΝΟ ΜΕΝΕΙ ΟΡΑΤΟ
// =============================================================================

describe('Ο — το `availability-unknown` ΔΕΝ συγχωρείται σε καμία στάση', () => {
  it('🔶 ζήτηση Ζ2 («από Μάρτιο 2027») δεν μετράει — δηλωμένη συνέπεια, όχι σφάλμα', () => {
    const future = [
      demand({ timing: { kind: 'window', fromDate: '2027-03-01', toDate: '2027-06-30' } }),
    ];
    const { census } = discloseInterest(DORMANT, future, NOW_ISO, TODAY);
    expect(census.mismatch).toBe(1);
    expect(census.undeclaredAxes).not.toContain('availability-unknown');
  });
});
