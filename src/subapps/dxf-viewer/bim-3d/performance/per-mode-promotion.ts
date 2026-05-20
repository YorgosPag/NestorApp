/**
 * per-mode-promotion — ADR-366 §B.5.Q4
 *
 * Per-mode metric emphasis for the Performance HUD expanded view.
 * Different render modes promote different metrics to bold / greyed.
 *
 * No React, no side effects.
 */

export type MetricEmphasis = 'bold' | 'normal' | 'greyed';

export type Bim3dRenderMode = '3d-raster' | '3d-preview' | '3d-final';

/** Maps Tailwind class per emphasis level. */
export const EMPHASIS_CLASS: Record<MetricEmphasis, string> = {
  bold:   'font-semibold',
  normal: '',
  greyed: 'text-muted-foreground opacity-50',
};

const EMPHASIS_MAP: Record<Bim3dRenderMode, Partial<Record<string, MetricEmphasis>>> = {
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

export function getEmphasis(metric: string, mode: Bim3dRenderMode): MetricEmphasis {
  return EMPHASIS_MAP[mode][metric] ?? 'normal';
}
