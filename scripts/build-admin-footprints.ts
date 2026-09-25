/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΩΝ ΑΠΟΤΥΠΩΜΑΤΩΝ** — πολύγωνα (εκτός repo) → δύο κύκλοι
 * ανά διοικητική οντότητα (`public/data/admin-footprints.json`). ADR-846 Φάση 2.5.
 *
 * ```
 * WFS GeoJSON (CC-BY)  →  join κατά κωδικό Καλλικράτη
 *                      →  geoRingsBoundingCircle   (center, outerKm)
 *                      →  geoRingsInscribedRadius  (innerKm)
 *                      →  public/data/admin-footprints.json
 * ```
 *
 * **Εκτέλεση**: `npm run build:admin-footprints`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚖️ Η ΑΔΕΙΑ — ΚΑΙ ΓΙΑΤΙ **ΑΥΤΗ** Η ΔΙΑΔΡΟΜΗ ΠΡΟΣ ΤΑ ΙΔΙΑ ΔΕΔΟΜΕΝΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η πηγή είναι το **geodata.gov.gr** *(«Όρια Δήμων — Καλλικράτης»,
 * `63786e9f-7be9-4d1e-99c9-48ff45d0962f`)*, υπό **Creative Commons Attribution 3.0** —
 * η **μόνη** άδεια που επιτρέπει εμπορική χρήση με αναφορά πηγής. Το OSM (ODbL,
 * share-alike) και το Eurostat GISCO (*«not… for commercial purposes»*) είναι **και τα
 * δύο απαγορευμένα** — δες `types/geo/admin-footprint.ts` για τον πλήρη πίνακα.
 *
 * 🔴 **Ο ίδιος ο διακομιστής του geodata.gov.gr δεν απαντά** *(μετρημένο 2026-09-08 και
 * ξανά 2026-09-08 από άλλη σύνοδο: `http=000`, timeout 21s, HTTP **και** HTTPS, ενώ το
 * DNS λύνεται κανονικά και κάθε άλλος ελληνικός κόμβος απαντά)*. Άρα τα **ίδια**
 * δεδομένα αντλούνται από τη **δημοσίευση του ΥΠΕΝ** στο `data.gov.gr`
 * *(`gis-ypen-wfd-wms-*`)*, που δηλώνει ρητά στην περιγραφή της **«Πηγή:
 * geodata.gov.gr»** και τα σερβίρει ως ζωντανό WFS. Η CC-BY **ταξιδεύει με τα
 * δεδομένα** *(CC-BY 3.0 §8α: ο αδειοδότης προσφέρει στον κάθε παραλήπτη τους ίδιους
 * όρους)*, άρα η υποχρέωσή μας παραμένει **μία**: να αναφέρουμε την πηγή — και
 * αναφέρεται **μέσα** στο παραγόμενο αρχείο (`meta.source` / `meta.license`), όχι σε
 * σχόλιο που κανείς δεν διανέμει.
 *
 * ⚠️ **Τα πολύγωνα ΔΕΝ μπαίνουν ΠΟΤΕ στο repo** *(~120 MB)*. Κατεβαίνουν σε cache εκτός
 * παρακολούθησης και μένουν εκεί· διανέμονται **μόνο οι δικοί μας αριθμοί**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΜΙΑ ΓΕΩΜΕΤΡΙΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο γεννήτορας είναι **TypeScript και τρέχει με `tsx`** ακριβώς γι' αυτό: εισάγει τον
 * **πραγματικό** SSoT (`lib/geo/*`) αντί να ξαναγράψει κύκλο, απόσταση ή ανάγνωση
 * GeoJSON σε JavaScript «επειδή είναι script». Ένας `.mjs` γεννήτορας θα ήταν
 * υποχρεωμένος να τα αντιγράψει — δηλαδή το κλασικό sibling clone του **N.18**, με τη
 * χειρότερη δυνατή μορφή: δύο υλοποιήσεις της **ίδιας κρίσης**, όπου η μία παράγει τα
 * δεδομένα και η άλλη τα καταναλώνει. *(Λειτουργεί χωρίς ρύθμιση alias γιατί κάθε
 * `@/`-εισαγωγή μέσα στο `lib/geo` είναι **type-only**, άρα σβήνεται στη μεταγλώττιση.)*
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ringsFootprint } from '../src/lib/geo/geo-footprint';
import { geoJsonRings } from '../src/lib/geo/geo-geojson';
import { DEFAULT_INTERIOR_COVER, interiorCircleCover } from '../src/lib/geo/geo-interior-cover';
import type { GeoCircle, GeoOutline } from '../src/types/geo/coordinates';
import type { GeoFootprint } from '../src/types/geo/admin-footprint';
import {
  ATTRIBUTION,
  LAYERS,
  MUNICIPAL_UNIT_LEVEL,
  REPO_ROOT,
  buildIdIndex,
  composeMunicipalitiesFromUnits,
  loadLayer,
  matchFeature,
  readHierarchyRows,
  type HierarchyRow,
} from './lib/admin-boundaries/admin-boundary-source';

