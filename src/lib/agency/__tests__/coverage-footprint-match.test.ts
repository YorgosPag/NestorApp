/**
 * Άγκυρα — **ΤΑ ΔΥΟ ΜΕΙΚΤΑ ΚΕΛΙΑ: ΑΚΤΙΝΑ ⇄ ΔΙΟΙΚΗΤΙΚΗ ΠΕΡΙΟΧΗ** *(ADR-846 Φάση 2)*
 *
 * ## Τι κρίνεται εδώ, και γιατί ξεχωριστό αρχείο
 *
 * Το `coverage-match.test.ts` καλύπτει τα **ομοειδή** ζεύγη *(διοικητικό εναντίον
 * διοικητικού)* με την **πραγματική** ιεραρχία των 20.721 οντοτήτων. Εδώ κρίνονται τα
 * **μεικτά**, που δεν έχουν ιεραρχία να ρωτήσουν — έχουν **γεωμετρία**:
 *
 * | ερώτημα ↓ · δήλωση → | διοικητική | ακτίνα |
 * |---|---|---|
 * | **διοικητική** | *(άλλο αρχείο)* | **εδώ** |
 * | **κύκλος** | **εδώ** | **εδώ** |
 *
 * 🔑 **Τα αποτυπώματα δίνονται με ένεση και είναι ΣΥΝΘΕΤΙΚΑ** — και πρέπει να είναι:
 * το παράγωγο αρχείο *(κέντρο + δύο ακτίνες ανά οντότητα, από CC-BY πηγή)* **δεν έχει
 * παραχθεί ακόμη**. Ένα test που περίμενε πραγματικά δεδομένα θα ήταν test που
 * **δεν τρέχει**.
 *
 * ## 🔴 Η ΑΞΙΑ ΤΟΥΣ: ΚΑΘΕ ΘΕΤΙΚΗ ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ **ΑΠΟΔΕΙΞΗ**
 *
 * Ο κριτής δεν εκτιμά ποτέ. Είτε αποδεικνύει *(«πολύγωνο ⊆ εξωτερικός ⊆ κύκλος»)*, είτε
 * λέει **`unknown`**. Τα παρακάτω μετρούν ακριβώς αυτό: ότι η γκρίζα ζώνη **υπάρχει** και
 * **δεν καταπίνεται** σε κάποια βολική τιμή.
 *
 * @module lib/agency/__tests__/coverage-footprint-match
 * @see ADR-846 §Φ2 · `types/geo/admin-footprint.ts`
 */

import { coverageMatches, coverageRelation, type CoverageResolvers } from '../coverage-match';
import type { DeclaredCoverage, ShowcaseWhere } from '@/types/agency-coverage';
import type { GeoFootprint } from '@/types/geo/admin-footprint';

// =============================================================================
// ΤΟ ΣΚΗΝΙΚΟ — ένα σημείο, και αποστάσεις που ελέγχουμε εμείς
// =============================================================================

/** Θεσσαλονίκη — το κέντρο κάθε μέτρησης εδώ. */
const ORIGIN = { lat: 40.6403, lng: 22.9439 };

/**
 * Σημείο **βόρεια** του {@link ORIGIN} κατά περίπου `km` χιλιόμετρα.
 *
 * 🔑 **Μόνο κατά πλάτος**, ώστε η απόσταση να είναι πρακτικά ανεξάρτητη από το γεω-πλάτος
 * *(1° πλάτους ≈ 111,195 χλμ παντού)* — αλλιώς οι αριθμοί του test θα κουβαλούσαν
 * σιωπηλά το σφάλμα της προβολής.
 */
function northOf(km: number): { lat: number; lng: number } {
  return { lat: ORIGIN.lat + km / 111.195, lng: ORIGIN.lng };
}

const AREA = 'municipality:0706';
const OTHER_AREA = 'municipality:1303';

