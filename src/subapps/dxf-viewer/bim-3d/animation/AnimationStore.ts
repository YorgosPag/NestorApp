'use client';

/**
 * ADR-366 Phase 9 / C.1.a — AnimationStore (Zustand SSoT).
 *
 * Source of truth για:
 *  - waypoints     : ordered array (user-authored OR turntable-generated)
 *  - durationSec / fps / axis / direction / splitTracks: animation config
 *  - activeWaypointIndex: selected waypoint για 3D drag handle + side panel
 *
 * Subscribers are micro-leaves (ADR-040). Mutations debounced 50ms per
 * waypoint-edit για race-free Firestore writes (GOL §C.1 N.7.2 #2).
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  createDefaultAnimationConfig,
  TURNTABLE_DEFAULTS,
} from './presets/animation-presets';
import { DEFAULT_SNAP_STEP } from './snap-quantizer';
import type { AxisLock } from './axis-constraint-projector';
import type {
  AnimationAxis,
  AnimationConfig,
  AnimationDirection,
  AnimationFps,
  BimAnimationDoc,
  Waypoint,
} from './animation-types';

interface AnimationState extends AnimationConfig {
  readonly activeWaypointIndex: number | null;
  /** Last-loaded doc id (null = unsaved / fresh). */
  readonly loadedDocId: string | null;
  /** ADR-366 §C.1.b — ribbon/panel/handles gate. Mirror BimDimensions3DStore.toolActive SSoT pattern. */
  readonly toolActive: boolean;
  /** ADR-366 §C.1.b snap-to-grid — enabled flag. */
  readonly snapEnabled: boolean;
  /** ADR-366 §C.1.b snap-to-grid — grid step in scene units. */
  readonly snapStepUnits: number;
  /** ADR-366 §C.1.b axis-constrained drag — active axis lock (null = free drag). */
  readonly dragAxisLock: AxisLock | null;
}

interface AnimationActions {
  setDurationSec(durationSec: number): void;
  setFps(fps: AnimationFps): void;
  setAxis(axis: AnimationAxis): void;
  setDirection(direction: AnimationDirection): void;
  setSplitTracks(splitTracks: boolean): void;

  setWaypoints(waypoints: ReadonlyArray<Waypoint>): void;
  addWaypoint(waypoint: Waypoint): void;
  insertWaypointAt(index: number, waypoint: Waypoint): void;
  removeWaypoint(index: number): void;
  updateWaypoint(index: number, patch: Partial<Waypoint>): void;
  reorderWaypoints(fromIndex: number, toIndex: number): void;

  setActiveWaypointIndex(index: number | null): void;

  /** ADR-366 §C.1.b — flip ribbon-contextual-tab + Floating3DPanel + 3D handles. */
  setToolActive(active: boolean): void;
  /** ADR-366 §C.1.b snap-to-grid — toggle snap on/off. */
  setSnapEnabled(enabled: boolean): void;
  /** ADR-366 §C.1.b snap-to-grid — update grid step (scene units). */
  setSnapStepUnits(step: number): void;
  /** ADR-366 §C.1.b axis-constrained drag — set/clear axis lock. */
  setDragAxisLock(axis: AxisLock | null): void;

  loadFromDoc(doc: BimAnimationDoc): void;
  reset(): void;
}

type AnimationStore = AnimationState & AnimationActions;

const initialState: AnimationState = {
  ...createDefaultAnimationConfig(),
  activeWaypointIndex: null,
  loadedDocId: null,
  toolActive: false,
  snapEnabled: false,
  snapStepUnits: DEFAULT_SNAP_STEP,
  dragAxisLock: null,
};

function clampIndex(idx: number, length: number): number {
  if (length <= 0) return 0;
  if (idx < 0) return 0;
  if (idx >= length) return length - 1;
  return idx;
}

