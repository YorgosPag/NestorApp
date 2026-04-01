/* eslint-disable design-system/prefer-design-system-imports -- Package outside src/, no access to @/lib/design-system */
import React from 'react';
import { useIconSizes } from '../../../../../src/hooks/useIconSizes';
import { useBorderTokens } from '../../../../../src/hooks/useBorderTokens';
import {
  useDynamicBackgroundClass,
  useDynamicBackgroundImageClass,
  useDynamicHeightClass,
  useDynamicTextClass,
} from '../../../../../src/components/ui/utils/dynamic-styles';
import { layoutUtilities } from '../../../../../src/styles/design-tokens';
import {
  CHART_BAR_PADDING,
  CHART_CONTAINER_OFFSET,
  DEFAULT_CHART_HEIGHT,
  PIE_CHART_COLORS,
} from '../AnalyticsDashboard.constants';
import type { ChartData } from '../AnalyticsDashboard.types';
import { calculateBarHeight } from '../AnalyticsDashboard.styles';

interface SimpleChartProps {
  title: string;
  data: ChartData;
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  height?: number;
}

// eslint-disable-next-line design-system/no-hardcoded-colors -- SVG text rendering requires raw colors
const TITLE_TEXT_COLOR = '#000';
// eslint-disable-next-line design-system/no-hardcoded-colors -- SVG text rendering requires raw colors
const BODY_TEXT_COLOR = '#6B7280';

const BarChartItem: React.FC<{
  label: string;
  value: number;
  barColor: string;
  barHeight: number;
  labelTextClass: string;
}> = ({ label, value, barColor, barHeight, labelTextClass }) => {
  const barBgClass = useDynamicBackgroundClass(barColor);
  const barHeightClass = useDynamicHeightClass(layoutUtilities.pixels(barHeight));

  return (
    <div className="flex flex-col items-center flex-1">
      <div
        className={`${barBgClass} ${barHeightClass} w-full max-w-[40px] rounded-t-sm flex items-end justify-center text-white text-xs pb-1 transition-all duration-200 ease-in-out`}
      >
        {value}
      </div>
      <span className={`${labelTextClass} text-xs mt-2 text-center break-words`}>
        {label}
      </span>
    </div>
  );
};

const PieLegendItem: React.FC<{
  color: string;
  label: string;
  value: number;
  labelTextClass: string;
}> = ({ color, label, value, labelTextClass }) => {
  const iconSizes = useIconSizes();
  const swatchBgClass = useDynamicBackgroundClass(color);

  return (
    <div className="flex items-center gap-1.5">
      <div className={`${iconSizes.xs} rounded-sm ${swatchBgClass}`} />
      <span className={`text-xs ${labelTextClass}`}>
        {label}: {value}
      </span>
    </div>
  );
};

const PieChartView: React.FC<{
  data: ChartData;
  labelTextClass: string;
}> = ({ data, labelTextClass }) => {
  const primaryDataset = data.datasets[0];
  if (!primaryDataset) {
    return null;
  }

  const total = primaryDataset.data.reduce((sum, value) => sum + value, 0);
  const gradientStops = primaryDataset.data.reduce<string[]>((stops, value, index) => {
    const previousPercentage = primaryDataset.data
      .slice(0, index)
      .reduce((sum, item) => sum + item, 0);
    const currentPercentage = previousPercentage + value;
    const start = total === 0 ? 0 : (previousPercentage / total) * 100;
    const end = total === 0 ? 0 : (currentPercentage / total) * 100;
    const color = PIE_CHART_COLORS[index % PIE_CHART_COLORS.length];

    stops.push(`${color} ${start}% ${end}%`);
    return stops;
  }, []);
  const pieChartBackgroundClass = useDynamicBackgroundImageClass(
    `conic-gradient(${gradientStops.join(', ')})`
  );

  return (
    <div className="flex flex-col items-center p-5">
      <div className={`w-[200px] h-[200px] rounded-full ${pieChartBackgroundClass}`} />
      <div className="mt-5 flex flex-wrap gap-3 justify-center">
        {data.labels.map((label, index) => (
          <PieLegendItem
            key={`${label}-${index}`}
            color={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]}
            label={label}
            value={primaryDataset.data[index] ?? 0}
            labelTextClass={labelTextClass}
          />
        ))}
      </div>
    </div>
  );
};

export const SimpleChart: React.FC<SimpleChartProps> = ({
  title,
  data,
  type,
  height = DEFAULT_CHART_HEIGHT,
}) => {
  const { quick } = useBorderTokens();

  const chartBgClass = useDynamicBackgroundClass('white');
  const titleTextClass = useDynamicTextClass(TITLE_TEXT_COLOR);
  const labelTextClass = useDynamicTextClass(TITLE_TEXT_COLOR);
  const centerTextClass = useDynamicTextClass(BODY_TEXT_COLOR);
  const chartHeightClass = useDynamicHeightClass(layoutUtilities.pixels(height));
  const barChartHeightClass = useDynamicHeightClass(
    layoutUtilities.pixels(height - CHART_CONTAINER_OFFSET)
  );

  const primaryDataset = data.datasets[0];

  return (
    <section className={`${chartBgClass} ${quick.card} p-4`}>
      <h3 className={`m-0 mb-4 text-base font-semibold ${titleTextClass}`}>
        {title}
      </h3>
      <div className={`w-full relative overflow-hidden ${chartHeightClass}`}>
        {type === 'bar' && primaryDataset && (
          <div className={`flex items-end gap-2 p-5 w-full ${barChartHeightClass}`}>
            {data.labels.map((label, index) => {
              const value = primaryDataset.data[index] ?? 0;
              const maxValue = Math.max(...primaryDataset.data, 0);
              const barHeight = calculateBarHeight(value, maxValue, height, CHART_BAR_PADDING);

              return (
                <BarChartItem
                  key={`${label}-${index}`}
                  label={label}
                  value={value}
                  barColor={primaryDataset.backgroundColor ?? PIE_CHART_COLORS[0]}
                  barHeight={barHeight}
                  labelTextClass={labelTextClass}
                />
              );
            })}
          </div>
        )}
        {type === 'pie' && (
          <PieChartView
            data={data}
            labelTextClass={labelTextClass}
          />
        )}
        {(type === 'line' || type === 'doughnut') && (
          <div className={`flex items-center justify-center h-full ${centerTextClass}`}>
            {/* eslint-disable-next-line custom/no-hardcoded-strings -- Placeholder for unimplemented chart types */}
            {type} Chart (Implementation needed)
          </div>
        )}
      </div>
    </section>
  );
};

export default SimpleChart;
