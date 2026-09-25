/**
 * @fileoverview **ΟΙ ΟΙΚΙΣΜΟΙ ΣΤΗΝ ΑΝΑΖΗΤΗΣΗ** — ποια γραμμή ευρετηρίου, ποιο όριο, ποια θέση.
 * @related ADR-883 §5.10 · `build-admin-boundaries.ts` (καταναλωτής) · `src/lib/geo/admin-area-words.ts` (ίδιο όνομα;)
 * @module scripts/lib/admin-boundaries/settlement-points
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΠΗΓΗ: ΣΗΜΕΙΑ, ΟΧΙ ΠΟΛΥΓΩΝΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο οικισμός δεν έχει επίσημο όριο πουθενά — ούτε στον Καλλικράτη, ούτε στο Zillow/Rightmove
 * (που **επινοούν** δικά τους). Η ΕΛΣΤΑΤ δίνει όμως τη **θέση** κάθε οικισμού (layer `oikismoi`
 * του ίδιου WFS, CC-BY 3.0). Άρα: φίλτρο = το **επίσημο** όριο του πλησιέστερου προγόνου, και
 * πινέζα = η **επίσημη** θέση του χωριού. Τίποτα επινοημένο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΤΑΙΡΙΑΣΜΑ ΓΙΝΕΤΑΙ ΜΕ ΟΝΟΜΑ, ΟΧΙ ΜΕ ΚΩΔΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-09-25: σε **585** σημεία ο ίδιος κωδικός δείχνει **άλλο χωριό** στην ιεραρχία
 * (ο 6106000016 είναι «Σκάλα» στην ΕΛΣΤΑΤ, «Χιλιομόδι» σε εμάς — αναρίθμηση ανάμεσα σε
 * απογραφές). Ταίριασμα με κωδικό θα έβαζε **πινέζα σε λάθος χωριό, σιωπηλά**. Εδώ:
 * **κοινότητα** (8 πρώτα ψηφία) **+ ίδιο όνομα** (`sameAdminName`, με κλίση). Ο κωδικός μόνο
 * ξεχωρίζει ομώνυμα της ίδιας κοινότητας. Αμφιβολία ⇒ **καμία πινέζα**, ποτέ εικασία.
 *
 * 🔒 **Δίχτυ ασφαλείας**: η θέση κρατιέται μόνο αν πέφτει **μέσα στο περίγραμμα που θα
 * ζωγραφίσει ο χάρτης** (`placeWithinBoundary` — η ίδια ερώτηση που κάνει η άγκυρα).
 */

import { geoJsonRings } from '../../../src/lib/geo/geo-geojson';
import { sameAdminName } from '../../../src/lib/geo/admin-area-words';
import { SETTLEMENT_LEVEL, type AdminAreaIndexRow } from '../../../src/lib/geo/admin-area-index-file';
import { placeWithinBoundary, type AdminBoundaryPlacesFile } from '../../../src/lib/geo/admin-boundary-file';
import type { GeoOutline } from '../../../src/types/geo/coordinates';
import type { HierarchyRow } from './admin-boundary-source';

/** Το layer των θέσεων οικισμών στο ίδιο WFS με τα όρια. */
export const SETTLEMENT_LAYER = 'oikismoi';

/** Ψηφία του κωδικού Καλλικράτη που ορίζουν την κοινότητα (ADR-772: 8 = κοινότητα, 10 = οικισμός). */
const COMMUNITY_CODE_LENGTH = 8;

export interface SettlementReport {
  readonly rows: number;
  readonly seats: number;
  readonly withoutOwner: number;
  readonly placed: number;
  readonly unmatchedPoints: number;
  readonly ambiguousPoints: number;
  readonly outsideOwner: number;
}

/** Ό,τι χρειάζεται για να κριθεί μια θέση: το όριο **όπως θα ζωγραφιστεί** και η ανοχή του. */
export interface DrawnBoundary {
  readonly geometry: GeoJSON.MultiPolygon;
  readonly toleranceM: number;
}

export interface SettlementOutput {
  readonly rows: readonly AdminAreaIndexRow[];
  /** `id` ορίου → θέσεις των οικισμών του, για το αρχείο εκείνου του ορίου. */
  readonly places: ReadonlyMap<string, AdminBoundaryPlacesFile>;
  readonly report: SettlementReport;
}

/** Το όνομα της ΕΛΣΤΑΤ χωρίς άρθρο και σχόλιο: «Άνυδρο,το (νησίς)» → «Άνυδρο». */
function elstatName(raw: string): string {
  return raw.split(',')[0].replace(/\(.*?\)/g, '').trim();
}

/** Ο πλησιέστερος πρόγονος **με αρχείο ορίου** — το όριο που θα δείξει ο οικισμός. */
function ownerOf(row: HierarchyRow, byId: ReadonlyMap<string, HierarchyRow>, bounded: ReadonlySet<string>): string | null {
  let parentId = row.p;
  for (let guard = 8; parentId !== null && guard > 0; guard -= 1) {
    if (bounded.has(parentId)) return parentId;
    parentId = byId.get(parentId)?.p ?? null;
  }
  return null;
}

interface PointMatch {
  readonly settlement: HierarchyRow;
  readonly position: readonly [number, number];
}

