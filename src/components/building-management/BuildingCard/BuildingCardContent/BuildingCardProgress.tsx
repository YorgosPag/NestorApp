'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getProgressColor } from '../BuildingCardUtils';

interface BuildingCardProgressProps {
  progress: number;
}

export function BuildingCardProgress({ progress }: BuildingCardProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Πρόοδος Έργου</span>
        <span className={cn("font-semibold", getProgressColor(progress))}>
          {progress}%
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
