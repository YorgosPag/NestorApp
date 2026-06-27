/**
 * ADR-537 — WallPlacementGhost post-FX overlay registration.
 *
 * The wall-drawing ghost is translucent: in the MAIN scene at idle the SSAO composer + warm
 * lighting tinted it "mustard". The fix (mirror of the underlay + edit gizmo) is to register it as
 * a post-FX overlay drawn AFTER SSAO, keeping the mesh root `visible=false` so the main render skips
 * it and the dedicated pass flips it on. This suite verifies the registration contract:
 *   • construction registers a provider (no mesh yet → nothing shown),
 *   • after `update`, the provider exposes the mesh ONLY while `setVisible(true)`,
 *   • the mesh root stays `visible=false` (main render must keep skipping it),
 *   • `dispose` unregisters (provider gone from the scene registry).
 *
 * The heavy converter + preview SSoT are mocked to a deterministic fake mesh — the focus is the
 * overlay wiring, not the wall geometry (covered elsewhere).
 */

import * as THREE from 'three';
import { collectPostFxOverlayRoots } from '../../scene/post-fx-overlay-pass';

const fakeMesh = new THREE.Group();
fakeMesh.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));

jest.mock('../../converters/BimToThreeConverter', () => ({
  wallToMesh: jest.fn(() => fakeMesh),
}));
jest.mock('../../../hooks/drawing/wall-preview-helpers', () => ({
  generateWallPreview: jest.fn(() => ({ type: 'wall', wallHud: null })),
}));
jest.mock('../../../bim/walls/wall-preview-store', () => ({
  wallPreviewStore: { get: () => ({ startPoint: { x: 0, y: 0 } }) },
}));

import { WallPlacementGhost } from '../WallPlacementGhost';

describe('WallPlacementGhost — post-FX overlay registration', () => {
  it('registers a provider that exposes the mesh only while shown, root kept invisible', () => {
    const scene = new THREE.Scene();
    const ghost = new WallPlacementGhost(scene);

    // No mesh built yet → provider yields nothing even though registered.
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);

    ghost.update({ x: 1000, y: 2000 }, 0, 'L1', 'mm');
    // Built but not shown yet.
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);

    ghost.setVisible(true);
    const shown = collectPostFxOverlayRoots(scene);
    expect(shown).toHaveLength(1);
    // Root stays visible=false so the MAIN render skips it (the pass flips it on transiently).
    expect(shown[0].visible).toBe(false);

    ghost.setVisible(false);
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
  });

  it('unregisters on dispose (provider removed from the scene registry)', () => {
    const scene = new THREE.Scene();
    const ghost = new WallPlacementGhost(scene);
    ghost.update({ x: 1, y: 1 }, 0, 'L1', 'mm');
    ghost.setVisible(true);
    expect(collectPostFxOverlayRoots(scene)).toHaveLength(1);

    ghost.dispose();
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
  });
});
