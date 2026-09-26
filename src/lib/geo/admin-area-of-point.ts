/**
 * @fileoverview **ΣΕ ΠΟΙΑ ΔΙΟΙΚΗΤΙΚΗ ΠΕΡΙΟΧΗ ΠΕΦΤΕΙ ΑΥΤΟ ΤΟ ΣΗΜΕΙΟ;** — με τα όρια του ADR-883.
 * @related ADR-890 Φ0 · ADR-883 (όρια, ταυτότητες) · `admin-boundary-file.ts` · `geo-ring.ts`
 * @module lib/geo/admin-area-of-point
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΘΟΔΟΣ ΣΤΗΝ ΙΕΡΑΡΧΙΑ, ΟΧΙ ΣΑΡΩΣΗ 7.432 ΟΡΙΩΝ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Περιφέρεια (14) → Π.Ε. → Δήμος → Δ.Ε. → Κοινότητα, ανοίγοντας **μόνο** τα παιδιά του
 * νικητή κάθε σκαλιού. Η κάθοδος γίνεται **μέσω `parentId`, ποτέ με σταθερό βήμα ανά
 * βαθμίδα**: μετρημένο 2026-09-26, 87 δήμοι **δεν έχουν** Δημοτικές Ενότητες και 176
 * κοινότητες δείχνουν **κατευθείαν** στον δήμο τους. Όποιος υποθέσει «πάντα 3→4→5→6→7»
 * χάνει την κοινότητα σε όλη την κεντρική Αθήνα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΙΔΙΟΙ ΔΑΚΤΥΛΙΟΙ ΜΕ ΤΟΝ ΧΑΡΤΗ ΤΟΥ ΕΠΙΣΚΕΠΤΗ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Κρίνουμε τα **απλοποιημένα** όρια (`adminBoundaryRegion`) που ζωγραφίζει ο χάρτης, όχι
 * κάποιο «αληθινό» που κανείς δεν βλέπει. Αλλιώς μια αγγελία θα μετρούσε στον δήμο που το
 * περίγραμμά του τη δείχνει **έξω**. Η αβεβαιότητα της απλοποίησης **δεν κρύβεται**:
 * γράφεται ως `nearBoundary`.
 *
 * ⚠️ **Φύλλο χωρίς runtime εισαγωγές από `@/`** — ίδια σύμβαση με τα `admin-*-file.ts`.
 */

import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import type { GeoPoint, GeoRegion } from '@/types/geo/coordinates';
import type { PlacePosition } from '@/types/geo/public-place';
import { geoRingsNearestEdgeMetres, isPointInGeoRings } from './geo-ring';

// ============================================================================
// ΒΑΘΜΙΔΕΣ
// ============================================================================

/** Οι βαθμίδες που έχουν **όριο** — 3 (Περιφέρεια) έως 7 (Κοινότητα), ADR-883 §3. */
type AdminBoundaryLevel = 3 | 4 | 5 | 6 | 7;

/**
 * **Η ΑΠΟΔΟΣΗ** — μία ταυτότητα ανά βαθμίδα, ή `null` όταν η βαθμίδα **δεν αποδόθηκε**.
 *
 * `null` σημαίνει ένα από τρία, και κανένα δεν είναι «δεν υπάρχει περιοχή»: ο δήμος δεν
 * έχει Δημοτικές Ενότητες · η ακρίβεια της θέσης δεν επιτρέπει τόσο βάθος · το σημείο
 * δεν έπεσε σε κανένα παιδί (π.χ. αρκετά μέσα στη θάλασσα).
 *
 * 🔑 **Μόνο ταυτότητες, ποτέ ονόματα**: το όνομα ζει στο ευρετήριο (ένα SSoT). Αντίγραφό του
 * εδώ θα μπαγιάτευε στην πρώτη διόρθωση ονόματος, σε χιλιάδες έγγραφα.
 */
export interface AdminAreaAssignment {
  readonly regionId: string | null;
  readonly regionalUnitId: string | null;
  readonly municipalityId: string | null;
  readonly municipalUnitId: string | null;
  readonly communityId: string | null;
  /**
   * Το σημείο απέχει από το σύνορο της **βαθύτερης** αποδοσμένης βαθμίδας **λιγότερο από την
   * ανοχή** της απλοποίησης: η απόδοση είναι αυτή που δείχνει ο χάρτης, αλλά το αληθινό
   * σύνορο θα μπορούσε να την αλλάξει. Μια σύνοψη αγοράς μπορεί να τη βαρύνει λιγότερο.
   */
  readonly nearBoundary: boolean;
}

