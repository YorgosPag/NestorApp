/**
 * ADVANCED DATA VISUALIZATION COMPONENTS
 * Geo-Alert System - Phase 6: Enterprise Chart Library
 *
 * Comprehensive chart components με responsive design, theming, και accessibility.
 * Custom implementation χωρίς external chart libraries για full control.
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { GEO_COLORS } from '../../../config/color-config';

// ✅ ENTERPRISE FIX: Local chart components styles (missing from design-tokens)
const chartComponents = {
  layout: {
    container: (width: number, height: number) => ({
      position: 'relative' as const,
      width: `${width}px`,
      height: `${height}px`
    }),
    interactive: (interactive: boolean) => ({
      cursor: interactive ? 'pointer' : 'default',
      userSelect: 'none' as const
    }),
    tooltip: {
      fontWeight: '500',
      fontSize: '11px'
    }
  },
  title: {
    container: {
      marginBottom: '12px',
      textAlign: 'center' as const
    },
    main: {
      margin: '0',
      fontSize: '16px',
      fontWeight: '600'
    },
    subtitle: {
      margin: '4px 0 0 0',
      fontSize: '12px',
      opacity: 0.7
    }
  }
};

// ✅ ENTERPRISE FIX: Local canvas UI utilities
const canvasUI = {
  charts: {
    chartElementTransition: (animated: boolean, speed: 'fast' | 'normal' | 'slow') => ({
      transition: animated ? `all ${speed === 'fast' ? '0.15s' : speed === 'normal' ? '0.3s' : '0.5s'} ease` : undefined
    }),
    chartInteraction: (interactive: boolean, animated: boolean, speed: 'fast' | 'normal' | 'slow') => ({
      cursor: interactive ? 'pointer' : 'default',
      transition: animated ? `all ${speed === 'fast' ? '0.15s' : speed === 'normal' ? '0.3s' : '0.5s'} ease` : undefined
    }),
    chartElementStyle: (animated: boolean, interactive: boolean, speed: 'fast' | 'normal' | 'slow') => ({
      cursor: interactive ? 'pointer' : 'default',
      transition: animated ? `all ${speed === 'fast' ? '0.15s' : speed === 'normal' ? '0.3s' : '0.5s'} ease` : undefined
    })
  }
};

// ============================================================================
// CHART TYPES και INTERFACES
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

const getChartColors = (semanticColors: ReturnType<typeof useSemanticColors>) => ({
  primary: GEO_COLORS.UI.PRIMARY,
  secondary: GEO_COLORS.UI.SECONDARY,
  accent: GEO_COLORS.UI.ACCENT,
  danger: GEO_COLORS.UI.DESTRUCTIVE,
  text: GEO_COLORS.UI.FOREGROUND,
  textSecondary: GEO_COLORS.UI.MUTED_FOREGROUND,
  grid: GEO_COLORS.UI.BORDER,
  background: GEO_COLORS.UI.BACKGROUND
});

const generateColorPalette = (count: number): string[] => {
  const baseColors = GEO_COLORS.CHART;

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
};

const formatValue = (value: number): string => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
};

const calculateViewBox = (width: number, height: number, padding: number = 40): string => {
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

const ChartTooltip: React.FC<TooltipProps> = ({
  visible,
  x,
  y,
  content,
  className = ''
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

// ============================================================================
// LINE CHART COMPONENT
// ============================================================================

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = 400,
  height = 300,
  title,
  subtitle,
  className = '',
  strokeWidth = 2,
  curved = true,
  filled = false,
  showPoints = true,
  showGrid = true,
  showTooltip = true,
  animated = true,
  interactive = true,
  onDataPointClick,
  onDataPointHover,
  yAxisMin,
  yAxisMax
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ point: TimeSeriesPoint & { x: number; y: number; index: number }; index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const semanticColors = useSemanticColors();
  const colors = getChartColors(semanticColors);
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  // Data processing
  const { minValue, maxValue, points, pathData } = useMemo(() => {
    if (data.length === 0) return { minValue: 0, maxValue: 0, points: [], pathData: '' };

    const values = data.map(d => d.value);
    const minVal = yAxisMin !== undefined ? yAxisMin : Math.min(...values);
    const maxVal = yAxisMax !== undefined ? yAxisMax : Math.max(...values);
    const range = maxVal - minVal || 1;

    const points = data.map((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((point.value - minVal) / range) * chartHeight;
      return { ...point, x, y, index };
    });

    // Generate SVG path
    let path = '';
    if (points.length > 0) {
      path = `M ${points[0].x} ${points[0].y}`;

      if (curved && points.length > 2) {
        // Smooth curve using quadratic bezier
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const controlX = (prev.x + curr.x) / 2;
          path += ` Q ${controlX} ${prev.y} ${curr.x} ${curr.y}`;
        }
      } else {
        // Straight lines
        for (let i = 1; i < points.length; i++) {
          path += ` L ${points[i].x} ${points[i].y}`;
        }
      }
    }

    return { minValue: minVal, maxValue: maxVal, points, pathData: path };
  }, [data, chartWidth, chartHeight, padding, yAxisMin, yAxisMax, curved]);

  // Grid lines
  const gridLines = useMemo(() => {
    if (!showGrid) return [];

    const lines = [];
    const gridCount = 5;

    // Horizontal grid lines
    for (let i = 0; i <= gridCount; i++) {
      const y = padding + (i / gridCount) * chartHeight;
      lines.push({
        type: 'horizontal',
        x1: padding,
        y1: y,
        x2: padding + chartWidth,
        y2: y,
        value: maxValue - (i / gridCount) * (maxValue - minValue)
      });
    }

    // Vertical grid lines
    const verticalCount = Math.min(data.length - 1, 5);
    for (let i = 0; i <= verticalCount; i++) {
      const x = padding + (i / verticalCount) * chartWidth;
      lines.push({
        type: 'vertical',
        x1: x,
        y1: padding,
        x2: x,
        y2: padding + chartHeight
      });
    }

    return lines;
  }, [showGrid, chartWidth, chartHeight, padding, data.length, maxValue, minValue]);

  // Event handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !showTooltip || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Find closest point
    let closestPoint = null;
    let closestDistance = Infinity;
    let closestIndex = -1;

    points.forEach((point, index) => {
      const distance = Math.sqrt(Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2));
      if (distance < closestDistance && distance < 20) { // 20px threshold
        closestDistance = distance;
        closestPoint = point;
        closestIndex = index;
      }
    });

    if (closestPoint) {
      setHoveredPoint({
        point: closestPoint,
        index: closestIndex,
        x: mouseX,
        y: mouseY
      });
      onDataPointHover?.(closestPoint, closestIndex);
    } else {
      setHoveredPoint(null);
      onDataPointHover?.(null, null);
    }
  }, [interactive, showTooltip, points, onDataPointHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
    onDataPointHover?.(null, null);
  }, [onDataPointHover]);

  const handleClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (hoveredPoint && onDataPointClick) {
      onDataPointClick(hoveredPoint.point, hoveredPoint.index);
    }
  }, [hoveredPoint, onDataPointClick]);

  // Filled area path
  const filledPath = useMemo(() => {
    if (!filled || !pathData) return '';
    return `${pathData} L ${padding + chartWidth} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;
  }, [filled, pathData, padding, chartWidth, chartHeight]);

  return (
    <div className={`line-chart ${className}`} style={chartComponents.layout.container(width, height)}>
      {title && (
        <div style={chartComponents.title.container}>
          <h3 style={chartComponents.title.main}>
            {title}
          </h3>
          {subtitle && (
            <p style={chartComponents.title.subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={calculateViewBox(width, height)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={chartComponents.layout.interactive(interactive)}
      >
        {/* Grid lines */}
        {gridLines.map((line, index) => (
          <line
            key={`grid-${index}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={colors.grid}
            strokeWidth={0.5}
            opacity={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {showGrid && gridLines
          .filter(line => line.type === 'horizontal')
          .map((line, index) => (
            <text
              key={`y-label-${index}`}
              x={padding - 10}
              y={line.y1 + 4}
              textAnchor="end"
              fontSize="10"
              fill={colors.textSecondary}
            >
              {formatValue(line.value || 0)}
            </text>
          ))}

        {/* Filled area */}
        {filled && filledPath && (
          <path
            d={filledPath}
            fill={`url(#gradient-${Math.random().toString(36).substr(2, 9)})`}
            opacity={0.3}
          >
            <defs>
              <linearGradient id={`gradient-${Math.random().toString(36).substr(2, 9)}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </linearGradient>
            </defs>
          </path>
        )}

        {/* Line path */}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={canvasUI.charts.chartElementTransition(animated, 'normal')}
          />
        )}

        {/* Data points */}
        {showPoints && points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={hoveredPoint?.index === index ? 6 : 4}
            fill={point.color || colors.primary}
            stroke={colors.background}
            strokeWidth={2}
            style={canvasUI.charts.chartInteraction(interactive, animated, 'fast')}
          />
        ))}

        {/* Hover indicator */}
        {hoveredPoint && (
          <g>
            <line
              x1={hoveredPoint.point.x}
              y1={padding}
              x2={hoveredPoint.point.x}
              y2={padding + chartHeight}
              stroke={colors.primary}
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.7}
            />
            <circle
              cx={hoveredPoint.point.x}
              cy={hoveredPoint.point.y}
              r={8}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2}
              opacity={0.8}
            />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && showTooltip && (
        <ChartTooltip
          visible={true}
          x={hoveredPoint.x}
          y={hoveredPoint.y}
          content={
            <div>
              <div style={chartComponents.layout.tooltip}>
                {hoveredPoint.point.label || hoveredPoint.point.timestamp.toLocaleDateString()}
              </div>
              <div>
                Value: {formatValue(hoveredPoint.point.value)}
              </div>
            </div>
          }
        />
      )}
    </div>
  );
};

// ============================================================================
// BAR CHART COMPONENT
// ============================================================================

export const BarChart: React.FC<BarChartProps> = ({
  data,
  width = 400,
  height = 300,
  title,
  subtitle,
  className = '',
  orientation = 'vertical',
  barSpacing = 0.1,
  cornerRadius = 4,
  showValues = true,
  showTooltip = true,
  animated = true,
  interactive = true,
  onDataPointClick,
  onDataPointHover
}) => {
  const [hoveredBar, setHoveredBar] = useState<{ point: ChartDataPoint; index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const semanticColors = useSemanticColors();
  const colors = getChartColors(semanticColors);
  const chartColors = generateColorPalette(data.length);
  const padding = 40;

  // Calculate bar dimensions
  const { bars, maxValue } = useMemo(() => {
    if (data.length === 0) return { bars: [], maxValue: 0 };

    const maxVal = Math.max(...data.map(d => d.value));
    const isVertical = orientation === 'vertical';

    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    const barCount = data.length;
    const totalSpacing = barSpacing * (barCount - 1);
    const availableSpace = (isVertical ? chartWidth : chartHeight) - totalSpacing;
    const barSize = availableSpace / barCount;

    const bars = data.map((point, index) => {
      const value = point.value;
      const normalizedValue = maxVal > 0 ? value / maxVal : 0;

      if (isVertical) {
        const barHeight = normalizedValue * chartHeight;
        const x = padding + index * (barSize + barSpacing);
        const y = padding + chartHeight - barHeight;

        return {
          ...point,
          x,
          y,
          width: barSize,
          height: barHeight,
          index,
          color: point.color || chartColors[index % chartColors.length]
        };
      } else {
        const barWidth = normalizedValue * chartWidth;
        const x = padding;
        const y = padding + index * (barSize + barSpacing);

        return {
          ...point,
          x,
          y,
          width: barWidth,
          height: barSize,
          index,
          color: point.color || chartColors[index % chartColors.length]
        };
      }
    });

    return { bars, maxValue: maxVal };
  }, [data, width, height, padding, orientation, barSpacing, chartColors]);

  // Event handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !showTooltip || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Find bar under cursor
    const hoveredBar = bars.find(bar =>
      mouseX >= bar.x &&
      mouseX <= bar.x + bar.width &&
      mouseY >= bar.y &&
      mouseY <= bar.y + bar.height
    );

    if (hoveredBar) {
      setHoveredBar({
        point: hoveredBar,
        index: hoveredBar.index,
        x: mouseX,
        y: mouseY
      });
      onDataPointHover?.(hoveredBar, hoveredBar.index);
    } else {
      setHoveredBar(null);
      onDataPointHover?.(null, null);
    }
  }, [interactive, showTooltip, bars, onDataPointHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredBar(null);
    onDataPointHover?.(null, null);
  }, [onDataPointHover]);

  const handleClick = useCallback(() => {
    if (hoveredBar && onDataPointClick) {
      onDataPointClick(hoveredBar.point, hoveredBar.index);
    }
  }, [hoveredBar, onDataPointClick]);

  return (
    <div className={`bar-chart ${className}`} style={chartComponents.layout.container(width, height)}>
      {title && (
        <div style={chartComponents.title.container}>
          <h3 style={chartComponents.title.main}>
            {title}
          </h3>
          {subtitle && (
            <p style={chartComponents.title.subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={calculateViewBox(width, height)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={chartComponents.layout.interactive(interactive)}
      >
        {/* Bars */}
        {bars.map((bar, index) => (
          <g key={index}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={bar.color}
              rx={cornerRadius}
              ry={cornerRadius}
              opacity={hoveredBar?.index === index ? 0.8 : 1}
              style={canvasUI.charts.chartElementStyle(animated, interactive, 'normal')}
            />

            {/* Value labels */}
            {showValues && (
              <text
                x={orientation === 'vertical' ? bar.x + bar.width / 2 : bar.x + bar.width + 5}
                y={orientation === 'vertical' ? bar.y - 5 : bar.y + bar.height / 2 + 4}
                textAnchor={orientation === 'vertical' ? 'middle' : 'start'}
                fontSize="10"
                fill={colors.textSecondary}
                fontWeight="500"
              >
                {formatValue(bar.value)}
              </text>
            )}

            {/* Bar labels */}
            <text
              x={orientation === 'vertical' ? bar.x + bar.width / 2 : bar.x - 5}
              y={orientation === 'vertical' ? height - padding + 15 : bar.y + bar.height / 2 + 4}
              textAnchor={orientation === 'vertical' ? 'middle' : 'end'}
              fontSize="10"
              fill={colors.textSecondary}
            >
              {bar.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredBar && showTooltip && (
        <ChartTooltip
          visible={true}
          x={hoveredBar.x}
          y={hoveredBar.y}
          content={
            <div>
              <div style={chartComponents.layout.tooltip}>{hoveredBar.point.label}</div>
              <div>Value: {formatValue(hoveredBar.point.value)}</div>
            </div>
          }
        />
      )}
    </div>
  );
};

// ============================================================================
// PIE CHART COMPONENT
// ============================================================================

export const PieChart: React.FC<PieChartProps> = ({
  data,
  width = 300,
  height = 300,
  title,
  subtitle,
  className = '',
  innerRadius = 0,
  startAngle = 0,
  showPercentages = true,
  showLabels = true,
  showTooltip = true,
  animated = true,
  interactive = true,
  onDataPointClick,
  onDataPointHover
}) => {
  const [hoveredSlice, setHoveredSlice] = useState<{ point: ChartDataPoint; index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const semanticColors = useSemanticColors();
  const colors = getChartColors(semanticColors);
  const chartColors = generateColorPalette(data.length);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 40;

  // Calculate slices
  const { slices, total } = useMemo(() => {
    if (data.length === 0) return { slices: [], total: 0 };

    const total = data.reduce((sum, point) => sum + point.value, 0);
    let currentAngle = (startAngle * Math.PI) / 180;

    const slices = data.map((point, index) => {
      const sliceAngle = (point.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;

      // Calculate arc path
      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
      const x1 = centerX + radius * Math.cos(currentAngle);
      const y1 = centerY + radius * Math.sin(currentAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const innerX1 = centerX + innerRadius * Math.cos(currentAngle);
      const innerY1 = centerY + innerRadius * Math.sin(currentAngle);
      const innerX2 = centerX + innerRadius * Math.cos(endAngle);
      const innerY2 = centerY + innerRadius * Math.sin(endAngle);

      let pathData;
      if (innerRadius > 0) {
        // Donut chart
        pathData = [
          `M ${innerX1} ${innerY1}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          `L ${innerX2} ${innerY2}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1}`,
          'Z'
        ].join(' ');
      } else {
        // Pie chart
        pathData = [
          `M ${centerX} ${centerY}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          'Z'
        ].join(' ');
      }

      // Label position
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelRadius = radius + 20;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);

      const slice = {
        ...point,
        path: pathData,
        startAngle: currentAngle,
        endAngle,
        labelX,
        labelY,
        percentage: (point.value / total) * 100,
        index,
        color: point.color || chartColors[index % chartColors.length]
      };

      currentAngle = endAngle;
      return slice;
    });

    return { slices, total };
  }, [data, centerX, centerY, radius, innerRadius, startAngle, chartColors]);

  // Event handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !showTooltip || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate angle from center
    const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
    const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

    // Find slice under cursor
    const hoveredSlice = slices.find(slice =>
      normalizedAngle >= slice.startAngle && normalizedAngle <= slice.endAngle
    );

    if (hoveredSlice) {
      setHoveredSlice({
        point: hoveredSlice,
        index: hoveredSlice.index,
        x: mouseX,
        y: mouseY
      });
      onDataPointHover?.(hoveredSlice, hoveredSlice.index);
    } else {
      setHoveredSlice(null);
      onDataPointHover?.(null, null);
    }
  }, [interactive, showTooltip, slices, centerY, onDataPointHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredSlice(null);
    onDataPointHover?.(null, null);
  }, [onDataPointHover]);

  const handleClick = useCallback(() => {
    if (hoveredSlice && onDataPointClick) {
      onDataPointClick(hoveredSlice.point, hoveredSlice.index);
    }
  }, [hoveredSlice, onDataPointClick]);

  return (
    <div className={`pie-chart ${className}`} style={chartComponents.layout.container(width, height)}>
      {title && (
        <div style={chartComponents.title.container}>
          <h3 style={chartComponents.title.main}>
            {title}
          </h3>
          {subtitle && (
            <p style={chartComponents.title.subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={calculateViewBox(width, height)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={chartComponents.layout.interactive(interactive)}
      >
        {/* Slices */}
        {slices.map((slice, index) => (
          <g key={index}>
            <path
              d={slice.path}
              fill={slice.color}
              stroke={colors.background}
              strokeWidth={2}
              opacity={hoveredSlice?.index === index ? 0.8 : 1}
              style={canvasUI.charts.chartElementStyle(animated, interactive, 'normal')}
            />

            {/* Labels */}
            {showLabels && slice.percentage > 5 && ( // Only show labels για slices > 5%
              <text
                x={slice.labelX}
                y={slice.labelY}
                textAnchor="middle"
                fontSize="10"
                fill={colors.textSecondary}
                fontWeight="500"
              >
                {showPercentages ? `${slice.percentage.toFixed(1)}%` : slice.label}
              </text>
            )}
          </g>
        ))}

        {/* Center text για donut charts */}
        {innerRadius > 0 && (
          <g>
            <text
              x={centerX}
              y={centerY - 5}
              textAnchor="middle"
              fontSize="14"
              fill={colors.text}
              fontWeight="600"
            >
              Total
            </text>
            <text
              x={centerX}
              y={centerY + 10}
              textAnchor="middle"
              fontSize="12"
              fill={colors.textSecondary}
            >
              {formatValue(total)}
            </text>
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredSlice && showTooltip && (
        <ChartTooltip
          visible={true}
          x={hoveredSlice.x}
          y={hoveredSlice.y}
          content={
            <div>
              <div style={chartComponents.layout.tooltip}>{hoveredSlice.point.label}</div>
              <div>Value: {formatValue(hoveredSlice.point.value)}</div>
              <div>Percentage: {hoveredSlice.point.percentage?.toFixed(1)}%</div>
            </div>
          }
        />
      )}
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  LineChart,
  BarChart,
  PieChart
};
