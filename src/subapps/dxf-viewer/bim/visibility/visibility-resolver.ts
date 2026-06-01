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
import type { Discipline } from '../discipline/bim-discipline';
import { DISCIPLINE_BY_CATEGORY } from '../discipline/bim-discipline';

export interface VisibilityContext {
  /** V/G per-view overrides (από `bim-render-settings-store.objectStyles`). */
  readonly objectStyles?: Partial<Record<BimCategory, ObjectStyle>>;
  /** Layer lookup (από `LayerStore.getLayer(id)`). null/undefined ⇒ no layer constraint. */
  readonly layer?: SceneLayer | null;
  /** Floor visibility mode (3D-only). undefined / 'show' / 'ghost' ⇒ visible. */
  readonly floorMode?: FloorVisMode;
  /** Building visibility mode (3D-only). undefined / 'show' / 'ghost' ⇒ visible. */
  readonly buildingMode?: BuildingVisMode;
  /**
   * ADR-405 §4 — per-discipline visibility (Revit "View Discipline" filter).
   * `false` for a discipline hides every entity of that discipline. Absent keys
   * ⇒ visible. Annotation categories are never filtered here. From
   * `bim-render-settings-store.disciplineVisibility`.
   */
  readonly disciplineVisibility?: Partial<Record<Discipline, boolean>>;
}

export interface EntityVisibilityInput {
  readonly category: BimCategory;
  readonly layerId?: string;
  /**
   * ADR-405 — per-instance discipline override. Absent ⇒ discipline is derived
   * from `category` via `DISCIPLINE_BY_CATEGORY` (type-driven default).
   */
  readonly discipline?: Discipline;
}

/**
 * AND-of-shows intersection. Returns true ΜΟΝΟ όταν όλες οι 5 sources συμφωνούν
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
  // ADR-405 §4 — discipline filter. Derive effective discipline (explicit
  // per-instance override > type-derived). Annotation categories are exempt.
  if (ctx.disciplineVisibility) {
    const discipline = entity.discipline ?? DISCIPLINE_BY_CATEGORY[entity.category];
    if (discipline !== 'annotation' && ctx.disciplineVisibility[discipline] === false) {
      return false;
    }
  }
  return true;
}
