/**
 * ADR-535 Φ6 — grip-3d-twin-overlay: per-surface config builder for the twin (top + bottom)
 * reshape-grip overlay.
 *
 * Locks the twin rules: a top pass (offset 0) and a bottom pass (offset N) over the same N
 * plan grips; the hovered flat index warms only its surface; the dragged vertex moves BOTH of
 * its faces to the live position; occlusion drops squares EXCEPT the exact dragged one.
 */

import type { GripInfo } from '../../../hooks/grip-types';
import { buildTwinSurfaceConfigs, type TwinOverlayInteraction } from '../grip-3d-twin-overlay';

/** Two footprint grips (plan positions double as the test's projected points elsewhere). */
const GRIPS = [
  { position: { x: 0, y: 0 }, type: 'vertex' },
  { position: { x: 10, y: 0 }, type: 'vertex' },
] as unknown as GripInfo[];
const N = GRIPS.length;

const IDLE: TwinOverlayInteraction = {
  hoverIndex: null,
  dragIndex: null,
  dragLivePlanPos: null,
  visibility: null,
};

describe('buildTwinSurfaceConfigs', () => {
  it('draws every grip cold on both passes when idle', () => {
    const top = buildTwinSurfaceConfigs(GRIPS, 0, IDLE);
    const bottom = buildTwinSurfaceConfigs(GRIPS, N, IDLE);
    expect(top).toHaveLength(N);
    expect(bottom).toHaveLength(N);
    expect(top.every((c) => c.temperature === 'cold')).toBe(true);
    expect(top.every((c) => c.shape === 'square')).toBe(true);
  });

  it('render-type: resize edge grips → vertex (μπλε), insert midpoints stay (ADR-535, Giorgio 2026-06-27)', () => {
    // beam width / length-edge = type 'edge' → στο 3D ζωγραφίζονταν ΠΡΑΣΙΝΑ (GripColorManager cold
    // edge → green) ενώ στο 2D + κολόνες μπλε. Normalize 'edge'→'vertex' (square μπλε). Τα insert
    // 'midpoint' (slab/roof) ΔΕΝ είναι resize → μένουν ως έχουν.
    const mixed = [
      { position: { x: 0, y: 0 }, type: 'vertex' },   // corner
      { position: { x: 5, y: 0 }, type: 'edge' },      // beam width / length resize
      { position: { x: 8, y: 0 }, type: 'midpoint' },  // slab insert-vertex
    ] as unknown as GripInfo[];
    const top = buildTwinSurfaceConfigs(mixed, 0, IDLE);
    expect(top[0].type).toBe('vertex');
    expect(top[1].type).toBe('vertex'); // 'edge' → 'vertex' (μπλε, όχι πράσινο)
    expect(top[2].type).toBe('midpoint'); // insert grip αμετάβλητο
    expect(top.every((c) => c.shape === 'square')).toBe(true);
  });

  it('warms ONLY the hovered surface (flat index)', () => {
    // Hover the bottom face of grip 1 → flat N+1.
    const hover: TwinOverlayInteraction = { ...IDLE, hoverIndex: N + 1 };
    const top = buildTwinSurfaceConfigs(GRIPS, 0, hover);
    const bottom = buildTwinSurfaceConfigs(GRIPS, N, hover);
    expect(top.every((c) => c.temperature === 'cold')).toBe(true); // top untouched
    expect(bottom[1].temperature).toBe('warm');
    expect(bottom[0].temperature).toBe('cold');
  });

  it('moves BOTH faces of the dragged vertex to the live position, both hot', () => {
    // Drag the bottom face of grip 0 (flat N) → both top[0] and bottom[0] ride the live pos.
    const live = { x: 5, y: 5 };
    const drag: TwinOverlayInteraction = { ...IDLE, dragIndex: N, dragLivePlanPos: live };
    const top = buildTwinSurfaceConfigs(GRIPS, 0, drag);
    const bottom = buildTwinSurfaceConfigs(GRIPS, N, drag);
    expect(top[0].position).toEqual(live);
    expect(bottom[0].position).toEqual(live);
    expect(top[0].temperature).toBe('hot');
    expect(bottom[0].temperature).toBe('hot');
    // The other vertex stays put.
    expect(top[1].position).toEqual(GRIPS[1].position);
  });

  it('culls occluded squares but never the exact dragged square', () => {
    // visibility (length 2N): top0 hidden, bottom0 hidden, rest visible. Drag bottom0 (flat N).
    const visibility = [false, true, false, true]; // [top0, top1, bottom0, bottom1]
    const drag: TwinOverlayInteraction = {
      ...IDLE,
      dragIndex: N, // bottom0
      dragLivePlanPos: { x: 1, y: 1 },
      visibility,
    };
    const top = buildTwinSurfaceConfigs(GRIPS, 0, drag);
    const bottom = buildTwinSurfaceConfigs(GRIPS, N, drag);
    // top0 occluded → dropped (it is the twin of the dragged square, not the dragged one itself).
    expect(top).toHaveLength(1);
    expect(top[0].position).toEqual(GRIPS[1].position);
    // bottom0 is the dragged square → force-shown despite visibility=false; bottom1 visible.
    expect(bottom).toHaveLength(N);
    expect(bottom[0].temperature).toBe('hot');
  });
});
