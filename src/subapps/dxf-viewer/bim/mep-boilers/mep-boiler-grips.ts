/**
 * ADR-408 Εύρος Β #2 — Heating boiler parametric 2D grips (wall-parity).
 *
 * A boiler is **always rectangular** (no circular / diameter handle), so it is a
 * PURE centred-box consumer: it delegates 100% to the shared box grip SSoT via the
 * `createCentredBoxGripAdapter` factory (ADR-602). Its params already carry the
 * box fields (`position` / `rotation` / `width` / `length`), so `toBoxParams` is
 * identity and `fromBoxPatch` is a plain spread. The only entity-specific input is
 * the `mep-boiler` grip-kind prefix + the `mepBoilerGripKind` discriminant field.
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { GripInfo, MepBoilerGripKind } from '../../hooks/grip-types';
import type { MepBoilerEntity, MepBoilerParams } from '../types/mep-boiler-types';
import { MIN_BOILER_DIMENSION_MM } from '../types/mep-boiler-types';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';

const adapter = createCentredBoxGripAdapter<MepBoilerEntity, MepBoilerParams, MepBoilerGripKind>({
  ...buildCentredBoxKindMaps('mep-boiler'),
  minDimensionMm: MIN_BOILER_DIMENSION_MM,
  toBoxParams: (params) => params,
  fromBoxPatch: (original, patch) => ({ ...original, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'mep-boiler', kind } }),
});

/** Drag input for a boiler grip (the shared centred-box 5-field shape). */
export type MepBoilerGripDragInput = CentredBoxAdapterDragInput<MepBoilerParams>;

/**
 * Compute parametric grip positions for a `MepBoilerEntity` (rotation + 4 corners,
 * stable order). Delegates to the shared box SSoT.
 */
export const getMepBoilerGrips: (entity: Readonly<MepBoilerEntity>) => GripInfo[] =
  adapter.getGrips;

/**
 * Pure transform: boiler grip kind + drag input → new `MepBoilerParams`. Zero delta
 * / unknown kind → returns `originalParams` referentially unchanged (commit
 * short-circuit).
 */
export const applyMepBoilerGripDrag: (
  kind: MepBoilerGripKind,
  input: Readonly<MepBoilerGripDragInput>,
) => MepBoilerParams = adapter.applyGripDrag;
