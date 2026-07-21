/**
 * BIM entity colour identity for "Select Similar (same colour)".
 *
 * Raw DXF primitives (line/circle/polyline/…) resolve colour from the layer
 * cascade (`resolve-entity-style.ts`). BIM entities (wall / column / beam / slab /
 * foundation / stair / railing / opening / …) DON'T — their colour comes from the
 * structural colour-identity SSoT (ADR-445): the Object Styles category /
 * subcategory colour resolved by `resolveSubcategoryStyle`, honouring V/G category
 * overrides + per-element overrides. That is exactly the outline colour the 2D
 * renderers paint, so "same colour" groups BIM entities the way the eye reads them
 * (blue = columns, amber = beams, sienna = foundations, orange = doors, …).
 *
 * Returns `null` for non-BIM entities so the caller falls back to the DXF cascade.
 *
 * @see config/bim-line-weight-resolver.ts — resolveSubcategoryStyle (colour SSoT)
 * @see config/bim-object-styles.ts — BIM_CATEGORY_LINE_COLORS / DEFAULT_OBJECT_STYLES
 * @see bim/visibility/resolve-entity-bim-category.ts — entity → BimCategory SSoT
 * @see ADR-445 Per-category structural colour identity
 */

import type { Entity } from '../../types/entities';
import type {
  BimCategory,
  BimElementStyleOverride,
  ObjectStyle,
} from '../../config/bim-object-styles';
import { DEFAULT_OBJECT_STYLES } from '../../config/bim-object-styles';
import { resolveEntityBimCategory } from '../../bim/visibility/resolve-entity-bim-category';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { wallFootprintSubcategory } from '../../bim/walls/wall-render-palette';
import { isWallColumnKind } from '../../bim/columns/column-from-faces';
import { isWindowKind } from '../../bim/types/opening-types';

/**
 * Object Styles subcategory key whose colour differs from the parent category, so
 * "same colour" tells apart sub-types the eye sees as distinct hues. Only the
 * colour-distinct cases need a key — every other subcategory inherits the parent
 * colour, which is what the parent-level resolution already returns.
 *
 *   - wall    → interior/partition = grey vs exterior = slate (`wallFootprintSubcategory`)
 *   - column  → shear-wall = deep RC-blue vs column = steel-blue
 *   - opening → window = glass-blue vs door = wood-orange
 *
 * Mirrors the per-renderer derivation (WallRenderer / ColumnRenderer / OpeningRenderer)
 * by reusing the exact same SSoT helpers — no duplicated classification logic.
 */
function colorSubcategoryKey(entity: Entity, category: BimCategory): string | undefined {
  switch (category) {
    case 'wall':
      return entity.type === 'wall'
        ? wallFootprintSubcategory(entity.params.category)
        : undefined;
    case 'column':
      return entity.type === 'column' && isWallColumnKind(entity.kind)
        ? 'shear-wall'
        : undefined;
    case 'opening':
      return entity.type === 'opening'
        ? (isWindowKind(entity.kind) ? 'window-opening' : 'door-opening')
        : undefined;
    default:
      return undefined;
  }
}

/** Per-element graphic override (ADR-375 C.5) when present on a BIM entity. */
function readStyleOverride(entity: Entity): BimElementStyleOverride | undefined {
  return 'styleOverride' in entity ? entity.styleOverride : undefined;
}

/**
 * Resolve the effective (rendered) identity colour hex of a BIM entity, normalized
 * to lowercase. Returns `null` when the entity is not a BIM object (raw DXF), so
 * the caller knows to use the DXF layer cascade instead.
 *
 * @param objectStyles live per-view Object Styles overrides
 *        (`useBimRenderSettingsStore.getState().objectStyles`) — same source the
 *        2D renderers read, so the colour matches the canvas exactly. Omit to use
 *        the hard-coded defaults.
 */
export function resolveBimEntityColorHex(
  entity: Entity,
  objectStyles?: Partial<Record<BimCategory, ObjectStyle>>,
): string | null {
  const category = resolveEntityBimCategory(entity);
  if (category === null) return null; // not a BIM entity → caller uses DXF cascade
  // Belt-and-suspenders (N.7.2 #4): resolveEntityBimCategory casts entity.type to
  // BimCategory, so a future DIRECT_CATEGORY_TYPES drift could yield a type that has
  // no DEFAULT_OBJECT_STYLES entry. Without this guard that undefined parent crashes
  // resolveSubcategoryStyle (`parent.visible`) + the line 102 default lookup below.
  // Degrade to the DXF colour cascade instead of throwing.
  if (!(category in DEFAULT_OBJECT_STYLES)) return null;

  const { color } = resolveSubcategoryStyle({
    category,
    subcategoryKey: colorSubcategoryKey(entity, category),
    // Identity colour is the projection colour; for the structural categories the
    // cut colour is identical, and V/G edits set both. scaleDenominator only feeds
    // line width (unused here), so 100 is a safe constant.
    cutState: 'projection',
    scaleDenominator: 100,
    objectStyles,
    elementOverride: readStyleOverride(entity),
  });

  // resolveSubcategoryStyle returns null when no colour is assigned (canvas token).
  // Fall back to the category default so every BIM entity has a stable identity hex.
  const hex = color ?? DEFAULT_OBJECT_STYLES[category].projectionColor ?? null;
  return hex ? hex.toLowerCase() : null;
}