// 🔑 ADR-883: η φόρτωση του WFS, η αντιστοίχιση κωδικού → `id` και η σύνθεση των δήμων
//    του Κλεισθένη μετακόμισαν στο `lib/admin-boundaries/admin-boundary-source.ts` — τις
//    χρειάζεται **και** ο γεννήτορας των ορίων του χάρτη, και δεύτερο αντίγραφο θα ήταν
//    δύο απαντήσεις στο «ποιο σχήμα ανήκει σε ποια οντότητα;» (N.18).
const OUTPUT_PATH = join(REPO_ROOT, 'public', 'data', 'admin-footprints.json');

/** Ό,τι κρατάμε από μια σάρωση ενός layer — για την αναφορά, όχι για το αρχείο. */
interface LayerReport {
  readonly layer: string;
  readonly level: number;
  readonly features: number;
  readonly written: number;
  readonly unmatched: number;
  readonly ambiguous: number;
  readonly degenerate: number;
  readonly innerZero: number;
}

/**
 * Οι **δύο κύκλοι** ενός χαρακτηριστικού. `null` όταν η γεωμετρία δεν είναι σχήμα.
 *
 * ⚠️ Οι δύο κύκλοι είναι **ομόκεντροι κατά κατασκευή**: το κέντρο βγαίνει από τον
 * περικλείοντα και **περνιέται** στον εγγεγραμμένο. Δύο ανεξάρτητα υπολογισμένα κέντρα
 * θα κατέστρεφαν τη σχέση `εσωτερικός ⊆ σχήμα ⊆ εξωτερικός`, από την οποία κρέμεται
 * **κάθε** συμπέρασμα του κριτή.
 */
function footprintOf(geometry: GeoJSON.Geometry | null, level: number): GeoFootprint | null {
  if (geometry === null) return null;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null;

  // 🔑 **Η κατασκευή έφυγε στο `lib/geo/geo-footprint.ts` (Φ3)** — ο γεννήτορας δεν
  //    είναι πλέον ο μόνος που τη χρειάζεται *(το χαραγμένο πολύγωνο τη χρειάζεται
  //    στον γραφέα ΚΑΙ στον αναγνώστη)*. Εδώ μένει **μόνο** ό,τι είναι δικό του: η
  //    ανάγνωση GeoJSON και η **στρογγυλοποίηση για bytes**, που δεν αφορά κανέναν
  //    καταναλωτή σε χρόνο εκτέλεσης.
  const rings = geoJsonRings(geometry);
  const footprint = ringsFootprint(rings);
  if (footprint === null) return null;

  return {
    center: round(footprint.center),
    outerKm: roundKm(footprint.outerKm),
    innerKm: roundKm(footprint.innerKm),
    ...interiorOf(rings, level),
  };
}

