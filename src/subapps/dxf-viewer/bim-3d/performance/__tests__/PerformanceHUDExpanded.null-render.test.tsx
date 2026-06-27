/**
 * PerformanceHUDExpanded — ADR-366 §B.5.U null-rendering.
 *
 * In 2D the WebGL-only metrics are null → rendered as the notFound dash.
 * In 3D every metric is a real number → formatted normally.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => (k === 'performance.notFound' ? '—' : k),
  }),
}));

import { render, screen } from '@testing-library/react';
import { PerformanceHUDExpanded } from '../PerformanceHUDExpanded';
import type { PerformanceMetricsSnapshot } from '../PerformanceHUDStore';

const noop = () => {};

function snapshot(overrides: Partial<PerformanceMetricsSnapshot>): PerformanceMetricsSnapshot {
  return {
    fps: 60,
    frameTimeMs: 16.7,
    triangles: null,
    vertices: null,
    drawCalls: null,
    objectsVisible: null,
    objectsTotal: null,
    gpuMemoryMb: null,
    cpuMemoryMb: 100,
    samplesPerSec: null,
    ...overrides,
  };
}

describe('PerformanceHUDExpanded null-rendering', () => {
  it('2D snapshot → real fps, WebGL metrics shown as the notFound dash', () => {
    render(
      <PerformanceHUDExpanded
        metrics={snapshot({})}
        renderMode="2d"
        historyEnabled={false}
        onCollapse={noop}
        onCopyStats={noop}
        onDownload={noop}
        onSendToSupport={noop}
      />,
    );

    // fps is real.
    expect(screen.getByText('60 FPS')).toBeInTheDocument();
    // triangles/vertices/drawCalls/objectsVisible/objectsTotal/gpuMemory/samplesPerSec → '—' (7 rows).
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(7);
  });

  it('3D snapshot → WebGL metrics formatted (no dash)', () => {
    render(
      <PerformanceHUDExpanded
        metrics={snapshot({ triangles: 1000, vertices: 3000, drawCalls: 500, objectsVisible: 12, objectsTotal: 8, gpuMemoryMb: 128 })}
        renderMode="3d-raster"
        historyEnabled={false}
        onCollapse={noop}
        onCopyStats={noop}
        onDownload={noop}
        onSendToSupport={noop}
      />,
    );

    expect(screen.getByText('1K')).toBeInTheDocument();   // triangles
    expect(screen.getByText('128 MB')).toBeInTheDocument(); // gpu memory
    // samplesPerSec is still null in raster → at least one dash.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