/** Βαθμίδα → πεδίο της απόδοσης. **Εξαντλητικό**: νέα βαθμίδα χωρίς πεδίο = σφάλμα μεταγλώττισης. */
const FIELD_OF_LEVEL = {
  3: 'regionId',
  4: 'regionalUnitId',
  5: 'municipalityId',
  6: 'municipalUnitId',
  7: 'communityId',
} as const satisfies Record<AdminBoundaryLevel, keyof Omit<AdminAreaAssignment, 'nearBoundary'>>;

function isBoundaryLevel(level: number): level is AdminBoundaryLevel {
  return level in FIELD_OF_LEVEL;
}

/** Το πεδίο της απόδοσης που κρατά μια βαθμίδα. */
export type AdminAreaField = (typeof FIELD_OF_LEVEL)[AdminBoundaryLevel];

/**
 * **Σε ποιο πεδίο του `adminArea` ζει η ταυτότητα μιας περιοχής αυτής της βαθμίδας** — ή `null` για
 * βαθμίδα που δεν αποδίδεται (οικισμός, Αποκεντρωμένη). Ο ΕΝΑΣ πίνακας, και για τον κριτή και για κάθε
 * ερώτημα `where('adminArea.<πεδίο>', '==', id)` (ADR-890 Φ1).
 */
export function adminAreaFieldOfLevel(level: number): AdminAreaField | null {
  return isBoundaryLevel(level) ? FIELD_OF_LEVEL[level] : null;
}

// ============================================================================
// ΠΟΣΟ ΒΑΘΙΑ ΔΙΚΑΙΟΛΟΓΕΙ Η ΘΕΣΗ — ποτέ ψευδής ακρίβεια
// ============================================================================

/**
 * Βάθος ανά ακρίβεια geocoder. **Εξαντλητικό**: νέα ακρίβεια χωρίς απάντηση = σφάλμα μεταγλώττισης.
 *
 * | ακρίβεια | τι είναι το σημείο | βάθος |
 * |---|---|---|
 * | `exact` · `interpolated` | η ίδια η διεύθυνση (ή πάνω στον δρόμο της) | κοινότητα (7) |
 * | `approximate` | κοντά, όχι επάνω | Δ.Ε. (6) |
 * | `center` | **κέντρο** περιοχής — πέφτει σε **μία** κοινότητα, τυχαία | δήμος (5) |
 */
const DEPTH_BY_ACCURACY = {
  exact: 7,
  interpolated: 7,
  approximate: 6,
  center: 5,
} as const satisfies Record<GeocodingAccuracy, AdminBoundaryLevel>;

/**
 * **Έως ποια βαθμίδα δικαιολογεί η θέση** — ή `null` όταν η θέση είναι άγνωστη.
 *
 * Κάθε θέση που **έδειξε** άνθρωπος ή μέτρησε όργανο (`manual` · `drawn` · `osm` · `survey` · `bim`)
 * είναι σημείο, όχι περιοχή ⇒ ως την κοινότητα. Μόνο ο geocoder έχει βαθμίδες ακρίβειας.
 */
export function deepestAdminLevelFor(position: PlacePosition): AdminBoundaryLevel | null {
  if (position.kind === 'unknown') return null;
  return position.provenance === 'geocoded' ? DEPTH_BY_ACCURACY[position.accuracy] : 7;
}

// ============================================================================
// ΤΟ ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΙΣ ΠΗΓΕΣ
// ============================================================================

/** Ό,τι χρειάζεται ο κριτής — **όχι** πώς φορτώνεται (fs στον server, δίκτυο αλλού). */
export interface AdminAreaLookup {
  /** Τα παιδιά μιας περιοχής **με όριο**· `null` = οι ρίζες (Περιφέρειες). */
  readonly childrenOf: (parentId: string | null) => readonly AdminAreaChild[];
  /** Το όριο ως περιοχή που κρίνεται, ή `null` = «δεν ξέρω» (ποτέ «κενό»). */
  readonly regionOf: (adminId: string) => Promise<GeoRegion | null>;
}

export interface AdminAreaChild {
  readonly id: string;
  readonly level: number;
}

interface ChosenArea {
  readonly id: string;
  readonly level: AdminBoundaryLevel;
  readonly nearBoundary: boolean;
}

// ============================================================================
// Η ΚΡΙΣΗ ΣΕ ΕΝΑ ΣΚΑΛΙ
// ============================================================================

const METRES_PER_DEGREE_LAT = 111_320;