/** Ποιος οικισμός της ίδιας κοινότητας έχει **το ίδιο όνομα** με το σημείο; — ένας, ή κανένας. */
function matchPoint(
  feature: GeoJSON.Feature,
  byCommunity: ReadonlyMap<string, readonly HierarchyRow[]>,
): PointMatch | 'unmatched' | 'ambiguous' {
  const code = String(feature.properties?.kalcode ?? '');
  const name = elstatName(String(feature.properties?.oikismos ?? ''));
  const { geometry } = feature;
  const position = geometry?.type === 'MultiPoint' ? geometry.coordinates[0] : geometry?.type === 'Point' ? geometry.coordinates : undefined;
  if (position === undefined || name === '') return 'unmatched';

  const named = (byCommunity.get(code.slice(0, COMMUNITY_CODE_LENGTH)) ?? []).filter((row) => sameAdminName(name, row.n));
  const chosen = named.length === 1 ? named[0] : named.find((row) => row.c === code);
  if (chosen === undefined) return named.length === 0 ? 'unmatched' : 'ambiguous';
  return { settlement: chosen, position: [position[0], position[1]] };
}

/** Κάθε οικισμός → το **μοναδικό** σημείο του. Οικισμός με δύο σημεία = αμφιβολία ⇒ κανένα. */
function assignPoints(
  points: GeoJSON.FeatureCollection,
  settlements: readonly HierarchyRow[],
): { readonly matches: ReadonlyMap<string, PointMatch>; readonly unmatched: number; readonly ambiguous: number } {
  const byCommunity = new Map<string, HierarchyRow[]>();
  for (const row of settlements) {
    const key = row.c.slice(0, COMMUNITY_CODE_LENGTH);
    byCommunity.set(key, [...(byCommunity.get(key) ?? []), row]);
  }

  const matches = new Map<string, PointMatch>();
  const contested = new Set<string>();
  let unmatched = 0;
  let ambiguous = 0;
  for (const feature of points.features) {
    const match = matchPoint(feature, byCommunity);
    if (match === 'unmatched') unmatched += 1;
    else if (match === 'ambiguous') ambiguous += 1;
    else if (matches.has(match.settlement.id) || contested.has(match.settlement.id)) {
      contested.add(match.settlement.id);
      matches.delete(match.settlement.id);
      ambiguous += 1;
    } else matches.set(match.settlement.id, match);
  }
  return { matches, unmatched, ambiguous };
}

/** Η θέση φαίνεται μέσα στο περίγραμμα του χάρτη; (δακτύλιοι υπολογίζονται μία φορά ανά όριο) */
function insideOwner(
  ownerId: string,
  position: readonly [number, number],
  boundaries: ReadonlyMap<string, DrawnBoundary>,
  rings: Map<string, readonly GeoOutline[]>,
): boolean {
  const boundary = boundaries.get(ownerId);
  if (boundary === undefined) return false;
  if (!rings.has(ownerId)) rings.set(ownerId, geoJsonRings(boundary.geometry));
  return placeWithinBoundary({ lng: position[0], lat: position[1] }, rings.get(ownerId) ?? [], boundary.toleranceM);
}

/** Η απόφαση για **έναν** οικισμό — ποια γραμμή, αν έχει θέση. */
type SettlementVerdict =
  | { readonly kind: 'without-owner' }
  | { readonly kind: 'seat' }
  | { readonly kind: 'row'; readonly row: AdminAreaIndexRow; readonly owner: string; readonly match: PointMatch | undefined };

/** Η ΕΔΡΑ («Καρτερές» της «Τ.Κ. Καρτερών») είναι ήδη στη λίστα ως κοινότητα, με το ίδιο όριο ⇒ όχι δεύτερη γραμμή. */
function judgeSettlement(
  row: HierarchyRow,
  byId: ReadonlyMap<string, HierarchyRow>,
  bounded: ReadonlySet<string>,
  match: PointMatch | undefined,
): SettlementVerdict {
  const owner = ownerOf(row, byId, bounded);
  if (owner === null) return { kind: 'without-owner' };
  const parent = row.p === null ? undefined : byId.get(row.p);
  if (parent !== undefined && owner === parent.id && sameAdminName(row.n, parent.n)) return { kind: 'seat' };

  return { kind: 'row', row: [row.id, row.n, SETTLEMENT_LEVEL, owner], owner, match };
}

/**
 * Οι γραμμές ευρετηρίου των οικισμών + οι θέσεις τους ανά όριο.
 *
 * @param boundaries το όριο **όπως θα γραφτεί** για κάθε περιοχή με αρχείο (κλειδί = `id`).
 */
export function buildSettlements(
  hierarchy: readonly HierarchyRow[],
  boundaries: ReadonlyMap<string, DrawnBoundary>,
  points: GeoJSON.FeatureCollection,
): SettlementOutput {
  const byId = new Map(hierarchy.map((row) => [row.id, row]));
  const settlements = hierarchy.filter((row) => row.l === SETTLEMENT_LEVEL);
  const { matches, unmatched, ambiguous } = assignPoints(points, settlements);
  const bounded = new Set(boundaries.keys());
  const rings = new Map<string, readonly GeoOutline[]>();

  const rows: AdminAreaIndexRow[] = [];
  const places = new Map<string, Record<string, readonly [number, number]>>();
  const counts = { seats: 0, withoutOwner: 0, placed: 0, outsideOwner: 0 };

  for (const settlement of settlements) {
    const verdict = judgeSettlement(settlement, byId, bounded, matches.get(settlement.id));
    if (verdict.kind === 'without-owner') counts.withoutOwner += 1;
    if (verdict.kind === 'seat') counts.seats += 1;
    if (verdict.kind !== 'row') continue;

    rows.push(verdict.row);
    if (verdict.match === undefined) continue;
    if (!insideOwner(verdict.owner, verdict.match.position, boundaries, rings)) {
      counts.outsideOwner += 1;
      continue;
    }
    places.set(verdict.owner, { ...places.get(verdict.owner), [settlement.id]: verdict.match.position });
    counts.placed += 1;
  }

  return { rows, places, report: { rows: rows.length, unmatchedPoints: unmatched, ambiguousPoints: ambiguous, ...counts } };
}
