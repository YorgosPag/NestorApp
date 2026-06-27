'use client';

/**
 * ProposalGhost3DOverlay — the generic SSoT **3D** overlay for the MEP auto-design proposal
 * ghost (the 3D twin of the 2D {@link ProposalGhostOverlay}). It owns a single transient
 * `THREE.Group` of the discipline's translucent ghost objects: it adds them to the live scene on
 * Generate and removes + disposes them on Accept/Reject (when `objects` flips back to `null`) or
 * on unmount. No discipline knowledge — the {@link ProposalGhost3DMount} builds the objects and
 * hands them down; this overlay is pure lifecycle (mirror of `MepSegmentPlacementGhost`).
 *
 * The group is non-pickable (`raycast = () => {}`) so the proposal never blocks selection of the
 * real model underneath it.
 *
 * @see ./ProposalGhost3DMount.tsx — discipline-aware object builder
 * @see ../placement/MepSegmentPlacementGhost.ts — transient-mesh lifecycle template
 */

import { useEffect, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
// ADR-537 — the translucent proposal ghost is a post-FX UI overlay (same mustard root cause as the
// placement ghosts / underlay / gizmo): drawn AFTER SSAO so the warm lighting + AO never tint it.
import { registerPostFxOverlay } from '../scene/post-fx-overlay-pass';
import { disposeObjectTree } from '../scene/dispose-object-tree';

export interface ProposalGhost3DOverlayProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  /** The discipline's translucent ghost objects, or `null` when no proposal is under review. */
  readonly objects: readonly THREE.Object3D[] | null;
}

/** Name stamped on the throwaway ghost group (never persisted, never raycast). */
const GHOST_GROUP_NAME = '__proposal-ghost-3d__';

export function ProposalGhost3DOverlay({ managerRef, objects }: ProposalGhost3DOverlayProps): null {
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !objects || objects.length === 0) return;
    const group = new THREE.Group();
    group.name = GHOST_GROUP_NAME;
    group.raycast = () => {};
    for (const obj of objects) group.add(obj);
    manager.scene.add(group);
    // ADR-537 — keep the root invisible to the MAIN render and expose it through the post-FX overlay
    // pass instead (AO-immune, depth-correct), so the translucent ghost never turns "mustard" at idle.
    group.visible = false;
    const unregister = registerPostFxOverlay(manager.scene, () => [group]);
    return () => {
      unregister();
      manager.scene.remove(group);
      // The overlay OWNS the ghost objects' geometry + materials (+ textures) → free them all.
      disposeObjectTree(group, { materials: true });
    };
  }, [managerRef, objects]);

  return null;
}
