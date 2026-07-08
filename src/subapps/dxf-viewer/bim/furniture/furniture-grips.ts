/**
 * ADR-410 — furniture parametric 2D grips.
 *
 * Furniture is **rectangular-only** (no circular/diameter affordance), so it is a
 * centred-box consumer, delegated to the shared box grip SSoT via the
 * `createCentredBoxGripAdapter` factory (ADR-602). Unlike the MEP boxes, its param
 * field names DIFFER from the box SSoT's (`rotationDeg`/`widthMm`/`depthMm` vs
 * `rotation`/`width`/`length`), so it supplies a `toBoxParams` / `fromBoxPatch`
 * bridge; everything else (kind maps, emit, drag delegation) is the factory's.
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type { GripInfo, FurnitureGripKind } from '../../hooks/grip-types';
import type { FurnitureEntity, FurnitureParams } from '../types/furniture-types';
import { MIN_FURNITURE_DIMENSION_MM } from '../types/furniture-types';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  mmSuffixedBoxBridge,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';

const adapter = createCentredBoxGripAdapter<FurnitureEntity, FurnitureParams, FurnitureGripKind>({
  ...buildCentredBoxKindMaps('furniture'),
  minDimensionMm: MIN_FURNITURE_DIMENSION_MM,
  // Field names differ (`rotationDeg`/`widthMm`/`depthMm`) → shared mm-suffixed bridge.
  ...mmSuffixedBoxBridge<FurnitureParams>(),
  toGripInfo: (base, kind) => ({ ...base, furnitureGripKind: kind, gripKind: { on: 'furniture', kind } }),
});

/** Drag input for a furniture grip (the shared centred-box 5-field shape). */
export type FurnitureGripDragInput = CentredBoxAdapterDragInput<FurnitureParams>;

/**
 * Compute parametric grip positions for a `FurnitureEntity` (rotation + 4 corners,
 * stable order). Delegates to the shared box SSoT (field names bridged).
 */
export const getFurnitureGrips: (entity: Readonly<FurnitureEntity>) => GripInfo[] =
  adapter.getGrips;

/**
 * Pure transform: furniture grip kind + drag input → new `FurnitureParams`. Zero
 * delta / unknown kind → returns `originalParams` referentially unchanged (commit
 * short-circuit).
 */
export const applyFurnitureGripDrag: (
  kind: FurnitureGripKind,
  input: Readonly<FurnitureGripDragInput>,
) => FurnitureParams = adapter.applyGripDrag;
