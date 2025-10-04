'use client';

import React from 'react';
import { Progress } from "@/components/ui/progress";

interface BuildingListItemProgressProps {
  progress: number;
}

export function BuildingListItemProgress({ progress }: BuildingListItemProgressProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">Πρόοδος</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
