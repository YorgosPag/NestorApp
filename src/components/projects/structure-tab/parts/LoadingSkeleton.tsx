'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';

export function LoadingSkeleton() {
  const spacing = useSpacingTokens();
  return (
    <div className={cn(spacing.spaceBetween.md, spacing.padding.md)}>
      <Skeleton className="h-12 w-1/2" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
