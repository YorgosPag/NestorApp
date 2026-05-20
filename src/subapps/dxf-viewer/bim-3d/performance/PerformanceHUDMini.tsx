'use client';

/**
 * PerformanceHUDMini — ADR-366 §B.5
 * 1-line pill summary. Pure presentational — no store access. Props only.
 */

import { useTranslation } from 'react-i18next';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';
import type { Bim3dRenderMode } from './per-mode-promotion';
import { getMetricTier } from './performance-thresholds';

const RENDER_MODE_KEY: Record<Bim3dRenderMode, string> = {
  '3d-raster':  'raster',
  '3d-preview': 'preview',
  '3d-final':   'final',
};

const TIER_DOT: Record<string, string> = {
  good:     '🟢',
  warn:     '🟡',
  critical: '🔴',
};

interface PerformanceHUDMiniProps {
  metrics: PerformanceMetricsSnapshot | null;
  renderMode: Bim3dRenderMode;
  onExpand: () => void;
}

export function PerformanceHUDMini({ metrics, renderMode, onExpand }: PerformanceHUDMiniProps) {
  const { t } = useTranslation('bim3d');

  const modeLabel = t(`performance.mode.${RENDER_MODE_KEY[renderMode]}`);
  const fps       = metrics?.fps ?? null;
  const tier      = fps !== null ? getMetricTier('fps', fps) : 'good';
  const dot       = TIER_DOT[tier];

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/80 backdrop-blur border border-border text-xs font-mono">
      <span>{modeLabel}</span>
      <span>|</span>
      <span>{fps !== null ? fps : '—'} FPS</span>
      <span>{dot}</span>
      <button
        onClick={onExpand}
        aria-label={t('performance.expand')}
        className="ml-1 hover:text-foreground text-muted-foreground"
      >
        ∨
      </button>
    </div>
  );
}
