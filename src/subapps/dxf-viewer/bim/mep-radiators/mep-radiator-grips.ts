/**
 * ADR-408 Εύρος Β #1 — Heating radiator parametric 2D grips (wall-parity).
 *
 * A radiator is **always rectangular** (no circular / diameter handle), so it is a
 * PURE centred-box consumer: it delegates 100% to the shared box grip SSoT via the
 * `createCentredBoxGripAdapter` factory (ADR-602). Its params already carry the box
 * fields (`position` / `rotation` / `width` / `length`), so `toBoxParams` is
 * identity and `fromBoxPatch` is a plain spread. The only entity-specific input is
 * the `mep-radiator` grip-kind prefix + the `mepRadiatorGripKind` discriminant field.
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { GripInfo, MepRadiatorGripKind } from '../../hooks/grip-types';
import type { MepRadiatorEntity, MepRadiatorParams } from '../types/mep-radiator-types';
import { MIN_RADIATOR_DIMENSION_MM } from '../types/mep-radiator-types';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';

const adapter = createCentredBoxGripAdapter<MepRadiatorEntity, MepRadiatorParams, MepRadiatorGripKind>({
  ...buildCentredBoxKindMaps('mep-radiator'),
  minDimensionMm: MIN_RADIATOR_DIMENSION_MM,
  toBoxParams: (params) => params,
  fromBoxPatch: (original, patch) => ({ ...original, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'mep-radiator', kind } }),
});

/** Drag input for a radiator grip (the shared centred-box 5-field shape). */
export type MepRadiatorGripDragInput = CentredBoxAdapterDragInput<MepRadiatorParams>;

/**
 * Compute parametric grip positions for a `MepRadiatorEntity` (rotation + 4 corners,
 * stable order). Delegates to the shared box SSoT.
 */
export const getMepRadiatorGrips: (entity: Readonly<MepRadiatorEntity>) => GripInfo[] =
  adapter.getGrips;

/**
 * Pure transform: radiator grip kind + drag input → new `MepRadiatorParams`. Zero
 * delta / unknown kind → returns `originalParams` referentially unchanged (commit
 * short-circuit).
 */
export const applyMepRadiatorGripDrag: (
  kind: MepRadiatorGripKind,
  input: Readonly<MepRadiatorGripDragInput>,
) => MepRadiatorParams = adapter.applyGripDrag;
