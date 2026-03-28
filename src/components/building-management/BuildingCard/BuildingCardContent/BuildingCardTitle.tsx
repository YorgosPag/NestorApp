'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface BuildingCardTitleProps {
  name: string;
  description?: string;
}

export function BuildingCardTitle({ name, description }: BuildingCardTitleProps) {
  const colors = useSemanticColors();
  return (
    <div>
      <h3 className={`font-semibold text-lg leading-tight line-clamp-2 mb-2 ${GROUP_HOVER_PATTERNS.BLUE_TEXT_ON_GROUP} transition-colors`}>
        {name}
      </h3>
      {description && (
        <p className={cn("text-sm line-clamp-2", colors.text.muted)}>
          {description}
        </p>
      )}
    </div>
  );
}
