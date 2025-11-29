'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';

interface BuildingCardProgressProps {
  progress: number;
}

export function BuildingCardProgress({ progress }: BuildingCardProgressProps) {
  return (
    <ThemeProgressBar
      progress={progress}
      label="Πρόοδος Κτιρίου"
      size="md"
      showPercentage={true}
    />
  );
}
