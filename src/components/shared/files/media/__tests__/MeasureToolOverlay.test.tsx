import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import path from 'path';
import fs from 'fs';

// Mock before importing component
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockComputeFitTransform = jest.fn(() => ({ scale: 1, offsetX: 0, offsetY: 0 }));
const mockScreenToWorld = jest.fn((sx: number, sy: number) => ({ x: sx, y: sy }));
const mockDrawMeasurement = jest.fn();
const mockRectBoundsToScene = jest.fn((w: number, h: number) => ({ min: { x: 0, y: 0 }, max: { x: w, y: h } }));

jest.mock('@/components/shared/files/media/overlay-renderer', () => ({
  computeFitTransform: (...args: unknown[]) => mockComputeFitTransform(...args),
  screenToWorld: (...args: unknown[]) => mockScreenToWorld(...args),
  drawMeasurement: (...args: unknown[]) => mockDrawMeasurement(...args),
  rectBoundsToScene: (...args: unknown[]) => mockRectBoundsToScene(...args),
}));

import { MeasureToolOverlay } from '../MeasureToolOverlay';

const defaultProps = {
  mode: null,
  sceneBounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
  zoom: 1,
  panOffset: { x: 0, y: 0 },
} as const;

describe('MeasureToolOverlay — bundle isolation', () => {
  it('has no Firestore writes — no createFloorplanOverlay import', () => {
    const srcPath = path.resolve(__dirname, '../MeasureToolOverlay.tsx');
    const src = fs.readFileSync(srcPath, 'utf-8');
    expect(src).not.toContain('createFloorplanOverlay');
  });

  it('has no imports from dxf-viewer subapp', () => {
    const srcPath = path.resolve(__dirname, '../MeasureToolOverlay.tsx');
    const src = fs.readFileSync(srcPath, 'utf-8');
    expect(src).not.toContain("from '@/subapps/dxf-viewer");
    expect(src).not.toContain("from 'src/subapps/dxf-viewer");
  });
});

describe('MeasureToolOverlay — rendering', () => {
  it('returns null when mode is null', () => {
    const { container } = render(<MeasureToolOverlay {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders canvas with aria-label when mode is set', () => {
    const { container } = render(<MeasureToolOverlay {...defaultProps} mode="distance" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-label')).toBe('floorplan.measure.toolbar');
  });

  it('removes canvas when mode switches back to null', () => {
    const { container, rerender } = render(<MeasureToolOverlay {...defaultProps} mode="distance" />);
    expect(container.querySelector('canvas')).not.toBeNull();
    rerender(<MeasureToolOverlay {...defaultProps} mode={null} />);
    expect(container.querySelector('canvas')).toBeNull();
  });
});

describe('MeasureToolOverlay — ESC key', () => {
  it('registers and cleans up keydown listener on mode change', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = render(<MeasureToolOverlay {...defaultProps} mode="distance" />);
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('fires ESC without error when mode is active', () => {
    render(<MeasureToolOverlay {...defaultProps} mode="area" />);
    expect(() => {
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
    }).not.toThrow();
  });
});
