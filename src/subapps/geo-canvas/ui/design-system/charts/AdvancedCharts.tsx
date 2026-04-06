/**
 * ADVANCED DATA VISUALIZATION COMPONENTS — BAR & PIE CHARTS
 * Geo-Alert System - Phase 6: Enterprise Chart Library
 *
 * LineChart and shared utilities extracted to sibling modules (ADR-065).
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BarChartProps, PieChartProps, ChartDataPoint } from './advanced-charts-shared';
import {
  chartComponents,
  canvasUI,
  getChartColors,
  generateColorPalette,
  formatValue,
  calculateViewBox,
  ChartTooltip,
} from './advanced-charts-shared';

// Re-export everything for consumers
export type {
  ChartDataPoint,
  TimeSeriesPoint,
  ChartProps,
  LineChartProps,
  BarChartProps,
  PieChartProps,
  AreaChartProps,
} from './advanced-charts-shared';
export { LineChart } from './LineChart';

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
  onDataPointHover,
}) => {
  const [hoveredBar, setHoveredBar] = useState<{ point: ChartDataPoint; index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const semanticColors = useSemanticColors();
  const colors = getChartColors(semanticColors);
  const chartColors = generateColorPalette(data.length);
  const padding = 40;

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
      const normalizedValue = maxVal > 0 ? point.value / maxVal : 0;

      if (isVertical) {
        const barHeight = normalizedValue * chartHeight;
        return {
          ...point, x: padding + index * (barSize + barSpacing),
          y: padding + chartHeight - barHeight, width: barSize, height: barHeight,
          index, color: point.color || chartColors[index % chartColors.length],
        };
      } else {
        const barWidth = normalizedValue * chartWidth;
        return {
          ...point, x: padding, y: padding + index * (barSize + barSpacing),
          width: barWidth, height: barSize, index,
          color: point.color || chartColors[index % chartColors.length],
        };
      }
    });

    return { bars, maxValue: maxVal };
  }, [data, width, height, padding, orientation, barSpacing, chartColors]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !showTooltip || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const found = bars.find(bar =>
      mouseX >= bar.x && mouseX <= bar.x + bar.width &&
      mouseY >= bar.y && mouseY <= bar.y + bar.height
    );

    if (found) {
      setHoveredBar({ point: found, index: found.index, x: mouseX, y: mouseY });
      onDataPointHover?.(found, found.index);
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
    if (hoveredBar && onDataPointClick) onDataPointClick(hoveredBar.point, hoveredBar.index);
  }, [hoveredBar, onDataPointClick]);

  return (
    <div className={`bar-chart ${className}`} style={chartComponents.layout.container(width, height)}>
      {title && (
        <div style={chartComponents.title.container}>
          <h3 style={chartComponents.title.main}>{title}</h3>
          {subtitle && <p style={chartComponents.title.subtitle}>{subtitle}</p>}
        </div>
      )}

      <svg ref={svgRef} width={width} height={height} viewBox={calculateViewBox(width, height)}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}
        style={chartComponents.layout.interactive(interactive)}>

        {bars.map((bar, index) => (
          <g key={index}>
            <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height}
              fill={bar.color} rx={cornerRadius} ry={cornerRadius}
              opacity={hoveredBar?.index === index ? 0.8 : 1}
              style={canvasUI.charts.chartElementStyle(animated, interactive, 'normal')}
            />
            {showValues && (
              <text
                x={orientation === 'vertical' ? bar.x + bar.width / 2 : bar.x + bar.width + 5}
                y={orientation === 'vertical' ? bar.y - 5 : bar.y + bar.height / 2 + 4}
                textAnchor={orientation === 'vertical' ? 'middle' : 'start'}
                fontSize="10" fill={colors.textSecondary} fontWeight="500">
                {formatValue(bar.value)}
              </text>
            )}
            <text
              x={orientation === 'vertical' ? bar.x + bar.width / 2 : bar.x - 5}
              y={orientation === 'vertical' ? height - padding + 15 : bar.y + bar.height / 2 + 4}
              textAnchor={orientation === 'vertical' ? 'middle' : 'end'}
              fontSize="10" fill={colors.textSecondary}>
              {bar.label}
            </text>
          </g>
        ))}
      </svg>

      {hoveredBar && showTooltip && (
        <ChartTooltip visible x={hoveredBar.x} y={hoveredBar.y}
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
  onDataPointHover,
}) => {
  const [hoveredSlice, setHoveredSlice] = useState<{ point: ChartDataPoint; index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const semanticColors = useSemanticColors();
  const colors = getChartColors(semanticColors);
  const chartColors = generateColorPalette(data.length);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 40;

  const { slices, total } = useMemo(() => {
    if (data.length === 0) return { slices: [], total: 0 };

    const total = data.reduce((sum, point) => sum + point.value, 0);
    let currentAngle = (startAngle * Math.PI) / 180;

    const slices = data.map((point, index) => {
      const sliceAngle = (point.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;
      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

      const x1 = centerX + radius * Math.cos(currentAngle);
      const y1 = centerY + radius * Math.sin(currentAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const innerX1 = centerX + innerRadius * Math.cos(currentAngle);
      const innerY1 = centerY + innerRadius * Math.sin(currentAngle);
      const innerX2 = centerX + innerRadius * Math.cos(endAngle);
      const innerY2 = centerY + innerRadius * Math.sin(endAngle);

      const pathData = innerRadius > 0
        ? `M ${innerX1} ${innerY1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${innerX2} ${innerY2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1} Z`
        : `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      const labelAngle = currentAngle + sliceAngle / 2;
      const labelRadius = radius + 20;

      const slice = {
        ...point, path: pathData,
        startAngle: currentAngle, endAngle,
        labelX: centerX + labelRadius * Math.cos(labelAngle),
        labelY: centerY + labelRadius * Math.sin(labelAngle),
        percentage: (point.value / total) * 100,
        index, color: point.color || chartColors[index % chartColors.length],
      };

      currentAngle = endAngle;
      return slice;
    });

    return { slices, total };
  }, [data, centerX, centerY, radius, innerRadius, startAngle, chartColors]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !showTooltip || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
    const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

    const found = slices.find(slice =>
      normalizedAngle >= slice.startAngle && normalizedAngle <= slice.endAngle
    );

    if (found) {
      setHoveredSlice({ point: found, index: found.index, x: mouseX, y: mouseY });
      onDataPointHover?.(found, found.index);
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
    if (hoveredSlice && onDataPointClick) onDataPointClick(hoveredSlice.point, hoveredSlice.index);
  }, [hoveredSlice, onDataPointClick]);

  return (
    <div className={`pie-chart ${className}`} style={chartComponents.layout.container(width, height)}>
      {title && (
        <div style={chartComponents.title.container}>
          <h3 style={chartComponents.title.main}>{title}</h3>
          {subtitle && <p style={chartComponents.title.subtitle}>{subtitle}</p>}
        </div>
      )}

      <svg ref={svgRef} width={width} height={height} viewBox={calculateViewBox(width, height)}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}
        style={chartComponents.layout.interactive(interactive)}>

        {slices.map((slice, index) => (
          <g key={index}>
            <path d={slice.path} fill={slice.color} stroke={colors.background} strokeWidth={2}
              opacity={hoveredSlice?.index === index ? 0.8 : 1}
              style={canvasUI.charts.chartElementStyle(animated, interactive, 'normal')}
            />
            {showLabels && slice.percentage > 5 && (
              <text x={slice.labelX} y={slice.labelY} textAnchor="middle"
                fontSize="10" fill={colors.textSecondary} fontWeight="500">
                {showPercentages ? `${slice.percentage.toFixed(1)}%` : slice.label}
              </text>
            )}
          </g>
        ))}

        {innerRadius > 0 && (
          <g>
            <text x={centerX} y={centerY - 5} textAnchor="middle"
              fontSize="14" fill={colors.text} fontWeight="600">Total</text>
            <text x={centerX} y={centerY + 10} textAnchor="middle"
              fontSize="12" fill={colors.textSecondary}>{formatValue(total)}</text>
          </g>
        )}
      </svg>

      {hoveredSlice && showTooltip && (
        <ChartTooltip visible x={hoveredSlice.x} y={hoveredSlice.y}
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
// DEFAULT EXPORT
// ============================================================================

import { LineChart } from './LineChart';
export default { LineChart, BarChart, PieChart };
