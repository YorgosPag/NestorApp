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
import type { HudRenderMode } from './hud-render-mode';
import { getEmphasis, EMPHASIS_CLASS } from './per-mode-promotion';
import { getMetricTier, TIER_TEXT_CLASS, type MetricTier } from './performance-thresholds';
import { formatBytes, formatCount, formatMs } from './metric-formatters';
import { PerformanceHUDSparklines } from './PerformanceHUDSparklines';
import { SPARKLINE_METRICS, type SparklineMetric } from './PerformanceHistoryStore';

const SPARKLINE_METRIC_SET: ReadonlySet<string> = new Set(SPARKLINE_METRICS);

const RENDER_MODE_KEY: Record<HudRenderMode, string> = {
  '2d':         '2d',
  '3d-raster':  'raster',
  '3d-preview': 'preview',
  '3d-final':   'final',
};

interface PerformanceHUDExpandedProps {
  metrics: PerformanceMetricsSnapshot | null;
  renderMode: HudRenderMode;
  historyEnabled: boolean;
  onCollapse: () => void;
  onCopyStats: () => void;
  onDownload: () => void;
  onSendToSupport: () => void;
}

interface MetricRow {
  key: string;
  label: string;
  format: (m: PerformanceMetricsSnapshot) => string;
  tier: (m: PerformanceMetricsSnapshot) => MetricTier;
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
      format: (m) => m.triangles !== null ? formatCount(m.triangles) : t('performance.notFound'),
      tier:   (m) => m.triangles !== null ? getMetricTier('triangles', m.triangles) : 'good',
    },
    {
      key: 'vertices',
      label: t('performance.metric.vertices'),
      format: (m) => m.vertices !== null ? formatCount(m.vertices) : t('performance.notFound'),
      tier:   () => 'good',
    },
    {
      key: 'drawCalls',
      label: t('performance.metric.drawCalls'),
      format: (m) => m.drawCalls !== null ? formatCount(m.drawCalls) : t('performance.notFound'),
      tier:   (m) => m.drawCalls !== null ? getMetricTier('drawCalls', m.drawCalls) : 'good',
    },
    {
      key: 'objectsVisible',
      label: t('performance.metric.objectsVisible'),
      format: (m) => m.objectsVisible !== null ? formatCount(m.objectsVisible) : t('performance.notFound'),
      tier:   () => 'good',
    },
    {
      key: 'gpuMemoryMb',
      label: t('performance.metric.gpuMemory'),
      format: (m) => m.gpuMemoryMb !== null ? formatBytes(m.gpuMemoryMb) : t('performance.notFound'),
      tier:   () => 'good',
    },
    {
      key: 'cpuMemoryMb',
      label: t('performance.metric.cpuMemory'),
      format: (m) => m.cpuMemoryMb !== null ? formatBytes(m.cpuMemoryMb) : t('performance.notFound'),
      tier:   (m) => m.cpuMemoryMb !== null ? getMetricTier('cpuMemoryMb', m.cpuMemoryMb) : 'good',
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
      format: (m) => m.objectsTotal !== null ? formatCount(m.objectsTotal) : t('performance.notFound'),
      tier:   () => 'good',
    },
  ];
}

export function PerformanceHUDExpanded({
  metrics,
  renderMode,
  historyEnabled,
  onCollapse,
  onCopyStats,
  onDownload,
  onSendToSupport,
}: PerformanceHUDExpandedProps) {
  const { t } = useTranslation('bim3d');
  const rows = buildRows(t);
  const modeLabel = t(`performance.mode.${RENDER_MODE_KEY[renderMode]}`);

  const minWidthClass = historyEnabled ? 'min-w-[230px]' : 'min-w-[180px]';

  return (
    <div className={cn(
      'flex flex-col gap-0.5 p-2 rounded bg-background/90 backdrop-blur border border-border text-xs font-mono',
      minWidthClass,
    )}>
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
        const tier          = metrics ? row.tier(metrics) : 'good';
        const tierClass     = metrics ? TIER_TEXT_CLASS[tier] : '';
        const showSparkline = historyEnabled && SPARKLINE_METRIC_SET.has(row.key);

        return (
          <div
            key={row.key}
            className={cn('flex items-center justify-between gap-3', emphasisClass)}
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="flex items-center gap-2">
              {showSparkline && (
                <PerformanceHUDSparklines
                  metricKey={row.key as SparklineMetric}
                  tier={tier}
                  ariaLabel={t('performance.history.sparklineAria', { metric: row.label, value })}
                />
              )}
              <span className={tierClass}>{value}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
