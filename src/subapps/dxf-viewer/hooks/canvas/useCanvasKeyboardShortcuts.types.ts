/**
 * useCanvasKeyboardShortcuts parameter & helper types.
 * Extracted from `useCanvasKeyboardShortcuts.ts` for file-size compliance (<500
 * lines); behavior-preserving. Re-exported from the hook module for callers.
 *
 * @module hooks/canvas/useCanvasKeyboardShortcuts.types
 * @see ./useCanvasKeyboardShortcuts.ts
 */
import type { Dispatch, SetStateAction } from 'react';
import type { SelectedGrip } from '../grips/unified-grip-types';
import type { Point2D } from '../../rendering/types/Types';

export interface DxfGripInteractionLike {
  handleGripEscape: () => boolean;
}
export interface UseCanvasKeyboardShortcutsParams {
  /** Context-aware delete handler */
  handleSmartDelete: () => Promise<boolean>;
  /** DXF grip interaction for Escape handling */
  dxfGripInteraction: DxfGripInteractionLike;
  /** Setter for draft polygon state */
  setDraftPolygon: Dispatch<SetStateAction<Array<[number, number]>>>;
  /** Current draft polygon points */
  draftPolygon: Array<[number, number]>;
  /** Currently selected grip vertices */
  selectedGrips: SelectedGrip[];
  /** Clear grip selection */
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  /** Active tool name */
  activeTool: string;
  /** Finish handler for continuous drawing tools */
  handleDrawingFinish: () => void;
  /** Flip arc direction handler */
  handleFlipArc: () => void;
  /** Legacy finish drawing for overlay polygons */
  finishDrawing: () => Promise<void>;
  /** ADR-161: Join handler (J key). ADR-532 B4 — reads the selection at event time. */
  handleEntityJoin?: () => void;
  /** ADR-161: Check if join is possible. ADR-532 B4 — getter, evaluated at keydown
   *  against the live selection (no stale render snapshot). */
  canEntityJoin?: () => boolean;
  /** Callback to exit overlay draw mode on Escape (resets overlayMode to 'select') */
  onExitDrawMode?: () => void;
  /** ADR-188: Rotation tool cancel handler */
  handleRotationEscape?: () => void;
  /** ADR-188: Whether the rotation tool is active */
  rotationIsActive?: boolean;
  /** ADR-049: Move tool cancel handler */
  handleMoveEscape?: () => void;
  /** ADR-049: Whether the move tool is active and collecting input */
  moveIsActive?: boolean;
  /** Mirror tool cancel handler */
  handleMirrorEscape?: () => void;
  /** Whether the mirror tool is active and collecting axis points */
  mirrorIsActive?: boolean;
  /** Mirror tool Y/N confirm handler (keepOriginals: true = keep, false = discard) */
  handleMirrorConfirm?: (keepOriginals: boolean) => void;
  /** True when mirror tool is in awaiting-keep-originals phase */
  mirrorAwaitingConfirm?: boolean;
  /** ADR-348: Scale tool cancel handler */
  handleScaleEscape?: () => void;
  /** ADR-348: Scale tool key handler — returns true if key was consumed */
  handleScaleKeyDown?: (key: string) => boolean;
  /** ADR-348: Whether the scale tool is active and collecting input */
  scaleIsActive?: boolean;
  /** ADR-349: Stretch / MStretch tool cancel handler */
  handleStretchEscape?: () => void;
  /** ADR-349: Stretch / MStretch tool key handler — returns true if key was consumed */
  handleStretchKeyDown?: (key: string) => boolean;
  /** ADR-349: Whether the stretch / mstretch tool is active and collecting input */
  stretchIsActive?: boolean;
  /** ADR-350: Trim tool cancel handler */
  handleTrimEscape?: () => void;
  /** ADR-350: Trim tool key handler — returns true if key was consumed */
  handleTrimKeyDown?: (key: string, shiftKey: boolean) => boolean;
  /** ADR-350: Whether the trim tool is active and in pick/edges phase */
  trimIsActive?: boolean;
  /** ADR-510 Φ4d: Offset tool cancel handler (two-level: deselect source, then exit) */
  handleOffsetEscape?: () => void;
  /** ADR-510 Φ4d: Offset tool key handler (digits/backspace/E/U) — returns true if consumed */
  handleOffsetKeyDown?: (key: string) => boolean;
  /** ADR-510 Φ4d: Whether the offset tool is active */
  offsetIsActive?: boolean;
  /** ADR-510 Φ4e: Fillet tool cancel handler (two-level: deselect line 1, then exit) */
  handleFilletEscape?: () => void;
  /** ADR-510 Φ4e: Fillet tool key handler (digits/backspace/R/T/P/U) — returns true if consumed */
  handleFilletKeyDown?: (key: string) => boolean;
  /** ADR-510 Φ4e: Whether the fillet tool is active */
  filletIsActive?: boolean;
  /** ADR-510 Φ4f: Chamfer tool cancel handler (two-level: deselect line 1, then exit) */
  handleChamferEscape?: () => void;
  /** ADR-510 Φ4f: Chamfer tool key handler (digits/backspace/D/A/T/P/U) — returns true if consumed */
  handleChamferKeyDown?: (key: string) => boolean;
  /** ADR-510 Φ4f: Whether the chamfer tool is active */
  chamferIsActive?: boolean;
  /** ADR-353: Extend tool cancel handler */
  handleExtendEscape?: () => void;
  /** ADR-353: Extend tool key handler — returns true if key was consumed */
  handleExtendKeyDown?: (key: string, shiftKey: boolean) => boolean;
  /** ADR-353: Whether the extend tool is active and in pick/edges phase */
  extendIsActive?: boolean;
  /** ADR-353 Phase B: Polar Array centre-pick cancel handler */
  handleArrayPolarEscape?: () => void;
  /** ADR-353 Phase B: Whether the polar Array tool is awaiting centre pick */
  arrayPolarIsActive?: boolean;
  /** ADR-353 Phase C: Path Array path-entity-pick cancel handler */
  handleArrayPathEscape?: () => void;
  /** ADR-353 Phase C: Whether the path Array tool is awaiting path-entity pick */
  arrayPathIsActive?: boolean;
  /** ADR-397 Σ2: rotate-free hot-grip key handler — returns true if the key was consumed (e.g. «R»). */
  handleHotGripKeyDown?: (key: string) => boolean;
  /** ADR-397 Σ2: Whether a hot-grip flow is live (gates the rotate-free key handler). */
  hotGripKeyIsActive?: boolean;
  /** ADR-397/513: 2-click ROTATE tool inline typed-angle handler (awaiting-angle) — true if consumed. */
  handleRotationKeyDown?: (key: string) => boolean;
  /** ADR-397/513: Whether the 2-click ROTATE tool is in `awaiting-angle` (gates the typed-angle handler). */
  rotateToolAwaitingAngle?: boolean;
  /** ADR-363 Phase 5.6: Wall Split ESC handler */
  handleWallSplitEscape?: () => void;
  /** ADR-363 Phase 5.6: Whether the wall-split tool is active */
  wallSplitIsActive?: boolean;
  /** ADR-401 Phase E.1: Wall Attach Top/Base ESC handler */
  handleWallAttachEscape?: () => void;
  /** ADR-401 Phase E.1: Whether the wall-attach pick-host tool is active */
  wallAttachIsActive?: boolean;
  /** ADR-566: Wall Merge ESC handler */
  handleWallMergeEscape?: () => void;
  /** ADR-566: Whether the wall-merge tool is active */
  wallMergeIsActive?: boolean;
  /** ADR-568: Wall gap-bridge + opening ESC handler */
  handleWallGapOpeningEscape?: () => void;
  /** ADR-568: Whether the wall-gap-opening tool is active */
  wallGapOpeningIsActive?: boolean;
  /** ADR-363 R1 / ADR-577: unified Copy ESC handler */
  handleCopyEscape?: () => void;
  /** ADR-363 R1 / ADR-577: Whether the copy tool is active */
  copyIsActive?: boolean;
  /** SSoT deselect-all callback — clears local entity state + UniversalSelection */
  clearEntitySelection?: () => void;
  /** True when any non-DXF entity is selected (e.g. overlays) — widens the Escape guard */
  hasAnySelection?: boolean;
  /**
   * Event-time getter — true when a MEP circuit is wire-selected (`activeSystemId`,
   * no scene entity). Widens the Escape deselect guard so ESC clears a circuit-only
   * selection. Getter (not snapshot) → no orchestrator subscription (ADR-040).
   */
  hasActiveCircuit?: () => boolean;
  /** PageUp/PageDown: bring selected entity to front / send to back */
  handleReorderEntity?: (direction: 'front' | 'back') => void;
  /**
   * ADR-357 Phase 3: Direct Distance Entry.
   * Temp points of the active drawing (line). Length >= 1 = COLLECTING_POINTS.
   * DDE activates when tool='line', tempPoints.length >= 1, no input focused.
   */
  drawingTempPoints?: Point2D[];
  /** ADR-357 Phase 3: DDE callback — called with the computed world point. */
  onDirectDistanceEntry?: (pt: { x: number; y: number }) => void;
  /** ADR-357 Phase 5: Undo last chain vertex (U / Ctrl+Z during line chain mode). */
  onUndoChainVertex?: () => void;
  /** ADR-357 Phase 5: Finish chain (Enter during chain, no DDE pending) — exits chain, tool deselects. */
  onChainFinish?: () => void;
  /** ADR-357 Phase 7: Shift+Right-click snap override — open snap override menu at (x, y). */
  onSnapOverrideMenuRequest?: (x: number, y: number) => void;
  /** ADR-357 Phase 7: Number of drawing temp points — needed to gate Shift+Right-click. */
  drawingTempPointCount?: number;
}
