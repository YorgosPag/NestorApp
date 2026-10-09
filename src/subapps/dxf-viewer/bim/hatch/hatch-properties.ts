/**
 * Hatch property SSoT (ADR-507).
 *
 * ΕΝΑ σημείο αλήθειας για semantic ιδιότητες της γραμμοσκίασης + το αμφίδρομο
 * mapping islandStyle ↔ DXF code 75. Καταναλωτές: `HatchRenderer` (canvas),
 * `dxf-ascii-writer` (export), `dxf-entity-converters` (import). Έτσι το «είναι
 * solid;» και το «code 75 ↔ island» ορίζονται ΜΙΑ φορά (N.12 — αλλιώς η ίδια
 * λογική τριπλασιάζεται σε render/write/read).
 *
 * Leaf module: type-only import από `types/entities` (μηδέν runtime dep → μηδέν κύκλος).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { HatchEntity, LineweightMm } from '../../types/entities';
import { lineweightToPx, isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { lineweightDisplayPx } from '../../config/lineweight-display-px';
import { getPrintColorPolicy } from '../../config/print-color-policy';

/** Island/fill style — παράγεται από τον τύπο (SSoT, μηδέν χειροκίνητο literal). */
export type HatchIslandStyle = NonNullable<HatchEntity['islandStyle']>;

/**
 * Fallback πάχος γραμμών μοτίβου (px) όταν η γραμμοσκίαση δεν έχει concrete
 * `lineweightMm` (ByLayer/default) — η ιστορική προεπιλογή (zero regression).
 */
export const DEFAULT_HATCH_LINE_WIDTH_PX = 0.5;

/**
 * Πάχος γραμμών μοτίβου (px) από το `lineweightMm` (ADR-507 Φ2). **Zoom-independent
 * (AutoCAD LWT)** μέσω του mm→px SSoT `lineweightToPx`· μη-concrete (ByLayer/-2 /
 * undefined) → ιστορικό fallback. Floor στο fallback ώστε λεπτές τιμές να φαίνονται.
 *
 * Leaf-safe: ζει εδώ (όχι στον HatchRenderer) ώστε να είναι unit-testable χωρίς να
 * τραβά το βαρύ render import chain.
 */
export function resolveHatchLineWidthPx(
  lineweightMm: LineweightMm | null | undefined,
): number {
  if (getPrintColorPolicy() !== null) return printHatchPenPx(lineweightMm, DEFAULT_HATCH_LINE_PEN_MM);
  if (!isConcreteLineweight(lineweightMm)) return DEFAULT_HATCH_LINE_WIDTH_PX;
  return Math.max(DEFAULT_HATCH_LINE_WIDTH_PX, lineweightToPx(lineweightMm));
}

/** Ιστορικό πάχος περιγράμματος στην οθόνη (px) όταν ο contour pen δεν ορίζει πάχος. */
export const DEFAULT_HATCH_CONTOUR_WIDTH_PX = 1;

/**
 * Οι πένες που **τυπώνονται** όταν η γραμμοσκίαση δεν ορίζει δική της (ADR-909 Β2.6). ISO 128: η
 * γραμμοσκίαση είναι **λεπτή** γραμμή, λεπτότερη από το περίγραμμα που την περικλείει — 0,13 mm μέσα,
 * 0,18 mm γύρω. Στην οθόνη δεν ισχύουν: εκεί μένουν τα ιστορικά 0,5 / 1 px.
 */
const DEFAULT_HATCH_LINE_PEN_MM = 0.13;
const DEFAULT_HATCH_CONTOUR_PEN_MM = 0.18;

/**
 * 🔴 **Η πένα μιας γραμμοσκίασης στο χαρτί** — στο dpi και με το δάπεδο της απόδοσης που τρέχει.
 *
 * Μετρημένο ζωντανά (2026-10-09, δημόσια κάτοψη 3732×4096): οι διαγώνιες έβγαιναν **0,5 px** δίπλα σε
 * τοίχους 4,92 px — το `lineweightToPx` μετέτρεπε στα **96 dpi της οθόνης** μέσα σε εικόνα 694 dpi, και
 * χωρίς δάπεδο. Πέμπτη εμφάνιση της κλάσης «ζωγράφος που δεν ρωτά την πολιτική εκτύπωσης».
 */
