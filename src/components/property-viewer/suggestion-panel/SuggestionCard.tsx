
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import type { Suggestion } from '@/types/suggestions';
import { HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function SuggestionCard({
  suggestion,
  isSelected,
  onSelect,
  onAccept
}: {
  suggestion: Suggestion;
  isSelected: boolean;
  onSelect: () => void;
  onAccept: () => void;
}) {
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const topRecommendation = suggestion.recommendations[0];

  return (
    <div
      className={`${quick.card} p-2 cursor-pointer transition-all ${
        isSelected ? `${getStatusBorder('info')} bg-primary/10` : `${quick.card} ${HOVER_BORDER_EFFECTS.GRAY}`
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h5 className="font-medium text-xs">{suggestion.propertyName}</h5>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`w-1.5 h-1.5 ${radius.full} ${
                  topRecommendation.priority === 'high'
                    ? 'bg-red-400'
                    : topRecommendation.priority === 'medium'
                    ? 'bg-yellow-400'
                    : 'bg-green-400'
                }`}
              />
              <span>{topRecommendation.message}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 ml-2">
          <div className="text-xs font-medium text-muted-foreground">Score: {suggestion.score}</div>
          {isSelected && (
            <Button size="sm" className="h-5 px-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onAccept(); }}>
              Αποδοχή
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
