/**
 * @fileoverview **ΤΟΠΟΛΟΓΙΚΗ ΑΠΛΟΠΟΙΗΣΗ — ΚΑΘΕ ΚΟΙΝΗ ΑΚΜΗ ΑΠΛΟΠΟΙΕΙΤΑΙ ΜΙΑ ΦΟΡΑ** (ADR-890 §14.3).
 * @related `dissolve-shared-edges.ts` (ίδια υπόθεση τοπολογίας) · `src/lib/geometry/douglas-peucker.ts` (ο DP)
 * @module scripts/lib/admin-boundaries/shared-arc-simplify
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΟΧΙ DOUGLAS–PEUCKER ΑΝΑ ΠΟΛΥΓΩΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Όταν κάθε περιοχή απλοποιείται **μόνη της**, η κοινή ακμή δύο γειτόνων απλοποιείται **δύο φορές**,
 * με άλλα σταθερά σημεία ⇒ οι δύο γραμμές αποκλίνουν έως την ανοχή, και ο χωροπληθής χάρτης δείχνει
 * **σχισμές** (το υπόβαθρο ανάμεσα σε δύο χρωματισμένους δήμους) ή **επικαλύψεις** (διπλό χρώμα). Ο
 * χάρτης ορίων του ADR-883 δεν το έβλεπε ποτέ: δείχνει **ένα** όριο τη φορά.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΙΔΙΩΜΑ TopoJSON / mapshaper — ΧΩΡΙΣ ΤΑ ΤΟΞΑ ΩΣ ΔΟΜΗ ΔΕΔΟΜΕΝΩΝ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Κόμβος** = κορυφή που οι εμφανίσεις της **δεν** έχουν τους ίδιους δύο γείτονες (εκεί
 *    συναντώνται τρεις περιοχές, ή τελειώνει η κοινή ακμή). Η πηγή είναι τοπολογικά καθαρή (οι
 *    γείτονες μοιράζονται **τις ίδιες ακριβώς** κορυφές — μετρημένο 2026-09-28: 240.587 ακμές
 *    κοινές ανά δύο στις Δ.Ε.), άρα η κρίση είναι **συνδυαστική**, χωρίς αριθμητική ανοχή.
 * 2. **Τόξο** = αλυσίδα ανάμεσα σε δύο κόμβους. Απλοποιείται **μία** φορά, σε **κανονική φορά**
 *    (ο DP δεν είναι συμμετρικός ως προς τη φορά), με σταθερά άκρα (`openChainKeepMask`).
 * 3. Αποτέλεσμα = **ένα σύνολο κορυφών που μένουν**. Κάθε μη-κόμβος ανήκει σε **ακριβώς ένα** τόξο,
 *    άρα κάθε δακτύλιος απλώς **φιλτράρεται** — ο γείτονας κρατά τις ίδιες κορυφές στην κοινή ακμή.
 *
 * 🔑 **Δύο ιδιότητες, δύο μηχανισμοί** (μετρημένο με μετάλλαξη 2026-09-28): η **απουσία σχισμών** την εγγυάται το
 * ΚΟΙΝΟ σύνολο (βήμα 3) — ακόμη και με δύο περάσματα DP οι γείτονες φιλτράρονται από το ίδιο σύνολο. Η **κανονική
 * φορά** (βήμα 2) εγγυάται την **ελαχιστότητα**: ένα πέρασμα ανά ακμή, όχι η ένωση δύο.
 *
 * ⚠️ **Όπου η υπόθεση δεν ισχύει** (γείτονες από **άλλο** layer της πηγής — οι 86 Δήμοι χωρίς Δ.Ε.
 * μοιράζονται μόλις 3% των ακμών τους με το layer των Δ.Ε.) η απλοποίηση μένει **σωστή** (≤ ανοχή)
 * απλώς όχι κοινή: ίδια συμπεριφορά με τον DP ανά πολύγωνο, ποτέ χειρότερη.
 *
 * ⚠️ Το mapshaper (MPL-2.0) δεν επιτρέπεται (N.5) — και δεν χρειάζεται.
 */

import { closedRingKeepMask, openChainKeepMask } from '../../../src/lib/geometry/douglas-peucker';
import { toLocalMetres } from '../../../src/lib/geo/geo-local-frame';
import type { GeoPoint } from '../../../src/types/geo/coordinates';

type Position = GeoJSON.Position;

export interface TopologyFeature {
  readonly id: string;
  readonly geometry: GeoJSON.MultiPolygon;
}