const asking = (adminId: string): ShowcaseWhere => ({ adminId });
const askingAround = (center: { lat: number; lng: number }, radiusKm: number): ShowcaseWhere => ({
  circle: { center, radiusKm },
});

const declaringRadius = (
  center: { lat: number; lng: number },
  radiusKm: 10 | 20 | 30 | 50,
): DeclaredCoverage => ({ circle: { center, radiusKm } });

const declaringAreas = (...adminIds: readonly string[]): DeclaredCoverage => ({ adminIds });

/** Η ιεραρχία **δεν ρωτιέται** σε κανένα μεικτό κελί — αν ρωτηθεί, το test το μαθαίνει. */
const explodingLineage = (): readonly string[] => {
  throw new Error('Το μεικτό κελί ΔΕΝ επιτρέπεται να ρωτήσει την ιεραρχία');
};

function withFootprints(table: Readonly<Record<string, GeoFootprint>>): CoverageResolvers {
  return {
    lineageOf: explodingLineage,
    footprintOf: (adminId) => table[adminId] ?? null,
  };
}

// =============================================================================
// 1. ΔΗΛΩΣΗ ΑΚΤΙΝΑΣ × ΕΡΩΤΗΜΑ ΔΙΟΙΚΗΤΙΚΗΣ ΠΕΡΙΟΧΗΣ
// =============================================================================

describe('ADR-846 Φ2 · δήλωση ΑΚΤΙΝΑΣ εναντίον ΔΙΟΙΚΗΤΙΚΟΥ ερωτήματος', () => {
  it('ο δηλωμένος κύκλος καταπίνει ΟΛΟΚΛΗΡΟ τον εξωτερικό ⇒ within', () => {
    // Δήλωση 50 χλμ γύρω από την αφετηρία· ο δήμος κάθεται 10 χλμ βόρεια με ακτίνα 5.
    const resolvers = withFootprints({
      [AREA]: { center: northOf(10), outerKm: 5, innerKm: 2 },
    });
    expect(coverageRelation(declaringRadius(ORIGIN, 50), asking(AREA), resolvers)).toBe('within');
  });

  it('ο δηλωμένος κύκλος δεν αγγίζει τον εξωτερικό ⇒ disjoint', () => {
    const resolvers = withFootprints({
      [AREA]: { center: northOf(100), outerKm: 5, innerKm: 2 },
    });
    expect(coverageRelation(declaringRadius(ORIGIN, 10), asking(AREA), resolvers)).toBe('disjoint');
  });

  it('ο δηλωμένος κύκλος αγγίζει τον ΕΣΩΤΕΡΙΚΟ ⇒ intersects (αποδεδειγμένη επαφή)', () => {
    // Κέντρο 30 χλμ βόρεια, εσωτερική ακτίνα 25 ⇒ ο εσωτερικός φτάνει 5 χλμ από την
    // αφετηρία· δήλωση 10 χλμ τον αγγίζει. Ο εξωτερικός (40) ΔΕΝ χωράει στα 10.
    const resolvers = withFootprints({
      [AREA]: { center: northOf(30), outerKm: 40, innerKm: 25 },
    });
    expect(coverageRelation(declaringRadius(ORIGIN, 10), asking(AREA), resolvers)).toBe(
      'intersects',
    );
  });

  it('🔴 αγγίζει τον εξωτερικό αλλά ΟΧΙ τον εσωτερικό ⇒ unknown — η γκρίζα ζώνη υπάρχει', () => {
    // Κέντρο 30 χλμ βόρεια· εξωτερικός 25 (φτάνει στα 5 χλμ), εσωτερικός 2 (δεν φτάνει).
    const resolvers = withFootprints({
      [AREA]: { center: northOf(30), outerKm: 25, innerKm: 2 },
    });
    expect(coverageRelation(declaringRadius(ORIGIN, 10), asking(AREA), resolvers)).toBe('unknown');
  });

  it('αποτύπωμα που ΛΕΙΠΕΙ ⇒ unknown, και ο άνθρωπος ΔΕΝ κόβεται', () => {
    const resolvers = withFootprints({});
    const coverage = declaringRadius(ORIGIN, 20);
    expect(coverageRelation(coverage, asking(AREA), resolvers)).toBe('unknown');
    // 🔑 Η ουσία: κενό **δικό μας** δεν εξαφανίζει τη δήλωση **του ανθρώπου**.
    expect(coverageMatches(coverage, asking(AREA), resolvers)).toBe(true);
  });

  it('🔒 innerKm === 0 ΔΕΝ αποδεικνύει ποτέ επαφή — το κέντρο μπορεί να είναι έξω', () => {
    // Δήμος-αρχιπέλαγος: το «κέντρο» πέφτει στη θάλασσα. Ο κύκλος το καλύπτει, αλλά
    // αυτό ΔΕΝ σημαίνει ότι αγγίζει στεριά του δήμου.
    const resolvers = withFootprints({
      [AREA]: { center: northOf(5), outerKm: 40, innerKm: 0 },
    });
    expect(coverageRelation(declaringRadius(ORIGIN, 10), asking(AREA), resolvers)).toBe('unknown');
  });
});

