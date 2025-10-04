'use client';

import React from 'react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';

interface UnitListItemProgressProps {
  progress: number;
}

export function UnitListItemProgress({ progress }: UnitListItemProgressProps) {
  // Determine progress bar color based on progress value
  const getProgressColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-blue-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">Πρόοδος Πώλησης</span>
        <span className={cn(
          "font-medium",
          progress >= 80 ? "text-green-600" :
          progress >= 60 ? "text-blue-600" :
          progress >= 40 ? "text-yellow-600" : "text-red-600"
        )}>
          {Math.round(progress)}%
        </span>
      </div>
      <Progress 
        value={progress} 
        className={cn(
          "h-2",
          `[&>div]:${getProgressColor(progress)}`
        )} 
      />
    </div>
  );
}