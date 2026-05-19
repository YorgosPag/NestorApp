"use client";

/**
 * CanvasLayerStack3dLeaf — ADR-040 micro-leaf for 3D BIM viewport.
 *
 * ADR-040: Sibling leaf subscriber. Mounts BimViewport3D when mode = 3D.
 * NOT YET imported by canvas-layer-stack-leaves.tsx (blocked by concurrent
 * ADR-362/363 changes). Wire up after those changes are committed:
 *
 *   // in canvas-layer-stack-leaves.tsx:
 *   import { CanvasLayerStack3dLeaf } from './canvas-layer-stack-3d-leaf';
 *   // add <CanvasLayerStack3dLeaf /> as last sibling leaf
 */

import { BimViewport3D } from '../../bim-3d/viewport/BimViewport3D';

export function CanvasLayerStack3dLeaf() {
  // BimViewport3D handles its own mode subscription + null-return when mode='2d'
  return <BimViewport3D />;
}
