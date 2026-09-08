/**
 * Άγκυρα — **ΤΟ ΧΑΡΑΓΜΕΝΟ ΠΟΛΥΓΩΝΟ: ΤΑ ΤΑΒΑΝΙΑ ΚΑΙ ΤΑ ΔΥΟ ΝΕΑ ΚΕΛΙΑ** *(ADR-846 Φ3)*
 *
 * ## Τι κρίνεται εδώ
 *
 * | ερώτημα ↓ · δήλωση → | «όλη η Ελλάδα» | διοικητική | ακτίνα | **πολύγωνο** |
 * |---|---|---|---|---|
 * | **διοικητική** | *(αλλού)* | *(αλλού)* | *(αλλού)* | **εδώ** |
 * | **κύκλος** | *(αλλού)* | *(αλλού)* | *(αλλού)* | **εδώ** |
 *
 * ## 🔴 Η ΟΜΑΔΑ ΠΟΥ ΜΕΤΡΑΕΙ ΠΕΡΙΣΣΟΤΕΡΟ: «Η ΑΝΑΓΩΓΗ ΔΕΝ ΑΡΚΟΥΣΕ»
 *
 * Η προφανής λύση ήταν *«ανάγαγε και το πολύγωνο σε δύο κύκλους»* — μηδέν νέα γεωμετρία.
 * Μετρήθηκε σε **326 πραγματικά ελληνικά σχήματα** *(δήμοι αραιωμένοι στις ~15 κορυφές,
 * δηλαδή ό,τι χαράζει άνθρωπος)* εναντίον **10.432** κύκλων-ερωτημάτων:
 *
 * | | «δεν ξέρω» | λάθος ετικέτες |
 * |---|---|---|
 * | σκέτη αναγωγή | **23,2 %** *(31,0 % σε λεπτά/κοίλα)* | **152** |
 * | ακριβής συνάρτηση | **0,0 %** | **0** |
 *
 * ⇒ Η ομάδα «η αναγωγή δεν αρκούσε» **εκτελεί** αυτή τη διαφορά σε ένα σχήμα: δείχνει
 * το `footprintRelation` να λέει `unknown` και τον κριτή να απαντά **οριστικά** για το
 * **ίδιο** ζεύγος. Χωρίς αυτήν, ο επόμενος που θα «απλοποιήσει» τον κριτή σε σκέτη
 * αναγωγή θα δει **πράσινα** και θα χαλάσει έναν στους τέσσερις επισκέπτες.
 *
 * @module lib/agency/__tests__/coverage-outline-match
 * @see ADR-846 §8.4 · `lib/agency/coverage-outline.ts` · `lib/agency/coverage-match.ts`
 */

import { coverageMatches, coverageRelation, footprintRelation } from '../coverage-match';
import { asCoverageOutline, coverageOutlineDefect } from '../coverage-outline';
import { circleFootprint, ringsFootprint } from '@/lib/geo/geo-footprint';
import { geoCircleOutline } from '@/lib/geo/geo-ring';
import {
  COVERAGE_MAX_OUTER_KM,
  COVERAGE_MAX_VERTICES,
  COVERAGE_RADIUS_STEPS,
  type DeclaredCoverage,
  type ShowcaseWhere,
} from '@/types/agency-coverage';
import type { GeoFootprint } from '@/types/geo/admin-footprint';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

// =============================================================================
// ΤΟ ΣΚΗΝΙΚΟ
// =============================================================================

/** Θεσσαλονίκη — το κέντρο κάθε μέτρησης εδώ. */
const ORIGIN: GeoPoint = { lat: 40.6403, lng: 22.9439 };

/** 1° πλάτους ≈ 111,195 χλμ **παντού**· 1° μήκους στο 40,64° ≈ 84,4 χλμ. */
const KM_PER_LAT = 111.195;
const KM_PER_LNG = 84.4;

const at = (eastKm: number, northKm: number): GeoPoint => ({
  lat: ORIGIN.lat + northKm / KM_PER_LAT,
  lng: ORIGIN.lng + eastKm / KM_PER_LNG,
});
const east = (km: number): GeoPoint => at(km, 0);
const north = (km: number): GeoPoint => at(0, km);

/**
 * **Η ΛΩΡΙΔΑ** — 40 χλμ μήκος, 1 χλμ πλάτος, κεντραρισμένη στο {@link ORIGIN}.
 *
 * 🔑 **Λεπτή επίτηδες**: είναι το σχήμα όπου η αναγωγή σε δύο κύκλους καταρρέει
 * *(περιγεγραμμένος ≈ 20 χλμ, εγγεγραμμένος ≈ 0,5 χλμ)* και είναι **ακριβώς** το σχήμα
 * που χαράζει ένας επαγγελματίας: μια παραλιακή ζώνη, ένας άξονας δρόμου, μια γειτονιά.
 */
