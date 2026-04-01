import React from 'react';
import { useBorderTokens } from '../../../../../src/hooks/useBorderTokens';
import {
  useDynamicBackgroundClass,
  useDynamicTextClass,
} from '../../../../../src/components/ui/utils/dynamic-styles';
import { HOVER_BACKGROUND_EFFECTS } from '../../../../../src/components/ui/effects/hover-effects';
import type { RecommendationCardActionProps } from '../AnalyticsDashboard.types';

const IMPACT_COLORS = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
} as const;

const TITLE_TEXT_COLOR = '#000';
const SECONDARY_TEXT_COLOR = '#6B7280';
const META_TEXT_COLOR = '#374151';
const ACTION_BUTTON_COLOR = '#3B82F6';

export const RecommendationCard: React.FC<RecommendationCardActionProps> = ({
  recommendation,
  onImplement,
}) => {
  const { quick } = useBorderTokens();

  const impactColor = IMPACT_COLORS[recommendation.impact];
  const cardBgClass = useDynamicBackgroundClass('white');
  const titleTextClass = useDynamicTextClass(TITLE_TEXT_COLOR);
  const impactBadgeBgClass = useDynamicBackgroundClass(impactColor, 0.125);
  const impactBadgeTextClass = useDynamicTextClass(impactColor);
  const priorityTextClass = useDynamicTextClass(SECONDARY_TEXT_COLOR);
  const descTextClass = useDynamicTextClass(SECONDARY_TEXT_COLOR);
  const metaTextClass = useDynamicTextClass(META_TEXT_COLOR);
  const buttonBgClass = useDynamicBackgroundClass(ACTION_BUTTON_COLOR);

  return (
    <div className={`${cardBgClass} ${quick.card} p-4`}>
      <div className="flex justify-between items-start mb-3">
        <h4 className={`m-0 text-sm font-semibold ${titleTextClass}`}>
          {recommendation.title}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${impactBadgeBgClass} ${impactBadgeTextClass}`}>
            {recommendation.impact.toUpperCase()}
          </span>
          <span className={`text-xs ${priorityTextClass}`}>
            Priority: {recommendation.priority}/10
          </span>
        </div>
      </div>

      <p className={`m-0 mb-3 text-xs leading-relaxed ${descTextClass}`}>
        {recommendation.description}
      </p>

      <div className="mb-3">
        <div className={`text-xs mb-1 ${metaTextClass}`}>
          <strong>Estimated Benefit:</strong> {recommendation.estimatedBenefit}
        </div>
        <div className={`text-xs ${priorityTextClass}`}>
          Effort: {recommendation.effort} | Category: {recommendation.category}
        </div>
      </div>

      {recommendation.implementationSteps.length > 0 && (
        <details className="mb-3">
          <summary className={`text-xs cursor-pointer ${metaTextClass}`}>
            Implementation Steps ({recommendation.implementationSteps.length})
          </summary>
          <ul className={`mt-2 ml-4 text-xs ${priorityTextClass}`}>
            {recommendation.implementationSteps.map((step, index) => (
              <li key={index} className="mb-1">{step}</li>
            ))}
          </ul>
        </details>
      )}

      {onImplement && (
        <div className="flex justify-end">
          <button
            onClick={() => onImplement(recommendation.id)}
            className={`px-4 py-1.5 border-none rounded text-xs text-white cursor-pointer ${buttonBgClass} ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT}`}
          >
            Start Implementation
          </button>
        </div>
      )}
    </div>
  );
};

export default RecommendationCard;
