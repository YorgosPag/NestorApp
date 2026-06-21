/**
 * bim3d-vertical-move.ts — back-compat re-export shim (ADR-049 Phase 2).
 *
 * The pure elevation-move computers were RE-HOMED to `bim/utils/bim-vertical-move.ts`
 * so the unified `MoveEntityCommand` z-branch (`calculateBimMovedGeometry`) can reach
 * them without coupling the command/geometry path to the `bim-3d` viewport tree. This
 * module re-exports them verbatim so the remaining 3D-gizmo callers
 * (`bim3d-pipe-follow-preview-rebuild`, tests) stay unchanged.
 *
 * @see ../../bim/utils/bim-vertical-move.ts — the SSoT (rationale + per-type fields)
 */

export {
  computeWallVerticalMove,
  computeColumnVerticalMove,
  computeBeamVerticalMove,
  computeSlabVerticalMove,
  computeStairVerticalMove,
  computeMepHostVerticalMove,
  computeMepSegmentVerticalMove,
} from '../../bim/utils/bim-vertical-move';
