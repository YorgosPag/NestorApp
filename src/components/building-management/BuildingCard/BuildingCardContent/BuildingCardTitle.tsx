'use client';

import React from 'react';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';

interface BuildingCardTitleProps {
  name: string;
  description?: string;
}

export function BuildingCardTitle({ name, description }: BuildingCardTitleProps) {
  return (
    <div>
      <h3 className={`font-semibold text-lg leading-tight line-clamp-2 mb-2 ${GROUP_HOVER_PATTERNS.BLUE_TEXT_ON_GROUP} transition-colors`}>
        {name}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      )}
    </div>
  );
}
