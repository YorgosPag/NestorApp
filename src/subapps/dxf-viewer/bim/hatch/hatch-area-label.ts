/**
 * ADR-649 — «Ετικέτα Εμβαδού Γραμμοσκίασης»: pure builders (χωρίς React/state).
 *
 * SSoT για ΤΟ ΚΕΙΜΕΝΟ + ΤΗ ΘΕΣΗ + ΤΟ ΜΕΓΕΘΟΣ + ΤΟ text-entity της ετικέτας εμβαδού
 * που ρίχνει το 2-κλικ εργαλείο (`handleHatchAreaLabelClick`). Μηδέν re-implementation:
 *   - εμβαδόν  → `computeHatchAreaMm2` (outer − islands, mm²)
 *   - μορφή    → `formatAreaForDisplay` (ενεργή display-μονάδα, «25,00 m²»)
 *   - κέντρο   → `polygon2DAreaCentroid` (area-weighted, σωστό σε κοίλα L/T/U)
 *   - bbox     → `boundsOfPoints` (fit-to-hatch ύψος κειμένου)
 *   - υλικό    → `HATCH_PATTERN_CATALOG[patternName].labelKey` → genitive i18n
 *   - textNode → `makeNode`/`makeRun` SSoT builders
 *   - id       → `generateEntityId` (enterprise-id SSoT, N.6)
 *
 * **Μέγεθος κειμένου (fit-to-hatch):** το ύψος ΔΕΝ κλιμακώνεται με το `drawingScale`
 * (που έκανε τα κείμενα δυσανάλογα μεγάλα)· προκύπτει από τις ΔΙΑΣΤΑΣΕΙΣ της ίδιας της
 * γραμμοσκίασης ώστε η ετικέτα να χωράει πάντα μέσα της, ανεξάρτητα από κλίμακα/μονάδες.
 *
 * @see ./hatch-completion — computeHatchAreaMm2
 * @see ../geometry/shared/polygon-utils — polygon2DAreaCentroid
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { HatchEntity, TextEntity } from '../../types/entities';
import type { DxfTextNode } from '../../text-engine/types/text-ast.types';
import { i18n } from '@/i18n';
import { computeHatchAreaMm2 } from './hatch-completion';
import { pickTopHatchAt } from './hatch-pick-at';
import { formatAreaForDisplay } from '../../config/display-length-format';
import { polygon2DAreaCentroid } from '../geometry/shared/polygon-utils';
import { boundsOfPoints } from '../../services/clip/clip-geometry';
import { HATCH_PATTERN_CATALOG } from '../../data/hatch-pattern-catalog';
import { makeRun, makeParagraph, makeNode, DEFAULT_RUN_STYLE } from '../../text-engine/templates/defaults/template-helpers';
import { generateEntityId } from '../../systems/entity-creation/utils';

const NS = 'dxf-viewer-shell';

// Fit-to-hatch tuning: το κείμενο καταλαμβάνει ~85% του πλάτους του bbox (με μέσο
// πλάτος χαρακτήρα ≈ 0.6× του ύψους) ΚΑΙ ≤35% του ύψους — ό,τι δώσει μικρότερο ύψος.
const LABEL_WIDTH_FILL = 0.85;
const LABEL_CHAR_WIDTH_RATIO = 0.6;
const LABEL_MAX_HEIGHT_FRACTION = 0.35;

/**
 * Γενική (genitive) ονομασία υλικού για το pattern της γραμμοσκίασης, ή `null`.
 * Παράγει το «γρασιδιού» στο «Εμβαδόν γρασιδιού: 25,00 m²». Η γενική ζει ΜΟΝΟ στο
 * locale (`hatchAreaLabel.materials.<key>`, N.11) — αν λείπει, επιστρέφει `null`
 * και η ετικέτα πέφτει στο σκέτο «Εμβαδόν: …» (fallback χωρίς υλικό).
 */
