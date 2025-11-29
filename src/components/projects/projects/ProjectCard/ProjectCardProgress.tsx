'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';

interface ProjectCardProgressProps {
  progress: number;
}

export function ProjectCardProgress({ progress }: ProjectCardProgressProps) {
  return (
    <ThemeProgressBar
      progress={progress}
      label="Πρόοδος Έργου"
      size="md"
      showPercentage={true}
    />
  );
}
