/**
 * ADR-547 regression guard — SnapSceneSyncLeaf feeds the LIVE scene (not the stale orchestrator prop)
 * into useGlobalSnapSceneSync, so in-session commits re-init the snap engine without a hard reload.
 * ADR-641 Φ4 — that live scene is now the EFFECTIVE scene (`useEffectiveLevelScene`): inside a Block
 * Editor session it is the block-local scene, so the snap engine indexes only the block's members.
 */
import { render } from '@testing-library/react';
import type { SceneModel } from '../../../types/scene';

// Mock the delegated hooks — the leaf is pure wiring, so we assert the exact
// scene/overlays argument it forwards.
const snapSyncSpy = jest.fn();
jest.mock('../../../snapping/hooks/useGlobalSnapSceneSync', () => ({
  useGlobalSnapSceneSync: (args: unknown) => snapSyncSpy(args),
}));

let mockLiveScene: SceneModel | null = null;
jest.mock('../../../systems/block/useEffectiveLevelScene', () => ({
  useEffectiveLevelScene: () => mockLiveScene,
}));

const mockOverlays = [{ id: 'ov1' }];
jest.mock('../../../hooks/useLiveOverlaysForLevel', () => ({
  useLiveOverlaysForLevel: () => mockOverlays,
}));

import { SnapSceneSyncLeaf } from '../SnapSceneSyncLeaf';

const sceneOf = (id: string): SceneModel =>
  ({ entities: [{ id }], layersById: {}, bounds: null } as unknown as SceneModel);

describe('SnapSceneSyncLeaf — snap-scene-sync source (ADR-547 fix)', () => {
  beforeEach(() => {
    snapSyncSpy.mockClear();
    mockLiveScene = null;
  });

  it('renders null (invisible side-effect leaf, orchestrator stays inert)', () => {
    const { container } = render(<SnapSceneSyncLeaf levelId="L1" fallbackScene={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('feeds the LIVE SceneStore scene when the level is hydrated (in-session commit)', () => {
    mockLiveScene = sceneOf('live-wall');
    const fallback = sceneOf('stale-prop');
    render(<SnapSceneSyncLeaf levelId="L1" fallbackScene={fallback} />);
    expect(snapSyncSpy).toHaveBeenCalledWith({ scene: mockLiveScene, overlays: mockOverlays });
  });

  it('falls back to the prop scene before the store hydrates (first paint / reload)', () => {
    mockLiveScene = null;
    const fallback = sceneOf('loaded-from-persistence');
    render(<SnapSceneSyncLeaf levelId="L1" fallbackScene={fallback} />);
    expect(snapSyncSpy).toHaveBeenCalledWith({ scene: fallback, overlays: mockOverlays });
  });
});