export interface SharedArcStats {
  readonly vertices: number;
  readonly junctions: number;
  readonly arcs: number;
  readonly kept: number;
}

export interface SharedArcResult {
  /** `null` = η περιοχή είναι **ολόκληρη** μικρότερη από την ανοχή — ο καλών αποφασίζει. */
  readonly geometries: ReadonlyMap<string, GeoJSON.MultiPolygon | null>;
  readonly stats: SharedArcStats;
}

function keyOf(position: Position): string {
  return `${position[0]},${position[1]}`;
}

/** Ανοιχτός δακτύλιος σε κλειδιά κορυφών (χωρίς επαναλαμβανόμενη τελευταία, χωρίς διαδοχικά διπλά). */
function openRingKeys(ring: readonly Position[], coordinates: Map<string, Position>): string[] {
  const keys: string[] = [];
  for (const position of ring) {
    const key = keyOf(position);
    if (keys[keys.length - 1] === key) continue;
    coordinates.set(key, position);
    keys.push(key);
  }
  if (keys.length > 1 && keys[0] === keys[keys.length - 1]) keys.pop();
  return keys;
}

function allRings(features: readonly TopologyFeature[], coordinates: Map<string, Position>): string[][] {
  const rings: string[][] = [];
  for (const { geometry } of features) {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        const keys = openRingKeys(ring, coordinates);
        if (keys.length >= 3) rings.push(keys);
      }
    }
  }
  return rings;
}

/** Κόμβοι: κορυφές που δεν έχουν παντού το ίδιο (μη διατεταγμένο) ζεύγος γειτόνων. */
function findJunctions(rings: readonly string[][]): Set<string> {
  const neighbours = new Map<string, string>();
  const junctions = new Set<string>();
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const previous = ring[(i + ring.length - 1) % ring.length];
      const next = ring[(i + 1) % ring.length];
      const pair = previous < next ? `${previous}|${next}` : `${next}|${previous}`;
      const seen = neighbours.get(ring[i]);
      if (seen === undefined) neighbours.set(ring[i], pair);
      else if (seen !== pair) junctions.add(ring[i]);
    }
  }
  return junctions;
}

/** Κανονική φορά ανοιχτού τόξου — ίδια απάντηση από όποια πλευρά κι αν το διασχίσει ο δακτύλιος. */
function canonicalArc(arc: string[]): string[] {
  const last = arc.length - 1;
  const first = arc[0];
  const end = arc[last];
  const reverse = first > end || (first === end && arc[1] > arc[last - 1]);
  return reverse ? [...arc].reverse() : arc;
}

/** Κανονική εκκίνηση + φορά δακτυλίου χωρίς κόμβους (νησί, ή θύλακας ίδιος με την τρύπα του γείτονα). */
function canonicalLoop(ring: readonly string[]): string[] {
  let start = 0;
  for (let i = 1; i < ring.length; i++) if (ring[i] < ring[start]) start = i;
  const rotated = [...ring.slice(start), ...ring.slice(0, start)];
  return rotated[1] > rotated[rotated.length - 1] ? [rotated[0], ...rotated.slice(1).reverse()] : rotated;
}

/** Η αρχή των αξόνων που δεν υποτιμά απόσταση: το πλάτος με τη μεγαλύτερη κλίμακα x (όπως `geo-simplify`). */
function localPoints(keys: readonly string[], coordinates: ReadonlyMap<string, Position>) {
  const points: GeoPoint[] = keys.map((key) => {
    const [lng, lat] = coordinates.get(key) as Position;
    return { lng, lat };
  });
  let origin = points[0];
  for (const point of points) if (Math.abs(point.lat) < Math.abs(origin.lat)) origin = point;
  return toLocalMetres(points, origin);
}

/** Τόξα δακτυλίου που έχει κόμβους: περιστροφή ώστε να αρχίζει σε κόμβο, κόψιμο σε κάθε κόμβο. */
function arcsOf(ring: readonly string[], junctions: ReadonlySet<string>): string[][] {
  const start = ring.findIndex((key) => junctions.has(key));
  const rotated = [...ring.slice(start), ...ring.slice(0, start), ring[start]];
  const arcs: string[][] = [];
  let current: string[] = [rotated[0]];
  for (let i = 1; i < rotated.length; i++) {
    current.push(rotated[i]);
    if (junctions.has(rotated[i])) {
      arcs.push(current);
      current = [rotated[i]];
    }
  }
  return arcs;
}

