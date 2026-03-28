'use client';

import React from 'react';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface ProjectCardTitleProps {
  name: string;
  description?: string;
}

export function ProjectCardTitle({ name, description }: ProjectCardTitleProps) {
  const typography = useTypography();
  return (
    <div>
      <h3 className={cn(typography.heading.md, `leading-tight line-clamp-2 mb-2 ${GROUP_HOVER_PATTERNS.BLUE_TEXT_ON_GROUP} transition-colors`)}>
        {name}
      </h3>
      {description && (
        <p className={cn(typography.special.secondary, "line-clamp-2")}>
          {description}
        </p>
      )}
    </div>
  );
}