const STRIP: GeoOutline = [
  { lat: ORIGIN.lat - 0.5 / KM_PER_LAT, lng: ORIGIN.lng - 20 / KM_PER_LNG },
  { lat: ORIGIN.lat - 0.5 / KM_PER_LAT, lng: ORIGIN.lng + 20 / KM_PER_LNG },
  { lat: ORIGIN.lat + 0.5 / KM_PER_LAT, lng: ORIGIN.lng + 20 / KM_PER_LNG },
  { lat: ORIGIN.lat + 0.5 / KM_PER_LAT, lng: ORIGIN.lng - 20 / KM_PER_LNG },
];

const declaring = (outline: GeoOutline): DeclaredCoverage => ({ outline });
const askingAround = (center: GeoPoint, radiusKm: number): ShowcaseWhere => ({
  circle: { center, radiusKm },
});
const asking = (adminId: string): ShowcaseWhere => ({ adminId });

const AREA = 'municipality:0706';

/** Ο κριτής χωρίς **καμία** διοικητική γνώση — το πολύγωνο δεν τη χρειάζεται. */
const noHierarchy = { lineageOf: (): readonly string[] => [], footprintOf: () => null };
const withFootprint = (footprint: GeoFootprint | null) => ({
  lineageOf: (): readonly string[] => [],
  footprintOf: (): GeoFootprint | null => footprint,
});

// =============================================================================
// 1. ΤΑ ΤΑΒΑΝΙΑ — ΚΑΙ ΤΟ ΕΠΙΧΕΙΡΗΜΑ ΤΗΣ #6, ΕΚΤΕΛΕΣΜΕΝΟ
// =============================================================================

describe('ADR-846 Φ3 · το ταβάνι ΔΕΝ είναι νέος αριθμός — είναι το ανώτατο βήμα ακτίνας', () => {
  it('🔴 το ταβάνι έκτασης ΕΙΝΑΙ το `max(COVERAGE_RADIUS_STEPS)`', () => {
    // Η μέρα που κάποιος γράψει εδώ «60» επειδή «χρειαζόταν λίγο παραπάνω», αυτό το
    // test κοκκινίζει — και μαζί του πέφτει ολόκληρο το επιχείρημα παρακάτω.
    expect(COVERAGE_MAX_OUTER_KM).toBe(Math.max(...COVERAGE_RADIUS_STEPS));
  });

  it('🏆 κάθε ΑΠΟΔΕΚΤΟ πολύγωνο είναι ΥΠΟΣΥΝΟΛΟ μιας ήδη νόμιμης δήλωσης ακτίνας', () => {
    // ⇒ Το τέταρτο σκέλος **δεν μπορεί να εκφράσει τίποτα ευρύτερο** από το τρίτο.
    //   Αυτή είναι όλη η άδεια που χρειαζόταν από την απαγόρευση #6.
    expect(coverageOutlineDefect(STRIP)).toBeNull();

    const footprint = ringsFootprint([STRIP]);
    expect(footprint).not.toBeNull();

    const step = COVERAGE_RADIUS_STEPS.find((km) => km >= footprint!.outerKm);
    expect(step).toBeDefined();

    // Και ο **ίδιος ο κριτής** το επιβεβαιώνει: εκείνος ο κύκλος καλύπτει ΟΛΟ το σχήμα.
    expect(
      footprintRelation(
        circleFootprint({ center: footprint!.center, radiusKm: step! }),
        footprint!,
      ),
    ).toBe('within');
  });

  it('σχήμα πλατύτερο από το ταβάνι απορρίπτεται ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ', () => {
    const huge = geoCircleOutline(ORIGIN, (COVERAGE_MAX_OUTER_KM + 5) * 1000);
    expect(huge).not.toBeNull();
    expect(coverageOutlineDefect(huge!)).toBe('coverage-outline-too-wide');
  });

  it('το όριο είναι ΠΡΑΓΜΑΤΙΚΟ κατώφλι: 45 χλμ περνά, 55 όχι', () => {
    // 🔴 **ΚΑΙ ΓΙΑΤΙ ΟΧΙ ΑΚΡΙΒΩΣ 50**: το `geoCircleOutline` παράγει κορυφές με
    //    **ισαπέχουσα** προβολή, ενώ ο περιγεγραμμένος μετριέται με **haversine** — η
    //    διαφορά είναι **+0,13 %** *(μετρημένο: ονομαστικά 50 χλμ ⇒ 50,0645)*. Άρα ένας
    //    «ακριβώς 50» κύκλος **δεν** περνά, και αυτό είναι **σωστό**: το ταβάνι
    //    επιβάλλεται πάνω στο μέγεθος που ο κριτής **πραγματικά** θα χρησιμοποιήσει,
    //    όχι σε αυτό που ήθελε να φτιάξει ο καλών.
    expect(coverageOutlineDefect(geoCircleOutline(ORIGIN, 45_000)!)).toBeNull();
    expect(coverageOutlineDefect(geoCircleOutline(ORIGIN, 55_000)!)).toBe(
      'coverage-outline-too-wide',
    );
  });
});

