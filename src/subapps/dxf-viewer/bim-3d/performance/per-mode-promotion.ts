/**
 * per-mode-promotion — ADR-366 §B.5.Q4
 *
 * Per-mode metric emphasis for the Performance HUD expanded view.
 * Different render modes promote different metrics to bold / greyed.
 *
 * No React, no side effects.
 */

import type { HudRenderMode } from './hud-render-mode';

export type MetricEmphasis = 'bold' | 'normal' | 'greyed';

/** Maps Tailwind class per emphasis level. */
export const EMPHASIS_CLASS: Record<MetricEmphasis, string> = {
  bold:   'font-semibold',
  normal: '',
  greyed: 'text-muted-foreground opacity-50',
};

const EMPHASIS_MAP: Record<HudRenderMode, Partial<Record<string, MetricEmphasis>>> = {
  // 2D Canvas2D viewport — only fps/frameTime/cpuMemory are real; WebGL-only
  // metrics are greyed (the 2D collector reports them as null).
  '2d': {
    fps:           'bold',
    frameTimeMs:   'bold',
    cpuMemoryMb:   'normal',
    triangles:     'greyed',
    vertices:      'greyed',
    drawCalls:     'greyed',
    objectsVisible:'greyed',
    objectsTotal:  'greyed',
    gpuMemoryMb:   'greyed',
    samplesPerSec: 'greyed',
  },
  '3d-raster': {
    fps:          'bold',
    frameTimeMs:  'bold',
    samplesPerSec: 'greyed',
  },
  '3d-preview': {
    samplesPerSec: 'bold',
    fps:           'normal',
    frameTimeMs:   'greyed',
  },
  '3d-final': {
    samplesPerSec: 'bold',
    fps:           'greyed',
    frameTimeMs:   'greyed',
  },
};

export function getEmphasis(metric: string, mode: HudRenderMode): MetricEmphasis {
  return EMPHASIS_MAP[mode][metric] ?? 'normal';
}