function markKept(
  chain: readonly string[],
  mask: readonly boolean[],
  kept: Set<string>,
): void {
  chain.forEach((key, index) => {
    if (mask[index]) kept.add(key);
  });
}

/** Το σύνολο των κορυφών που μένουν — κάθε τόξο απλοποιημένο μία φορά. */
function keptVertices(
  rings: readonly string[][],
  junctions: ReadonlySet<string>,
  coordinates: ReadonlyMap<string, Position>,
  toleranceM: number,
): { readonly kept: Set<string>; readonly arcs: number } {
  const kept = new Set(junctions);
  const done = new Set<string>();
  for (const ring of rings) {
    const loop = !ring.some((key) => junctions.has(key));
    const chains = loop ? [canonicalLoop(ring)] : arcsOf(ring, junctions).map(canonicalArc);
    for (const chain of chains) {
      const signature = `${loop ? 'o' : '-'}${chain[0]}>${chain[1]}>${chain[chain.length - 1]}>${chain.length}`;
      if (done.has(signature)) continue;
      done.add(signature);
      const points = localPoints(chain, coordinates);
      markKept(chain, loop ? closedRingKeepMask(points, toleranceM) : openChainKeepMask(points, toleranceM), kept);
    }
  }
  return { kept, arcs: done.size };
}

/**
 * Κλειστός δακτύλιος με στρογγυλεμένες συντεταγμένες. Η στρογγύλευση είναι **ίδια** για την κοινή κορυφή δύο
 * γειτόνων, άρα η κοινή ακμή μένει κοινή· διαδοχικές κορυφές που συμπίπτουν μετά από αυτήν ενώνονται.
 */
function closedRing(keys: readonly string[], coordinates: ReadonlyMap<string, Position>, decimals: number): Position[] {
  const ring: Position[] = [];
  for (const key of keys) {
    const [lng, lat] = coordinates.get(key) as Position;
    const position: Position = [Number(lng.toFixed(decimals)), Number(lat.toFixed(decimals))];
    const previous = ring[ring.length - 1];
    if (previous?.[0] !== position[0] || previous[1] !== position[1]) ring.push(position);
  }
  const [first] = ring;
  const last = ring[ring.length - 1];
  if (ring.length > 1 && first[0] === last[0] && first[1] === last[1]) ring.pop();
  return ring.length >= 3 ? [...ring, ring[0]] : [];
}

function rebuild(
  geometry: GeoJSON.MultiPolygon,
  kept: ReadonlySet<string>,
  coordinates: Map<string, Position>,
  decimals: number,
): GeoJSON.MultiPolygon | null {
  const polygons: Position[][][] = [];
  for (const polygon of geometry.coordinates) {
    const rings = polygon
      .map((ring) => closedRing(openRingKeys(ring, coordinates).filter((key) => kept.has(key)), coordinates, decimals))
      .map((ring, index) => ({ ring, index }))
      .filter(({ ring }) => ring.length > 0);
    // Εξωτερικός που έσβησε ⇒ φεύγει όλο το πολύγωνο (νησίδα κάτω από την ανοχή)· τρύπα που έσβησε απλώς φεύγει.
    if (rings[0]?.index !== 0) continue;
    polygons.push(rings.map(({ ring }) => ring));
  }
  return polygons.length > 0 ? { type: 'MultiPolygon', coordinates: polygons } : null;
}

/**
 * **Απλοποιεί ένα σύνολο γειτονικών περιοχών μαζί**, ώστε κάθε κοινή ακμή να μείνει κοινή.
 * Ντετερμινιστικό: ίδια είσοδος σε **οποιαδήποτε** σειρά ⇒ ίδιες κορυφές.
 * @param decimals δεκαδικά εξόδου — πρέπει να είναι **κάτω** από την ανοχή (4 ≈ 11 m), αλλιώς αλλοιώνει την εγγύηση
 */
export function simplifySharedArcs(
  features: readonly TopologyFeature[],
  toleranceM: number,
  decimals: number,
): SharedArcResult {
  const coordinates = new Map<string, Position>();
  const rings = allRings(features, coordinates);
  const junctions = findJunctions(rings);
  const { kept, arcs } = keptVertices(rings, junctions, coordinates, toleranceM);

  const geometries = new Map<string, GeoJSON.MultiPolygon | null>();
  for (const feature of features) geometries.set(feature.id, rebuild(feature.geometry, kept, coordinates, decimals));

  return {
    geometries,
    stats: { vertices: coordinates.size, junctions: junctions.size, arcs, kept: kept.size },
  };
}