function printHatchPenPx(lineweightMm: LineweightMm | null | undefined, defaultMm: number): number {
  const concrete = isConcreteLineweight(lineweightMm) && lineweightMm > 0;
  return lineweightDisplayPx(concrete ? lineweightMm : defaultMm);
}

/**
 * Πάχος **περιγράμματος** γραμμοσκίασης (px) — ο αδελφός του {@link resolveHatchLineWidthPx} για τον
 * contour pen. Οθόνη: ό,τι και πριν (ρητό πάχος → LWT px, αλλιώς 1 px). Print pass: πένα στο dpi της
 * απόδοσης, με το δάπεδό της.
 */
export function resolveHatchContourWidthPx(
  lineweightMm: LineweightMm | null | undefined,
): number {
  if (getPrintColorPolicy() !== null) return printHatchPenPx(lineweightMm, DEFAULT_HATCH_CONTOUR_PEN_MM);
  return lineweightMm === undefined
    ? DEFAULT_HATCH_CONTOUR_WIDTH_PX
    : resolveHatchLineWidthPx(lineweightMm);
}

/** Τα μόνα πεδία που χρειάζεται ο solid-έλεγχος (loose ώστε να δέχεται writer carriers). */
type SolidProbe = Pick<HatchEntity, 'fillType' | 'patternType' | 'patternName'>;

/**
 * SSoT: είναι συμπαγής (solid fill) η γραμμοσκίαση; Προτεραιότητα `fillType` →
 * `patternType` → όνομα μοτίβου `SOLID`.
 */
export function isSolidHatch(hatch: SolidProbe): boolean {
  if (hatch.fillType) return hatch.fillType === 'solid';
  if (hatch.patternType) return hatch.patternType === 'solid';
  return (hatch.patternName ?? '').toUpperCase() === 'SOLID';
}

/** Το μόνο πεδίο που χρειάζεται ο έλεγχος περιγράμματος (loose, όπως το `SolidProbe`). */
type ContourProbe = Pick<HatchEntity, 'contourPen'>;

/**
 * SSoT: ζωγραφίζει αυτή η γραμμοσκίαση **δικό της** περίγραμμα; (ADR-507 — contour pen).
 *
 * `undefined` ⇒ **ναι** (backward-compat για ήδη αποθηκευμένα έγγραφα)· ο import γράφει ρητά
 * `{ visible: false }`, γιατί στο AutoCAD το όριο είναι **ξεχωριστή οντότητα** που έρχεται με
 * το ίδιο DXF (μετρημένο στο `47_ergasia.dxf`: 47 LWPOLYLINE στο layer `pl`, **99,4%** των
 * κορυφών τους πάνω σε κορυφή ορίου hatch) ⇒ δεύτερο δικό μας περίγραμμα = **διπλή γραμμή**.
 *
 * Ζει εδώ και **όχι** μέσα στον renderer επειδή την ίδια ερώτηση κάνουν **δύο** pipelines:
 * η οθόνη (`HatchRenderer`) και το vector PDF (`print/vector/scene-hatch-emitter`). Όσο η
 * συνθήκη ήταν inline στην οθόνη, το χαρτί δεν την ρωτούσε καν και τύπωνε πάντα περίγραμμα.
 */
export function isHatchContourVisible(hatch: ContourProbe): boolean {
  return hatch.contourPen?.visible !== false;
}

/** SSoT: islandStyle → DXF code 75 (normal=0, outer=1, ignore=2). */
export function islandStyleToDxf75(style: HatchEntity['islandStyle']): number {
  return style === 'outer' ? 1 : style === 'ignore' ? 2 : 0;
}

/** SSoT: DXF code 75 → islandStyle (αντίστροφο του `islandStyleToDxf75`). */
export function dxf75ToIslandStyle(code: number): HatchIslandStyle {
  return code === 1 ? 'outer' : code === 2 ? 'ignore' : 'normal';
}
