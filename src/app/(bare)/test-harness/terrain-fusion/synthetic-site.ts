/**
 * ADR-920 §14.12 Β4 — το **συνθετικό** οικόπεδο της σελίδας δοκιμής, ως **κανονικό στιγμιότυπο εδάφους**.
 *
 * Η σελίδα δεν έχει πια δικό της TIN ούτε δικό της ψηφιδωτή: τα σημεία της «αποτύπωσης» περνούν από τον ίδιο χτίστη που
 * περνά κάθε τοπογραφικό (`buildListingTerrainSnapshot`), και το στιγμιότυπο πηγαίνει στο πρωτόκολλο της παραγωγής.
 *
 * ⚠️ **Δεν είναι μέτρηση.** Τα ύψη βγαίνουν από τύπο πάνω στο ύψος του χοντρού στο κέντρο (`baseElevationM`) συν μια
 * ρυθμιζόμενη μετατόπιση — ώστε η ραφή να κρίνεται με το μάτι σε ελεγχόμενες διαφορές. Η πραγματική διαφορά
 * αποτύπωσης ⇄ GLO-30 μετριέται με αληθινή αποτύπωση (Β8).
 */

import { geoPointToGreekGrid } from '@/lib/geo/greek-grid';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import type { TopoPoint } from '@/lib/terrain/terrain-types';
import type { GeoPoint } from '@/types/geo/coordinates';

export interface ProbeSiteSpec {
  readonly center: GeoPoint;
  /** Ύψος του χοντρού στο κέντρο — το συνθετικό έδαφος «κάθεται» εκεί. */
  readonly baseElevationM: number;
  /** Κατακόρυφη μετατόπιση της «μέτρησης» ως προς το χοντρό (προσομοιώνει τη διαφορά DSM ⇄ εδάφους). */
  readonly offsetM: number;
  /** Βήμα των σημείων της συνθετικής αποτύπωσης. */
  readonly gridStepM: number;
}

/** Το περίγραμμα, σε μέτρα του ελληνικού πλέγματος γύρω από το κέντρο — ακανόνιστο πεντάγωνο ~70 × 50 m. */
const PROBE_RING: readonly PlanarPoint[] = [
  { x: -34, y: -18 },
  { x: 26, y: -24 },
  { x: 36, y: 14 },
  { x: 4, y: 26 },
  { x: -30, y: 16 },
];

const MM_PER_M = 1000;

/** Ο τύπος της συνθετικής «αποτύπωσης»: κλίση + ήπιο μικροανάγλυφο + αναλημματικό σκαλοπάτι 1,2 m. */
function syntheticHeightM(spec: ProbeSiteSpec, x: number, y: number): number {
  const slope = 0.06 * x + 0.03 * y;
  const relief = 0.6 * Math.sin(x / 7) * Math.cos(y / 9);
  const terrace = y > 4 + 0.15 * x ? 1.2 : 0;
  return spec.baseElevationM + spec.offsetM + slope + relief + terrace;
}

/** Τα σημεία της «αποτύπωσης»: πλέγμα `gridStepM` πάνω από το περίγραμμα και ένα βήμα γύρω του, σε mm του ΕΓΣΑ '87. */
function surveyPoints(spec: ProbeSiteSpec, eastingM: number, northingM: number): TopoPoint[] {
  const step = spec.gridStepM;
  const xs = PROBE_RING.map((p) => p.x);
  const ys = PROBE_RING.map((p) => p.y);
  const points: TopoPoint[] = [];
  for (let y = Math.min(...ys) - step; y <= Math.max(...ys) + step; y += step) {
    for (let x = Math.min(...xs) - step; x <= Math.max(...xs) + step; x += step) {
      points.push({
        x: (eastingM + x) * MM_PER_M,
        y: (northingM + y) * MM_PER_M,
        z: Math.round(syntheticHeightM(spec, x, y) * MM_PER_M),
      });
    }
  }
  return points;
}

/**
 * Το στιγμιότυπο του συνθετικού οικοπέδου: σημεία σε ΕΓΣΑ '87, κομμένα στο περίγραμμα, με γεωαναφορά. Κάθε κλήση δίνει
 * **νέο αντικείμενο** — άρα νέο κλειδί επιφάνειας στο πρωτόκολλο.
 */
export function buildProbeSnapshot(spec: ProbeSiteSpec): ListingTerrainSnapshot {
  const { easting, northing } = geoPointToGreekGrid(spec.center);
  const built = buildListingTerrainSnapshot({
    points: surveyPoints(spec, easting, northing),
    boundaryWorldMm: PROBE_RING.map((p) => ({ x: (easting + p.x) * MM_PER_M, y: (northing + p.y) * MM_PER_M })),
    envelope: null,
    georeference: { coordinateSystem: 'EPSG:2100' },
  });
  if (!built.ok) throw new Error(`terrain-fusion probe: the synthetic survey was refused (${built.reason})`);
  return built.snapshot;
}
