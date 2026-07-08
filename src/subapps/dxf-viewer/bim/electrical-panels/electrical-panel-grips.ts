/**
 * ADR-408 Φ3 — Electrical panel parametric 2D grips (wall-parity).
 *
 * A panel is **always rectangular** (no circular / diameter handle), so it is a
 * PURE centred-box consumer: it delegates 100% to the shared box grip SSoT via the
 * `createCentredBoxGripAdapter` factory (ADR-602). Its params already carry the box
 * fields (`position` / `rotation` / `width` / `length`), so `toBoxParams` is
 * identity and `fromBoxPatch` is a plain spread. The only entity-specific input is
 * the `electrical-panel` grip-kind prefix + the `electricalPanelGripKind`
 * discriminant field.
 *
 * Exposes (rotation + 4 corners, stable order):
 *   1 → `electrical-panel-rotation` (handle beyond +Y edge, ROTATION glyph)
 *   2-5 → `electrical-panel-corner-{ne,nw,sw,se}` (opposite-corner-anchored resize,
 *         ORTHO-aware). Clamped to `MIN_PANEL_DIMENSION_MM`.
 * `UpdateElectricalPanelParamsCommand` recomputes geometry at commit time; this
 * module returns ONLY new params.
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { GripInfo, ElectricalPanelGripKind } from '../../hooks/grip-types';
import type { ElectricalPanelEntity, ElectricalPanelParams } from '../types/electrical-panel-types';
import { MIN_PANEL_DIMENSION_MM } from '../types/electrical-panel-types';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';

const adapter = createCentredBoxGripAdapter<
  ElectricalPanelEntity,
  ElectricalPanelParams,
  ElectricalPanelGripKind
>({
  ...buildCentredBoxKindMaps('electrical-panel'),
  minDimensionMm: MIN_PANEL_DIMENSION_MM,
  toBoxParams: (params) => params,
  fromBoxPatch: (original, patch) => ({ ...original, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'electrical-panel', kind } }),
});

/** Drag input for an electrical panel grip (the shared centred-box 5-field shape). */
export type ElectricalPanelGripDragInput = CentredBoxAdapterDragInput<ElectricalPanelParams>;

/**
 * Compute parametric grip positions for an `ElectricalPanelEntity` (rotation + 4
 * corners, stable order). Delegates to the shared box SSoT.
 */
export const getElectricalPanelGrips: (entity: Readonly<ElectricalPanelEntity>) => GripInfo[] =
  adapter.getGrips;

/**
 * Pure transform: electrical panel grip kind + drag input → new
 * `ElectricalPanelParams`. Zero delta / unknown kind → returns `originalParams`
 * referentially unchanged (commit short-circuit).
 */
export const applyElectricalPanelGripDrag: (
  kind: ElectricalPanelGripKind,
  input: Readonly<ElectricalPanelGripDragInput>,
) => ElectricalPanelParams = adapter.applyGripDrag;
