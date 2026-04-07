'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';
import { formatBuildingLabel } from '@/lib/entity-formatters';

interface BuildingCardTitleProps {
  name: string;
  /** ADR-233 §3.4: locked building identifier (e.g. "Κτήριο Α") */
  code?: string;
  description?: string;
}

export function BuildingCardTitle({ name, code, description }: BuildingCardTitleProps) {
  const colors = useSemanticColors();
  // SSoT: formatBuildingLabel handles code/name combination (ADR-233 §3.4)
  const primaryTitle = formatBuildingLabel(code, name);
  return (
    <div>
      <h3 className={`font-semibold text-lg leading-tight line-clamp-2 mb-1 ${GROUP_HOVER_PATTERNS.BLUE_TEXT_ON_GROUP} transition-colors`}>
        {primaryTitle}
      </h3>
      {description && (
        <p className={cn("text-sm line-clamp-2", colors.text.muted)}>
          {description}
        </p>
      )}
    </div>
  );
}
