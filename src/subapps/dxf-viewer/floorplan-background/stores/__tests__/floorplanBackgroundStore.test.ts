import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../providers/provider-registry', () => ({
  getProvider: vi.fn(),
}));

import { useFloorplanBackgroundStore } from '../floorplanBackgroundStore';
import { getProvider } from '../../providers/provider-registry';
import type { IFloorplanBackgroundProvider } from '../../providers/IFloorplanBackgroundProvider';
import type { NaturalBounds, ProviderLoadResult } from '../../providers/types';

const MOCK_BOUNDS: NaturalBounds = { width: 800, height: 600 };
const DEMO_FLOOR = 'floor-test-1';
const PNG_FILE = () => new File([], 'test.png', { type: 'image/png' });

function makeMockProvider(): IFloorplanBackgroundProvider {
  return {
    id: 'image',
    capabilities: { multiPage: false, exifAware: true, vectorEquivalent: false, calibratable: true },
    supportedMimeTypes: ['image/png'],
    loadAsync: vi.fn().mockResolvedValue({
      success: true,
      bounds: MOCK_BOUNDS,
      metadata: { imageOrientation: 1 },
    } satisfies ProviderLoadResult),
    render: vi.fn(),
    getNaturalBounds: vi.fn().mockReturnValue(MOCK_BOUNDS),
    dispose: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useFloorplanBackgroundStore.setState({
    floors: {},
    activeFloorId: null,
    pendingReplaceRequest: null,
  });
});

describe('floorplanBackgroundStore', () => {
  it('addBackground → floor state populated with correct bounds', async () => {
    const provider = makeMockProvider();
    vi.mocked(getProvider).mockReturnValue(provider);

    await useFloorplanBackgroundStore.getState().addBackground(
      DEMO_FLOOR,
      { kind: 'file', file: PNG_FILE() },
      'image',
    );

    const slot = useFloorplanBackgroundStore.getState().floors[DEMO_FLOOR];
    expect(slot).toBeDefined();
    expect(slot.background).not.toBeNull();
    expect(slot.background?.naturalBounds).toEqual(MOCK_BOUNDS);
    expect(slot.background?.providerId).toBe('image');
    expect(slot.isLoading).toBe(false);
    expect(slot.error).toBeNull();
  });

  it('addBackground second time same floor → pendingReplaceRequest set, background not overwritten', async () => {
    const provider = makeMockProvider();
    vi.mocked(getProvider).mockReturnValue(provider);

    await useFloorplanBackgroundStore.getState().addBackground(
      DEMO_FLOOR,
      { kind: 'file', file: PNG_FILE() },
      'image',
    );

    const originalId = useFloorplanBackgroundStore.getState().floors[DEMO_FLOOR].background?.id;
    expect(originalId).toBeDefined();

    await useFloorplanBackgroundStore.getState().addBackground(
      DEMO_FLOOR,
      { kind: 'file', file: new File([], 'second.png', { type: 'image/png' }) },
      'image',
    );

    const state = useFloorplanBackgroundStore.getState();
    expect(state.pendingReplaceRequest).not.toBeNull();
    expect(state.pendingReplaceRequest?.floorId).toBe(DEMO_FLOOR);
    expect(state.floors[DEMO_FLOOR].background?.id).toBe(originalId);
  });

  it('removeBackground → slot deleted and provider disposed', async () => {
    const provider = makeMockProvider();
    vi.mocked(getProvider).mockReturnValue(provider);

    await useFloorplanBackgroundStore.getState().addBackground(
      DEMO_FLOOR,
      { kind: 'file', file: PNG_FILE() },
      'image',
    );

    expect(useFloorplanBackgroundStore.getState().floors[DEMO_FLOOR]).toBeDefined();

    await useFloorplanBackgroundStore.getState().removeBackground(DEMO_FLOOR);

    expect(useFloorplanBackgroundStore.getState().floors[DEMO_FLOOR]).toBeUndefined();
    expect(vi.mocked(provider.dispose)).toHaveBeenCalledOnce();
  });

  it('setTransform → transform fields updated, others unchanged', async () => {
    const provider = makeMockProvider();
    vi.mocked(getProvider).mockReturnValue(provider);

    await useFloorplanBackgroundStore.getState().addBackground(
      DEMO_FLOOR,
      { kind: 'file', file: PNG_FILE() },
      'image',
    );

    useFloorplanBackgroundStore.getState().setTransform(DEMO_FLOOR, {
      translateX: 150,
      scaleX: 2.5,
    });

    const bg = useFloorplanBackgroundStore.getState().floors[DEMO_FLOOR].background;
    expect(bg?.transform.translateX).toBe(150);
    expect(bg?.transform.scaleX).toBe(2.5);
    expect(bg?.transform.translateY).toBe(0);  // unchanged default
    expect(bg?.transform.scaleY).toBe(1);      // unchanged default
    expect(bg?.transform.rotation).toBe(0);    // unchanged default
  });
});
