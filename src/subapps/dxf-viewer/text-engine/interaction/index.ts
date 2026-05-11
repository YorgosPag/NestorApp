/**
 * ADR-344 Phase 6 — Text interaction barrel.
 *
 * Snap (6.B) + grip (6.C) primitives for DXF TEXT/MTEXT entities.
 */

export {
  getTextSnapPoints,
  toSnapCandidates,
  type TextSnapKind,
  type TextSnapPoint,
} from './TextSnapProvider';

export {
  computeGrips,
  hitTestGrips,
  type TextGrip,
  type TextGripKind,
  type ComputeGripsOptions,
} from './TextGripGeometry';

export {
  DirectDistanceEntry,
  type DDEStatus,
  type DDESnapshot,
} from './DirectDistanceEntry';

export {
  TextGripHandler,
  type GripDragStatus,
  type GripGhost,
  type BeginDragInput,
  type UpdateDragInput,
  type TextGripHandlerDependencies,
} from './TextGripHandler';