export function resolveHatchMaterialGenitive(patternName?: string): string | null {
  if (!patternName) return null;
  const entry = HATCH_PATTERN_CATALOG[patternName];
  if (!entry) return null;
  // labelKey = 'ribbon.commands.hatchEditor.patterns.grass' → τελευταίο segment 'grass'.
  const patternKey = entry.labelKey.split('.').pop();
  if (!patternKey) return null;
  const key = `hatchAreaLabel.materials.${patternKey}`;
  return i18n.exists(key, { ns: NS }) ? i18n.t(key, { ns: NS }) : null;
}

/**
 * Το κείμενο της ετικέτας: «Εμβαδόν γρασιδιού: 25,00 m²» όταν το pattern είναι
 * αναγνωρίσιμο, αλλιώς «Εμβαδόν: 25,00 m²». Prefix + genitive resolve μέσω i18n.
 */
export function buildHatchAreaLabelText(hatch: HatchEntity): string {
  const areaStr = formatAreaForDisplay(computeHatchAreaMm2(hatch));
  const prefix = i18n.t('hatchAreaLabel.areaPrefix', { ns: NS });
  const material = resolveHatchMaterialGenitive(hatch.patternName);
  return material ? `${prefix} ${material}: ${areaStr}` : `${prefix}: ${areaStr}`;
}

/**
 * Σημείο αγκύρωσης της ετικέτας (επιλογή Giorgio): αν το 2ο κλικ πέσει ΜΕΣΑ στην
 * ίδια γραμμοσκίαση (even-odd `pickTopHatchAt` σε μονάδα-λίστα) → κέντρο βάρους·
 * αλλιώς (κλικ στον καμβά) → ακριβώς το σημείο του κλικ.
 */
export function resolveHatchLabelAnchor(hatch: HatchEntity, clickPoint: Point2D): Point2D {
  const outer = hatch.boundaryPaths[0];
  const inside = pickTopHatchAt(clickPoint, [hatch]) === hatch.id;
  return inside && outer && outer.length >= 3 ? polygon2DAreaCentroid(outer) : clickPoint;
}

/**
 * **Fit-to-hatch** ύψος κειμένου (ίδιες μονάδες με τις συντεταγμένες του σχεδίου):
 * όσο χρειάζεται ώστε το κείμενο να χωράει στο ~85% του πλάτους του bbox της
 * γραμμοσκίασης, χωρίς να ξεπερνά το ~35% του ύψους της. Degenerate outer → 1.
 */
export function fitHatchLabelHeight(text: string, outer: readonly Point2D[] | undefined): number {
  if (!outer || outer.length < 3) return 1;
  const b = boundsOfPoints(outer as Point2D[]);
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;
  const byWidth = (LABEL_WIDTH_FILL * width) / Math.max(1, text.length * LABEL_CHAR_WIDTH_RATIO);
  const byHeight = LABEL_MAX_HEIGHT_FRACTION * height;
  const fit = Math.min(byWidth, byHeight);
  return fit > 0 ? fit : 1;
}

/**
 * `DxfTextNode` για την ετικέτα: ένα κεντραρισμένο (MC) run με το δοσμένο `height`
 * (σε μονάδες σχεδίου). Χτίζεται με τα `makeRun`/`makeParagraph`/`makeNode` SSoT.
 */
export function buildHatchAreaLabelTextNode(text: string, height: number): DxfTextNode {
  const run = makeRun(text, { ...DEFAULT_RUN_STYLE, height });
  return makeNode([makeParagraph([run], { justification: 1 })], { attachment: 'MC' });
}

/**
 * Το ολοκληρωμένο `TextEntity` της ετικέτας εμβαδού (κείμενο + θέση + fit-to-hatch
 * ύψος + textNode + enterprise id), έτοιμο για `completeEntity`. Το `layerId: ''`
 * αφήνει τον canonical create-path να αναθέσει το ενεργό layer (mirror annotation symbol).
 */
export function buildHatchAreaLabelEntity(hatch: HatchEntity, clickPoint: Point2D): TextEntity {
  const text = buildHatchAreaLabelText(hatch);
  const height = fitHatchLabelHeight(text, hatch.boundaryPaths[0]);
  return {
    id: generateEntityId(),
    type: 'text',
    layerId: '',
    position: resolveHatchLabelAnchor(hatch, clickPoint),
    text,
    textNode: buildHatchAreaLabelTextNode(text, height),
    rotation: 0,
  };
}
