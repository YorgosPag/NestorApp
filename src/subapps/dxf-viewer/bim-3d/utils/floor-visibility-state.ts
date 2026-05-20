/**
 * floor-visibility-state — pure helpers for 3D floor visibility.
 * ADR-366 Phase 4 Group B (B.3). No React, no Three.js.
 */

import * as THREE from 'three';
import type { Level } from '../../systems/levels/config';

export type FloorVisMode = 'show' | 'ghost' | 'hide';
export type FloorPreset = 'all' | 'active' | 'none' | 'invert';

// Ghost material cache (WeakMap — GC-safe, no manual cleanup needed).
const GHOST_CACHE = new WeakMap<THREE.Material, THREE.Material>();

export function getGhostMaterial(original: THREE.Material): THREE.Material {
  let ghost = GHOST_CACHE.get(original);
  if (!ghost) {
    ghost = original.clone();
    (ghost as THREE.MeshStandardMaterial).transparent = true;
    (ghost as THREE.MeshStandardMaterial).opacity = 0.3;
    (ghost as THREE.MeshStandardMaterial).depthWrite = false;
    GHOST_CACHE.set(original, ghost);
  }
  return ghost;
}

/** Sort levels top-down (highest order first — per B.3.Q4). */
export function sortLevelsTopDown(levels: readonly Level[]): Level[] {
  return [...levels].sort((a, b) => b.order - a.order);
}

/** Compute new visibility map for a given preset. */
export function applyPreset(
  levels: readonly Level[],
  preset: FloorPreset,
  activeLevelId: string | null,
  current: ReadonlyMap<string, FloorVisMode>,
): Map<string, FloorVisMode> {
  const next = new Map<string, FloorVisMode>();
  for (const level of levels) {
    switch (preset) {
      case 'all':
        next.set(level.id, 'show');
        break;
      case 'active':
        next.set(level.id, level.id === activeLevelId ? 'show' : 'hide');
        break;
      case 'none':
        next.set(level.id, 'hide');
        break;
      case 'invert': {
        const curr = current.get(level.id) ?? 'show';
        next.set(level.id, curr === 'hide' ? 'show' : 'hide');
        break;
      }
    }
  }
  return next;
}