export const useAnimationStore = create<AnimationStore>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        ...initialState,

        setDurationSec: (durationSec) =>
          set((s) => {
            s.durationSec = durationSec;
          }),

        setFps: (fps) =>
          set((s) => {
            s.fps = fps;
          }),

        setAxis: (axis) =>
          set((s) => {
            s.axis = axis;
          }),

        setDirection: (direction) =>
          set((s) => {
            s.direction = direction;
          }),

        setSplitTracks: (splitTracks) =>
          set((s) => {
            s.splitTracks = splitTracks;
          }),

        setWaypoints: (waypoints) =>
          set((s) => {
            s.waypoints = waypoints;
            if (s.activeWaypointIndex !== null && s.activeWaypointIndex >= waypoints.length) {
              s.activeWaypointIndex = waypoints.length === 0 ? null : waypoints.length - 1;
            }
          }),

        addWaypoint: (waypoint) =>
          set((s) => {
            s.waypoints = [...s.waypoints, waypoint];
            s.activeWaypointIndex = s.waypoints.length - 1;
          }),

        insertWaypointAt: (index, waypoint) =>
          set((s) => {
            const safeIdx = Math.max(0, Math.min(index, s.waypoints.length));
            const next = [...s.waypoints];
            next.splice(safeIdx, 0, waypoint);
            s.waypoints = next;
            s.activeWaypointIndex = safeIdx;
          }),

        removeWaypoint: (index) =>
          set((s) => {
            if (index < 0 || index >= s.waypoints.length) return;
            const next = [...s.waypoints];
            next.splice(index, 1);
            s.waypoints = next;
            if (s.activeWaypointIndex === index) {
              s.activeWaypointIndex = next.length === 0 ? null : clampIndex(index, next.length);
            } else if (s.activeWaypointIndex !== null && s.activeWaypointIndex > index) {
              s.activeWaypointIndex -= 1;
            }
          }),

        updateWaypoint: (index, patch) =>
          set((s) => {
            if (index < 0 || index >= s.waypoints.length) return;
            const current = s.waypoints[index]!;
            const next = [...s.waypoints];
            next[index] = { ...current, ...patch };
            s.waypoints = next;
          }),

        reorderWaypoints: (fromIndex, toIndex) =>
          set((s) => {
            if (fromIndex === toIndex) return;
            if (fromIndex < 0 || fromIndex >= s.waypoints.length) return;
            if (toIndex < 0 || toIndex >= s.waypoints.length) return;
            const next = [...s.waypoints];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved!);
            s.waypoints = next;
            if (s.activeWaypointIndex === fromIndex) {
              s.activeWaypointIndex = toIndex;
            }
          }),

        setActiveWaypointIndex: (index) =>
          set((s) => {
            s.activeWaypointIndex =
              index === null ? null : clampIndex(index, s.waypoints.length);
          }),

        setToolActive: (active) =>
          set((s) => {
            s.toolActive = active;
            if (!active) {
              s.activeWaypointIndex = null;
              s.dragAxisLock = null;
            }
          }),

        setSnapEnabled: (enabled) =>
          set((s) => {
            s.snapEnabled = enabled;
          }),

        setSnapStepUnits: (step) =>
          set((s) => {
            if (step > 0) s.snapStepUnits = step;
          }),

        setDragAxisLock: (axis) =>
          set((s) => {
            s.dragAxisLock = axis;
          }),

        loadFromDoc: (doc) =>
          set((s) => {
            s.waypoints = doc.waypoints;
            s.durationSec = doc.durationSec;
            s.fps = doc.fps;
            s.axis = doc.axis;
            s.direction = doc.direction;
            s.splitTracks = doc.splitTracks;
            s.activeWaypointIndex = doc.waypoints.length > 0 ? 0 : null;
            s.loadedDocId = doc.id;
          }),

        reset: () =>
          set((s) => {
            Object.assign(s, initialState);
          }),
      }))
    ),
    { name: 'AnimationStore' }
  )
);

/** Selectors — keep components from re-rendering on unrelated state changes. */
export const selectAnimationConfig = (s: AnimationStore): AnimationConfig => ({
  waypoints: s.waypoints,
  durationSec: s.durationSec,
  fps: s.fps,
  axis: s.axis,
  direction: s.direction,
  splitTracks: s.splitTracks,
});

export const selectActiveWaypoint = (s: AnimationStore): Waypoint | null => {
  if (s.activeWaypointIndex === null) return null;
  return s.waypoints[s.activeWaypointIndex] ?? null;
};

export const selectAnimationToolActive = (s: AnimationStore): boolean => s.toolActive;

export const TURNTABLE_PRESET_DEFAULTS = TURNTABLE_DEFAULTS;
