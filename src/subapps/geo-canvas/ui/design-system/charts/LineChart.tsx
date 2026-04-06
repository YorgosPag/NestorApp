/**
 * LINE CHART COMPONENT
 * Extracted from AdvancedCharts.tsx (ADR-065 SRP split)
 *
 * SVG-based line chart with hover, tooltips, grid, and fill support.
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { LineChartProps, TimeSeriesPoint } from './advanced-charts-shared';
import {
  chartComponents,
  canvasUI,
  getChartColors,
  formatValue,
  calculateViewBox,
  ChartTooltip,
} from './advanced-charts-shared';

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
  yAxisMax,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: TimeSeriesPoint & { x: number; y: number; index: number };
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const semanticColors = useSemanticColors();
  const colors = getChartColors(semanticColors);
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

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

    let path = '';
    if (points.length > 0) {
      path = `M ${points[0].x} ${points[0].y}`;

      if (curved && points.length > 2) {
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const controlX = (prev.x + curr.x) / 2;
          path += ` Q ${controlX} ${prev.y} ${curr.x} ${curr.y}`;
        }
      } else {
        for (let i = 1; i < points.length; i++) {
          path += ` L ${points[i].x} ${points[i].y}`;
        }
      }
    }

    return { minValue: minVal, maxValue: maxVal, points, pathData: path };
  }, [data, chartWidth, chartHeight, padding, yAxisMin, yAxisMax, curved]);

  const gridLines = useMemo(() => {
    if (!showGrid) return [];

    const lines: { type: string; x1: number; y1: number; x2: number; y2: number; value?: number }[] = [];
    const gridCount = 5;

    for (let i = 0; i <= gridCount; i++) {
      const y = padding + (i / gridCount) * chartHeight;
      lines.push({
        type: 'horizontal',
        x1: padding,
        y1: y,
        x2: padding + chartWidth,
        y2: y,
        value: maxValue - (i / gridCount) * (maxValue - minValue),
      });
    }

    const verticalCount = Math.min(data.length - 1, 5);
    for (let i = 0; i <= verticalCount; i++) {
      const x = padding + (i / verticalCount) * chartWidth;
      lines.push({ type: 'vertical', x1: x, y1: padding, x2: x, y2: padding + chartHeight });
    }

    return lines;
  }, [showGrid, chartWidth, chartHeight, padding, data.length, maxValue, minValue]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !showTooltip || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let closestPoint = null;
    let closestDistance = Infinity;
    let closestIndex = -1;

    points.forEach((point, index) => {
      const distance = Math.sqrt(Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2));
      if (distance < closestDistance && distance < 20) {
        closestDistance = distance;
        closestPoint = point;
        closestIndex = index;
      }
    });

    if (closestPoint) {
      setHoveredPoint({ point: closestPoint, index: closestIndex, x: mouseX, y: mouseY });
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

  const handleClick = useCallback(() => {
    if (hoveredPoint && onDataPointClick) {
      onDataPointClick(hoveredPoint.point, hoveredPoint.index);
    }
  }, [hoveredPoint, onDataPointClick]);

  const filledPath = useMemo(() => {
    if (!filled || !pathData) return '';
    return `${pathData} L ${padding + chartWidth} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;
  }, [filled, pathData, padding, chartWidth, chartHeight]);

  return (
    <div className={`line-chart ${className}`} style={chartComponents.layout.container(width, height)}>
      {title && (
        <div style={chartComponents.title.container}>
          <h3 style={chartComponents.title.main}>{title}</h3>
          {subtitle && <p style={chartComponents.title.subtitle}>{subtitle}</p>}
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
        {gridLines.map((line, index) => (
          <line
            key={`grid-${index}`}
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke={colors.grid} strokeWidth={0.5} opacity={0.5}
          />
        ))}

        {showGrid && gridLines
          .filter(line => line.type === 'horizontal')
          .map((line, index) => (
            <text key={`y-label-${index}`} x={padding - 10} y={line.y1 + 4}
              textAnchor="end" fontSize="10" fill={colors.textSecondary}>
              {formatValue(line.value || 0)}
            </text>
          ))}

        {filled && filledPath && (
          <path d={filledPath} fill={`url(#gradient-${Math.random().toString(36).substr(2, 9)})`} opacity={0.3}>
            <defs>
              <linearGradient id={`gradient-${Math.random().toString(36).substr(2, 9)}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </linearGradient>
            </defs>
          </path>
        )}

        {pathData && (
          <path d={pathData} fill="none" stroke={colors.primary} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round"
            style={canvasUI.charts.chartElementTransition(animated, 'normal')}
          />
        )}

        {showPoints && points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y}
            r={hoveredPoint?.index === index ? 6 : 4}
            fill={point.color || colors.primary} stroke={colors.background} strokeWidth={2}
            style={canvasUI.charts.chartInteraction(interactive, animated, 'fast')}
          />
        ))}

        {hoveredPoint && (
          <g>
            <line x1={hoveredPoint.point.x} y1={padding} x2={hoveredPoint.point.x} y2={padding + chartHeight}
              stroke={colors.primary} strokeWidth={1} strokeDasharray="4,4" opacity={0.7}
            />
            <circle cx={hoveredPoint.point.x} cy={hoveredPoint.point.y} r={8}
              fill="none" stroke={colors.primary} strokeWidth={2} opacity={0.8}
            />
          </g>
        )}
      </svg>

      {hoveredPoint && showTooltip && (
        <ChartTooltip
          visible x={hoveredPoint.x} y={hoveredPoint.y}
          content={
            <div>
              <div style={chartComponents.layout.tooltip}>
                {hoveredPoint.point.label || hoveredPoint.point.timestamp.toLocaleDateString()}
              </div>
              <div>Value: {formatValue(hoveredPoint.point.value)}</div>
            </div>
          }
        />
      )}
    </div>
  );
};