// =============================================================================
// 2. ΔΗΛΩΣΗ ΔΙΟΙΚΗΤΙΚΩΝ ΠΕΡΙΟΧΩΝ × ΕΡΩΤΗΜΑ ΚΥΚΛΟΥ
// =============================================================================

describe('ADR-846 Φ2 · δήλωση ΠΕΡΙΟΧΩΝ εναντίον ΚΥΚΛΙΚΟΥ ερωτήματος', () => {
  it('ο κύκλος του επισκέπτη χωράει μέσα στον ΕΣΩΤΕΡΙΚΟ ⇒ within', () => {
    const resolvers = withFootprints({
      [AREA]: { center: ORIGIN, outerKm: 60, innerKm: 40 },
    });
    expect(
      coverageRelation(declaringAreas(AREA), askingAround(northOf(10), 20), resolvers),
    ).toBe('within');
  });

  it('αγγίζει τον εσωτερικό χωρίς να χωράει ⇒ intersects', () => {
    const resolvers = withFootprints({
      [AREA]: { center: ORIGIN, outerKm: 60, innerKm: 15 },
    });
    expect(
      coverageRelation(declaringAreas(AREA), askingAround(northOf(20), 10), resolvers),
    ).toBe('intersects');
  });

  it('όλες οι δηλωμένες είναι αποδεδειγμένα μακριά ⇒ disjoint', () => {
    const resolvers = withFootprints({
      [AREA]: { center: northOf(200), outerKm: 10, innerKm: 5 },
      [OTHER_AREA]: { center: northOf(300), outerKm: 10, innerKm: 5 },
    });
    expect(
      coverageRelation(declaringAreas(AREA, OTHER_AREA), askingAround(ORIGIN, 10), resolvers),
    ).toBe('disjoint');
  });

  it('🔴 ΜΙΑ άγνωστη περιοχή αρκεί για unknown — το disjoint απαιτεί ΟΛΕΣ', () => {
    // Η μία είναι αποδεδειγμένα μακριά· για την άλλη δεν ξέρουμε τίποτα.
    const resolvers = withFootprints({
      [AREA]: { center: northOf(200), outerKm: 10, innerKm: 5 },
    });
    expect(
      coverageRelation(declaringAreas(AREA, OTHER_AREA), askingAround(ORIGIN, 10), resolvers),
    ).toBe('unknown');
  });

  it('αποδεδειγμένη επαφή ΝΙΚΑ την αβεβαιότητα μιας άλλης περιοχής', () => {
    const resolvers = withFootprints({
      [AREA]: { center: ORIGIN, outerKm: 60, innerKm: 15 },
    });
    expect(
      coverageRelation(
        declaringAreas(AREA, OTHER_AREA),
        askingAround(northOf(20), 10),
        resolvers,
      ),
    ).toBe('intersects');
  });
});

