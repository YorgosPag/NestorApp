
'use client';

import { colors } from '@/styles/design-tokens';
import type { Suggestion } from '@/types/suggestions';

/** Suggestion overlay visual configuration — SSoT: design-tokens */
const SUGGESTION_STYLE = {
  stroke: colors.blue['500'],           // #3b82f6
  fillCircle: 'rgba(59, 130, 246, 0.1)',  // blue-500 @ 10%
  fillRect: 'rgba(59, 130, 246, 0.2)',    // blue-500 @ 20%
  defaultSize: 100,
} as const;

interface SuggestionOverlayProps {
  suggestion: Suggestion | null;
}

export function SuggestionOverlay({ suggestion }: SuggestionOverlayProps) {
  if (!suggestion) return null;

  return (
    <g className="suggestion-overlay pointer-events-none">
      {suggestion.recommendations.map((rec, index) => {
        if (rec.suggestedArea) {
          if (rec.suggestedArea.radius) {
            return (
              <circle
                key={index}
                cx={rec.suggestedArea.x}
                cy={rec.suggestedArea.y}
                r={rec.suggestedArea.radius}
                fill={SUGGESTION_STYLE.fillCircle}
                stroke={SUGGESTION_STYLE.stroke}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            )
          }
          return (
            <rect
              key={index}
              x={rec.suggestedArea.x}
              y={rec.suggestedArea.y}
              width={rec.suggestedArea.width || SUGGESTION_STYLE.defaultSize}
              height={rec.suggestedArea.height || SUGGESTION_STYLE.defaultSize}
              fill={SUGGESTION_STYLE.fillRect}
              stroke={SUGGESTION_STYLE.stroke}
              strokeWidth="2"
              strokeDasharray="5 5"
              className="animate-pulse"
            />
          );
        }
        return null;
      })}
    </g>
  );
}
