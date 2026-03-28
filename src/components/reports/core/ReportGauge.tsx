'use client';

/**
 * @module ReportGauge
 * @enterprise ADR-265 — Custom SVG arc gauge for CPI/SPI/targets
 *
 * Semi-circular gauge (180°) with color zones.
 * Default scale 0–2 (for EVM: CPI/SPI where 1.0 = on target).
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/intl-formatting';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GaugeZone = 'danger' | 'warning' | 'good' | 'excellent';

interface ZoneThresholds {
  danger: [number, number];
  warning: [number, number];
  good: [number, number];
  excellent: [number, number];
}

export interface ReportGaugeProps {
  /** Current value */
  value: number;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 2) */
  max?: number;
  /** Target reference value (default: 1.0) */
  target?: number;
  /** Label below the value */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show numeric value (default: true) */
  showValue?: boolean;
  /** Custom value formatter */
  formatValue?: (value: number) => string;
  /** Custom zone thresholds */
  zones?: ZoneThresholds;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ZONES: ZoneThresholds = {
  danger: [0, 0.85],
  warning: [0.85, 0.95],
  good: [0.95, 1.05],
  excellent: [1.05, 2],
};

const ZONE_COLORS: Record<GaugeZone, string> = {
  danger: 'hsl(var(--status-error))',
  warning: 'hsl(var(--status-warning))',
  good: 'hsl(var(--status-success))',
  excellent: 'hsl(var(--status-info))',
};

const SIZE_CONFIG = {
  sm: { width: 120, height: 70, strokeWidth: 8, fontSize: 'text-lg', labelSize: 'text-xs' },
  md: { width: 160, height: 90, strokeWidth: 10, fontSize: 'text-2xl', labelSize: 'text-sm' },
  lg: { width: 200, height: 115, strokeWidth: 12, fontSize: 'text-3xl', labelSize: 'text-base' },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getZone(value: number, zones: ZoneThresholds): GaugeZone {
  if (value < zones.warning[0]) return 'danger';
  if (value < zones.good[0]) return 'warning';
  if (value <= zones.good[1]) return 'good';
  return 'excellent';
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportGauge({
  value,
  min = 0,
  max = 2,
  target = 1.0,
  label,
  size = 'md',
  showValue = true,
  formatValue,
  zones = DEFAULT_ZONES,
  className,
}: ReportGaugeProps) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();
  const config = SIZE_CONFIG[size];

  const clampedValue = Math.max(min, Math.min(max, value));

  const { zone, needleAngle, zoneArcs } = useMemo(() => {
    const currentZone = getZone(clampedValue, zones);
    const ratio = (clampedValue - min) / (max - min);
    const angle = 180 - ratio * 180; // 180° = min, 0° = max

    const cx = config.width / 2;
    const cy = config.height - 5;
    const r = config.width / 2 - config.strokeWidth;

    const arcs = (['danger', 'warning', 'good', 'excellent'] as const).map((z) => {
      const [zMin, zMax] = zones[z];
      const startRatio = Math.max(0, (zMin - min) / (max - min));
      const endRatio = Math.min(1, (zMax - min) / (max - min));
      const startAngle = 180 - startRatio * 180;
      const endAngle = 180 - endRatio * 180;
      return { zone: z, path: describeArc(cx, cy, r, endAngle, startAngle) };
    });

    return { zone: currentZone, needleAngle: angle, zoneArcs: arcs };
  }, [clampedValue, min, max, zones, config]);

  const cx = config.width / 2;
  const cy = config.height - 5;
  const r = config.width / 2 - config.strokeWidth;
  const displayValue = formatValue ? formatValue(value) : formatNumber(value);

  return (
    <figure
      className={cn('flex flex-col items-center', className)}
      role="img"
      aria-label={`${label ?? t('gauge.value')}: ${displayValue}`}
    >
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
      >
        {/* Zone arcs */}
        {zoneArcs.map(({ zone: z, path }) => (
          <path
            key={z}
            d={path}
            fill="none"
            stroke={ZONE_COLORS[z]}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            opacity={z === zone ? 1 : 0.25}
          />
        ))}

        {/* Target tick */}
        {target !== undefined && (() => {
          const targetRatio = (target - min) / (max - min);
          const targetAngle = 180 - targetRatio * 180;
          const inner = polarToCartesian(cx, cy, r - config.strokeWidth, targetAngle);
          const outer = polarToCartesian(cx, cy, r + config.strokeWidth / 2, targetAngle);
          return (
            <line
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={colors.text.muted.replace('text-', '')}
              strokeWidth={1.5}
              className="stroke-muted-foreground"
            />
          );
        })()}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={polarToCartesian(cx, cy, r - config.strokeWidth * 1.5, needleAngle).x}
          y2={polarToCartesian(cx, cy, r - config.strokeWidth * 1.5, needleAngle).y}
          className="stroke-foreground"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={3} className="fill-foreground" />
      </svg>

      {/* Value + Label */}
      {showValue && (
        <figcaption className="flex flex-col items-center -mt-1">
          <span className={cn(config.fontSize, 'font-bold', colors.text.primary)}>
            {displayValue}
          </span>
          {label && (
            <span className={cn(config.labelSize, colors.text.muted)}>
              {label}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