/**
 * **ΤΟ ΕΣΩΤΕΡΙΚΟ ΚΑΛΥΜΜΑ — ΚΑΙ ΜΟΝΟ ΟΠΟΥ ΧΡΕΙΑΖΕΤΑΙ** *(ADR-846 §9 #11)*.
 *
 * 🔴 **Το πρόβλημα**: ο **ένας** εγγεγραμμένος κύκλος καταρρέει για μη-συμπαγή σχήματα
 * — ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ `innerKm = 0,123` σε `outerKm = 5,005`. Μετρημένο σε **7.440**
 * αποτυπώματα: **1.431 (19,2%)** με λόγο `< 0,10`.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ ΓΙΑ ΟΛΟΥΣ**: αυτό το αρχείο το κατεβάζει **κάθε ανώνυμος επισκέπτης**
 * *(713 KB σήμερα)*. Ένα κάλυμμα παντού θα το φούσκωνε **χωρίς αντάλλαγμα** εκεί όπου
 * ο ένας δίσκος ήδη απαντά. ⇒ Εκπέμπουμε `interior` **μόνο** όταν ο ένας δίσκος
 * αφήνει την κάλυψη κάτω από το κατώφλι — **πληρώνουμε μόνο εκεί που είναι σπασμένο**.
 *
 * 🔑 Και όταν το εκπέμπουμε, ο **πρώτος** δίσκος είναι ο μέγιστος εγγεγραμμένος ⇒ το
 * κάλυμμα είναι **υπερσύνολο** της σημερινής ικανότητας, ποτέ υποσύνολο.
 */
function interiorOf(rings: readonly GeoOutline[], level: number): { interior?: GeoCircle[] } {
  const budget = DISC_BUDGET[level] ?? DEFAULT_INTERIOR_COVER.maxDiscs;
  // 🔑 Μηδενικός προϋπολογισμός ⇒ ούτε **υπολογίζουμε**. Στο επίπεδο 7 αυτό γλιτώνει
  //    **6.062** περιττά καλύμματα από κάθε build.
  if (budget <= 0) return {};

  const cover = interiorCircleCover(rings, {
    ...DEFAULT_INTERIOR_COVER,
    maxDiscs: budget,
  });
  if (cover.discs.length <= 1) return {};
  if (cover.singleDiscCoverage >= INTERIOR_NEEDED_BELOW) return {};
  if (cover.coverage - cover.singleDiscCoverage < INTERIOR_MIN_GAIN) return {};

  return {
    interior: cover.discs.map((disc) => ({
      center: roundDisc(disc.center),
      radiusKm: roundDiscKm(disc.radiusKm),
    })),
  };
}

/**
 * **ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΔΙΣΚΩΝ ΑΝΑ ΕΠΙΠΕΔΟ** — και είναι **οικονομική**, όχι γεωμετρική
 * απόφαση.
 *
 * 🔴 **Μετρημένο (09/09)**: με ενιαίο ταβάνι 16 το αρχείο πήγε **697 → 5.988 KB ωμό**
 * *(gzip **121 → 956 KB**)*, και το **77%** των δίσκων πήγε στο **επίπεδο 7**, τις
 * **6.062 κοινότητες**. Το αρχείο το κατεβάζει **κάθε ανώνυμος επισκέπτης**.
 *
 * 🔑 **Η κατανομή ακολουθεί το πλήθος, αντίστροφα**: **14** περιφέρειες μπορούν να
 * έχουν 24 δίσκους η καθεμιά και να κοστίσουν **τίποτα**· 6.062 κοινότητες δεν
 * μπορούν. Και οι κοινότητες είναι **μικρές** — ο ένας δίσκος τους ήδη πιάνει
 * μεγαλύτερο κλάσμα *(διάμεσος λόγος `inner/outer` **0,249**, ο υψηλότερος όλων)*.
 */
const DISC_BUDGET: Readonly<Record<number, number>> = {
  2: 24, // αποκεντρωμένες διοικήσεις — 8 οντότητες
  3: 24, // περιφέρειες — 14
  4: 20, // περιφερειακές ενότητες — 75
  5: 16, // δήμοι — 333
  6: 10, // δημοτικές ενότητες — 948
  7: 0,  // δημοτικές/τοπικές κοινότητες — 6.062 · δες παρακάτω
};

