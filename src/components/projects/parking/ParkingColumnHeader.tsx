'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parkingComponentsStyles } from './ParkingComponents.styles';
import { useIconSizes } from '@/hooks/useIconSizes';

interface ParkingColumnHeaderProps {
  column: { key: string; label: string };
  width: number;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (columnKey: string) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

export function ParkingColumnHeader({
  column,
  width,
  sortConfig,
  onSort,
  onResizeStart
}: ParkingColumnHeaderProps) {
  const iconSizes = useIconSizes();
  return (
    <div
      className="border-r last:border-r-0 whitespace-nowrap overflow-hidden relative"
      style={parkingComponentsStyles.columns.header(width)}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-1 -ml-1"
        onClick={() => onSort(column.key)}
      >
        <span>{column.label}</span>
        <ArrowUpDown className={cn(
          `ml-2 ${iconSizes.xs} transition-transform`,
          sortConfig?.key === column.key ? 'text-primary' : 'text-muted-foreground/50',
          sortConfig?.key === column.key && sortConfig.direction === 'desc' && 'rotate-180'
        )} />
      </Button>
      <div 
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
          onMouseDown={onResizeStart}
      />
    </div>
  );
}
