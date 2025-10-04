
'use client';

import type { Suggestion } from '@/types/suggestions';

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
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3B82F6"
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
              width={rec.suggestedArea.width || 100}
              height={rec.suggestedArea.height || 100}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3B82F6"
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
