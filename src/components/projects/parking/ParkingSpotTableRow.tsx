'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Pencil, Trash2, MoreVertical, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParkingSpot } from '@/types/parking';
import { getParkingTypeLabel, getParkingStatusLabel, getParkingStatusColor, formatNumber } from '../utils/parking-utils';

interface ParkingSpotTableRowProps {
  spot: ParkingSpot;
  columnWidths: number[];
  isSelected: boolean;
  onSelectionChange: (selectedIds: string[]) => void;
  onEdit: (spot: ParkingSpot) => void;
  onView: (spot: ParkingSpot) => void;
  onViewFloorPlan: (spot: ParkingSpot) => void;
}

export function ParkingSpotTableRow({
  spot,
  columnWidths,
  isSelected,
  onSelectionChange,
  onEdit,
  onView,
  onViewFloorPlan,
}: ParkingSpotTableRowProps) {
  
  const handleSelect = () => {
      onSelectionChange(
          isSelected ? [] : [spot.id] // Simplified for single row action
      );
  };
    
  return (
    <div
      className={cn(
        'flex items-center border-b px-2 py-1.5 transition-colors cursor-pointer',
        isSelected ? 'bg-blue-100 dark:bg-blue-900/20' : 'hover:bg-muted/50'
      )}
      onClick={handleSelect}
    >
      <div style={{ flex: `0 0 ${columnWidths[0]}px` }} className="flex items-center justify-center px-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleSelect}
          aria-label={`Select row ${spot.code}`}
        />
      </div>
      <div style={{ flex: `0 0 ${columnWidths[1]}px` }} className="px-2 truncate">{spot.code}</div>
      <div style={{ flex: `0 0 ${columnWidths[2]}px` }} className="px-2 truncate">{getParkingTypeLabel(spot.type)}</div>
      <div style={{ flex: `0 0 ${columnWidths[3]}px` }} className="px-2 truncate">{spot.propertyCode}</div>
      <div style={{ flex: `0 0 ${columnWidths[4]}px` }} className="px-2 truncate">{spot.level}</div>
      <div style={{ flex: `0 0 ${columnWidths[5]}px` }} className="px-2 truncate">{formatNumber(spot.area)}</div>
      <div style={{ flex: `0 0 ${columnWidths[6]}px` }} className="px-2 truncate">{formatNumber(spot.price)}</div>
      <div style={{ flex: `0 0 ${columnWidths[7]}px` }} className="px-2 truncate">{formatNumber(spot.value)}</div>
      <div style={{ flex: `0 0 ${columnWidths[8]}px` }} className="px-2 truncate">{formatNumber(spot.valueWithSyndicate)}</div>
      <div style={{ flex: `0 0 ${columnWidths[9]}px` }} className="px-2 truncate">
        <Badge variant="outline" className={cn('text-xs', getParkingStatusColor(spot.status))}>
            {getParkingStatusLabel(spot.status)}
        </Badge>
      </div>
      <div style={{ flex: `0 0 ${columnWidths[10]}px` }} className="px-2 truncate">{spot.owner}</div>
      <div style={{ flex: `0 0 ${columnWidths[11]}px` }} className="px-2 truncate">{spot.floorPlan}</div>
      <div style={{ flex: `0 0 ${columnWidths[12]}px` }} className="px-2 truncate">{spot.constructedBy}</div>
      <div style={{ flex: `0 0 ${columnWidths[13]}px` }} className="flex justify-end items-center px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(spot)}><Eye className="w-4 h-4 mr-2" />Προβολή</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(spot)}><Pencil className="w-4 h-4 mr-2" />Επεξεργασία</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewFloorPlan(spot)}><Map className="w-4 h-4 mr-2" />Κάτοψη</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Διαγραφή</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