// =============================================================================
// 3. 🔴🔴 Η ΣΕΙΡΑ ΤΩΝ ΟΡΙΣΜΑΤΩΝ — Η ΠΑΓΙΔΑ ΠΟΥ ΔΕΝ ΣΚΑΕΙ ΠΟΥΘΕΝΑ
// =============================================================================

/**
 * Το `areaRelation(subject, query)` του `geo-area.ts` δίνει `within` όταν το **subject**
 * χωράει μέσα στο **query** *(`gap + subjectM <= queryM`)*. Ο πίνακας στην κορυφή του
 * `coverage-match.ts` το περιέγραφε **ανάποδα**.
 *
 * ⚠️ **Και οι δύο τιμές είναι νόμιμες**, οπότε η λάθος σειρά **δεν πετά τίποτα**: απλώς
 * η κάρτα γράφει *«καλύπτει όλη την περιοχή»* εκεί που έπρεπε να γράψει *«μέρος»*, και
 * αντίστροφα. Ακριβώς το είδος σφάλματος που ζει χρόνια.
 */
describe('ADR-846 Φ2 · δήλωση ΑΚΤΙΝΑΣ εναντίον ΚΥΚΛΙΚΟΥ ερωτήματος — η σειρά των ορισμάτων', () => {
  const resolvers = withFootprints({});

  it('🔴 μεγάλη δήλωση, μικρό ερώτημα ⇒ within («σε καλύπτω ολόκληρο»)', () => {
    expect(
      coverageRelation(declaringRadius(ORIGIN, 50), askingAround(ORIGIN, 5), resolvers),
    ).toBe('within');
  });

  it('🔴 μικρή δήλωση, μεγάλο ερώτημα ⇒ intersects («καλύπτω μέρος σου»)', () => {
    expect(
      coverageRelation(declaringRadius(ORIGIN, 10), askingAround(ORIGIN, 50), resolvers),
    ).toBe('intersects');
  });

  it('μακριά ⇒ disjoint', () => {
    expect(
      coverageRelation(declaringRadius(ORIGIN, 10), askingAround(northOf(100), 10), resolvers),
    ).toBe('disjoint');
  });

  it('το κυκλικό ζεύγος ΔΕΝ χρειάζεται ποτέ αποτυπώματα — απαντά και με άδειο πίνακα', () => {
    // 🔑 Ο παρονομαστής των παραπάνω: αν χρειαζόταν, όλα θα ήταν `unknown`.
    expect(
      coverageRelation(declaringRadius(ORIGIN, 50), askingAround(ORIGIN, 5), resolvers),
    ).not.toBe('unknown');
  });
});

// =============================================================================
// 4. «ΟΛΗ Η ΕΛΛΑΔΑ» ΚΑΙ Η ΣΙΩΠΗ — ανεξάρτητα από γεωμετρία
// =============================================================================

describe('ADR-846 Φ2 · τα δύο άκρα δεν αγγίζουν καθόλου τη γεωμετρία', () => {
  const resolvers: CoverageResolvers = {
    lineageOf: explodingLineage,
    footprintOf: () => {
      throw new Error('Το «όλη η Ελλάδα» ΔΕΝ επιτρέπεται να ρωτήσει αποτύπωμα');
    },
  };

  it('«όλη η Ελλάδα» ⇒ within σε ΚΑΘΕ ερώτημα', () => {
    const nationwide: DeclaredCoverage = { nationwide: true };
    expect(coverageRelation(nationwide, asking(AREA), resolvers)).toBe('within');
    expect(coverageRelation(nationwide, askingAround(ORIGIN, 20), resolvers)).toBe('within');
  });

  it('καμία δήλωση ⇒ disjoint — η σιωπή δεν ανταμείβεται ούτε εδώ', () => {
    expect(coverageRelation(null, askingAround(ORIGIN, 20), resolvers)).toBe('disjoint');
  });
});
