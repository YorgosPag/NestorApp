'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';

interface UnitListItemProgressProps {
  progress: number;
}

export function UnitListItemProgress({ progress }: UnitListItemProgressProps) {
  return (
    <ThemeProgressBar
      progress={progress}
      label="Πρόοδος Πώλησης"
      size="md"
      showPercentage
    />
  );
}