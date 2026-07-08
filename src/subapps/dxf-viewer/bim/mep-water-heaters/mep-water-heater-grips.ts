/**
 * ADR-408 DHW — Domestic hot water heater parametric 2D grips (wall-parity).
 *
 * A water heater is **always rectangular** (no circular / diameter handle), so it
 * is a PURE centred-box consumer: it delegates 100% to the shared box grip SSoT via
 * the `createCentredBoxGripAdapter` factory (ADR-602). Its params already carry the
 * box fields (`position` / `rotation` / `width` / `length`), so `toBoxParams` is
 * identity and `fromBoxPatch` is a plain spread. The only entity-specific input is
 * the `mep-water-heater` grip-kind prefix + the `mepWaterHeaterGripKind`
 * discriminant field (now a first-class field on the shared `GripInfo`).
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { GripInfo, MepWaterHeaterGripKind } from '../../hooks/grip-types';
import type { MepWaterHeaterEntity, MepWaterHeaterParams } from '../types/mep-water-heater-types';
import { MIN_WATER_HEATER_DIMENSION_MM } from '../types/mep-water-heater-types';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';

const adapter = createCentredBoxGripAdapter<
  MepWaterHeaterEntity,
  MepWaterHeaterParams,
  MepWaterHeaterGripKind
>({
  ...buildCentredBoxKindMaps('mep-water-heater'),
  minDimensionMm: MIN_WATER_HEATER_DIMENSION_MM,
  toBoxParams: (params) => params,
  fromBoxPatch: (original, patch) => ({ ...original, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, mepWaterHeaterGripKind: kind }),
});

/** Drag input for a water-heater grip (the shared centred-box 5-field shape). */
export type MepWaterHeaterGripDragInput = CentredBoxAdapterDragInput<MepWaterHeaterParams>;

/**
 * Compute parametric grip positions for a `MepWaterHeaterEntity` (rotation + 4
 * corners, stable order). Delegates to the shared box SSoT.
 */
export const getMepWaterHeaterGrips: (entity: Readonly<MepWaterHeaterEntity>) => GripInfo[] =
  adapter.getGrips;

/**
 * Pure transform: water heater grip kind + drag input → new `MepWaterHeaterParams`.
 * Zero delta / unknown kind → returns `originalParams` referentially unchanged
 * (commit short-circuit).
 */
export const applyMepWaterHeaterGripDrag: (
  kind: MepWaterHeaterGripKind,
  input: Readonly<MepWaterHeaterGripDragInput>,
) => MepWaterHeaterParams = adapter.applyGripDrag;
