/**
 * @fileoverview **ΤΟ ΕΣΩΤΕΡΙΚΟ ΚΑΛΥΜΜΑ ΕΝΟΣ ΣΧΗΜΑΤΟΣ** — «τι μπορώ να υποσχεθώ ότι
 * **περιέχω**;» *(ADR-846 §9 #11)*.
 * @related lib/geo/geo-ring · lib/geo/geo-footprint · lib/agency/coverage-match
 * @module lib/geo/geo-interior-cover
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ, ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το {@link GeoFootprint} περιγράφει μια περιοχή με **δύο ομόκεντρους κύκλους**:
 * τον περιγεγραμμένο *(`outerKm`)* και **έναν** εγγεγραμμένο *(`innerKm`)*, και τους
 * δύο γύρω από το **ίδιο** κέντρο. Ο εγγεγραμμένος απαντά το ερώτημα *«ποιον χώρο
 * μπορώ να ορκιστώ ότι είναι δικός μου;»* — και είναι η **μόνη** βάση πάνω στην οποία
 * ο κριτής λέει `within`.
 *
 * 🔴 **Για μη-συμπαγή σχήματα ο ένας κύκλος καταρρέει.** Μετρημένο *(09/09)*:
 *
 * | Οντότητα | `outerKm` | `innerKm` | λόγος |
 * |---|---|---|---|
 * | ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ | 5,005 | **0,123** | 0,025 |
 * | ΠΕΡ. ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ | 145,88 | 17,07 | 0,117 |
 *
 * Ο Δήμος Θεσσαλονίκης είναι **μακρόστενος κατά μήκος του Θερμαϊκού**: το κέντρο του
 * περιγεγραμμένου κύκλου πέφτει **123 μέτρα** από την ακτογραμμή. Ένα ακίνητο **στο
 * κέντρο της πόλης**, 530 m μακριά, απαντιέται **«δεν είσαι μέσα»** — και το γραφείο
 * εξαφανίζεται από τον δήμο όπου αποδεδειγμένα δουλεύει.
 *
 * **Σε όλα τα 7.440 αποτυπώματα**: **1.431 (19,2%)** έχουν `inner/outer < 0,10` —
 * και **9 από τις 14 περιφέρειες**. Ο λόγος **χειροτερεύει** όσο μεγαλώνει η περιοχή
 * *(διάμεσος: κοινότητα 0,249 → περιφέρεια 0,015)*, δηλαδή **αντίστροφα** από ό,τι
 * υπέθετε το σχέδιο της Φ5δ.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🏆 Η ΛΥΣΗ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ — ΜΕ ΕΝΑ ΠΑΡΑΠΑΝΩ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Δεν είναι νέα ιδέα, και δεν έπρεπε να είναι.** Η βιομηχανία λύνει *ακριβώς* αυτό
 * με **εσωτερική προσέγγιση**: το δίπλωμα **US 10,003,946** *(«Enhanced spatial index
 * for point in polygon operations»)* περιγράφει R-tree όπου το bounding box δίνει
 * `ΟΧΙ`/`ΙΣΩΣ`, και προστίθεται *«an interior approximation of the polygon … quad tree
 * tiles … as an inexpensive approximation of the interior»* ώστε το `ΙΣΩΣ` να γίνει
 * **`ΝΑΙ` χωρίς να ανοίξει το πολύγωνο**. Το ίδιο πράγμα ονομάζει η **S2** του Google
 * `GetInteriorCovering` — *«returns an S2CellUnion that is **contained within** the
 * given region»*, σε αντιδιαστολή με το `GetCovering` που απλώς την **σκεπάζει**.
 *
 * 🔑 **Το `innerKm` ΕΙΝΑΙ ήδη εσωτερική προσέγγιση — απλώς με πληθυκότητα 1.** Η
 * διόρθωση δεν αλλάζει αρχή· **αίρει έναν αυθαίρετο περιορισμό**.
 *
 * 🏆 **ΠΟΥ ΤΟΥΣ ΞΕΠΕΡΝΑΜΕ — δίσκοι αντί για κελιά.** Το quad-tree tile και το κελί S2
 * είναι **ευθυγραμμισμένα στο πλέγμα**: για να χωρέσουν σε λοξό ή καμπύλο σύνορο
 * χρειάζονται **πολλά μικρά** κελιά, και το πλήθος τους εκρήγνυται ακριβώς εκεί που
 * το σχήμα είναι δύσκολο. Ο **δίσκος** δεν έχει προσανατολισμό: ακολουθεί το σχήμα
 * και όχι το πλέγμα, άρα **ίδια κάλυψη με λιγότερα σχήματα**. Και έχει δύο ακόμη
 * πλεονεκτήματα που μετράνε **περισσότερο** από τη συμπίεση:
 *
 * 1. ⚡ **Καμία νέα εξάρτηση, κανένα νέο πρωτόγονο.** Το κριτήριο *«ο δίσκος Α
 *    περιέχει τον κύκλο Β»* είναι **η ίδια αριθμητική** που ήδη εκτελεί το
 *    `footprintRelation`: `απόσταση + ακτίνα_Β ≤ ακτίνα_Α`. Ένα cell covering θα
 *    απαιτούσε βιβλιοθήκη S2/H3 **και** δεύτερο λεξιλόγιο χωρικής ταυτότητας —
 *    δηλαδή ακριβώς το σχήμα που το ADR-749 καταγγέλλει.
 * 2. 🔒 **Το ερώτημα του επισκέπτη ΕΙΝΑΙ κύκλος** *(`GeoCircle`)*. Δίσκος εναντίον
 *    δίσκου απαντιέται **ακριβώς**· δίσκος εναντίον κελιών απαιτεί προσέγγιση **του
 *    ερωτήματος** — δηλαδή θα εισήγαγε το σφάλμα από την **άλλη** πλευρά.
 *
 * ⛔ **Απορρίφθηκε το «στείλε τα πολύγωνα στον πελάτη»**: **~120 MB** ωμό GeoJSON
 * *(μετρημένο — δες `scripts/build-admin-footprints.ts`)*, και η απλοποίησή τους
 * **σπάει τη συντηρητικότητα**: ένα απλοποιημένο περίγραμμα μπορεί να διεκδικήσει
 * χώρο που δεν του ανήκει, δηλαδή να παραγάγει **ψευδώς θετικό ισχυρισμό παρουσίας**
 * σε δημόσιο κατάλογο. Το κάλυμμα δίσκων **δεν μπορεί** *(δες την εγγύηση παρακάτω)*.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔒 Η ΕΓΓΥΗΣΗ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΔΕΙΞΗ, ΟΧΙ ΡΥΘΜΙΣΗ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Κάθε δίσκος που επιστρέφεται βρίσκεται ΟΛΟΚΛΗΡΟΣ μέσα στο σχήμα.**
 *
 * *Απόδειξη*: έστω κέντρο `p` **εντός** του σχήματος και `d` η απόσταση από την
 * **πλησιέστερη ακμή οποιουδήποτε δακτυλίου** *(συμπεριλαμβανομένων των τρυπών —
 * το {@link geoRingsNearestEdgeMetres} τους μετρά όλους)*. Ο ανοιχτός δίσκος
 * `B(p, d)` **δεν περιέχει κανένα συνοριακό σημείο**. Είναι συνεκτικός, το `p` είναι
 * εσωτερικό, και δεν τέμνει το σύνορο ⇒ **ολόκληρος** εσωτερικός. ∎
 *
 * ⇒ Το κάλυμμα είναι **υπο-προσέγγιση**: μπορεί να πει *«δεν ξέρω»*, **ποτέ**
 * *«ναι» κατά λάθος*. Αυτό είναι το σωστό πρόσημο του σφάλματος για **δημόσιο
 * ισχυρισμό**: το κόστος μιας χαμένης εμφάνισης το πληρώνει το γραφείο· το κόστος
 * ενός ψεύτικου ισχυρισμού το πληρώνει **ο επισκέπτης, και η εμπιστοσύνη**.
 */