/**
 * 🔴 **ΓΙΑΤΙ ΤΟ ΕΠΙΠΕΔΟ 7 ΠΑΙΡΝΕΙ ΜΗΔΕΝ — ΜΕΤΡΗΜΕΝΗ ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ**
 *
 * Καμπύλη κόστους *(gzip του αρχείου που κατεβάζει **κάθε** επισκέπτης)*:
 *
 * | ταβάνι κοινοτήτων | gzip | μονάδες με κάλυμμα |
 * |---|---|---|
 * | 6 | **403 KB** | 4.468 |
 * | 4 | 352 KB | 4.468 |
 * | 2 | 297 KB | 4.468 |
 * | **0** | **231 KB** | **1.050** |
 *
 * *(σημερινή βάση: **121 KB**)*
 *
 * **Τρεις λόγοι, όλοι μετρημένοι:**
 * 1. Οι κοινότητες είναι το **λιγότερο σπασμένο** επίπεδο — διάμεσος λόγος
 *    `inner/outer` **0,249**, ο **υψηλότερος** όλων *(περιφέρεια: 0,015)*.
 * 2. Είναι **6.062 από 7.440** οντότητες και θα κατανάλωναν **61%** των δίσκων.
 * 3. Η αστοχία που **μετρήθηκε στην οθόνη** ήταν σε **δήμο** και **περιφέρεια**.
 *
 * ⚠️ **Και είναι στοίχημα με ημερομηνία λήξης**: το **§9 #13** *(διοικητική απάντηση
 * μέσω ιεραρχίας)* καθιστά **όλα** αυτά τα bytes περιττά για διοικητικά ερωτήματα.
 * Πληρώνουμε **1,9×** σήμερα αντί για **3,3×**, για μηχανισμό που σχεδιάζουμε να
 * αντικαταστήσουμε. ⇒ Αν το #13 απορριφθεί, **αυτός ο πίνακας ξανασυζητιέται**.
 */

/**
 * 4 δεκαδικά ≈ **11 m** για το **κέντρο δίσκου**.
 *
 * ⚠️ **Χωριστό από το {@link round} των 5 δεκαδικών επίτηδες**: εκείνο στρογγυλοποιεί
 * το κέντρο του **αποτυπώματος**, που είναι η αναφορά κάθε απόστασης. Εδώ μιλάμε για
 * το κέντρο ενός δίσκου **ακτίνας ≥ 200 m** — 11 m είναι θόρυβος, και ο πληθυντικός
 * πολλαπλασιάζει το κόστος επί **δεκάδες χιλιάδες**.
 */
function roundDisc(center: { lat: number; lng: number }): { lat: number; lng: number } {
  return { lat: Number(center.lat.toFixed(4)), lng: Number(center.lng.toFixed(4)) };
}

/** 2 δεκαδικά = **10 m** ακτίνας. 🔒 Στρογγυλοποιεί **ΠΡΟΣ ΤΑ ΚΑΤΩ** — δες παρακάτω. */
function roundDiscKm(kilometres: number): number {
  // 🔒 **ΚΡΙΣΙΜΟ: ΠΟΤΕ ΠΡΟΣ ΤΑ ΠΑΝΩ.** Το `toFixed` στρογγυλοποιεί κανονικά, και μια
  //    ακτίνα που **μεγάλωσε** κατά 5 m σπάει την απόδειξη «ο δίσκος είναι ολόκληρος
  //    μέσα» — δηλαδή θα μπορούσε να γεννήσει **ψευδώς θετικό** ισχυρισμό παρουσίας.
  //    Το `floor` κοστίζει έως 10 m κάλυψης· η εγγύηση δεν κοστίζει τίποτα.
  return Math.floor(kilometres * 100) / 100;
}

/**
 * Κάτω από αυτό το κλάσμα, ο **ένας** δίσκος θεωρείται ανεπαρκής.
 *
 * ⚠️ **Ήταν 0,6 και έπιανε 6.870 από 7.440 οντότητες (92%)** — δηλαδή δεν διέκρινε
 * τίποτα. Στο **0,45** μένουν εκείνες όπου ο ένας δίσκος χάνει **πάνω από το μισό**
 * του σχήματος.
 */
const INTERIOR_NEEDED_BELOW = 0.45;

/** Και δεν γράφουμε κάλυμμα που **δεν βοηθά**: χωρίς αυτό, πληρώνουμε bytes για τίποτα. */
const INTERIOR_MIN_GAIN = 0.2;

/** 5 δεκαδικά ≈ **1,1 m** — κάτω από κάθε σφάλμα της ίδιας της πηγής στο 1:50.000. */
function round(center: { lat: number; lng: number }): { lat: number; lng: number } {
  return { lat: Number(center.lat.toFixed(5)), lng: Number(center.lng.toFixed(5)) };
}

