'use client';

import React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface MultiLevelNavigationProps {
  property: Property;
  onSelectFloor: (floorId: string | null) => void;
  currentFloorId: string | null;
}

export function MultiLevelNavigation({ property, onSelectFloor, currentFloorId }: MultiLevelNavigationProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  if (!property.levels) return null;

  return (
    <div className={`bg-blue-50 dark:bg-blue-950/30 ${getStatusBorder('info')} p-3 space-y-2`}>
      <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
        <ChevronsUpDown className={iconSizes.sm} />
        Επίπεδα Ακινήτου
      </h4>
      {property.levels.map((level) => (
        <div 
          key={level.floorId}
          className={cn(
            "p-2 rounded-md flex items-center justify-between transition-colors",
            currentFloorId === level.floorId ? "bg-blue-100 dark:bg-blue-900" : "bg-white/50 dark:bg-black/20"
          )}
        >
          <span className="text-sm font-medium">{level.name}</span>
          <Button size="sm" className="h-7 text-xs" onClick={() => onSelectFloor(level.floorId)}>
            Μετάβαση
          </Button>
        </div>
      ))}
    </div>
  );
}