import { distanceMeters } from './geo-distance';
import { geoRingsInscribedRadius, isPointInGeoRings } from './geo-ring';
import type { GeoCircle, GeoOutline, GeoPoint } from '@/types/geo/coordinates';

const METRES_PER_KM = 1000;

/**
 * Πόσο πυκνά δειγματοληπτούμε το πλαίσιο του σχήματος, **ανά άξονα**.
 *
 * ⚠️ Το κόστος είναι `O(δείγματα² × ακμές)` — και το `geoRingsNearestEdgeMetres`
 * σαρώνει **κάθε** ακμή. Στα **32** το χειρότερο σχήμα της Ελλάδας *(περιφέρεια με
 * χιλιάδες κορυφές)* μένει σε δευτερόλεπτα, και τρέχει **μία φορά, στο build**.
 */
const DEFAULT_GRID = 32;

/** Οι επιλογές του καλύμματος — **όλες δηλωμένες**, καμία μαγική σταθερά στο σώμα. */
export interface InteriorCoverOptions {
  /** Ταβάνι δίσκων. Πάνω από αυτό το κέρδος σε bytes δεν αξίζει το κέρδος σε κάλυψη. */
  readonly maxDiscs: number;
  /** Σταματάμε μόλις το κάλυμμα πιάσει αυτό το **κλάσμα εμβαδού** του σχήματος. */
  readonly targetCoverage: number;
  /** Δίσκος μικρότερος από αυτό δεν προστίθεται — δεν χωράει ούτε μία αγγελία. */
  readonly minDiscKm: number;
  /** Δείγματα ανά άξονα. Δες {@link DEFAULT_GRID}. */
  readonly grid: number;
}