describe('ADR-846 Φ3 · το πλήθος κορυφών, και η ΣΕΙΡΑ που το κρίνει', () => {
  it('πάνω από το όριο ⇒ ονομασμένο ελάττωμα', () => {
    const many: GeoPoint[] = [];
    for (let i = 0; i <= COVERAGE_MAX_VERTICES; i += 1) {
      many.push(north(0.001 * i));
    }
    expect(coverageOutlineDefect(many)).toBe('coverage-outline-too-many-vertices');
  });

  it('🔴 ΤΟ ΠΛΗΘΟΣ ΚΡΙΝΕΤΑΙ ΠΡΙΝ ΤΗ ΓΕΩΜΕΤΡΙΑ — φρουρός πόρου, όχι γούστο', () => {
    // Το σχήμα είναι **και** εκφυλισμένο (όλες οι κορυφές συνευθειακές) **και**
    // υπεράριθμο. Αν ο έλεγχος πλήθους δεν ήταν πρώτος, η απάντηση θα ήταν
    // `outline-degenerate` — δηλαδή θα είχε τρέξει O(n²) πάνω σε είσοδο που δεν
    // επρόκειτο ποτέ να γίνει δεκτή.
    const collinear: GeoPoint[] = [];
    for (let i = 0; i < COVERAGE_MAX_VERTICES * 3; i += 1) {
      collinear.push(east(i * 0.01));
    }
    expect(coverageOutlineDefect(collinear)).toBe('coverage-outline-too-many-vertices');
  });

  it('τα ελαττώματα ΣΧΗΜΑΤΟΣ κρατούν τα ΙΔΙΑ ονόματα με τη χάραξη τόπου', () => {
    // ⚠️ Δεύτερο λεξιλόγιο για το ίδιο πρόβλημα θα σήμαινε ότι ο άνθρωπος διαβάζει
    //    **άλλα λόγια** πριν και μετά την υποβολή, για το ίδιο σχήμα.
    expect(coverageOutlineDefect([ORIGIN, east(1)])).toBe('outline-too-few-vertices');
    expect(coverageOutlineDefect([ORIGIN, east(1), east(2)])).toBe('outline-degenerate');
    // ⚠️ **ΑΣΥΜΜΕΤΡΟ παπιγιόν, επίτηδες**: ένα συμμετρικό έχει **μηδενικό** εμβαδόν
    //    (οι δύο λοβοί αλληλοαναιρούνται στη shoelace) και θα κρινόταν `outline-degenerate`
    //    — σωστά, γιατί ο εκφυλισμός ελέγχεται **πρώτος**. Το test θα περνούσε για
    //    **λάθος λόγο** και δεν θα άγγιζε ποτέ τον έλεγχο αυτοτομής.
    expect(coverageOutlineDefect([at(0, 0), at(6, 0), at(0, 2), at(2, 5)])).toBe(
      'outline-self-intersecting',
    );
  });
});

describe('ADR-846 Φ3 · το σύνορο εισόδου — ο δίσκος και το σώμα δεν είναι αξιόπιστα', () => {
  it('ό,τι δεν είναι πίνακας σημείων ⇒ null', () => {
    expect(asCoverageOutline(null)).toBeNull();
    expect(asCoverageOutline('πολύγωνο')).toBeNull();
    expect(asCoverageOutline([{ lat: 40 }])).toBeNull();
    expect(asCoverageOutline([{ lat: '40', lng: '23' }])).toBeNull();
  });

  it('🔒 χειρόγραφο πολύγωνο ΠΑΝΩ από το ταβάνι ⇒ null, όπως το `radiusKm: 500`', () => {
    const huge = geoCircleOutline(ORIGIN, 300_000);
    expect(asCoverageOutline(huge)).toBeNull();
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — έγκυρο πολύγωνο περνά, και ΞΑΝΑΧΤΙΖΕΤΑΙ καθαρό', () => {
    const withNoise = STRIP.map((v) => ({ ...v, note: 'δεν ελέγχθηκε ποτέ' }));
    expect(asCoverageOutline(withNoise)).toEqual(STRIP);
  });
});

// =============================================================================
// 2. Ο ΚΡΙΤΗΣ — ΤΑ ΔΥΟ ΝΕΑ ΚΕΛΙΑ
// =============================================================================

