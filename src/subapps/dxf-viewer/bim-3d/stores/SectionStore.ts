/**
 * SectionStore — Zustand SSoT για ADR-366 §A.3 Section Cuts (Phase 7.0).
 *
 * Owns clip-volume state (enabled, box bounds, plane list, mode, link toggle).
 * Pure plain-data (tuples instead of THREE.Vector3) for immutability and
 * useSyncExternalStore equality stability.
 *
 * Consumers:
 * - ThreeJsSceneManager → reads bounds + plane list → builds THREE.Plane[]
 * - Section3DPanelTab    → UI subscriber (ADR-040 micro-leaf, ≤2 hooks)
 * - BimViewport3D        → enabled change → manager.initSectionBox()
 *
 * Default: OFF, mode='box', empty planes, bounds=null (lazy-init at first geometry).
 *
 * @see ADR-366 §A.3 — Section cuts decisions
 * @see docs/centralized-systems/reference/adrs/ADR-366-3d-bim-viewer-photorealistic-rendering.md
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type SectionMode = 'box' | 'plane';
export type Vec3Tuple = readonly [number, number, number];
export type AxisSide = 'min' | 'max';
export type Axis = 'x' | 'y' | 'z';

export interface SectionPlaneState {
  readonly id: string;
  /** World-space normal (unit vector, plain tuple) */
  readonly normal: Vec3Tuple;
  /** Three.Plane constant (signed distance from origin) */
  readonly constant: number;
  readonly enabled: boolean;
  readonly label: string;
}

export interface SectionBoxBounds {
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
}

interface SectionState {
  enabled: boolean;
  mode: SectionMode;
  planes: ReadonlyArray<SectionPlaneState>;
  linkPlanes: boolean;
  boxBounds: SectionBoxBounds | null;
}

interface SectionActions {
  setEnabled(v: boolean): void;
  setMode(m: SectionMode): void;
  setBoxBounds(bounds: SectionBoxBounds | null): void;
  /** Drag a single face of the section box. */
  setBoxBoundsAxis(axis: Axis, side: AxisSide, value: number): void;
  addPlane(plane: Omit<SectionPlaneState, 'id'>): void;
  removePlane(id: string): void;
  updatePlane(id: string, patch: Partial<Omit<SectionPlaneState, 'id'>>): void;
  setPlaneEnabled(id: string, enabled: boolean): void;
  setLinkPlanes(v: boolean): void;
  resetToDefault(): void;
}

type SectionStore = SectionState & SectionActions;

const MAX_PLANES = 6;

const INITIAL_STATE: SectionState = {
  enabled: false,
  mode: 'box',
  planes: [],
  linkPlanes: false,
  boxBounds: null,
};

function nextPlaneId(existing: ReadonlyArray<SectionPlaneState>): string {
  const ids = new Set(existing.map((p) => p.id));
  for (let i = 1; i <= MAX_PLANES; i++) {
    const candidate = `section-plane-${i}`;
    if (!ids.has(candidate)) return candidate;
  }
  return `section-plane-${Date.now()}`;
}

export const useSectionStore = create<SectionStore>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,

    setEnabled(v) {
      set({ enabled: v });
    },

    setMode(m) {
      set({ mode: m });
    },

    setBoxBounds(bounds) {
      set({ boxBounds: bounds });
    },

    setBoxBoundsAxis(axis, side, value) {
      const prev = get().boxBounds;
      if (!prev) return;
      const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      const next: SectionBoxBounds = {
        min: prev.min.map((v, i) => (side === 'min' && i === idx ? value : v)) as unknown as Vec3Tuple,
        max: prev.max.map((v, i) => (side === 'max' && i === idx ? value : v)) as unknown as Vec3Tuple,
      };
      set({ boxBounds: next });
    },

    addPlane(plane) {
      const current = get().planes;
      if (current.length >= MAX_PLANES) return;
      const id = nextPlaneId(current);
      const label = plane.label || `plane-${current.length + 1}`;
      set({ planes: [...current, { ...plane, id, label }] });
    },

    removePlane(id) {
      set({ planes: get().planes.filter((p) => p.id !== id) });
    },

    updatePlane(id, patch) {
      set({
        planes: get().planes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      });
    },

    setPlaneEnabled(id, enabled) {
      set({
        planes: get().planes.map((p) => (p.id === id ? { ...p, enabled } : p)),
      });
    },

    setLinkPlanes(v) {
      set({ linkPlanes: v });
    },

    resetToDefault() {
      set({ ...INITIAL_STATE, boxBounds: get().boxBounds });
    },
  }))
);

export const SECTION_MAX_PLANES = MAX_PLANES;
