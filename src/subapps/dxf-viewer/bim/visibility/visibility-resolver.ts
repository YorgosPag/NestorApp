/**
 * ADR-382 — Visibility Resolver SSoT (BIM 2D + 3D).
 *
 * Single source of truth για visibility decisions σε BIM entities. Consults
 * τις 4 runtime sources με intersection semantics (ANY-hides-wins, Revit-style):
 *
 *   1. V/G category visibility (`objectStyles[cat].visible`)
 *   2. Layer visibility + frozen (`layer.visible === false || layer.frozen === true`)
 *   3. Floor visibility mode (`'hide'` only — `'show'` / `'ghost'` count as visible)
 *   4. Building visibility mode (`'hide'` only — `'show'` / `'ghost'` count as visible)
 *
 * Pure function, no React, no subscriptions. Event-time call από κάθε render
 * path πριν δημιουργηθεί mesh ή πραγματοποιηθεί canvas draw. ADR-040 compliant.
 *
 * Q1 (Layer hidden = absolute hide) · Q2 (AND-of-shows intersection) · Q3 (2D/3D
 * parity — single state) · Q4 (hide stronger than ghost — ghost is stylistic).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-382-visibility-resolver-ssot.md
 */

import type { SceneLayer } from '../../types/scene-types';
import type { BimCategory, ObjectStyle } from '../../config/bim-object-styles';
import type { FloorVisMode } from '../../bim-3d/utils/floor-visibility-state';
import type { BuildingVisMode } from '../../bim-3d/utils/building-visibility-state';

export interface VisibilityContext {
  /** V/G per-view overrides (από `bim-render-settings-store.objectStyles`). */
  readonly objectStyles?: Partial<Record<BimCategory, ObjectStyle>>;
  /** Layer lookup (από `LayerStore.getLayer(id)`). null/undefined ⇒ no layer constraint. */
  readonly layer?: SceneLayer | null;
  /** Floor visibility mode (3D-only). undefined / 'show' / 'ghost' ⇒ visible. */
  readonly floorMode?: FloorVisMode;
  /** Building visibility mode (3D-only). undefined / 'show' / 'ghost' ⇒ visible. */
  readonly buildingMode?: BuildingVisMode;
}

export interface EntityVisibilityInput {
  readonly category: BimCategory;
  readonly layerId?: string;
}

/**
 * AND-of-shows intersection. Returns true ΜΟΝΟ όταν όλες οι 4 sources συμφωνούν
 * "δείξε". Αν ΟΠΟΙΑΔΗΠΟΤΕ πει "κρύψε" → false.
 *
 * Ghost mode counts as visible (Q4 — stylistic-only). Undefined ctx fields
 * default σε no-constraint (visible).
 */
export function resolveIsEntityVisible(
  entity: EntityVisibilityInput,
  ctx: VisibilityContext,
): boolean {
  if (ctx.objectStyles && ctx.objectStyles[entity.category]?.visible === false) {
    return false;
  }
  if (ctx.layer && (ctx.layer.visible === false || ctx.layer.frozen === true)) {
    return false;
  }
  if (ctx.floorMode === 'hide') return false;
  if (ctx.buildingMode === 'hide') return false;
  return true;
}