/** Φτηνός αποκλεισμός: το σημείο είναι μέσα στο bbox **διευρυμένο κατά την ανοχή**; */
function withinExpandedBbox(point: GeoPoint, region: GeoRegion): boolean {
  const marginLat = region.toleranceM / METRES_PER_DEGREE_LAT;
  const marginLng = marginLat / Math.max(Math.cos((point.lat * Math.PI) / 180), 0.01);
  const { west, south, east, north } = region.bbox;
  return (
    point.lat >= south - marginLat && point.lat <= north + marginLat &&
    point.lng >= west - marginLng && point.lng <= east + marginLng
  );
}

interface Measured {
  readonly id: string;
  readonly level: AdminBoundaryLevel;
  readonly inside: boolean;
  readonly edgeM: number;
  readonly toleranceM: number;
}

/**
 * Ποιο παιδί περιέχει το σημείο.
 *
 * 1. **Μέσα** σε έναν ⇒ αυτός. Μέσα σε **πολλούς** (επικάλυψη από απλοποίηση) ⇒ εκείνος όπου το
 *    σημείο είναι **βαθύτερα** (μεγαλύτερη απόσταση από το σύνορο) — ντετερμινιστικά, όχι «ο πρώτος».
 * 2. **Σε κανέναν** ⇒ ο πλησιέστερος **εντός της ανοχής του** (ακτή, κενό απλοποίησης).
 * 3. Αλλιώς ⇒ `null`: η κάθοδος σταματά εκεί, ό,τι αποδόθηκε πιο πάνω μένει.
 */
function chooseContaining(measured: readonly Measured[]): ChosenArea | null {
  let best: Measured | null = null;
  for (const m of measured) {
    if (m.inside && (best === null || !best.inside || m.edgeM > best.edgeM)) best = m;
  }
  if (best === null) {
    for (const m of measured) {
      if (m.edgeM <= m.toleranceM && (best === null || m.edgeM < best.edgeM)) best = m;
    }
  }
  if (best === null) return null;
  return { id: best.id, level: best.level, nearBoundary: best.edgeM <= best.toleranceM };
}

async function measureChild(point: GeoPoint, child: AdminAreaChild, lookup: AdminAreaLookup): Promise<Measured | null> {
  if (!isBoundaryLevel(child.level)) return null;
  const region = await lookup.regionOf(child.id);
  if (region === null || !withinExpandedBbox(point, region)) return null;
  return {
    id: child.id,
    level: child.level,
    inside: isPointInGeoRings(point, region.rings),
    edgeM: geoRingsNearestEdgeMetres(point, region.rings),
    toleranceM: region.toleranceM,
  };
}

// ============================================================================
// Η ΚΑΘΟΔΟΣ
// ============================================================================

/**
 * **Η διοικητική απόδοση ενός σημείου**, έως τη βαθμίδα `deepest` — ή `null` αν δεν
 * αποδόθηκε **ούτε** Περιφέρεια (σημείο εκτός Ελλάδας ή όρια μη διαθέσιμα).
 *
 * @param deepest Το βαθύτερο επίπεδο που **δικαιολογεί** η ακρίβεια της θέσης. Ένα σημείο
 *   «κέντρο δήμου» από τον geocoder δεν λέει τίποτα για την κοινότητα — θα πέσει σε **μία**
 *   κοινότητα, τυχαία. Ο καλών αποφασίζει το βάθος· ο κριτής απλώς δεν το ξεπερνά.
 */
export async function assignAdminArea(
  point: GeoPoint,
  deepest: AdminBoundaryLevel,
  lookup: AdminAreaLookup,
): Promise<AdminAreaAssignment | null> {
  const ids: Record<AdminBoundaryLevel, string | null> = { 3: null, 4: null, 5: null, 6: null, 7: null };
  let parentId: string | null = null;
  let nearBoundary = false;
  let assigned = false;

  for (;;) {
    const children = lookup.childrenOf(parentId).filter((c) => isBoundaryLevel(c.level) && c.level <= deepest);
    if (children.length === 0) break;

    const measured = await Promise.all(children.map((child) => measureChild(point, child, lookup)));
    const chosen = chooseContaining(measured.filter((m): m is Measured => m !== null));
    if (chosen === null) break;

    ids[chosen.level] = chosen.id;
    nearBoundary = chosen.nearBoundary;
    parentId = chosen.id;
    assigned = true;
  }

  if (!assigned) return null;
  return {
    regionId: ids[3],
    regionalUnitId: ids[4],
    municipalityId: ids[5],
    municipalUnitId: ids[6],
    communityId: ids[7],
    nearBoundary,
  };
}
