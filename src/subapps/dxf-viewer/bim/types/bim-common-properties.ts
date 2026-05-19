/**
 * ADR-363 Phase 7.1 Step 6.1 — Common-properties registry για bulk-edit ribbon.
 *
 * SSoT για το «τι μπορώ να επεξεργαστώ μαζικά» όταν multi-selection.
 * Mixed selection → intersection per `key` (Revit common-properties pattern).
 *
 * Scope Phase 7.1: numeric mm params μόνο. Material / layerId / visible →
 * Phase 7.2 (μαζί με mirror/rotate/copy και material catalog hookup).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §7.1
 */

import type { EntityType } from '../../types/entities';

export type BimEditablePropertyKey =
  | 'height'
  | 'thickness'
  | 'width'
  | 'depth'
  | 'elevation'
  | 'sillHeight';

export interface BimEditableProperty {
  readonly key: BimEditablePropertyKey;
  readonly unit: 'mm';
  readonly min: number;
  readonly max: number;
  /** i18n label key under `ribbon.contextualTabs.multiSelection.properties`. */
  readonly labelKey: string;
}

// ─── Property definitions (single source — referenced by registry below) ─────

const HEIGHT:      BimEditableProperty = { key: 'height',     unit: 'mm', min: 1,   max: 100_000, labelKey: 'ribbon.contextualTabs.multiSelection.properties.height' };
const THICKNESS:   BimEditableProperty = { key: 'thickness',  unit: 'mm', min: 1,   max: 5_000,   labelKey: 'ribbon.contextualTabs.multiSelection.properties.thickness' };
const WIDTH:       BimEditableProperty = { key: 'width',      unit: 'mm', min: 1,   max: 50_000,  labelKey: 'ribbon.contextualTabs.multiSelection.properties.width' };
const DEPTH:       BimEditableProperty = { key: 'depth',      unit: 'mm', min: 1,   max: 5_000,   labelKey: 'ribbon.contextualTabs.multiSelection.properties.depth' };
const ELEVATION:   BimEditableProperty = { key: 'elevation',  unit: 'mm', min: -50_000, max: 1_000_000, labelKey: 'ribbon.contextualTabs.multiSelection.properties.elevation' };
const SILL_HEIGHT: BimEditableProperty = { key: 'sillHeight', unit: 'mm', min: 0,   max: 10_000,  labelKey: 'ribbon.contextualTabs.multiSelection.properties.sillHeight' };

/**
 * Per-kind editable properties.
 * Order = visual order στο ribbon panel.
 */
export const COMMON_PROPERTIES_BY_KIND: Readonly<Partial<Record<EntityType, readonly BimEditableProperty[]>>> = {
  wall:           [HEIGHT, THICKNESS],
  opening:        [WIDTH, HEIGHT, SILL_HEIGHT],
  slab:           [THICKNESS, ELEVATION],
  'slab-opening': [],
  column:         [WIDTH, DEPTH, HEIGHT],
  beam:           [WIDTH, DEPTH, ELEVATION],
  stair:          [WIDTH],
};

/** Entity kinds που υποστηρίζονται από το multi-selection ribbon (BIM-only). */
export const SUPPORTED_BIM_KINDS: readonly EntityType[] = [
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair',
];

/**
 * Intersection των editable properties μεταξύ N kinds.
 * Revit common-properties pattern — εμφάνιση μόνο ό,τι υπάρχει σε ΟΛΑ τα kinds.
 *
 * Edge cases:
 *  - 0 kinds → []
 *  - 1 kind → properties του kind (full set)
 *  - mixed χωρίς κοινό key → [] (UI δείχνει empty-state + Filter panel)
 */
export function getCommonProperties(
  kinds: readonly EntityType[],
): readonly BimEditableProperty[] {
  if (kinds.length === 0) return [];

  const firstKindProps = COMMON_PROPERTIES_BY_KIND[kinds[0]];
  if (!firstKindProps || firstKindProps.length === 0) return [];

  if (kinds.length === 1) return firstKindProps;

  const otherKindKeySets = kinds.slice(1).map((kind) => {
    const props = COMMON_PROPERTIES_BY_KIND[kind] ?? [];
    return new Set(props.map((p) => p.key));
  });

  return firstKindProps.filter((prop) =>
    otherKindKeySets.every((set) => set.has(prop.key)),
  );
}

/** Per-kind counts για τα Filter panel buttons. */
export function countByKind(
  kinds: readonly EntityType[],
): ReadonlyMap<EntityType, number> {
  const counts = new Map<EntityType, number>();
  for (const kind of kinds) {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

/** True όταν όλα τα kinds είναι ίδια (homogeneous selection — hide Filter panel). */
export function isHomogeneous(kinds: readonly EntityType[]): boolean {
  if (kinds.length <= 1) return true;
  const first = kinds[0];
  return kinds.every((k) => k === first);
}
