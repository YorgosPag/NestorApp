/**
 * =============================================================================
 * Κοινόχρηστος χώρος — εμβαδόν από τη γεωμετρία, με πηγή (καθαρό, ADR-931 §6 Β1)
 * =============================================================================
 *
 * Δύο αριθμοί, μία ενεργή τιμή — πέρα από τη Revit, που δείχνει **μόνο** το υπολογισμένο:
 *
 * | πεδίο | ποιος το γράφει | σημασία |
 * |---|---|---|
 * | `drawnArea` | **μόνο ο server**, από τα περιγράμματα `common_space` | Σ εμβαδών όλων των κατόψεων που δένουν τον χώρο |
 * | `area` | άνθρωπος (`declared`) **ή** ο server (`drawn`) | η ενεργή τιμή — τα σύνολα και τα πινάκια διαβάζουν αυτήν |
 * | `areaSource` | άνθρωπος | `drawn` ⇒ το `area` **ακολουθεί** το σχέδιο· απόν/`declared` ⇒ το `area` είναι του ανθρώπου |
 *
 * 🔑 Άθροισμα, όχι «το τελευταίο»: χώρος χωρίς όροφο (κλιμακοστάσιο, ανελκυστήρας) σχεδιάζεται σε **κάθε** κάτοψη που
 * διασχίζει — όπως ένα Area της Revit ανά επίπεδο, που το πινάκιο αθροίζει. Ο υπολογισμός ξαναγίνεται **από την
 * πηγή** σε κάθε αλλαγή (ιδεμποτικός: δύο κλήσεις ⇒ ίδιο αποτέλεσμα, καμία συσσώρευση δέλτα).
 *
 * 📐 Μονάδες: τα περιγράμματα τα γράφει **μόνο** το DXF viewer, σε **canonical mm** της σκηνής (ADR-462)·
 * m² = `areaMm2ToM2(polygonArea(vertices))` — ο ΕΝΑΣ πίνακας μετατροπής, όχι δεύτερο `/ 1e6`.
 *
 * @module lib/common-spaces/common-space-area
 */

import { polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { areaMm2ToM2 } from '@/subapps/dxf-viewer/utils/scene-units';

/** Η πηγή της ενεργής τιμής `area`. Απόν στο έγγραφο ≡ `declared` (κάθε χώρος του Σταδίου Α). */
export const COMMON_SPACE_AREA_SOURCES = ['declared', 'drawn'] as const;
export type CommonSpaceAreaSource = (typeof COMMON_SPACE_AREA_SOURCES)[number];

export function isCommonSpaceAreaSource(value: unknown): value is CommonSpaceAreaSource {
  return typeof value === 'string' && (COMMON_SPACE_AREA_SOURCES as readonly string[]).includes(value);
}

/**
 * Πάνω από αυτή τη σχετική διαφορά, σχέδιο και δήλωση **διαφωνούν** (σήμα στον άνθρωπο, ποτέ σιωπηλή διόρθωση).
 * 2% ≈ το περιθώριο που δέχεται η πρακτική μετρήσεων για καθαρό εμβαδόν από σχέδιο (πάχος γραμμής, στρογγύλευση).
 */
export const DRAWN_AREA_DIVERGENCE_RATIO = 0.02;

/** Ακρίβεια αποθήκευσης: εκατοστό του m² — ώστε το ιστορικό να μη γράφει «12,000000001». */
const DRAWN_AREA_DECIMALS = 2;
const DRAWN_AREA_SCALE = 10 ** DRAWN_AREA_DECIMALS;

function roundDrawnArea(m2: number): number {
  return Math.round(m2 * DRAWN_AREA_SCALE) / DRAWN_AREA_SCALE;
}

function isPlanarPoint(value: unknown): value is PlanarPoint {
  const p = value as { x?: unknown; y?: unknown } | null;
  return typeof p?.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y);
}

/** Το εμβαδόν (m²) **ενός** αποθηκευμένου γεωμετρικού σχήματος — `null` αν δεν είναι κλειστό πολύγωνο με εμβαδόν. */
export function drawnAreaOfGeometry(geometry: unknown): number | null {
  const shape = geometry as { type?: unknown; vertices?: unknown; closed?: unknown } | null | undefined;
  if (shape?.type !== 'polygon' || shape.closed === false || !Array.isArray(shape.vertices)) return null;
  if (shape.vertices.length < 3 || !shape.vertices.every(isPlanarPoint)) return null;
  const m2 = areaMm2ToM2(polygonArea(shape.vertices));
  return m2 > 0 ? m2 : null;
}