describe('ADR-846 Φ3 · δηλωμένο ΠΟΛΥΓΩΝΟ εναντίον ΚΥΚΛΙΚΟΥ ερωτήματος', () => {
  const relation = (where: ShowcaseWhere): string =>
    coverageRelation(declaring(STRIP), where, noHierarchy);

  it('ο κύκλος του επισκέπτη χωράει ΟΛΟΚΛΗΡΟΣ μέσα ⇒ within', () => {
    expect(relation(askingAround(ORIGIN, 0.2))).toBe('within');
  });

  it('το κέντρο είναι μέσα αλλά ο κύκλος ξεχειλίζει ⇒ intersects', () => {
    expect(relation(askingAround(east(10), 3))).toBe('intersects');
  });

  it('αποδεδειγμένα μακριά ⇒ disjoint', () => {
    expect(relation(askingAround(east(35), 3))).toBe('disjoint');
  });

  it('🏆 ΚΑΜΙΑ ΓΚΡΙΖΑ ΖΩΝΗ σε κυκλικό ερώτημα — μετρημένο 0,0 % «δεν ξέρω»', () => {
    // Ο κύκλος έχει `innerKm === outerKm`, οπότε οι τρεις έλεγχοι είναι **εξαντλητικοί**.
    for (let km = 0; km <= 40; km += 1) {
      for (const radiusKm of [0.2, 1, 3, 10]) {
        expect(relation(askingAround(east(km), radiusKm))).not.toBe('unknown');
      }
    }
  });
});

describe('ADR-846 Φ3 · 🔴 Η ΑΝΑΓΩΓΗ ΣΕ ΔΥΟ ΚΥΚΛΟΥΣ ΔΕΝ ΑΡΚΟΥΣΕ — μετρημένο, όχι υποτιθέμενο', () => {
  const asked = circleFootprint({ center: east(10), radiusKm: 3 });

  it('η σκέτη αναγωγή λέει «δεν ξέρω» για τη λεπτή λωρίδα', () => {
    const reduced = ringsFootprint([STRIP]);
    expect(footprintRelation(reduced!, asked)).toBe('unknown');
  });

  it('ο κριτής απαντά ΟΡΙΣΤΙΚΑ για το ΙΔΙΟ ζεύγος', () => {
    // ⇒ Αυτή η γραμμή είναι ο λόγος που ο κριτής κρατά το **ακριβές** σκέλος. Όποιος
    //   το «απλοποιήσει» σε `footprintRelation(ringsFootprint(...), ...)` θα το δει.
    expect(coverageRelation(declaring(STRIP), askingAround(east(10), 3), noHierarchy)).toBe(
      'intersects',
    );
  });
});

describe('ADR-846 Φ3 · δηλωμένο ΠΟΛΥΓΩΝΟ εναντίον ΔΙΟΙΚΗΤΙΚΟΥ ερωτήματος', () => {
  const relation = (footprint: GeoFootprint | null): string =>
    coverageRelation(declaring(STRIP), asking(AREA), withFootprint(footprint));

  it('ο ΕΞΩΤΕΡΙΚΟΣ της οντότητας χωράει μέσα στο σχήμα ⇒ within', () => {
    expect(relation({ center: ORIGIN, outerKm: 0.3, innerKm: 0.1 })).toBe('within');
  });

  it('ούτε ο ΕΞΩΤΕΡΙΚΟΣ δεν αγγίζει το σχήμα ⇒ disjoint', () => {
    expect(relation({ center: east(35), outerKm: 3, innerKm: 1 })).toBe('disjoint');
  });

  it('ο ΕΣΩΤΕΡΙΚΟΣ αγγίζει το σχήμα ⇒ intersects (αποδεδειγμένη επαφή)', () => {
    expect(relation({ center: east(10), outerKm: 8, innerKm: 2 })).toBe('intersects');
  });

  it('🔴 Η ΓΚΡΙΖΑ ΖΩΝΗ ΕΠΙΒΙΩΝΕΙ όταν η ΟΝΤΟΤΗΤΑ είναι χονδρική — και το λέει', () => {
    // Το κέντρο της οντότητας πέφτει **έξω** από τη λωρίδα, ο εξωτερικός της την
    // αγγίζει, και ο εσωτερικός της **δεν αποδεικνύει τίποτα** (`innerKm === 0`, π.χ.
    // δήμος-αρχιπέλαγος). Καμία απόδειξη προς καμία κατεύθυνση ⇒ `unknown`.
    expect(relation({ center: north(1), outerKm: 5, innerKm: 0 })).toBe('unknown');
  });

  it('αποτύπωμα που ΛΕΙΠΕΙ ⇒ unknown, και ο άνθρωπος ΔΕΝ κόβεται', () => {
    expect(relation(null)).toBe('unknown');
    expect(coverageMatches(declaring(STRIP), asking(AREA), withFootprint(null))).toBe(true);
  });
});