export const DEFAULT_INTERIOR_COVER: InteriorCoverOptions = {
  maxDiscs: 16,
  targetCoverage: 0.92,
  minDiscKm: 0.2,
  grid: DEFAULT_GRID,
};

/**
 * **Ταβάνι ακμών για τη ΔΕΙΓΜΑΤΟΛΗΨΙΑ** — και **μόνο** για αυτήν.
 *
 * 🔴 **Το κόστος ήταν το πρόβλημα**: η ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ έχει **46.544**
 * κορυφές· `grid² × κορυφές × 2` = ~95 M πράξεις ⇒ **9 δευτερόλεπτα** για **ένα**
 * σχήμα, μετρημένα. Επί 7.440 σχήματα, το build θα γινόταν ακατοίκητο.
 *
 * 🔑 **ΚΑΙ Η ΕΓΓΥΗΣΗ ΔΕΝ ΘΥΣΙΑΖΕΤΑΙ**: το αραιωμένο περίγραμμα χρησιμοποιείται **μόνο**
 * για να *διαλέξει* πού να κοιτάξουμε. Η **ακτίνα κάθε δίσκου που εκπέμπεται**
 * υπολογίζεται ξανά στο **πλήρες** περίγραμμα *(δες {@link exactDisc})*, άρα η απόδειξη
 * «ο δίσκος είναι ολόκληρος μέσα» μένει **άθικτη**. Η αραίωση μπορεί να μας κάνει να
 * διαλέξουμε **χειρότερο** κέντρο — ποτέ **λάθος** δίσκο.
 */
const SAMPLING_EDGE_BUDGET = 2500;

/** Ένα υποψήφιο κέντρο, με τον **μέγιστο** δίσκο που χωράει εκεί. */
interface Candidate {
  readonly point: GeoPoint;
  readonly radiusKm: number;
  /** Βάρος εμβαδού: το `cos(φ)` διορθώνει τη σύγκλιση των μεσημβρινών. */
  readonly weight: number;
  /**
   * **Επίπεδες συντεταγμένες σε μέτρα**, γύρω από το κέντρο του πλαισίου.
   *
   * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ**: ο άπληστος συγκρίνει **κάθε υποψήφιο με κάθε υποψήφιο**
   * σε κάθε γύρο — `O(n²)` ανά δίσκο. Με ακριβή αποστασιομέτρηση *(τριγωνομετρία)*
   * το αρχείο άγκυρας έκανε **185 δευτερόλεπτα**, μετρημένα. Σε τοπική κλίμακα η
   * επίπεδη προσέγγιση είναι **ισοδύναμη για ταξινόμηση** και ασύγκριτα φθηνότερη.
   *
   * 🔒 **ΔΕΝ αγγίζει την εγγύηση**: χρησιμοποιείται **μόνο** για λογιστική κάλυψης
   * *(ποιο δείγμα θεωρείται καλυμμένο)*. Η **ακτίνα** κάθε εκπεμπόμενου δίσκου
   * βγαίνει από το {@link geoRingsInscribedRadius} στο **πλήρες** περίγραμμα, και ο
   * έλεγχος σε **χρόνο εκτέλεσης** ({@link interiorContainsCircle}) μένει ακριβής.
   */
  readonly x: number;
  readonly y: number;
  covered: boolean;
}

