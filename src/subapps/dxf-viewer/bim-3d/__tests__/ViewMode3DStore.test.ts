import { useViewMode3DStore } from '../stores/ViewMode3DStore';

// Reset store before each test
beforeEach(() => {
  useViewMode3DStore.setState({
    mode: '2d',
    isTransitioning: false,
    visibleFloors: new Set(),
    showAllFloors: false,
  });
});

describe('toggle2D3D', () => {
  it('switches 2d → 3d-raster', () => {
    useViewMode3DStore.getState().toggle2D3D();
    expect(useViewMode3DStore.getState().mode).toBe('3d-raster');
  });

  it('switches 3d-raster → 2d', () => {
    useViewMode3DStore.setState({ mode: '3d-raster' });
    useViewMode3DStore.getState().toggle2D3D();
    expect(useViewMode3DStore.getState().mode).toBe('2d');
  });

  it('isTransitioning stays false after toggle', () => {
    useViewMode3DStore.getState().toggle2D3D();
    expect(useViewMode3DStore.getState().isTransitioning).toBe(false);
  });
});

describe('enterPreviewMode', () => {
  it('transitions raster → preview', () => {
    useViewMode3DStore.setState({ mode: '3d-raster' });
    useViewMode3DStore.getState().enterPreviewMode();
    expect(useViewMode3DStore.getState().mode).toBe('3d-preview');
  });

  it('does nothing when in 2d mode', () => {
    useViewMode3DStore.getState().enterPreviewMode();
    expect(useViewMode3DStore.getState().mode).toBe('2d');
  });
});

describe('enterFinalMode', () => {
  it('transitions preview → final', () => {
    useViewMode3DStore.setState({ mode: '3d-preview' });
    useViewMode3DStore.getState().enterFinalMode();
    expect(useViewMode3DStore.getState().mode).toBe('3d-final');
  });

  it('transitions raster → final (direct render)', () => {
    useViewMode3DStore.setState({ mode: '3d-raster' });
    useViewMode3DStore.getState().enterFinalMode();
    expect(useViewMode3DStore.getState().mode).toBe('3d-final');
  });

  it('does nothing when in 2d mode', () => {
    useViewMode3DStore.getState().enterFinalMode();
    expect(useViewMode3DStore.getState().mode).toBe('2d');
  });
});

describe('floor visibility (Q2)', () => {
  it('setActiveFloor seeds visibleFloors', () => {
    useViewMode3DStore.getState().setActiveFloor('floor-1');
    expect(useViewMode3DStore.getState().visibleFloors.has('floor-1')).toBe(true);
  });

  it('toggleShowAllFloors flips flag', () => {
    useViewMode3DStore.getState().toggleShowAllFloors();
    expect(useViewMode3DStore.getState().showAllFloors).toBe(true);
    useViewMode3DStore.getState().toggleShowAllFloors();
    expect(useViewMode3DStore.getState().showAllFloors).toBe(false);
  });
});

describe('selectors', () => {
  it('selectIs3D returns false when mode is 2d', () => {
    const { selectIs3D } = require('../stores/ViewMode3DStore');
    expect(selectIs3D(useViewMode3DStore.getState())).toBe(false);
  });

  it('selectIs3D returns true when mode is 3d-raster', () => {
    const { selectIs3D } = require('../stores/ViewMode3DStore');
    useViewMode3DStore.setState({ mode: '3d-raster' });
    expect(selectIs3D(useViewMode3DStore.getState())).toBe(true);
  });
});
