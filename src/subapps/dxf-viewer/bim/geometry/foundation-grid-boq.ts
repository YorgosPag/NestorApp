/**
 * ADR-441 Slice 4 — Foundation strip-grid NET BOQ geometry (safeUnion).
 *
 * Pure SSoT για τον **καθαρό** (de-duplicated) όγκο μιας εσχάρας πεδιλοδοκών. Η
 * εσχάρα μοντελοποιείται με **διακριτές επικαλυπτόμενες** λωρίδες (Slice 2 + JOIN):
 * σε κάθε διασταύρωση η κάθετη + η οριζόντια λωρίδα επικαλύπτονται κατά `w × w`
 * (εγγενές & σωστό για μονολιθικό σώμα). Το άθροισμα των ΑΚΑΘΑΡΤΩΝ όγκων όμως
 * **μετράει διπλά** τους κόμβους → λάθος επιμέτρηση σκυροδέματος.
 *
 * Λύση (Revit/Tekla way): boolean **union** των footprints → καθαρό εμβαδόν/όγκος.
 * Δύο SSoT entry points:
 *   - `foundationStripNetGeometry(strip, siblings)` — το NET **μερίδιο** μίας λωρίδας
 *     (gross − ½·Σ επικαλύψεων με αδελφές). Άθροισμα μεριδίων == union total (exact
 *     για ομοιόμορφο πάχος· οι κόμβοι είναι 2-cover = 1 κάθετη + 1 οριζόντια).
 *   - `computeFoundationGridNet(strips)` — authoritative grid total μέσω `safeUnion`
 *     (thickness-bucketed) — για verification/tests + future ATOE.
 *
 * Παραδοχή v1: οι λωρίδες μιας εσχάρας έχουν **ομοιόμορφο πάχος** (ο generator
 * `buildStripGridFromGuides` παράγει uniform). Hand-mixed πάχη → approximate.
 *
 * @see bim/geometry/shared/safe-polygon-boolean.ts — robust boolean ops
 * @see bim/foundations/foundation-from-grid.ts — grid builder (born-hosted strips)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { Pair, Polygon } from 'polygon-clipping';
import type { FoundationEntity, FoundationGeometry } from '../types/foundation-types';
import { safeIntersection, safeUnion } from './shared/safe-polygon-boolean';
import { multiPolygonArea } from './shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;

/** Authoritative net quantities μιας εσχάρας (m² / m³). */
export interface FoundationGridNet {
  /** Άθροισμα ΑΚΑΘΑΡΤΩΝ όγκων (διπλομετρά κόμβους), m³. */
  readonly grossVolumeM3: number;
  /** Καθαρός όγκος ένωσης (χωρίς διπλομέτρηση), m³. */
  readonly netVolumeM3: number;
  /** Καθαρό εμβαδόν ένωσης, m². */
  readonly netAreaM2: number;
  /** gross − net (ο διπλομετρημένος όγκος κόμβων), m³. */
  readonly overlapVolumeM3: number;
}

/** footprint → polygon-clipping `Polygon` (single outer ring, canvas units). */
function footprintToPolygon(entity: FoundationEntity): Polygon {
  return [entity.geometry.footprint.vertices.map((v): Pair => [v.x, v.y])];
}

/** canvas units² → m² multiplier για μία λωρίδα (από το `sceneUnits` της). */
function canvasToM2(entity: FoundationEntity): number {
  const canvasToM = (1 / mmToSceneUnits(entity.params.sceneUnits ?? 'mm')) * MM_TO_M;
  return canvasToM * canvasToM;
}

/**
 * NET μερίδιο γεωμετρίας μίας λωρίδας: αφαιρεί το **μισό** της επικάλυψής της με
 * κάθε αδελφή λωρίδα (κάθε κόμβος ανήκει σε 2 λωρίδες → ½+½ = 1 αφαίρεση συνολικά).
 * Μη-strip kinds (pad/tie-beam) ή χωρίς επικάλυψη → επιστρέφει το geometry ως έχει.
 */
export function foundationStripNetGeometry(
  strip: FoundationEntity,
  siblings: readonly FoundationEntity[],
): FoundationGeometry {
  if (strip.kind !== 'strip') return strip.geometry;
  const self = footprintToPolygon(strip);
  let overlapCanvas = 0;
  for (const sib of siblings) {
    if (sib.id === strip.id || sib.kind !== 'strip') continue;
    overlapCanvas += multiPolygonArea(safeIntersection(self, footprintToPolygon(sib)));
  }
  if (overlapCanvas <= 0) return strip.geometry;
  const overlapM2 = overlapCanvas * canvasToM2(strip);
  const netArea = Math.max(0, strip.geometry.area - overlapM2 / 2);
  const netVolume = netArea * strip.geometry.thickness * MM_TO_M;
  return { ...strip.geometry, area: netArea, volume: netVolume };
}

/**
 * Authoritative net total μιας εσχάρας: union των footprints ανά thickness-bucket
 * (διαφορετικά πάχη → ξεχωριστά στερεά), άθροισμα area×thickness. Standalone/μη-strip
 * αγνοούνται (μόνο grid strips συνεισφέρουν στο union).
 */
export function computeFoundationGridNet(
  strips: readonly FoundationEntity[],
): FoundationGridNet {
  const grid = strips.filter((s) => s.kind === 'strip');
  const grossVolumeM3 = grid.reduce((sum, s) => sum + s.geometry.volume, 0);

  const buckets = new Map<number, FoundationEntity[]>();
  for (const s of grid) {
    const key = Math.round(s.geometry.thickness);
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(s);
  }

  let netAreaM2 = 0;
  let netVolumeM3 = 0;
  for (const [thicknessMm, bucket] of buckets) {
    const polys = bucket.map(footprintToPolygon);
    const union = safeUnion(polys[0], ...polys.slice(1));
    const areaM2 = multiPolygonArea(union) * canvasToM2(bucket[0]);
    netAreaM2 += areaM2;
    netVolumeM3 += areaM2 * thicknessMm * MM_TO_M;
  }

  return {
    grossVolumeM3,
    netVolumeM3,
    netAreaM2,
    overlapVolumeM3: Math.max(0, grossVolumeM3 - netVolumeM3),
  };
}