/** Μέτρα ανά μοίρα γεωγραφικού πλάτους — σταθερό με επαρκή ακρίβεια για λογιστική. */
const METRES_PER_DEGREE = 111_320;

function withinFast(a: Candidate, b: Candidate, radiusKm: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const limit = radiusKm * METRES_PER_KM;
  return dx * dx + dy * dy <= limit * limit;
}

/**
 * Αραιώνει τα περιγράμματα κρατώντας **κάθε ν-οστή** κορυφή, ώστε το σύνολο των ακμών
 * να μείνει κάτω από το {@link SAMPLING_EDGE_BUDGET}.
 *
 * ⚠️ **Δεν είναι Douglas-Peucker και δεν πρέπει να γίνει**: εδώ δεν μας νοιάζει η
 * πιστότητα του σχήματος — μας νοιάζει **πού να κοιτάξουμε**. Ένα φθηνό, ομοιόμορφο
 * αραίωμα δίνει την ίδια πληροφορία τοποθεσίας με κλάσμα του κόστους, και **καμία**
 * απόφαση δεν κρέμεται από την ακρίβειά του.
 */
function thinRings(rings: readonly GeoOutline[]): readonly GeoOutline[] {
  const total = rings.reduce((sum, ring) => sum + ring.length, 0);
  if (total <= SAMPLING_EDGE_BUDGET) return rings;

  const stride = Math.ceil(total / SAMPLING_EDGE_BUDGET);
  const thinned: GeoOutline[] = [];
  for (const ring of rings) {
    const kept = ring.filter((_, index) => index % stride === 0);
    // Κάτω από 3 κορυφές δεν είναι δακτύλιος — κράτα τον αυτούσιο αντί να τον χάσεις.
    thinned.push(kept.length >= 3 ? kept : ring);
  }
  return thinned;
}

function boundingBox(rings: readonly GeoOutline[]): {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
} | null {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const ring of rings) {
    for (const vertex of ring) {
      if (vertex.lat < minLat) minLat = vertex.lat;
      if (vertex.lat > maxLat) maxLat = vertex.lat;
      if (vertex.lng < minLng) minLng = vertex.lng;
      if (vertex.lng > maxLng) maxLng = vertex.lng;
    }
  }
  return Number.isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null;
}

/**
 * Δειγματοληπτεί το εσωτερικό και κρατά, για κάθε δείγμα, τον **μέγιστο δίσκο** που
 * χωράει εκεί.
 *
 * 🔑 Τα δείγματα μπαίνουν στα **κέντρα** των κελιών του πλέγματος, όχι στις γωνίες:
 * ένα λεπτό σχήμα που περνά ανάμεσα από γραμμές πλέγματος θα έδινε **μηδέν** δείγματα
 * αν δειγματοληπτούσαμε στις γωνίες — δηλαδή θα σιωπούσε ακριβώς για τα σχήματα που
 * αυτό το module υπάρχει για να σώσει.
 */
function sampleInterior(rings: readonly GeoOutline[], grid: number): Candidate[] {
  const box = boundingBox(rings);
  if (box === null) return [];

  const latStep = (box.maxLat - box.minLat) / grid;
  const lngStep = (box.maxLng - box.minLng) / grid;
  if (latStep <= 0 || lngStep <= 0) return [];

  const candidates: Candidate[] = [];
  for (let row = 0; row < grid; row += 1) {
    const lat = box.minLat + (row + 0.5) * latStep;
    const weight = Math.cos((lat * Math.PI) / 180);
    for (let col = 0; col < grid; col += 1) {
      const point = { lat, lng: box.minLng + (col + 0.5) * lngStep };
      if (!isPointInGeoRings(point, rings)) continue;
      const radiusKm = geoRingsInscribedRadius(rings, point);
      if (radiusKm <= 0) continue;
      candidates.push({
        point,
        radiusKm,
        weight,
        x: (point.lng - box.minLng) * METRES_PER_DEGREE * weight,
        y: (point.lat - box.minLat) * METRES_PER_DEGREE,
        covered: false,
      });
    }
  }
  return candidates;
}

