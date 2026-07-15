/**
 * ADR-366 Phase 4.1 — canonical-views unit tests (8 tests).
 */

import * as THREE from 'three';
import {
  CANONICAL_VIEW_ENTRIES,
  HOME_CANONICAL_VIEW_ID,
  matchIsoCanonicalView,
  ISO_EXACT_MATCH_THRESHOLD,
  getCanonicalViewDef,
} from '../viewport/canonical-views';
import { detectSnapCandidate } from '../viewport/view-snap-detector';
import { createCanonicalViewService } from '../viewport/CanonicalViewService';
import type { ViewportCamera, CanonicalViewId } from '../viewport/viewport-types';

// ── Test 1: 12 entries, unique IDs ─────────────────────────────────────────

describe('CANONICAL_VIEW_ENTRIES', () => {
  it('contains exactly 12 entries with unique IDs', () => {
    expect(CANONICAL_VIEW_ENTRIES).toHaveLength(12);
    const ids = CANONICAL_VIEW_ENTRIES.map(v => v.id);
    expect(new Set(ids).size).toBe(12);
  });

  // ── Test 2: all lookDir vectors are unit-length ───────────────────────────

  it('all lookDir vectors are unit length (±1e-6)', () => {
    for (const v of CANONICAL_VIEW_ENTRIES) {
      const [x, y, z] = v.lookDir;
      const len = Math.sqrt(x * x + y * y + z * z);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  // ── Test 3: ortho views have projectionMode; iso views do not ─────────────

  it('ortho views have projectionMode; iso views have type=iso and no projectionMode', () => {
    const ortho = CANONICAL_VIEW_ENTRIES.filter(v => v.type === 'ortho');
    const iso = CANONICAL_VIEW_ENTRIES.filter(v => v.type === 'iso');
    expect(ortho).toHaveLength(6);
    expect(iso).toHaveLength(6);
    for (const v of ortho) expect(v.projectionMode).toBeDefined();
    for (const v of iso) expect(v.projectionMode).toBeUndefined();
  });

  // ── Test 4: home view = iso-ne (A.5 decision) ────────────────────────────

  it('HOME_CANONICAL_VIEW_ID is iso-ne (A.5 decision)', () => {
    expect(HOME_CANONICAL_VIEW_ID).toBe('iso-ne');
    const def = getCanonicalViewDef(HOME_CANONICAL_VIEW_ID);
    expect(def?.type).toBe('iso');
  });
});

// ── Test 5: matchIsoCanonicalView — (+1,+1,+1) → iso-ne ──────────────────

describe('matchIsoCanonicalView', () => {
  const S = 1 / Math.sqrt(3);

  it('maps (+1,+1,+1) normalized to iso-ne', () => {
    const dir = new THREE.Vector3(S, S, S); // camera-from-target = +X+Y+Z
    expect(matchIsoCanonicalView(dir)).toBe('iso-ne');
  });

  // ── Test 6: (-1,+1,+1) → iso-nw ─────────────────────────────────────────

  it('maps (-1,+1,+1) normalized to iso-nw', () => {
    const dir = new THREE.Vector3(-S, S, S);
    expect(matchIsoCanonicalView(dir)).toBe('iso-nw');
  });

  it('returns null for non-canonical direction (top+front edge)', () => {
    // top+front edge: (0, 1/√2, 1/√2) — scores ~0.816 against iso-ne, below 0.98 threshold
    const S2 = 1 / Math.sqrt(2);
    const dir = new THREE.Vector3(0, S2, S2);
    expect(matchIsoCanonicalView(dir)).toBeNull();
  });
});

// ── Test 7: detectSnapCandidate detects iso-ne direction ─────────────────

describe('detectSnapCandidate — 12-direction detection', () => {
  it('detects iso-ne when camera is at (+1,+1,+1) from target', () => {
    const S = 1 / Math.sqrt(3);
    const target = new THREE.Vector3(0, 0, 0);
    const cameraPos = new THREE.Vector3(S * 20, S * 20, S * 20); // distance 20
    const candidate = detectSnapCandidate(cameraPos, target);
    expect(candidate?.id).toBe('iso-ne');
    expect(candidate?.type).toBe('iso');
  });

  it('detects top view when camera is directly above target', () => {
    const cameraPos = new THREE.Vector3(0, 20, 0);
    const target = new THREE.Vector3(0, 0, 0);
    const candidate = detectSnapCandidate(cameraPos, target);
    expect(candidate?.id).toBe('top');
  });
});

// ── Test 8: CanonicalViewService dispatch ────────────────────────────────

describe('CanonicalViewService', () => {
  function makeViewport(): {
    setProjection: jest.Mock;
    snapToViewDirection: jest.Mock;
    viewport: ViewportCamera;
  } {
    const setProjection = jest.fn();
    const snapToViewDirection = jest.fn();
    const viewport = {
      camera: new THREE.PerspectiveCamera(),
      target: new THREE.Vector3(),
      projectionMode: 'perspective' as const,
      isAnimating: false,
      setProjection,
      snapToViewDirection,
      rollView: jest.fn(),
      getZoom: jest.fn(() => 1),
      setZoom: jest.fn(),
      setZoomPreset: jest.fn(),
      updateAspect: jest.fn(),
      update: jest.fn(),
      dispose: jest.fn(),
      frameBounds: jest.fn(),
      frameHome: jest.fn(),
      cancelAnimation: jest.fn(),
      setSpeedModifier: jest.fn(),
      goHome: jest.fn(),
      applyTumble: jest.fn(),
      pan: jest.fn(),
      setOrbitPivot: jest.fn(),
      setControlsEnabled: jest.fn(),
    };
    return { setProjection, snapToViewDirection, viewport };
  }

  it('snapTo ortho view calls setProjection with correct mode', () => {
    const { setProjection, viewport } = makeViewport();
    const service = createCanonicalViewService(viewport);
    service.snapTo('top');
    expect(setProjection).toHaveBeenCalledWith('top');
    service.snapTo('front');
    expect(setProjection).toHaveBeenCalledWith('front');
  });

  it('snapTo iso view calls snapToViewDirection (not setProjection)', () => {
    const { setProjection, snapToViewDirection, viewport } = makeViewport();
    const service = createCanonicalViewService(viewport);
    service.snapTo('iso-ne');
    expect(setProjection).not.toHaveBeenCalled();
    expect(snapToViewDirection).toHaveBeenCalledTimes(1);
    // camera-from-target direction should be -lookDir of iso-ne = (+S,+S,+S)
    const S = 1 / Math.sqrt(3);
    const dir: THREE.Vector3 = snapToViewDirection.mock.calls[0][0];
    expect(dir.x).toBeCloseTo(S, 5);
    expect(dir.y).toBeCloseTo(S, 5);
    expect(dir.z).toBeCloseTo(S, 5);
  });

  it('snapHome calls snapTo(iso-ne)', () => {
    const { snapToViewDirection, viewport } = makeViewport();
    const service = createCanonicalViewService(viewport);
    service.snapHome();
    expect(snapToViewDirection).toHaveBeenCalledTimes(1);
  });
});