/** Σ εμβαδών των περιγραμμάτων ενός χώρου (m², στρογγυλεμένο)· κανένα έγκυρο περίγραμμα ⇒ `null` (= «δεν σχεδιάστηκε»). */
export function drawnAreaOfGeometries(geometries: readonly unknown[]): number | null {
  let total = 0;
  let counted = 0;
  for (const geometry of geometries) {
    const m2 = drawnAreaOfGeometry(geometry);
    if (m2 === null) continue;
    total += m2;
    counted += 1;
  }
  return counted === 0 ? null : roundDrawnArea(total);
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Τα πεδία που γράφει ο **server** όταν άλλαξε το σχέδιο: `drawnArea` πάντα· `area` **μόνο** αν ο άνθρωπος έχει πει
 * «ακολούθησε το σχέδιο». `null` στη θέση ⇒ το πεδίο σβήνει. `{}` ⇒ τίποτα δεν άλλαξε (καμία γραφή, κανένα ίχνος).
 */
export function derivedAreaPatch(
  existing: Readonly<Record<string, unknown>>,
  drawnArea: number | null,
): Record<string, number | null> {
  const patch: Record<string, number | null> = {};
  const before = positive(existing.drawnArea) ?? null;
  if (before !== drawnArea) patch.drawnArea = drawnArea;
  // Δεμένο στο σχέδιο: το `area` ακολουθεί — αλλά σχέδιο που **χάθηκε** δεν σβήνει τη δήλωση (μένει η τελευταία τιμή).
  if (existing.areaSource === 'drawn' && drawnArea !== null && positive(existing.area) !== drawnArea) {
    patch.area = drawnArea;
  }
  return patch;
}

/** Η απόφαση του ανθρώπου για το εμβαδόν σε ένα PATCH — ή γιατί απορρίπτεται. */
export type AreaSourceResolution =
  | { readonly kind: 'ok'; readonly fields: Readonly<Record<string, unknown>> }
  | { readonly kind: 'rejected'; readonly reason: 'no-drawn-area' | 'area-with-drawn-source' };

/** Μήνυμα HTTP ανά άρνηση (αγγλικά, όπως κάθε μήνυμα API). */
export const AREA_SOURCE_REJECTION_MESSAGE = {
  'no-drawn-area': 'There is no drawn area to adopt — link a floor-plan outline first',
  'area-with-drawn-source': 'Send either an area or areaSource "drawn", not both',
} as const satisfies Record<Extract<AreaSourceResolution, { kind: 'rejected' }>['reason'], string>;

/**
 * Σώμα ⊕ αποθηκευμένο → τι γράφεται για την πηγή του εμβαδού. Ιδεμποτικό.
 *
 * - `areaSource: 'drawn'` ⇒ «υιοθέτησε το σχεδιασμένο»: `area := drawnArea` (από τη **βάση**, όχι από τον πελάτη).
 * - νέα τιμή `area` από άνθρωπο ⇒ η πηγή γίνεται `declared` (η δήλωση κόβει τη δέσμευση — ρητά, όχι σιωπηλά).
 * - ίδια τιμή `area` με την αποθηκευμένη ⇒ καμία αλλαγή πηγής (μια φόρμα που ξαναστέλνει ό,τι είδε δεν κόβει τη δέσμευση).
 */
export function resolveAreaSourcePatch(
  body: Readonly<{ area?: number | null; areaSource?: CommonSpaceAreaSource }>,
  existing: Readonly<Record<string, unknown>>,
): AreaSourceResolution {
  if (body.areaSource === 'drawn') {
    if (body.area !== undefined) return { kind: 'rejected', reason: 'area-with-drawn-source' };
    const drawnArea = positive(existing.drawnArea);
    if (drawnArea === undefined) return { kind: 'rejected', reason: 'no-drawn-area' };
    return { kind: 'ok', fields: { area: drawnArea, areaSource: 'drawn' } };
  }
  const areaChanged = body.area !== undefined && (positive(body.area) ?? null) !== (positive(existing.area) ?? null);
  if (body.areaSource === 'declared' || areaChanged) return { kind: 'ok', fields: { areaSource: 'declared' } };
  return { kind: 'ok', fields: {} };
}

/** Η σύγκριση σχεδίου/δήλωσης για την οθόνη. */
export type AreaDivergence =
  | { readonly kind: 'none' }
  | { readonly kind: 'diverges'; readonly declared: number; readonly drawn: number; readonly ratio: number };

/**
 * Διαφωνούν σχέδιο και δήλωση; Μόνο όταν **υπάρχουν και τα δύο** και η πηγή είναι η δήλωση (δεμένο στο σχέδιο ⇒
 * ίσα εξ ορισμού). `ratio` = |σχέδιο − δήλωση| / δήλωση.
 */
export function areaDivergenceOf(
  space: Readonly<{ area?: number; drawnArea?: number; areaSource?: CommonSpaceAreaSource }>,
): AreaDivergence {
  const declared = positive(space.area);
  const drawn = positive(space.drawnArea);
  if (declared === undefined || drawn === undefined || space.areaSource === 'drawn') return { kind: 'none' };
  const ratio = Math.abs(drawn - declared) / declared;
  return ratio > DRAWN_AREA_DIVERGENCE_RATIO ? { kind: 'diverges', declared, drawn, ratio } : { kind: 'none' };
}
