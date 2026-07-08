/**
 * ADR-415 — floorplan-symbol parametric 2D grips.
 *
 * A floorplan symbol is a centre-anchored rotatable rectangle — the SAME engine
 * furniture / MEP fixture / electrical panel use — so it is a centred-box consumer,
 * delegated to the shared box grip SSoT via the `createCentredBoxGripAdapter`
 * factory (ADR-602). Its param field names DIFFER from the box SSoT's
 * (`rotationDeg`/`widthMm`/`depthMm` vs `rotation`/`width`/`length`), so it supplies
 * a `toBoxParams` / `fromBoxPatch` bridge; everything else (kind maps, emit, drag
 * delegation) is the factory's. 1:1 sibling of `furniture-grips.ts`.
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { GripInfo, FloorplanSymbolGripKind } from '../../hooks/grip-types';
import type { FloorplanSymbolEntity, FloorplanSymbolParams } from '../types/floorplan-symbol-types';
import { MIN_FLOORPLAN_SYMBOL_DIMENSION_MM } from '../types/floorplan-symbol-types';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  mmSuffixedBoxBridge,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';

const adapter = createCentredBoxGripAdapter<
  FloorplanSymbolEntity,
  FloorplanSymbolParams,
  FloorplanSymbolGripKind
>({
  ...buildCentredBoxKindMaps('floorplan-symbol'),
  minDimensionMm: MIN_FLOORPLAN_SYMBOL_DIMENSION_MM,
  // Field names differ (`rotationDeg`/`widthMm`/`depthMm`) → shared mm-suffixed bridge.
  ...mmSuffixedBoxBridge<FloorplanSymbolParams>(),
  toGripInfo: (base, kind) => ({ ...base, floorplanSymbolGripKind: kind, gripKind: { on: 'floorplan-symbol', kind } }),
});

/** Drag input for a floorplan-symbol grip (the shared centred-box 5-field shape). */
export type FloorplanSymbolGripDragInput = CentredBoxAdapterDragInput<FloorplanSymbolParams>;

/**
 * Compute parametric grip positions for a `FloorplanSymbolEntity` (rotation + 4
 * corners, stable order). Delegates to the shared box SSoT (field names bridged).
 */
export const getFloorplanSymbolGrips: (entity: Readonly<FloorplanSymbolEntity>) => GripInfo[] =
  adapter.getGrips;

/**
 * Pure transform: floorplan-symbol grip kind + drag input → new params. Zero delta
 * / unknown kind → returns `originalParams` referentially unchanged (commit
 * short-circuit).
 */
export const applyFloorplanSymbolGripDrag: (
  kind: FloorplanSymbolGripKind,
  input: Readonly<FloorplanSymbolGripDragInput>,
) => FloorplanSymbolParams = adapter.applyGripDrag;
