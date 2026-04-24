import { layoutUtilities } from '../../../styles/design-tokens';

const { chartComponents } = layoutUtilities;

export const getLegendContainerStyles = (verticalAlign: 'top' | 'bottom' = 'bottom') => ({
  ...chartComponents.legend.container,
  ...chartComponents.legend.positioning[verticalAlign]
});

export const getLegendItemStyles = () => chartComponents.legend.item.base;

export type TooltipIndicatorType = 'dot' | 'line' | 'dashed';

export const getTooltipIndicatorStyles = (
  indicator: TooltipIndicatorType,
  color?: string,
  nestLabel?: boolean
) => {
  const baseStyles = chartComponents.tooltip.indicator[indicator];
  const colorStyles = color ? chartComponents.tooltip.indicator.withColor(color) : {};
  const cssVariableStyles = chartComponents.tooltip.indicator.cssVariables;

  const nestingStyles = nestLabel && indicator === 'dashed'
    ? { margin: '2px 0' }
    : {};

  return {
    ...baseStyles,
    ...cssVariableStyles,
    ...colorStyles,
    ...nestingStyles
  };
};

export const getTooltipIndicatorClassName = (
  indicator: TooltipIndicatorType,
  nestLabel?: boolean
) => {
  return [
    'shrink-0 rounded-[2px]',
    indicator === 'dot' ? 'h-2.5 w-2.5' : '',
    indicator === 'line' ? 'w-1' : '',
    indicator === 'dashed' ? 'w-0 border-[1.5px] border-dashed bg-transparent' : '',
    nestLabel && indicator === 'dashed' ? 'my-0.5' : ''
  ].filter(Boolean).join(' ');
};

export interface ChartPayloadItem {
  dataKey?: string;
  value: string | number;
  color: string;
  payload?: Record<string, unknown>;
  label?: string;
}

export interface ChartLegendProps {
  payload?: ChartPayloadItem[];
  verticalAlign?: 'top' | 'bottom';
  hideIcon?: boolean;
  nameKey?: string;
  className?: string;
}
