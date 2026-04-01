import React from 'react';
import { useBorderTokens } from '../../../../../src/hooks/useBorderTokens';
import {
  useDynamicBackgroundClass,
  useDynamicBorderClass,
  useDynamicTextClass,
} from '../../../../../src/components/ui/utils/dynamic-styles';
import { HOVER_BACKGROUND_EFFECTS } from '../../../../../src/components/ui/effects/hover-effects';
import type { InsightCardActionProps } from '../AnalyticsDashboard.types';

const SEVERITY_COLORS = {
  critical: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

const TITLE_TEXT_COLOR = '#000';
const BODY_TEXT_COLOR = '#6B7280';
const META_TEXT_COLOR = '#9CA3AF';

export const InsightCard: React.FC<InsightCardActionProps> = ({ insight, onAction }) => {
  const { quick } = useBorderTokens();

  const getSeverityIcon = () => {
    switch (insight.severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📊';
    }
  };

  const cardBgClass = useDynamicBackgroundClass('white');
  const borderLeftClass = useDynamicBorderClass(SEVERITY_COLORS[insight.severity], '4px');
  const titleTextClass = useDynamicTextClass(TITLE_TEXT_COLOR);
  const descTextClass = useDynamicTextClass(BODY_TEXT_COLOR);
  const metaTextClass = useDynamicTextClass(META_TEXT_COLOR);

  return (
    <div className={`${cardBgClass} ${quick.card} p-4 ${borderLeftClass}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{getSeverityIcon()}</span>
        <div className="flex-1">
          <h4 className={`m-0 mb-2 text-sm font-semibold ${titleTextClass}`}>
            {insight.title}
          </h4>
          <p className={`m-0 mb-3 text-xs leading-relaxed ${descTextClass}`}>
            {insight.description}
          </p>
          <div className="flex justify-between items-center">
            <div className={`flex gap-3 text-xs ${metaTextClass}`}>
              <span>Confidence: {insight.confidence}%</span>
              <span>Type: {insight.type}</span>
            </div>
            {insight.actionRequired && onAction && (
              <button
                onClick={() => onAction(insight.id)}
                className={`px-3 py-1 ${quick.card} text-xs text-gray-700 cursor-pointer ${cardBgClass} ${HOVER_BACKGROUND_EFFECTS.GRAY_LIGHT}`}
              >
                Take Action
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightCard;
