/**
 * ============================================================================
 * DXF CATEGORY LAYERS — per-category layer SSoT (Revit subcategories)
 * ============================================================================
 *
 * ADR-505 §C (SOLID fill / poché). Ο Giorgio θέλει **κάθε κατηγορία οντότητας σε
 * δικό της layer** (κολώνες → COLUMNS, δοκάρια → BEAMS, ...) + το γέμισμα σε
 * ΞΕΧΩΡΙΣΤΟ layer ανά κατηγορία (COLUMNS_FILL, ...), ώστε να ανάβει/σβήνει χωριστά.
 *
 * Layer names = **ASCII ΕΠΙΤΗΔΕΣ**: ο writer βγάζει bare DXF χωρίς
 * HEADER/$DWGCODEPAGE → ο AutoCAD υποθέτει ANSI και ΣΚΑΛΩΝΕΙ σε non-ASCII
 * (UTF-8 ελληνικά) layer names (ίδιο μάθημα με τον overlay collector).
 *
 * Χρώματα layer = το per-category structural colour identity (ADR-445,
 * `BIM_CATEGORY_LINE_COLORS`) — μηδέν διπλό palette. (Οι ίδιες οι οντότητες
 * φέρουν το δικό τους resolved χρώμα code 62· το layer χρώμα είναι fallback.)
 *
 * Consumers:
 *   - `bim-to-dxf-primitives.ts` → re-layer κάθε BIM body outline σε `resolveDxfBodyLayer`.
 *   - `overlay-dxf-collector.ts` → fill carriers σε `resolveDxfFillLayer`.
 *   - `dxf-export-adapter.ts` → `usedCategoryLayerDefs` register ΜΟΝΟ ό,τι χρησιμοποιήθηκε.
 */

import type { EntityType } from '../../types/base-entity';
import type { SceneLayer } from '../../types/scene-types';
import { BIM_CATEGORY_LINE_COLORS } from '../../config/bim-object-styles';

/** Ορισμός μιας κατηγορίας: outline layer + (προαιρετικό) fill layer + χρώμα. */
interface CategorySpec {
  /** Per-category outline layer name (ASCII). */
  readonly outline: string;
  /** Per-category fill layer name (ASCII) ή null όταν η κατηγορία ΔΕΝ γεμίζεται. */
  readonly fill: string | null;
  /** Layer colour (ADR-445 identity ή ουδέτερο). */
  readonly color: string;
}

const NEUTRAL = '#9e9e9e';
const MEP_GREY = '#7a8a99';

/**
 * Δομικά + αρχιτεκτονικά BIM body categories → layer. Γεμίζονται (fill≠null) ΜΟΝΟ
 * τα δομικά που ζήτησε ο Giorgio: κολώνες/δοκάρια/πλάκες/πέδιλα (+ σοβάς, που ζει
 * στον overlay collector ως FINISH/FINISH_FILL). Τοίχοι/ανοίγματα/Η-Μ = outline-only.
 */
const BODY_CATEGORY: Partial<Record<EntityType, CategorySpec>> = {
  column: { outline: 'COLUMNS', fill: 'COLUMNS_FILL', color: BIM_CATEGORY_LINE_COLORS.column },
  beam: { outline: 'BEAMS', fill: 'BEAMS_FILL', color: BIM_CATEGORY_LINE_COLORS.beam },
  slab: { outline: 'SLABS', fill: 'SLABS_FILL', color: BIM_CATEGORY_LINE_COLORS.slab },
  foundation: { outline: 'FOOTINGS', fill: 'FOOTINGS_FILL', color: BIM_CATEGORY_LINE_COLORS.foundation },
  wall: { outline: 'WALLS', fill: null, color: BIM_CATEGORY_LINE_COLORS.wallExterior },
  opening: { outline: 'OPENINGS', fill: null, color: BIM_CATEGORY_LINE_COLORS.door },
  'slab-opening': { outline: 'OPENINGS', fill: null, color: BIM_CATEGORY_LINE_COLORS.door },
  stair: { outline: 'STAIRS', fill: null, color: BIM_CATEGORY_LINE_COLORS.stair },
  railing: { outline: 'RAILINGS', fill: null, color: BIM_CATEGORY_LINE_COLORS.railing },
  roof: { outline: 'ROOF', fill: null, color: NEUTRAL },
  furniture: { outline: 'FURNITURE', fill: null, color: NEUTRAL },
  'floorplan-symbol': { outline: 'SYMBOLS', fill: null, color: NEUTRAL },
};

/** Όλοι οι Η-Μ τύποι → ΕΝΑ κοινό `MEP` layer (outline-only). */
const MEP_TYPES: readonly EntityType[] = [
  'mep-fixture', 'mep-manifold', 'mep-segment', 'mep-fitting', 'electrical-panel',
  'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-underfloor',
];
const MEP_SPEC: CategorySpec = { outline: 'MEP', fill: null, color: MEP_GREY };

function specFor(type: EntityType): CategorySpec | null {
  return BODY_CATEGORY[type] ?? (MEP_TYPES.includes(type) ? MEP_SPEC : null);
}

/**
 * Per-category outline layer για ένα BIM body type. `null` ⇒ άγνωστη κατηγορία →
 * ο caller κρατά το αρχικό `entity.layerId` (zero-break για μη-χαρτογραφημένους τύπους).
 */
export function resolveDxfBodyLayer(type: EntityType): string | null {
  return specFor(type)?.outline ?? null;
}

/**
 * Per-category fill layer. `null` ⇒ η κατηγορία δεν γεμίζεται (μόνο περίγραμμα).
 */
export function resolveDxfFillLayer(type: EntityType): string | null {
  return specFor(type)?.fill ?? null;
}

function layer(id: string, color: string): SceneLayer {
  return { id, name: id, color, visible: true, locked: false };
}

/** Όλοι οι per-category ορισμοί (outline + fill), keyed by layer id. */
export const CATEGORY_LAYER_DEFS: Readonly<Record<string, SceneLayer>> = (() => {
  const defs: Record<string, SceneLayer> = {};
  const add = (s: CategorySpec): void => {
    defs[s.outline] = layer(s.outline, s.color);
    if (s.fill) defs[s.fill] = layer(s.fill, s.color);
  };
  for (const s of Object.values(BODY_CATEGORY)) if (s) add(s);
  add(MEP_SPEC);
  return defs;
})();

/**
 * Από μια λίστα (ήδη re-layered) entities κρατά ΜΟΝΟ τους category layer defs που
 * όντως χρησιμοποιούνται — ώστε το `layersById` να μη γεμίζει με κενά layers
 * (Revit-clean + προβλέψιμα tests).
 */
export function usedCategoryLayerDefs(
  entities: readonly { readonly layerId: string }[],
): Record<string, SceneLayer> {
  const defs: Record<string, SceneLayer> = {};
  for (const e of entities) {
    const def = CATEGORY_LAYER_DEFS[e.layerId];
    if (def) defs[e.layerId] = def;
  }
  return defs;
}
