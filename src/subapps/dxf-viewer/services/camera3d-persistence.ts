/**
 * camera3d-persistence.ts — 3D Camera View Persistence SSoT (ADR-400 §3D).
 *
 * The 3D sibling of `viewport-persistence.ts`. Restores the user's 3D camera
 * (position + orbit target + zoom + projection mode) on page refresh AND across an
 * in-session 2D↔3D toggle (the 3D viewport fully remounts each time and would
 * otherwise reset to the hard-coded INITIAL camera).
 *
 * Big-player web practice (Figma / Autodesk Forge / Speckle camera deep-link): the
 * view is a shareable URL deep-link, with a per-document localStorage fallback — the
 * SAME dual-sink philosophy as the 2D `viewport-persistence`. One compact URL key
 * keeps shared links short:
 *
 *   /dxf/viewer?c3d=<px>,<py>,<pz>,<tx>,<ty>,<tz>,<zoom>,<modeCode>
 *
 * ADR-040 compliance: URL writes go through the shared `replaceUrlSearchParams`
 * (history.replaceState — no React re-render, no Next remount), so the 3D camera hot
 * path stays at 60fps. Reads use `window.location.search`.
 *
 * @see services/viewport-persistence.ts — the 2D sibling + shared URL helper
 * @see docs/centralized-systems/reference/adrs/ADR-400-viewport-state-persistence.md
 */

import type { ProjectionMode } from '../bim-3d/viewport/viewport-types';
import {
  STORAGE_KEYS,
  storageGet,
  storageSet,
  storageRemove,
} from '../utils/storage-utils';
import {
  replaceUrlSearchParams,
  currentSearchParams,
  isFiniteNumber,
  roundToSignificantFigures,
} from './viewport-persistence';

/** A restorable 3D camera pose — everything needed to reproduce the exact view. */
export interface Camera3DPose {
  /** Camera world position [x, y, z] (metres, Three.js Y-up). */
  readonly position: readonly [number, number, number];
  /** Orbit look-at target [x, y, z] (metres). */
  readonly target: readonly [number, number, number];
  /** Zoom scalar (`ViewportCamera.getZoom()` units). */
  readonly zoom: number;
  /** Active projection mode (perspective or a canonical ortho face). */
  readonly projection: ProjectionMode;
}

/** Compact URL key for the whole 3D camera (kept terse so shared links stay short). */
const URL_KEY_CAMERA3D = 'c3d';

/** Single-char codes for projection modes (compact URL). */
const MODE_TO_CODE: Readonly<Record<ProjectionMode, string>> = {
  perspective: 'p', top: 't', bottom: 'b', front: 'f', back: 'k', left: 'l', right: 'r',
} as const;
const CODE_TO_MODE: Readonly<Record<string, ProjectionMode>> = {
  p: 'perspective', t: 'top', b: 'bottom', f: 'front', k: 'back', l: 'left', r: 'right',
} as const;

/** Coordinate precision: 3 decimals on metres ≈ 1 mm — plenty for an exact view. */
function roundCoord(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ─── Guards ──────────────────────────────────────────────────────────────────

function isValidPose(p: Camera3DPose | null | undefined): p is Camera3DPose {
  return (
    !!p &&
    Array.isArray(p.position) && p.position.length === 3 && p.position.every(isFiniteNumber) &&
    Array.isArray(p.target) && p.target.length === 3 && p.target.every(isFiniteNumber) &&
    isFiniteNumber(p.zoom) && p.zoom > 0 &&
    typeof p.projection === 'string' && p.projection in MODE_TO_CODE
  );
}

// ─── URL serialization ───────────────────────────────────────────────────────

/** Serialize a pose to the compact CSV `c3d` value. */
export function serializeCamera3DToParam(pose: Camera3DPose): string {
  const [px, py, pz] = pose.position;
  const [tx, ty, tz] = pose.target;
  return [
    roundCoord(px), roundCoord(py), roundCoord(pz),
    roundCoord(tx), roundCoord(ty), roundCoord(tz),
    roundToSignificantFigures(pose.zoom), MODE_TO_CODE[pose.projection],
  ].join(',');
}

/** Parse + validate a pose from the compact CSV `c3d` value. Invalid → null. */
export function parseCamera3DFromParam(raw: string | null): Camera3DPose | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 8) return null;
  const nums = parts.slice(0, 7).map(Number);
  const projection = CODE_TO_MODE[parts[7]];
  if (!projection) return null;
  const candidate: Camera3DPose = {
    position: [nums[0], nums[1], nums[2]],
    target: [nums[3], nums[4], nums[5]],
    zoom: nums[6],
    projection,
  };
  return isValidPose(candidate) ? candidate : null;
}

/** Read the 3D camera pose from the current page URL (`c3d`), or null. */
export function readCamera3DFromUrl(): Camera3DPose | null {
  return parseCamera3DFromParam(currentSearchParams().get(URL_KEY_CAMERA3D));
}

/** Write the 3D camera pose to the URL via the shared `replaceUrlSearchParams`. */
export function writeCamera3DToUrl(pose: Camera3DPose): void {
  if (!isValidPose(pose)) return;
  replaceUrlSearchParams((params) => params.set(URL_KEY_CAMERA3D, serializeCamera3DToParam(pose)));
}

// ─── localStorage fallback (per FileRecord) ──────────────────────────────────

function storageKeyFor(fileRecordId: string): string {
  return `${STORAGE_KEYS.CAMERA3D_STATE_PREFIX}:${fileRecordId}`;
}

/** Read the per-document persisted 3D camera pose (validated). */
export function readCamera3DFromStorage(fileRecordId: string | null): Camera3DPose | null {
  if (!fileRecordId) return null;
  const raw = storageGet<Camera3DPose | null>(storageKeyFor(fileRecordId), null);
  return isValidPose(raw) ? raw : null;
}

/** Persist the 3D camera pose for a document to localStorage. No-op without an id. */
export function writeCamera3DToStorage(fileRecordId: string | null, pose: Camera3DPose): void {
  if (!fileRecordId || !isValidPose(pose)) return;
  storageSet<Camera3DPose>(storageKeyFor(fileRecordId), pose);
}

/** Remove the per-document persisted 3D camera pose. */
export function clearCamera3DStorage(fileRecordId: string | null): void {
  if (!fileRecordId) return;
  storageRemove(storageKeyFor(fileRecordId));
}

// ─── Combined facade (used by restore + sync) ────────────────────────────────

/**
 * Resolve the 3D camera pose to restore on mount: the URL deep-link wins when valid,
 * otherwise the per-document localStorage fallback. Null when neither carries a pose.
 */
export function readPersistedCamera3D(fileRecordId: string | null): Camera3DPose | null {
  return readCamera3DFromUrl() ?? readCamera3DFromStorage(fileRecordId);
}

/** Persist to BOTH sinks (URL deep-link + localStorage fallback) in one call. */
export function persistCamera3D(fileRecordId: string | null, pose: Camera3DPose): void {
  if (!isValidPose(pose)) return;
  writeCamera3DToUrl(pose);
  writeCamera3DToStorage(fileRecordId, pose);
}