/** Το αποτέλεσμα — **και η μέτρησή του**, ώστε ο καλών να μη μαντεύει. */
export interface InteriorCover {
  /** Οι δίσκοι, **φθίνουσας** ακτίνας. Ο πρώτος είναι ο μέγιστος εγγεγραμμένος. */
  readonly discs: readonly GeoCircle[];
  /** Κλάσμα εμβαδού που καλύπτουν, σταθμισμένο κατά `cos(φ)`. */
  readonly coverage: number;
  /** Κλάσμα που κάλυπτε ο **ένας** δίσκος — ο παρονομαστής της βελτίωσης. */
  readonly singleDiscCoverage: number;
}

const EMPTY_COVER: InteriorCover = { discs: [], coverage: 0, singleDiscCoverage: 0 };

/**
 * **Άπληστο κάλυμμα εσωτερικών δίσκων.**
 *
 * Σε κάθε γύρο διαλέγει το **ακάλυπτο** δείγμα με τον **μεγαλύτερο** δίσκο και τον
 * προσθέτει. Είναι η κλασική άπληστη προσέγγιση του *set cover* — και εδώ έχει μια
 * ιδιότητα που την κάνει ιδιαίτερα κατάλληλη: ο **πρώτος** δίσκος είναι, εξ ορισμού
 * της επιλογής, ο **μέγιστος εγγεγραμμένος κύκλος** του σχήματος — δηλαδή **ακριβώς**
 * το «pole of inaccessibility» που ήδη υπολογίζει το `geoRingsInscribedRadius`.
 * ⇒ **Το `k = 1` αναπαράγει τη σημερινή συμπεριφορά**, και κάθε επιπλέον δίσκος μόνο
 * προσθέτει. Καμία παλινδρόμηση δεν είναι δυνατή.
 */
export function interiorCircleCover(
  rings: readonly GeoOutline[],
  options: InteriorCoverOptions = DEFAULT_INTERIOR_COVER,
): InteriorCover {
  // 🔑 Δειγματοληπτούμε στο **αραιωμένο** σχήμα (ταχύτητα)· μετράμε στο **πλήρες**
  //    (εγγύηση). Δες {@link SAMPLING_EDGE_BUDGET}.
  const coarse = thinRings(rings);
  const candidates = sampleInterior(coarse, options.grid);
  if (candidates.length === 0) return EMPTY_COVER;

  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return EMPTY_COVER;

  const discs: GeoCircle[] = [];
  let coveredWeight = 0;
  let singleDiscCoverage = 0;

  while (discs.length < options.maxDiscs) {
    const pick = discs.length === 0
      ? widestCandidate(candidates)
      : mostRevealingCandidate(candidates);
    if (pick === null) break;

    // 🔒 **ΕΔΩ ΓΕΝΝΙΕΤΑΙ Η ΕΓΓΥΗΣΗ**: η ακτίνα ξαναμετριέται στο **πλήρες**
    //    περίγραμμα. Ό,τι κι αν υποσχέθηκε το αραιωμένο, εκπέμπεται μόνο ό,τι
    //    χωράει **στ' αλήθεια**.
    const exactKm = geoRingsInscribedRadius(rings, pick.point);
    pick.covered = true;
    if (exactKm < options.minDiscKm) continue;

    discs.push({ center: pick.point, radiusKm: exactKm });

    for (const candidate of candidates) {
      if (candidate.covered) continue;
      if (withinFast(pick, candidate, exactKm)) {
        candidate.covered = true;
        coveredWeight += candidate.weight;
      }
    }
    coveredWeight += pick.weight;

    if (discs.length === 1) singleDiscCoverage = coveredWeight / total;
    if (coveredWeight / total >= options.targetCoverage) break;
  }

  discs.sort((a, b) => b.radiusKm - a.radiusKm);
  return { discs, coverage: coveredWeight / total, singleDiscCoverage };
}

/**
 * Ο **μέγιστος εγγεγραμμένος** — ο πρώτος δίσκος, πάντα.
 *
 * 🔑 **Γιατί ο πρώτος διαλέγεται αλλιώς από τους υπόλοιπους**: αυτός είναι που κάνει
 * το `k = 1` να **ταυτίζεται** με τη σημερινή συμπεριφορά *(το «pole of
 * inaccessibility» που ήδη υπολογίζει το `geoRingsInscribedRadius`)*. Αν διαλεγόταν
 * κι αυτός με κριτήριο «νέα κάλυψη», το κάλυμμα θα μπορούσε να είναι **χειρότερο**
 * από τον έναν δίσκο για κάποια σχήματα — δηλαδή παλινδρόμηση.
 */
