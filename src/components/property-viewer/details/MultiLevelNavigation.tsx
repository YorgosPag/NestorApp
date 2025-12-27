'use client';

import React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface MultiLevelNavigationProps {
  property: Property;
  onSelectFloor: (floorId: string | null) => void;
  currentFloorId: string | null;
}

export function MultiLevelNavigation({ property, onSelectFloor, currentFloorId }: MultiLevelNavigationProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  if (!property.levels) return null;

  return (
    <div className={`${colors.bg.info} ${getStatusBorder('info')} p-3 space-y-2`}>
      <h4 className={`text-xs font-semibold ${colors.text.info} flex items-center gap-2`}>
        <ChevronsUpDown className={iconSizes.sm} />
        Επίπεδα Ακινήτου
      </h4>
      {property.levels.map((level) => (
        <div 
          key={level.floorId}
          className={cn(
            `p-2 ${radius.md} flex items-center justify-between transition-colors`,
            currentFloorId === level.floorId ? `${colors.bg.info}` : `${colors.bg.secondary}`
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
