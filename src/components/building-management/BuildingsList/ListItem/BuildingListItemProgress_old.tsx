'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';

interface BuildingListItemProgressProps {
  progress: number;
}

export function BuildingListItemProgress({ progress }: BuildingListItemProgressProps) {
  return (
    <ThemeProgressBar
      progress={progress}
      label="Πρόοδος"
      size="md"
      showPercentage={true}
    />
  );
}