function widestCandidate(candidates: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (candidate.covered) continue;
    if (best === null || candidate.radiusKm > best.radiusKm) best = candidate;
  }
  return best;
}

/**
 * Ο δίσκος που **αποκαλύπτει το περισσότερο καινούργιο** — κλασικός άπληστος
 * *set cover*.
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ «ο μεγαλύτερος»**, που ήταν η πρώτη γραφή: ο μεγαλύτερος
 * ακάλυπτος δίσκος βρίσκεται συνήθως **δίπλα** στον προηγούμενο *(τα πλατιά μέρη
 * ενός σχήματος είναι γειτονικά)* και επικαλύπτεται μαζί του. **Μετρημένο στον ΔΗΜΟ
 * ΘΕΣΣΑΛΟΝΙΚΗΣ**: με κριτήριο «ακτίνα» οι 8 δίσκοι έφταναν **68,4%**· το ακίνητο στη
 * Σταυρούπολη έμενε **έξω**. Το «νέα κάλυψη» πάει τον επόμενο δίσκο εκεί όπου
 * **λείπει** κάλυψη — δηλαδή στα άκρα, που είναι ακριβώς όπου ζουν οι συνοικίες.
 */
function mostRevealingCandidate(candidates: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  let bestGain = 0;
  for (const candidate of candidates) {
    if (candidate.covered) continue;
    let gain = 0;
    for (const other of candidates) {
      if (other.covered) continue;
      if (withinFast(candidate, other, candidate.radiusKm)) gain += other.weight;
    }
    if (best === null || gain > bestGain) {
      best = candidate;
      bestGain = gain;
    }
  }
  return best;
}

/**
 * **Ο ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ** — «ποιους δίσκους μπορώ να επικαλεστώ για να πω *σε περιέχω*;»
 *
 * ⚠️ **Γιατί ζει εδώ και όχι στον κριτή**: το `interior` είναι **προαιρετικό** *(μπαίνει
 * μόνο όπου ο ένας δίσκος δεν φτάνει — δες `build-admin-footprints`)*. Αν κάθε καλών
 * έγραφε `f.interior ?? [...]` μόνος του, η **προεπιλογή** θα ήταν αντιγραμμένη σε
 * κάθε σημείο κλήσης, και η μέρα που θα άλλαζε θα άφηνε πίσω αντίγραφα *(N.0.2)*.
 */
export function footprintInteriorDiscs(footprint: {
  readonly center: GeoPoint;
  readonly innerKm: number;
  readonly interior?: readonly GeoCircle[];
}): readonly GeoCircle[] {
  if (footprint.interior !== undefined && footprint.interior.length > 0) {
    return footprint.interior;
  }
  return footprint.innerKm > 0
    ? [{ center: footprint.center, radiusKm: footprint.innerKm }]
    : [];
}

/**
 * **«Περιέχω ολόκληρο αυτόν τον κύκλο;»** — το ερώτημα που το `innerKm` απαντούσε με
 * έναν δίσκο και τώρα απαντιέται με όσους χρειάζονται.
 *
 * ⚠️ **Ο έλεγχος είναι ανά δίσκο, ΠΟΤΕ αθροιστικός**: ένας κύκλος που «σκεπάζεται»
 * από την **ένωση** δύο δίσκων χωρίς να χωράει σε **κανέναν** ξεχωριστά **δεν**
 * θεωρείται περιεχόμενος. Η ένωση δίσκων δεν είναι κυρτή, και ο έλεγχος «μέσα στην
 * ένωση» απαιτεί γεωμετρία που **δεν** έχουμε — ενώ αυτή η αυστηρότητα κρατά την
 * εγγύηση **αποδεδειγμένη**, όχι πιθανή. Χάνουμε λίγες αληθινές περιπτώσεις· δεν
 * κερδίζουμε **ούτε μία** ψεύτικη.
 */
export function interiorContainsCircle(
  discs: readonly GeoCircle[],
  center: GeoPoint,
  radiusKm: number,
): boolean {
  for (const disc of discs) {
    const gapKm = distanceMeters(disc.center, center) / METRES_PER_KM;
    if (gapKm + radiusKm <= disc.radiusKm) return true;
  }
  return false;
}
