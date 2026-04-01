import React from 'react';
import { useBorderTokens } from '../../../../../src/hooks/useBorderTokens';
import {
  useDynamicBackgroundClass,
  useDynamicTextClass,
} from '../../../../../src/components/ui/utils/dynamic-styles';
import { HOVER_BACKGROUND_EFFECTS } from '../../../../../src/components/ui/effects/hover-effects';

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: number;
  icon?: string;
  status?: 'good' | 'warning' | 'critical';
  description?: string;
}

const STATUS_COLORS: Record<NonNullable<MetricCardProps['status']>, string> = {
  good: '#10B981',
  warning: '#F59E0B',
  critical: '#EF4444',
};

const NEUTRAL_TEXT_COLOR = '#6B7280';
const SUBTLE_TEXT_COLOR = '#9CA3AF';

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  icon,
  status = 'good',
  description,
}) => {
  const { quick } = useBorderTokens();

  const trendColor = trend === undefined
    ? NEUTRAL_TEXT_COLOR
    : trend > 0
      ? STATUS_COLORS.good
      : STATUS_COLORS.critical;

  const cardBgClass = useDynamicBackgroundClass('white');
  const titleTextClass = useDynamicTextClass(NEUTRAL_TEXT_COLOR);
  const valueTextClass = useDynamicTextClass(STATUS_COLORS[status]);
  const unitTextClass = useDynamicTextClass(NEUTRAL_TEXT_COLOR);
  const trendTextClass = useDynamicTextClass(trendColor);
  const descTextClass = useDynamicTextClass(SUBTLE_TEXT_COLOR);

  const formatTrend = () => {
    if (trend === undefined) {
      return null;
    }

    const direction = trend > 0 ? '↗' : '↘';
    return `${direction} ${Math.abs(trend).toFixed(1)}%`;
  };

  return (
    <div className={`${cardBgClass} ${quick.card} p-5 min-h-[140px] flex flex-col justify-between ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}>
      <div className="flex justify-between items-center">
        <h4 className={`m-0 text-sm font-medium ${titleTextClass}`}>
          {title}
        </h4>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className="my-3">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${valueTextClass}`}>
            {value}
          </span>
          {unit && (
            <span className={`text-base ${unitTextClass}`}>
              {unit}
            </span>
          )}
        </div>
        {trend !== undefined && (
          <div className={`text-xs mt-1 ${trendTextClass}`}>
            {formatTrend()}
          </div>
        )}
      </div>

      {description && (
        <p className={`m-0 text-xs leading-relaxed ${descTextClass}`}>
          {description}
        </p>
      )}
    </div>
  );
};

export default MetricCard;
