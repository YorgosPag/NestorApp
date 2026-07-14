'use client';

/**
 * ADR-650 — Topographic persistence types + (de)serialization.
 *
 * The surveyed DEFINITION of a floor's topography persists as **one document per
 * floor** (`floorplan_topo_surfaces/{topo_*}`), mirroring the grid-guide single-doc
 * model (ADR-441) rather than per-entity collections. Big-player model (Civil 3D
 * «Surface Definition» / Revit Toposurface): the SSoT is the raw survey + settings;
 * the TIN, contours and 3D mesh are DERIVED products regenerated on load — never
 * stored as baked geometry.
 *
 * Scale: a typed/CSV survey serializes small (inline in the doc). A point cloud
 * (M8) can be tens of MB — over the 1MB Firestore doc limit — so when the survey
 * payload exceeds {@link TOPO_INLINE_MAX_BYTES} the points/breaklines are offloaded
 * to a Storage blob and the doc keeps only `pointsStoragePath` (see the service).
 *
 * @see ./topo-firestore-service.ts
 * @see ../../../bim/persistence/bim-floor-scope.ts
 */

import type { Timestamp } from 'firebase/firestore';
import type {
  TopoDefinition, TopoBoundary, TopoSurfaceId, CutFillReferenceMode, TerrainSurfaceStyle,
} from '../topo-types';
import type { ContourConfig, ContourDisplayStyle } from '../contour-config';
import { DEFAULT_CONTOUR_CONFIG, DEFAULT_CONTOUR_DISPLAY_STYLE } from '../contour-config';

/** The two named surfaces a floor owns (Civil 3D collection): surveyed vs designed ground. */
export type TopoSurfacesDefinition = Readonly<Record<TopoSurfaceId, TopoDefinition>>;

/** Persisted 3D display prefs (mirror of `Terrain3DState`). */
export interface TopoTerrain3DPrefs {
  readonly visible: boolean;
  readonly style: TerrainSurfaceStyle;
}

/** Persisted earthworks QUESTION (never the derived answer). */
export interface TopoCutFillPrefs {
  readonly mode: CutFillReferenceMode;
  readonly datumZMm: number;
}

/**
 * The full, in-memory topographic state of a floor gathered from every topo store —
 * the payload the persistence layer round-trips. Definition (SSoT) + all view settings.
 */
export interface TopoPersistedState {
  readonly surfaces: TopoSurfacesDefinition;
  readonly boundary: TopoBoundary | null;
  readonly contourConfig: ContourConfig;
  readonly contourDisplayStyle: ContourDisplayStyle;
  readonly terrain3d: TopoTerrain3DPrefs;
  readonly cutFill: TopoCutFillPrefs;
}

/**
 * Canonical Firestore document — one floor's topographic definition + settings.
 * `surfaces` is inline for small surveys; when offloaded, `surfaces` is absent and
 * `pointsStoragePath` points at the Storage blob holding {@link TopoSurfacesDefinition}.
 */
export interface TopoSurfaceDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly floorId?: string;
  /** Inline survey definition (small surveys). Absent when offloaded to Storage. */
  readonly surfaces?: TopoSurfacesDefinition;
  /** Storage path of the offloaded {@link TopoSurfacesDefinition} blob (large clouds). */
  readonly pointsStoragePath?: string;
  readonly boundary: TopoBoundary | null;
  readonly contourConfig: ContourConfig;
  readonly contourDisplayStyle: ContourDisplayStyle;
  readonly terrain3d: TopoTerrain3DPrefs;
  readonly cutFill: TopoCutFillPrefs;
  /** Monotonic counter — informational (last-write-wins v1). */
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

/** Payload size above which the survey definition is offloaded to a Storage blob. */
export const TOPO_INLINE_MAX_BYTES = 700_000;

/**
 * Deterministic JSON with recursively SORTED object keys — so a doc echoed back from
 * Firestore (whose map fields may deserialize in a different key order) produces the
 * SAME signature as the in-memory state that wrote it. Without this the anti-echo guard
 * could mis-compare and re-save in a loop.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',');
  return `{${body}}`;
}

/** Stable string signature for no-op / anti-echo comparison (key-order independent). */
export function topoStateSignature(state: TopoPersistedState): string {
  return stableStringify({
    surfaces: state.surfaces,
    boundary: state.boundary,
    contourConfig: state.contourConfig,
    contourDisplayStyle: state.contourDisplayStyle,
    terrain3d: state.terrain3d,
    cutFill: state.cutFill,
  });
}

/** Serialized byte size of the survey definition (drives the inline↔Storage decision). */
export function topoDefinitionByteSize(surfaces: TopoSurfacesDefinition): number {
  return JSON.stringify(surfaces).length;
}

/**
 * Is there nothing worth persisting yet? Both surfaces empty AND no boundary means the
 * floor has no survey — never create a doc for it (mirror of the grid-guide empty guard).
 * Settings alone (an unused default interval) do not justify a document.
 */
export function isEmptyTopoState(state: TopoPersistedState): boolean {
  const noPoints =
    state.surfaces.existing.points.length === 0 &&
    state.surfaces.proposed.points.length === 0;
  return noPoints && state.boundary === null;
}

/** The settings half of the document (everything except the survey definition). */
export function topoSettingsDocFields(state: TopoPersistedState): {
  boundary: TopoBoundary | null;
  contourConfig: ContourConfig;
  contourDisplayStyle: ContourDisplayStyle;
  terrain3d: TopoTerrain3DPrefs;
  cutFill: TopoCutFillPrefs;
} {
  return {
    boundary: state.boundary,
    contourConfig: state.contourConfig,
    contourDisplayStyle: state.contourDisplayStyle,
    terrain3d: state.terrain3d,
    cutFill: state.cutFill,
  };
}

/**
 * `TopoSurfaceDoc` → in-memory `TopoPersistedState`, defaulting any absent field so an
 * older/partial doc still hydrates. `surfaces` come either inline (this function) or, when
 * offloaded, from the Storage blob the caller merges in via {@link withSurfaces}.
 */
export function docToTopoState(doc: TopoSurfaceDoc): TopoPersistedState {
  const emptyDef: TopoDefinition = { points: [], breaklines: [] };
  return {
    surfaces: doc.surfaces ?? { existing: emptyDef, proposed: emptyDef },
    boundary: doc.boundary ?? null,
    contourConfig: doc.contourConfig ?? DEFAULT_CONTOUR_CONFIG,
    contourDisplayStyle: doc.contourDisplayStyle ?? DEFAULT_CONTOUR_DISPLAY_STYLE,
    terrain3d: doc.terrain3d ?? { visible: false, style: 'shaded' },
    cutFill: doc.cutFill ?? { mode: 'datum', datumZMm: 0 },
  };
}

/** Replace the surfaces of a state (used after reading an offloaded Storage blob). */
export function withSurfaces(
  state: TopoPersistedState,
  surfaces: TopoSurfacesDefinition,
): TopoPersistedState {
  return { ...state, surfaces };
}