/** 3 δεκαδικά του χιλιομέτρου = **1 m**. Περισσότερα θα ήταν θόρυβος με κόστος bytes. */
function roundKm(kilometres: number): number {
  return Number(kilometres.toFixed(3));
}

/** Σαρώνει ένα layer και γράφει ό,τι **ταιριάζει μονοσήμαντα** στον συσσωρευτή. */
function collectLayer(
  collection: GeoJSON.FeatureCollection,
  level: number,
  layer: string,
  index: ReadonlyMap<string, string>,
  ambiguous: ReadonlySet<string>,
  into: Map<string, GeoFootprint>,
): LayerReport {
  let written = 0;
  let unmatched = 0;
  let ambiguousHits = 0;
  let degenerate = 0;
  let innerZero = 0;

  for (const feature of collection.features) {
    const match = matchFeature(feature, level, index, ambiguous);
    if (match.kind === 'skipped') {
      if (match.reason === 'ambiguous') ambiguousHits += 1;
      else if (match.reason === 'unmatched') unmatched += 1;
      else degenerate += 1;
      continue;
    }

    const footprint = footprintOf(match.geometry, level);
    if (footprint === null) {
      degenerate += 1;
      continue;
    }

    if (footprint.innerKm === 0) innerZero += 1;
    into.set(match.id, footprint);
    written += 1;
  }

  return {
    layer,
    level,
    features: collection.features.length,
    written,
    unmatched,
    ambiguous: ambiguousHits,
    degenerate,
    innerZero,
  };
}

/**
 * 🔴 **ΟΙ ΔΗΜΟΙ ΠΟΥ Η ΠΗΓΗ ΔΕΝ ΞΕΡΕΙ** — ADR-846 Φ4. Η **σύνθεση** ζει στην κοινή πηγή
 * (`composeMunicipalitiesFromUnits`)· εδώ μένει μόνο το αποτύπωμα.
 *
 * ⚠️ **Τα δαχτυλίδια ΕΝΩΝΟΝΤΑΙ, δεν μέσο-ποιούνται**: ο `ringsFootprint` δέχεται **όλα**
 * τα δαχτυλίδια μαζί, οπότε ο περικλείων κύκλος βγαίνει από το σύνολο και ο εγγεγραμμένος
 * **περνιέται** από αυτόν — η σχέση `εσωτερικός ⊆ σχήμα ⊆ εξωτερικός` μένει ακέραιη.
 */
function composeFromMunicipalUnits(
  rows: readonly HierarchyRow[],
  units: GeoJSON.FeatureCollection,
  into: Map<string, GeoFootprint>,
): readonly string[] {
  const composed: string[] = [];
  const nameOf = new Map(rows.map((row) => [row.id, row.n]));
  for (const [id, { geometry, children }] of composeMunicipalitiesFromUnits(rows, units, new Set(into.keys()))) {
    const footprint = ringsFootprint(geoJsonRings(geometry));
    if (footprint === null) continue;
    into.set(id, {
      center: round(footprint.center),
      outerKm: roundKm(footprint.outerKm),
      innerKm: roundKm(footprint.innerKm),
    });
    composed.push(`${nameOf.get(id)} ← ${children} δημ. ενότητες`);
  }
  return composed;
}

/**
 * **Ποιος δήμος μένει χωρίς έδαφος** — τυπώνεται ονομαστικά, ποτέ ως αριθμός.
 *
 * ⚠️ Ένας δήμος χωρίς αποτύπωμα είναι **αόρατος σε κάθε κυκλικό ερώτημα**: ο
 * επαγγελματίας τον δηλώνει και ο κριτής απαντά `unknown` για πάντα. Δεν σκάει τίποτα —
 * γι' αυτό πρέπει να **λέγεται**. Ένα πλήθος («λείπουν 8») δεν επιτρέπει σε κανέναν να
 * καταλάβει αν το κενό είναι αναμενόμενο ή καινούριο.
 */
