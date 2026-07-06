/**
 * ADR-183 / ADR-363 / ADR-397 Phase 1G — Grip mouse-down helper functions.
 *
 * Extracted verbatim from `grip-mouse-handlers.ts` to keep that file under the
 * Google 500-line limit (SOS N.7.1). These are the two self-contained helpers the
 * `runGripMouseDown` flow delegates to; behaviour is identical to the previous
 * in-file definitions.
 *
 * @see grip-mouse-handlers.ts — owner of `runGripMouseDown` / `runGripMouseUp`
 * @see wall-hot-grip-fsm.ts — hot-grip decision SSoT
 */
import type { Point2D } from '../../rendering/types/Types';
import { unlockGripSnapPosition } from '../../systems/cursor/GripSnapStore';
import { commitDxfGripDragModeAware, type DxfCommitDeps } from './grip-commit-adapters';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { directionForZone } from '../../bim/grips/move-glyph-zones';
import { getPromptDialogStore } from '../../systems/prompt-dialog';
import { GripModeStore } from '../../systems/grip/GripModeStore';
import type { WallHotGripOp, HotGripStep } from './wall-hot-grip-fsm';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { GripMouseDownCtx } from './grip-mouse-handlers.types';
import i18next from 'i18next';

// ============================================================================
// ADR-397 Φ2 — DIRECTIONAL MOVE-BY-VALUE
// ============================================================================
/**
 * Open the distance prompt (the shared rotation-angle `PromptDialog` SSoT) and, on
 * confirm, translate the entity by `distance × the clicked arm's world axis`. The
 * typed value is millimetres → canvas units via the grip's `moveGlyphMmScale`. The
 * move is committed through the SAME `commitDxfGripDragModeAware` the drag flow uses
 * — no new command. Cancel (`null`) / non-positive input → no-op.
 */
export async function runDirectionalMove(
  grip: UnifiedGripInfo,
  zone: 'x+' | 'x-' | 'y+' | 'y-',
  deps: DxfCommitDeps,
): Promise<void> {
  const frame = grip.moveGlyphFrame;
  if (!frame) return;
  const dir = directionForZone(zone, frame);
  if (!dir) return;
  const raw = await getPromptDialogStore().prompt({
    title: i18next.t('dxf-viewer-wizard:promptDialog.moveDistance'),
    label: i18next.t('dxf-viewer-wizard:promptDialog.moveDistanceLabel'),
    placeholder: i18next.t('dxf-viewer-wizard:promptDialog.distancePlaceholder'),
    inputType: 'number',
    unit: 'mm',
    validate: (v) => {
      const n = parseFloat(v);
      // Negatives allowed (AutoCAD direct-distance parity): the clicked arm is the
      // positive direction, a negative value moves the opposite way. Reject only
      // non-numeric / zero (no-op).
      return !Number.isFinite(n) || n === 0
        ? i18next.t('dxf-viewer-wizard:promptDialog.invalidNumber')
        : null;
    },
  });
  if (raw === null) return;
  const mm = parseFloat(raw);
  if (!Number.isFinite(mm) || mm === 0) return;
  // Signed: positive → along the clicked arm; negative → opposite direction.
  const canvas = mm * (grip.moveGlyphMmScale ?? 1);
  const delta: Point2D = { x: dir.x * canvas, y: dir.y * canvas };
  commitDxfGripDragModeAware(grip, delta, deps, GripModeStore.getSnapshot());
}

// ============================================================================
// ADR-363/397/513 — HOT-GRIP SESSION ENTRY (SSoT)
// ============================================================================
/**
 * Enter the AutoCAD "hot grip" (click-move-click) session for `grip`: flip the phase,
 * reset ALL hot-grip refs to a clean slate, and clear the warm-hover timer. ONE source
 * for the entry boilerplate shared by every hot-grip trigger — the registry-driven
 * wall/column/line enter, the Ctrl-endpoint rotate-copy, and the ADR-513 line-endpoint
 * click-move-click — so a new trigger can never drift or forget a field (e.g. the
 * `BimRotateHotGripStore.clear()` that a hand-rolled copy silently omitted).
 *
 * The per-trigger tail (step seeding for rotate, `applyHotGripHint`, `setActiveDragGrip`
 * with the trigger's grip-kind fields, `markSessionStart`) stays at the call site — only
 * the identical reset boilerplate is centralized here.
 */
export function beginHotGripSession(
  grip: UnifiedGripInfo,
  ctx: GripMouseDownCtx,
  cfg: {
    op: WallHotGripOp;
    awaitingFirstRelease: boolean;
    /** Rotation centre / base point stored in `hotGripBaseRef` (pivot for Ctrl-rotate, else null). */
    base: Point2D | null;
    /** Terminal anchor + live preview seed (grip position for corner/endpoint, null for move/rotate await-base). */
    anchor: Point2D | null;
    /** Initial hot-grip step; omit when a later seeder sets it (e.g. rotate-free via `seedRotateFreeStep`). */
    step?: HotGripStep;
  },
): void {
  const {
    setActiveGrip, setPhase, setCurrentWorldPos, anchorRef, warmTimerRef,
    hotGripOpRef, hotGripStepRef, hotGripAwaitingFirstReleaseRef, hotGripMovedRef,
    hotGripBaseRef, hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef, hotGripRotateBaseRef,
  } = ctx;
  setActiveGrip(grip);
  setPhase('hotGrip');
  unlockGripSnapPosition();
  hotGripOpRef.current = cfg.op;
  hotGripAwaitingFirstReleaseRef.current = cfg.awaitingFirstRelease;
  hotGripMovedRef.current = false;
  hotGripBaseRef.current = cfg.base;
  hotGripRefStartRef.current = null;
  hotGripRefEndRef.current = null;
  hotGripAlignStartRef.current = null;
  hotGripRotateBaseRef.current = null;
  BimRotateHotGripStore.clear();
  if (cfg.step !== undefined) hotGripStepRef.current = cfg.step;
  anchorRef.current = cfg.anchor;
  setCurrentWorldPos(cfg.anchor);
  if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
}
