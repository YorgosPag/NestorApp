/**
 * ADR-650 M4 · ADR-920 Β6.1 — **ΜΙΑ** υψομετρική κλίμακα (Civil 3D «Elevation Banding») για τον DXF viewer
 * **και** για τη δημόσια αγγελία.
 *
 * Η χαρτογραφική σύμβαση που χρησιμοποιούν όλα τα εργαλεία τοπογραφίας και GIS (Civil 3D elevation analysis,
 * υψομετρικές αποχρώσεις QGIS/GRASS, φύλλα USGS): το χαμηλό έδαφος διαβάζεται πράσινο, το μεσαίο ώχρα/κίτρινο,
 * το ψηλό καφέ, και οι κορυφές ανοιχτόχρωμες. Δεν είναι διακόσμηση: έτσι διαβάζει ο τοπογράφος το ανάγλυφο με μια
 * ματιά, πριν καν σχεδιαστούν οι ισοϋψείς.
 *
 * 🔑 **Γιατί ζει εδώ και όχι στον viewer**: η κάτοψη (SVG) και το 3Δ της αγγελίας πρέπει να δείχνουν τα **ίδια**
 * χρώματα με τον viewer. Δεύτερος πίνακας στάσεων θα απέκλινε σιωπηλά. Ο viewer (`bim-3d/converters/
 * terrain-elevation-ramp.ts`) **καλεί** αυτόν τον αξιολογητή· δεν κρατά δικό του.
 *
 * 🔑 **Τα μαθηματικά είναι του three.js, χωρίς το three.js**: οι στάσεις είναι sRGB, μετατρέπονται σε **γραμμικό**
 * χώρο (ό,τι κάνει το `THREE.Color.setHex` με το ColorManagement ενεργό, όπως είναι στον viewer) και η
 * παρεμβολή γίνεται εκεί. Έτσι ένας λόφος ταιριάζει με το δείγμα του και δεν ξεθωριάζει κάτω από τον φωτισμό PBR.
 * Η μετατροπή είναι η **μία** του έργου (`@/lib/color/srgb-transfer`, IEC 61966-2-1).
 *
 * Pure — zero DOM/React/store/three.
 */

import { linearToSrgbUnit, srgbToLinearUnit } from '@/lib/color/srgb-transfer';
import { trueColorToHex } from '@/lib/color/true-color';

/** Μία στάση: `t` = κανονικοποιημένο υψόμετρο μέσα στο **δικό** εύρος της επιφάνειας· `color` = sRGB `0xRRGGBB`. */
export interface ElevationRampStop {
  readonly t: number;
  readonly color: number;
}

/** Στάση έτοιμη για παρεμβολή: τα κανάλια σε γραμμικό χώρο, υπολογισμένα **μία** φορά. */
export interface LinearRampStop {
  readonly t: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * Η κλίμακα, από χαμηλά προς ψηλά. Σχετική με το **δικό** εύρος της επιφάνειας (όχι απόλυτο υψόμετρο), ώστε ένας
 * ύβος 3 m σε κήπο και μια πλαγιά 300 m να απλώνονται και οι δύο σε όλη την κλίμακα, γιατί αυτός είναι ο σκοπός
 * ενός στυλ ανάλυσης.
 */
export const TERRAIN_ELEVATION_RAMP: readonly ElevationRampStop[] = [
  { t: 0.0, color: 0x2f6b3c }, // valley floor — deep green
  { t: 0.28, color: 0x7fae53 }, // low slopes — grass
  { t: 0.52, color: 0xd8cd7d }, // mid slopes — ochre
  { t: 0.76, color: 0xa8744d }, // upper slopes — earth brown
  { t: 1.0, color: 0xf0ece4 }, // crest — pale rock
];

/** sRGB `0xRRGGBB` → γραμμικά κανάλια, με την **ίδια** διάσπαση bytes με το `THREE.Color.setHex`. */
function linearStop(stop: ElevationRampStop): LinearRampStop {
  const hex = Math.floor(stop.color);
  return {
    t: stop.t,
    r: srgbToLinearUnit(((hex >> 16) & 255) / 255),
    g: srgbToLinearUnit(((hex >> 8) & 255) / 255),
    b: srgbToLinearUnit((hex & 255) / 255),
  };
}

/** Προετοιμάζει μια κλίμακα για παρεμβολή. Ο καλών την κρατά (μία φορά ανά module), ποτέ ανά κορυφή. */
export function linearRampOf(ramp: readonly ElevationRampStop[]): readonly LinearRampStop[] {
  return ramp.map(linearStop);
}

const LINEAR_ELEVATION_RAMP = linearRampOf(TERRAIN_ELEVATION_RAMP);

/** Δείκτης της πρώτης στάσης στο `t` ή πάνω του (ποτέ 0: κάθε `t ≥ 0` έχει κάτω στάση). */
function upperStopIndex(t: number, ramp: readonly LinearRampStop[]): number {
  for (let i = 1; i < ramp.length; i++) {
    if (t <= ramp[i]!.t) return i;
  }
  return ramp.length - 1;
}

/**
 * Ο **ένας** αξιολογητής κλίμακας: χρώμα για κανονικοποιημένο `t` ∈ [0,1], γραμμένο στο `out` από τη θέση `i` ως
 * γραμμικό RGB (η διάταξη που περιμένει το `color` ενός `BufferGeometry`). Χωρίς δέσμευση μνήμης, γιατί τρέχει
 * μία φορά ανά κορυφή. Το `t` έξω από το εύρος περιορίζεται· μη πεπερασμένο ⇒ `0` (επίπεδη επιφάνεια = τόνος κοιλάδας).
 */
export function writeLinearRampColor(
  out: Float32Array | number[],
  i: number,
  t: number,
  ramp: readonly LinearRampStop[],
): void {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const upperIndex = upperStopIndex(clamped, ramp);
  const lower = ramp[upperIndex - 1]!;
  const upper = ramp[upperIndex]!;
  const span = upper.t - lower.t;
  const local = span > 0 ? (clamped - lower.t) / span : 0;
  out[i] = lower.r + (upper.r - lower.r) * local;
  out[i + 1] = lower.g + (upper.g - lower.g) * local;
  out[i + 2] = lower.b + (upper.b - lower.b) * local;
}

/** Η υψομετρική κλίμακα του εδάφους, σε γραμμικό χώρο (για 3Δ). */
export function writeTerrainElevationColor(out: Float32Array | number[], i: number, t: number): void {
  writeLinearRampColor(out, i, t, LINEAR_ELEVATION_RAMP);
}

/** Γραμμικό κανάλι → byte sRGB. */
function srgbByte(linear: number): number {
  return Math.round(linearToSrgbUnit(linear) * 255);
}

/**
 * Το **ίδιο** χρώμα ως `#RRGGBB` sRGB, για το SVG της κάτοψης: παρεμβολή στον γραμμικό χώρο, όπως στο 3Δ, και
 * μετά πίσω σε sRGB. Έτσι η κάτοψη και το 3Δ δείχνουν το ίδιο υψόμετρο με το ίδιο χρώμα.
 */
export function terrainElevationHex(t: number): string {
  const rgb = [0, 0, 0];
  writeTerrainElevationColor(rgb, 0, t);
  return trueColorToHex((srgbByte(rgb[0]!) << 16) | (srgbByte(rgb[1]!) << 8) | srgbByte(rgb[2]!));
}
