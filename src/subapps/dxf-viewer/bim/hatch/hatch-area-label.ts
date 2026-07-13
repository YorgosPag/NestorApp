/**
 * ADR-649 — «Ετικέτα Εμβαδού Γραμμοσκίασης»: pure builders (χωρίς React/state).
 *
 * SSoT για ΤΟ ΚΕΙΜΕΝΟ + ΤΗ ΘΕΣΗ + ΤΟ text-entity της ετικέτας εμβαδού που ρίχνει
 * το 2-κλικ εργαλείο (`handleHatchAreaLabelClick`). Μηδέν re-implementation:
 *   - εμβαδόν  → `computeHatchAreaMm2` (outer − islands, mm²)
 *   - μορφή    → `formatAreaForDisplay` (ενεργή display-μονάδα, «25,00 m²»)
 *   - κέντρο   → `polygon2DAreaCentroid` (area-weighted, σωστό σε κοίλα L/T/U)
 *   - υλικό    → `HATCH_PATTERN_CATALOG[patternName].labelKey` → genitive i18n
 *   - textNode → `makeNode`/`makeRun` SSoT + `paperHeightToModel` (unit-safe ύψος)
 *   - id       → `generateEntityId` (enterprise-id SSoT, N.6)
 *
 * @see ./hatch-completion — computeHatchAreaMm2
 * @see ../geometry/shared/polygon-utils — polygon2DAreaCentroid
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { HatchEntity, TextEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { DxfTextNode } from '../../text-engine/types/text-ast.types';
import { i18n } from '@/i18n';
import { computeHatchAreaMm2 } from './hatch-completion';
import { pickTopHatchAt } from './hatch-pick-at';
import { formatAreaForDisplay } from '../../config/display-length-format';
import { polygon2DAreaCentroid } from '../geometry/shared/polygon-utils';
import { HATCH_PATTERN_CATALOG } from '../../data/hatch-pattern-catalog';
import { makeRun, makeParagraph, makeNode, DEFAULT_RUN_STYLE } from '../../text-engine/templates/defaults/template-helpers';
import { paperHeightToModel } from '../../utils/annotation-scale';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import { generateEntityId } from '../../systems/entity-creation/utils';

const NS = 'dxf-viewer-shell';

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
 * `DxfTextNode` για το κείμενο της ετικέτας με **unit-safe** ύψος: το paper-mm
 * DEFAULT_HEIGHT κλιμακώνεται με το drawing-scale + τις scene units (ίδια διαδρομή
 * με το `makeEmptyTextNode` του text tool), ώστε το μέγεθος να είναι σωστό σε
 * mm/cm/m σκηνές. Χτίζεται με τα `makeRun`/`makeParagraph`/`makeNode` SSoT builders.
 */
export function buildHatchAreaLabelTextNode(
  text: string,
  units: SceneUnits,
  drawingScale: number,
): DxfTextNode {
  const height = paperHeightToModel(TEXT_SIZE_LIMITS.DEFAULT_HEIGHT, drawingScale, units);
  return makeNode([makeParagraph([makeRun(text, { ...DEFAULT_RUN_STYLE, height })])]);
}

/**
 * Το ολοκληρωμένο `TextEntity` της ετικέτας εμβαδού (κείμενο + θέση + textNode +
 * enterprise id), έτοιμο για `completeEntity`. Το `layerId: ''` αφήνει τον
 * canonical create-path να αναθέσει το ενεργό layer (mirror του annotation symbol).
 */
export function buildHatchAreaLabelEntity(
  hatch: HatchEntity,
  clickPoint: Point2D,
  units: SceneUnits,
  drawingScale: number,
): TextEntity {
  const text = buildHatchAreaLabelText(hatch);
  const position = resolveHatchLabelAnchor(hatch, clickPoint);
  return {
    id: generateEntityId(),
    type: 'text',
    layerId: '',
    position,
    text,
    textNode: buildHatchAreaLabelTextNode(text, units, drawingScale),
    rotation: 0,
  };
}
