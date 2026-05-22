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
import { generateSectionId } from '@/services/enterprise-id.service';

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

/** Linked plane group — ephemeral session-only (ADR-366 §C.6.Q3 Navisworks pattern). */
export interface PlaneGroup {
  readonly id: string;
  readonly planeIds: ReadonlyArray<string>;
  /** Cumulative translation delta applied to all member planes (meters). */
  readonly transformDeltaM: number;
}

interface SectionState {
  enabled: boolean;
  mode: SectionMode;
  planes: ReadonlyArray<SectionPlaneState>;
  linkedGroups: ReadonlyArray<PlaneGroup>;
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
  /** Create a linked group from given plane IDs (ADR-366 §C.6.Q3). */
  addGroup(planeIds: readonly string[]): void;
  /** Remove a linked group (planes remain, just ungrouped). */
  removeGroup(groupId: string): void;
  /** Apply a translation delta (meters) to all planes in the group. */
  applyGroupDelta(groupId: string, deltaM: number): void;
  resetToDefault(): void;
}

type SectionStore = SectionState & SectionActions;

const MAX_PLANES = 6;

const INITIAL_STATE: SectionState = {
  enabled: false,
  mode: 'box',
  planes: [],
  linkedGroups: [],
  linkPlanes: false,
  boxBounds: null,
};

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
      const id = generateSectionId();
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

    addGroup(planeIds) {
      if (planeIds.length < 2) return;
      const group: PlaneGroup = {
        id: generateSectionId(),
        planeIds: [...planeIds],
        transformDeltaM: 0,
      };
      set({ linkedGroups: [...get().linkedGroups, group] });
    },

    removeGroup(groupId) {
      set({ linkedGroups: get().linkedGroups.filter((g) => g.id !== groupId) });
    },

    applyGroupDelta(groupId, deltaM) {
      const group = get().linkedGroups.find((g) => g.id === groupId);
      if (!group) return;
      const planeSet = new Set(group.planeIds);
      set({
        planes: get().planes.map((p) =>
          planeSet.has(p.id) ? { ...p, constant: p.constant + deltaM } : p,
        ),
        linkedGroups: get().linkedGroups.map((g) =>
          g.id === groupId
            ? { ...g, transformDeltaM: g.transformDeltaM + deltaM }
            : g,
        ),
      });
    },

    resetToDefault() {
      set({ ...INITIAL_STATE, boxBounds: get().boxBounds });
    },
  }))
);

export const SECTION_MAX_PLANES = MAX_PLANES;

/** Backward-compat helper: first enabled plane or null. */
export function getActivePlane(
  state: Pick<SectionState, 'planes'>,
): SectionPlaneState | null {
  return state.planes.find((p) => p.enabled) ?? null;
}
