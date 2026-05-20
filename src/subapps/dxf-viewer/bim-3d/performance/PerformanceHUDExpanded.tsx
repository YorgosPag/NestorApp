'use client';

/**
 * PerformanceHUDExpanded — ADR-366 §B.5
 * Full 10-metric panel. Pure presentational — no store access. Props only.
 */

import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';
import type { Bim3dRenderMode } from './per-mode-promotion';
import { getEmphasis, EMPHASIS_CLASS } from './per-mode-promotion';
import { getMetricTier, TIER_TEXT_CLASS } from './performance-thresholds';
import { formatBytes, formatCount, formatMs } from './metric-formatters';

const RENDER_MODE_KEY: Record<Bim3dRenderMode, string> = {
  '3d-raster':  'raster',
  '3d-preview': 'preview',
  '3d-final':   'final',
};

interface PerformanceHUDExpandedProps {
  metrics: PerformanceMetricsSnapshot | null;
  renderMode: Bim3dRenderMode;
  onCollapse: () => void;
  onCopyStats: () => void;
  onDownload: () => void;
  onSendToSupport: () => void;
}

interface MetricRow {
  key: string;
  label: string;
  format: (m: PerformanceMetricsSnapshot) => string;
  tier: (m: PerformanceMetricsSnapshot) => 'good' | 'warn' | 'critical';
}

function buildRows(t: (k: string) => string): MetricRow[] {
  return [
    {
      key: 'fps',
      label: t('performance.metric.fps'),
      format: (m) => `${formatCount(m.fps)} FPS`,
      tier:   (m) => getMetricTier('fps', m.fps),
    },
    {
      key: 'frameTimeMs',
      label: t('performance.metric.frameTime'),
      format: (m) => formatMs(m.frameTimeMs),
      tier:   (m) => getMetricTier('frameTimeMs', m.frameTimeMs),
    },
    {
      key: 'triangles',
      label: t('performance.metric.triangles'),
      format: (m) => formatCount(m.triangles),
      tier:   (m) => getMetricTier('triangles', m.triangles),
    },
    {
      key: 'vertices',
      label: t('performance.metric.vertices'),
      format: (m) => formatCount(m.vertices),
      tier:   () => 'good',
    },
    {
      key: 'drawCalls',
      label: t('performance.metric.drawCalls'),
      format: (m) => formatCount(m.drawCalls),
      tier:   (m) => getMetricTier('drawCalls', m.drawCalls),
    },
    {
      key: 'objectsVisible',
      label: t('performance.metric.objectsVisible'),
      format: (m) => formatCount(m.objectsVisible),
      tier:   () => 'good',
    },
    {
      key: 'gpuMemoryMb',
      label: t('performance.metric.gpuMemory'),
      format: (m) => formatBytes(m.gpuMemoryMb),
      tier:   () => 'good',
    },
    {
      key: 'cpuMemoryMb',
      label: t('performance.metric.cpuMemory'),
      format: (m) => m.cpuMemoryMb !== null ? formatBytes(m.cpuMemoryMb) : t('performance.notFound'),
      tier:   () => 'good',
    },
    {
      key: 'samplesPerSec',
      label: t('performance.metric.samplesPerSec'),
      format: (m) => m.samplesPerSec !== null ? formatCount(m.samplesPerSec) : t('performance.notFound'),
      tier:   () => 'good',
    },
    {
      key: 'objectsTotal',
      label: t('performance.metric.objectsTotal'),
      format: (m) => formatCount(m.objectsTotal),
      tier:   () => 'good',
    },
  ];
}

export function PerformanceHUDExpanded({
  metrics,
  renderMode,
  onCollapse,
  onCopyStats,
  onDownload,
  onSendToSupport,
}: PerformanceHUDExpandedProps) {
  const { t } = useTranslation('bim3d');
  const rows = buildRows(t);
  const modeLabel = t(`performance.mode.${RENDER_MODE_KEY[renderMode]}`);

  return (
    <div className="flex flex-col gap-0.5 p-2 rounded bg-background/90 backdrop-blur border border-border text-xs font-mono min-w-[180px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted-foreground font-medium">{modeLabel}</span>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t('performance.menu.aria')}
                className="hover:text-foreground text-muted-foreground px-1"
              >
                ⋮
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onSelect={onCopyStats}>
                {t('performance.menu.copyStats')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDownload}>
                {t('performance.menu.download')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSendToSupport}>
                {t('performance.menu.sendToSupport')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={onCollapse}
            aria-label={t('performance.collapse')}
            className="hover:text-foreground text-muted-foreground"
          >
            ∧
          </button>
        </div>
      </div>

      {rows.map((row) => {
        const emphasisClass = EMPHASIS_CLASS[getEmphasis(row.key, renderMode)];
        const value         = metrics ? row.format(metrics) : '—';
        const tierClass     = metrics ? TIER_TEXT_CLASS[row.tier(metrics)] : '';

        return (
          <div
            key={row.key}
            className={cn('flex justify-between gap-3', emphasisClass)}
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className={tierClass}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}
