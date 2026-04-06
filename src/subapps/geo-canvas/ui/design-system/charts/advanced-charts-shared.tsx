/**
 * ADVANCED CHARTS — SHARED TYPES, UTILITIES & TOOLTIP
 * Extracted from AdvancedCharts.tsx (ADR-065 SRP split)
 */

import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { GEO_COLORS } from '../../../config/color-config';

// ============================================================================
// LOCAL STYLE HELPERS
// ============================================================================

export const chartComponents = {
  layout: {
    container: (width: number, height: number) => ({
      position: 'relative' as const,
      width: `${width}px`,
      height: `${height}px`,
    }),
    interactive: (interactive: boolean) => ({
      cursor: interactive ? 'pointer' : 'default',
      userSelect: 'none' as const,
    }),
    tooltip: {
      fontWeight: '500',
      fontSize: '11px',
    },
  },
  title: {
    container: { marginBottom: '12px', textAlign: 'center' as const },
    main: { margin: '0', fontSize: '16px', fontWeight: '600' },
    subtitle: { margin: '4px 0 0 0', fontSize: '12px', opacity: 0.7 },
  },
};

export const canvasUI = {
  charts: {
    chartElementTransition: (animated: boolean, speed: 'fast' | 'normal' | 'slow') => ({
      transition: animated
        ? `all ${speed === 'fast' ? '0.15s' : speed === 'normal' ? '0.3s' : '0.5s'} ease`
        : undefined,
    }),
    chartInteraction: (interactive: boolean, animated: boolean, speed: 'fast' | 'normal' | 'slow') => ({
      cursor: interactive ? 'pointer' : 'default',
      transition: animated
        ? `all ${speed === 'fast' ? '0.15s' : speed === 'normal' ? '0.3s' : '0.5s'} ease`
        : undefined,
    }),
    chartElementStyle: (animated: boolean, interactive: boolean, speed: 'fast' | 'normal' | 'slow') => ({
      cursor: interactive ? 'pointer' : 'default',
      transition: animated
        ? `all ${speed === 'fast' ? '0.15s' : speed === 'normal' ? '0.3s' : '0.5s'} ease`
        : undefined,
    }),
  },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  percentage?: number;
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
  color?: string;
}

export interface ChartProps {
  data: ChartDataPoint[] | TimeSeriesPoint[];
  width?: number;
  height?: number;
  title?: string;
  subtitle?: string;
  className?: string;
  animated?: boolean;
  interactive?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  onDataPointClick?: (point: ChartDataPoint | TimeSeriesPoint, index: number) => void;
  onDataPointHover?: (point: ChartDataPoint | TimeSeriesPoint | null, index: number | null) => void;
}

export interface LineChartProps extends ChartProps {
  data: TimeSeriesPoint[];
  strokeWidth?: number;
  curved?: boolean;
  filled?: boolean;
  showPoints?: boolean;
  gridLines?: boolean;
  yAxisMin?: number;
  yAxisMax?: number;
}

export interface BarChartProps extends ChartProps {
  data: ChartDataPoint[];
  orientation?: 'horizontal' | 'vertical';
  barSpacing?: number;
  cornerRadius?: number;
  showValues?: boolean;
}

export interface PieChartProps extends ChartProps {
  data: ChartDataPoint[];
  innerRadius?: number;
  startAngle?: number;
  showPercentages?: boolean;
  showLabels?: boolean;
}

export interface AreaChartProps extends ChartProps {
  data: TimeSeriesPoint[];
  opacity?: number;
  gradient?: boolean;
  stacked?: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getChartColors = (semanticColors: ReturnType<typeof useSemanticColors>) => ({
  primary: GEO_COLORS.UI.PRIMARY,
  secondary: GEO_COLORS.UI.SECONDARY,
  accent: GEO_COLORS.UI.ACCENT,
  danger: GEO_COLORS.UI.DANGER,
  text: GEO_COLORS.UI.TEXT,
  textSecondary: GEO_COLORS.UI.TEXT_SECONDARY,
  grid: GEO_COLORS.UI.GRID,
  background: GEO_COLORS.UI.BACKGROUND,
});

export const generateColorPalette = (count: number): string[] => {
  const baseColors = GEO_COLORS.CHART;
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
};

export const formatValue = (value: number): string => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toString();
};

export const calculateViewBox = (width: number, height: number, _padding: number = 40): string => {
  return `0 0 ${width} ${height}`;
};

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
  className?: string;
}

export const ChartTooltip: React.FC<TooltipProps> = ({
  visible,
  x,
  y,
  content,
  className = '',
}) => {
  const semanticColors = useSemanticColors();

  if (!visible) return null;

  return (
    <div
      className={`absolute z-[1000] rounded-md px-3 py-2 text-xs shadow-md pointer-events-none max-w-[200px] whitespace-nowrap ${semanticColors.bg.card} ${semanticColors.text.primary} ${semanticColors.border.default} border ${className}`}
      data-chart-tooltip="true"
      data-x={x + 10}
      data-y={y - 10}
    >
      {content}
    </div>
  );
};
