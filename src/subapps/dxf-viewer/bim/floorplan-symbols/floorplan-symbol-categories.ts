/**
 * ADR-415 — Floorplan symbol CATEGORY ENGINE (SSoT).
 *
 * The Revit-faithful heart of the category-driven entity (ADR-415 Δ2): ONE family
 * engine (`type: 'floorplan-symbol'`) + a `category` that resolves discipline
 * (ADR-405), IFC class, BimCategory (V/G), the i18n label and the plan palette.
 * A WC therefore becomes a Plumbing Fixture (`IfcSanitaryTerminal`, discipline
 * `plumbing`) — never a piece of furniture.
 *
 * Total over `FloorplanSymbolCategory`: when a future phase adds a category to the
 * union, add its config here in the same commit (the compiler enforces totality).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { type BimCategory, BIM_CATEGORY_LINE_COLORS } from '../../config/bim-object-styles';
import type { Discipline } from '../discipline/bim-discipline';
import type { IfcEntityType } from '../types/ifc-entity-mixin';
import type { FloorplanSymbolCategory } from '../types/floorplan-symbol-types';

export interface FloorplanSymbolCategoryConfig {
  /** V/G + discipline-visibility category (ADR-405). */
  readonly bimCategory: BimCategory;
  /** AEC discipline (drives discipline visibility multi-toggle). */
  readonly discipline: Discipline;
  /** IFC4 class exported for this category. */
  readonly ifcType: IfcEntityType;
  /** i18n label key (namespace: dxf-viewer-shell). */
  readonly labelKey: string;
  /** Plan-symbol stroke colour. */
  readonly stroke: string;
  /** Plan-symbol translucent fill. */
  readonly fill: string;
}

/**
 * Category → config map. Each category maps to an existing BimCategory:
 *   - sanitary → `sanitary` (plumbing, IfcSanitaryTerminal) — cool blue
 *   - kitchen  → `kitchen`  (architectural, IfcFurniture)   — green
 *   - furniture→ `furniture`(interior, IfcFurniture)        — tan
 */
export const FLOORPLAN_SYMBOL_CATEGORY_CONFIG: Readonly<
  Record<FloorplanSymbolCategory, FloorplanSymbolCategoryConfig>
> = {
  sanitary: {
    bimCategory: 'sanitary',
    discipline: 'plumbing',
    ifcType: 'IfcSanitaryTerminal',
    labelKey: 'floorplanSymbol.category.sanitary',
    // ADR-375 Φ D — stroke από το κεντρικό BIM_CATEGORY_LINE_COLORS SSoT (όχι διπλό literal).
    stroke: BIM_CATEGORY_LINE_COLORS.sanitary,
    fill: 'rgba(2, 132, 199, 0.10)',
  },
  kitchen: {
    bimCategory: 'kitchen',
    discipline: 'architectural',
    ifcType: 'IfcFurniture',
    labelKey: 'floorplanSymbol.category.kitchen',
    stroke: BIM_CATEGORY_LINE_COLORS.kitchen,
    fill: 'rgba(5, 150, 105, 0.10)',
  },
  furniture: {
    bimCategory: 'furniture',
    discipline: 'interior',
    ifcType: 'IfcFurniture',
    labelKey: 'floorplanSymbol.category.furniture',
    stroke: BIM_CATEGORY_LINE_COLORS.furniture,
    fill: 'rgba(180, 130, 80, 0.12)',
  },
} as const;

/** Resolve the category config (discipline/IFC/BimCategory/label/palette). */
export function resolveSymbolCategoryConfig(
  category: FloorplanSymbolCategory,
): FloorplanSymbolCategoryConfig {
  return FLOORPLAN_SYMBOL_CATEGORY_CONFIG[category];
}
