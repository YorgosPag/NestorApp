'use client';

/**
 * ADR-366 Phase 9 / C.3 — BimDimensions3DStore (Zustand SSoT).
 *
 * Source of truth for 3D dimensions runtime state:
 *  - dimensionsByProjectId: cached Firestore documents per active project
 *  - selectedDimId        : right-side properties panel target
 *  - toolActive / toolMode: ribbon tool toggle + 4-mode discriminator
 *  - fsmState             : current FSM state (mirrors Dim3DToolStateMachine)
 *  - snapPreview          : live snap glyph world position + mode
 *
 * Subscribes are handled by leaf renderers (ADR-040 micro-leaf pattern) — the
 * store itself stays UI-free and synchronous.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  DEFAULT_DIM3D_SNAP_TOGGLES,
  type Dim3DSnapMode,
  type Dim3DSnapToggleState,
} from '../dimensions/dim3d-snap-engine-adapter';
import {
  activateTool,
  buildAnchorFromContext,
  cancelTool,
  continueTool,
  cycleMode,
  placeFirstPoint,
  placeSecondPoint,
  placeTextAnchor,
  type Dim3DFsmContext,
  type Dim3DFsmState,
} from '../dimensions/Dim3DToolStateMachine';
import type {
  BimDimension3D,
  Dim3DAnchor,
  Dim3DMode,
  Vec3,
} from '../dimensions/dim3d-types';

interface SnapPreview {
  readonly mode: Dim3DSnapMode;
  readonly position: Vec3;
}

interface BimDimensions3DState {
  dimensionsByProjectId: Record<string, readonly BimDimension3D[]>;
  selectedDimId: string | null;
  toolActive: boolean;
  toolMode: Dim3DMode;
  snapToggles: Dim3DSnapToggleState;
  fsmState: Dim3DFsmState;
  fsmContext: Dim3DFsmContext;
  snapPreview: SnapPreview | null;
}

interface BimDimensions3DActions {
  setDimensionsForProject(projectId: string, dimensions: readonly BimDimension3D[]): void;
  upsertDimension(projectId: string, dim: BimDimension3D): void;
  removeDimension(projectId: string, dimensionId: string): void;
  selectDimension(dimensionId: string | null): void;

  activateTool(mode?: Dim3DMode): void;
  deactivateTool(): void;
  setToolMode(mode: Dim3DMode): void;
  cycleToolMode(): void;

  setSnapToggle(key: keyof Dim3DSnapToggleState, value: boolean): void;
  setSnapPreview(preview: SnapPreview | null): void;

  fsmPlaceFirstPoint(point: Vec3): void;
  fsmPlaceSecondPoint(point: Vec3): void;
  fsmPlaceTextAnchor(): { anchor: Dim3DAnchor; mode: Dim3DMode } | null;
  fsmContinue(): void;
  fsmCancel(): void;
}

type BimDimensions3DStoreType = BimDimensions3DState & BimDimensions3DActions;

const INITIAL_CONTEXT: Dim3DFsmContext = { mode: 'aligned' };

export const useBimDimensions3DStore = create<BimDimensions3DStoreType>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // ── State ─────────────────────────────────────────────────────────────
        dimensionsByProjectId: {},
        selectedDimId: null,
        toolActive: false,
        toolMode: 'aligned',
        snapToggles: { ...DEFAULT_DIM3D_SNAP_TOGGLES },
        fsmState: 'idle',
        fsmContext: INITIAL_CONTEXT,
        snapPreview: null,

        // ── Cache mutations ───────────────────────────────────────────────────
        setDimensionsForProject(projectId, dimensions) {
          set((draft) => {
            draft.dimensionsByProjectId[projectId] = dimensions;
          });
        },

        upsertDimension(projectId, dim) {
          set((draft) => {
            const current = draft.dimensionsByProjectId[projectId] ?? [];
            const idx = current.findIndex((d) => d.id === dim.id);
            if (idx === -1) {
              draft.dimensionsByProjectId[projectId] = [...current, dim];
            } else {
              const next = [...current];
              next[idx] = dim;
              draft.dimensionsByProjectId[projectId] = next;
            }
          });
        },

        removeDimension(projectId, dimensionId) {
          set((draft) => {
            const current = draft.dimensionsByProjectId[projectId] ?? [];
            draft.dimensionsByProjectId[projectId] = current.filter(
              (d) => d.id !== dimensionId,
            );
            if (draft.selectedDimId === dimensionId) {
              draft.selectedDimId = null;
            }
          });
        },

        selectDimension(dimensionId) {
          set((draft) => {
            draft.selectedDimId = dimensionId;
          });
        },

        // ── Tool activation ──────────────────────────────────────────────────
        activateTool(mode) {
          const next = activateTool(mode ?? get().toolMode);
          set((draft) => {
            draft.toolActive = true;
            draft.toolMode = next.context.mode;
            draft.fsmState = next.state;
            draft.fsmContext = next.context;
          });
        },

        deactivateTool() {
          set((draft) => {
            draft.toolActive = false;
            draft.fsmState = 'idle';
            draft.fsmContext = INITIAL_CONTEXT;
            draft.snapPreview = null;
          });
        },

        setToolMode(mode) {
          set((draft) => {
            draft.toolMode = mode;
            draft.fsmContext = { ...draft.fsmContext, mode };
          });
        },

        cycleToolMode() {
          set((draft) => {
            const next = cycleMode(draft.fsmContext);
            draft.fsmContext = next;
            draft.toolMode = next.mode;
          });
        },

        // ── Snap settings ─────────────────────────────────────────────────────
        setSnapToggle(key, value) {
          set((draft) => {
            draft.snapToggles[key] = value;
          });
        },

        setSnapPreview(preview) {
          set((draft) => {
            draft.snapPreview = preview;
          });
        },

        // ── FSM ──────────────────────────────────────────────────────────────
        fsmPlaceFirstPoint(point) {
          set((draft) => {
            const next = placeFirstPoint(draft.fsmContext, point);
            draft.fsmState = next.state;
            draft.fsmContext = next.context;
          });
        },

        fsmPlaceSecondPoint(point) {
          set((draft) => {
            const next = placeSecondPoint(draft.fsmContext, point);
            draft.fsmState = next.state;
            draft.fsmContext = next.context;
          });
        },

        fsmPlaceTextAnchor() {
          const ctx = get().fsmContext;
          if (!ctx.endpointA || !ctx.endpointB) return null;
          const next = placeTextAnchor(ctx);
          const anchor = buildAnchorFromContext(next.context);
          set((draft) => {
            draft.fsmState = next.state;
            draft.fsmContext = next.context;
          });
          return { anchor, mode: ctx.mode };
        },

        fsmContinue() {
          set((draft) => {
            const next = continueTool(draft.fsmContext);
            draft.fsmState = next.state;
            draft.fsmContext = next.context;
            draft.snapPreview = null;
          });
        },

        fsmCancel() {
          set((draft) => {
            const next = cancelTool();
            draft.fsmState = next.state;
            draft.fsmContext = { ...next.context, mode: draft.toolMode };
            draft.snapPreview = null;
          });
        },
      })),
    ),
    { name: 'BimDimensions3DStore' },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

export const selectDim3DToolActive = (s: BimDimensions3DState) => s.toolActive;
export const selectDim3DToolMode = (s: BimDimensions3DState) => s.toolMode;
export const selectDim3DSnapPreview = (s: BimDimensions3DState) => s.snapPreview;
export const selectDim3DFsmState = (s: BimDimensions3DState) => s.fsmState;
export const selectDim3DDimensions = (projectId: string) =>
  (s: BimDimensions3DState) => s.dimensionsByProjectId[projectId] ?? [];
