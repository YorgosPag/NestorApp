'use client';

/**
 * DynamicInput3DLeaf — mounts the SAME 2D «Δαχτυλίδι Εντολών» (`RadialCommandRing`, ADR-513) in the
 * 3D viewport while drawing a wall, for full 2D↔3D parity (ADR-537 / ADR-544). ONE source of truth:
 * it renders the identical SSoT component the 2D canvas uses — zero duplicated ring logic.
 *
 * The ring is self-driven (WINDOW mousemove, `position:fixed`, `DynamicInputLockStore` for Length/
 * Angle, `wallToolBridgeStore.setParamOverrides` for Thickness/Height) so it needs no 3D cursor
 * store. The Length/Angle lock feeds back through the SAME `generateWallPreview` the 3D wall ghost
 * uses → the 3D ghost obeys the typed values exactly like the 2D ghost (preview ≡ commit).
 *
 * Gate (mirror of `DynamicInputSubscriber`): the Dynamic-Input toggle is ON AND the wall tool is in
 * `awaitingEnd` (first click placed, second pending). The 2D `DynamicInputSubscriber` yields while in
 * 3D (it returns null), so exactly ONE ring is ever mounted — never double window intercepts.
 *
 * ADR-040 micro-leaf: low-frequency store subscriptions only (tool / toggle / wall-preview phase);
 * the high-frequency cursor follow lives inside `RadialCommandRing`'s own window listener.
 */

import { type MutableRefObject } from 'react';
import { useToolState } from '../../stores/ToolStateStore';
import { useWallPreview, isWallAwaitingEnd } from '../../bim/walls/wall-preview-store';
import { useCadToggles } from '../../hooks/common/useCadToggles';
import { wallToolBridgeStore } from '../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
import { RadialCommandRing } from '../../systems/dynamic-input/components/RadialCommandRing';
import { WALL_RING_CONFIG } from '../../systems/dynamic-input/wall-ring-config';
import { ringStartKey } from '../../systems/dynamic-input/ring-config';
import type { SceneUnits } from '../../utils/scene-units';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

export interface DynamicInput3DLeafProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function DynamicInput3DLeaf({ managerRef }: DynamicInput3DLeafProps) {
  const { dynInput } = useCadToggles();
  // Reuse the SSoT tool-state hook + the SSoT wall-awaitingEnd gate (shared with DynamicInputSubscriber).
  const { activeTool } = useToolState();
  const wallPreview = useWallPreview();

  if (!dynInput.on || !isWallAwaitingEnd(activeTool, wallPreview)) return null;

  const sceneUnits: SceneUnits = wallToolBridgeStore.get()?.getSceneUnits() ?? 'mm';
  return (
    <RadialCommandRing
      config={WALL_RING_CONFIG}
      startKey={ringStartKey(wallPreview.startPoint)}
      sceneUnits={sceneUnits}
      getCanvasEl={() => managerRef.current?.getRendererCanvas() ?? null}
    />
  );
}
