/**
 * @fileoverview **ΟΙ ΛΕΞΕΙΣ ΤΗΣ ΕΠΙΘΕΩΡΗΣΗΣ ΕΔΑΦΟΥΣ** — υψόμετρα, κλίσεις, αποστάσεις και συντεταγμένες για τη γλώσσα του
 *   αναγνώστη (ADR-920 §14.10).
 * @related ./terrain-map-words (`metresOf` · `lengthLabel` — η ΜΙΑ μορφοποίηση μήκους) · `@/lib/geo/greek-grid` (ΕΓΣΑ'87 →
 *   WGS84, η ΜΙΑ σύνθεση) · `properties-enums:orientation.short` (Β · ΒΑ · … — το ΕΝΑ λεξιλόγιο διευθύνσεων)
 * @module components/listing-detail/terrain/terrain-inspect-words
 *
 * 📐 **Ακρίβεια = ό,τι υποστηρίζει η επιφάνεια**: υψόμετρο σε εκατοστά (η ακρίβεια του δημοσιευμένου στιγμιότυπου —
 *   Civil 3D δείχνει δύο δεκαδικά στο tooltip), αποστάσεις σε δέκατα, κλίση σε δέκατα του %. Ποτέ ψευδο-ακρίβεια.
 * 🗺️ **Συντεταγμένες — η πρακτική Revit / Civil 3D, μέσα στη Δ3**: η δημόσια αγγελία δείχνει θέση ως προς το ΚΕΝΤΡΟ
 *   («12 m Α · 8 m Β», το «project base point»). Η προεπισκόπηση του ιδιοκτήτη, που έχει το αρχείο, δείχνει και τις
 *   συντεταγμένες του αρχείου (το «survey point»): ΕΓΣΑ'87 + WGS84 όταν το αρχείο πέφτει στην περιοχή χρήσης του EPSG:2100,
 *   αλλιώς ουδέτερα «X / Y αρχείου» — ποτέ ετικέτα συστήματος που δεν επαληθεύτηκε.
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { greekGridToGeoPoint, isWithinGreekGridAreaOfUse } from '@/lib/geo/greek-grid';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import type { TerrainPointReading } from '@/lib/terrain/inspect/terrain-point-reading';

import { lengthLabel } from './terrain-map-words';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map.inspect';
/** Τα namespaces της επιθεώρησης: οι λέξεις του χάρτη + οι συντομογραφίες διευθύνσεων. */
export const TERRAIN_INSPECT_NAMESPACES = ['listing-detail', 'properties-enums'] as const;

const ELEVATION_STEP_M = 0.01;
const DISTANCE_STEP_M = 0.1;
const GRID_DIGITS = 2;
const GEO_DIGITS = 6;

/** «124,37 m». */
export function elevationLabel(t: T, valueM: number): string {
  return lengthLabel(t, valueM, ELEVATION_STEP_M);
}

/** «4,2 m». */
export function distanceLabel(t: T, valueM: number): string {
  return lengthLabel(t, valueM, DISTANCE_STEP_M);
}

/** «12,4 %». */
export function gradeLabel(valuePct: number): string {
  return formatPercentage(valuePct, { maximumFractionDigits: 1 });
}

/** «12,4 % (7,1°)». */
export function slopeLabel(t: T, reading: Pick<TerrainPointReading, 'slopePct' | 'slopeDeg'>): string {
  const deg = t(`${NS}.degrees`, { value: formatNumber(reading.slopeDeg, { maximumFractionDigits: 1 }) });
  return t(`${NS}.slopeValue`, { pct: gradeLabel(reading.slopePct), deg });
}

/** «12 m Α · 8 m Β από το κέντρο» — θέση ως προς το κέντρο της επιφάνειας, χωρίς πρόσημα (ο αναγνώστης διαβάζει γράμματα). */
export function localPositionLabel(t: T, x: number, y: number): string {
  const east = `${distanceLabel(t, Math.abs(x))} ${t(`properties-enums:orientation.short.${x < 0 ? 'west' : 'east'}`)}`;
  const north = `${distanceLabel(t, Math.abs(y))} ${t(`properties-enums:orientation.short.${y < 0 ? 'south' : 'north'}`)}`;
  return t(`${NS}.local`, { east, north });
}

const grid = (value: number): string => formatNumber(value, { minimumFractionDigits: GRID_DIGITS, maximumFractionDigits: GRID_DIGITS });
const geo = (value: number): string => formatNumber(value, { minimumFractionDigits: GEO_DIGITS, maximumFractionDigits: GEO_DIGITS });

/** Οι συντεταγμένες του αρχείου στο σημείο: γραμμές για ανάγνωση + το κείμενο για αντιγραφή («E N», μέτρα). */
interface WorldPositionWords {
  readonly lines: readonly string[];
  readonly copyText: string;
}

/** Μόνο για την προεπισκόπηση του ιδιοκτήτη (`centreWorldMm` υπάρχει μόνο εκεί). */
export function worldPositionWords(t: T, centreWorldMm: PlanarPoint, x: number, y: number): WorldPositionWords {
  const e = centreWorldMm.x / 1000 + x;
  const n = centreWorldMm.y / 1000 + y;
  const copyText = `${e.toFixed(GRID_DIGITS)} ${n.toFixed(GRID_DIGITS)}`;
  if (!isWithinGreekGridAreaOfUse(e, n)) return { lines: [t(`${NS}.file`, { x: grid(e), y: grid(n) })], copyText };
  const wgs = greekGridToGeoPoint(e, n);
  return {
    lines: [t(`${NS}.egsa`, { e: grid(e), n: grid(n) }), t(`${NS}.wgs84`, { lat: geo(wgs.lat), lng: geo(wgs.lng) })],
    copyText,
  };
}
