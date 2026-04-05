'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface BuildingCardTitleProps {
  name: string;
  /** ADR-233 §3.4: locked building identifier (e.g. "Κτήριο Α") */
  code?: string;
  description?: string;
}

export function BuildingCardTitle({ name, code, description }: BuildingCardTitleProps) {
  const colors = useSemanticColors();
  // ADR-233 §3.4: show code as primary title (if available), name as subtitle.
  // Legacy buildings without `code` fall back to showing `name` as title.
  const primaryTitle = code || name;
  const showNameAsSubtitle = code && name && name !== code;
  return (
    <div>
      <h3 className={`font-semibold text-lg leading-tight line-clamp-2 mb-1 ${GROUP_HOVER_PATTERNS.BLUE_TEXT_ON_GROUP} transition-colors`}>
        {primaryTitle}
      </h3>
      {showNameAsSubtitle && (
        <p className={cn("text-sm font-medium line-clamp-1 mb-1", colors.text.default)}>
          {name}
        </p>
      )}
      {description && (
        <p className={cn("text-sm line-clamp-2", colors.text.muted)}>
          {description}
        </p>
      )}
    </div>
  );
}