function reportMunicipalitiesWithoutFootprint(
  rows: readonly HierarchyRow[],
  footprints: ReadonlyMap<string, GeoFootprint>,
): void {
  const missing = rows.filter((row) => row.l === 5 && !footprints.has(row.id));
  if (missing.length === 0) {
    console.log('\n✅ ΚΑΘΕ δήμος έχει αποτύπωμα.');
    return;
  }
  console.log(`\n⚠️  ${missing.length} δήμοι ΧΩΡΙΣ αποτύπωμα — αόρατοι σε κυκλικό ερώτημα:`);
  for (const row of missing) console.log(`   • ${row.c} ${row.n}`);
}

/**
 * 🔒 **Η ΑΓΚΥΡΑ ΤΟΥ ΓΕΝΝΗΤΟΡΑ** — τρέχει **πριν** γραφτεί το αρχείο, ποτέ μετά.
 *
 * `outer >= inner` για **κάθε** γραμμή. Αν σπάσει, κάτι θεμελιώδες είναι λάθος στη
 * γεωμετρία και το αρχείο **δεν πρέπει να υπάρξει**: ο κριτής θα έβγαζε αποδείξεις από
 * μια σχέση που δεν ισχύει, δηλαδή θα έλεγε ψέματα **με βεβαιότητα**.
 */
function assertContainment(footprints: ReadonlyMap<string, GeoFootprint>): void {
  for (const [id, footprint] of footprints) {
    if (!(footprint.outerKm >= footprint.innerKm)) {
      throw new Error(`ΑΓΚΥΡΑ: ${id} έχει outerKm ${footprint.outerKm} < innerKm ${footprint.innerKm}`);
    }
    if (!Number.isFinite(footprint.center.lat) || !Number.isFinite(footprint.center.lng)) {
      throw new Error(`ΑΓΚΥΡΑ: ${id} έχει μη-πεπερασμένο κέντρο`);
    }
  }
}

async function main(): Promise<void> {
  const rows = readHierarchyRows();
  const { index, ambiguous } = buildIdIndex(rows);

  console.log(`🗺️  ADR-846 Φ2.5 — αποτυπώματα από ${LAYERS.length} επίπεδα`);
  if (ambiguous.size > 0) {
    console.log(`⚠️  ${ambiguous.size} διφορούμενοι κωδικοί αγνοούνται: ${[...ambiguous].join(', ')}`);
  }

  const footprints = new Map<string, GeoFootprint>();
  const reports: LayerReport[] = [];
  let municipalUnits: GeoJSON.FeatureCollection | null = null;
  for (const { layer, level } of LAYERS) {
    const collection = await loadLayer(layer);
    if (level === MUNICIPAL_UNIT_LEVEL) municipalUnits = collection;
    reports.push(collectLayer(collection, level, layer, index, ambiguous, footprints));
  }

  if (municipalUnits !== null) {
    const composed = composeFromMunicipalUnits(rows, municipalUnits, footprints);
    if (composed.length > 0) {
      console.log(`\n🧩 ${composed.length} δήμοι με ΣΥΝΘΕΤΟ αποτύπωμα (η πηγή τους δεν ξέρει):`);
      for (const line of composed) console.log(`   • ${line}`);
    }
  }

  reportMunicipalitiesWithoutFootprint(rows, footprints);
  assertContainment(footprints);

  const payload = {
    meta: {
      ...ATTRIBUTION,
      retrieved: new Date().toISOString().slice(0, 10),
      generator: 'scripts/build-admin-footprints.ts',
      adr: 'ADR-846 Φάση 2.5',
      levels: Object.fromEntries(reports.map((r) => [r.level, r.written])),
      count: footprints.size,
    },
    // ⚠️ Ταξινομημένο κατά κλειδί ⇒ **ντετερμινιστική** έξοδος: δύο εκτελέσεις με τα ίδια
    // δεδομένα δίνουν byte-ταυτόσημο αρχείο, άρα το `git diff` δείχνει **αλλαγές**, όχι
    // ανακάτεμα σειράς.
    data: Object.fromEntries([...footprints].sort(([a], [b]) => (a < b ? -1 : 1))),
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload)}\n`);

  console.table(reports);
  const bytes = readFileSync(OUTPUT_PATH).length;
  console.log(`✅ ${footprints.size} αποτυπώματα → ${OUTPUT_PATH} (${(bytes / 1024).toFixed(0)} KB ωμό)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
