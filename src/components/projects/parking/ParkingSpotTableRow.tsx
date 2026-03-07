'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { UnitBadge } from '@/core/badges';
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
import { formatNumber } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import styles from '@/components/ui/table/EnterpriseTable.module.css';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingSpotTableRowProps {
  spot: ParkingSpot;
  columnWidths: readonly number[];
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
  const { t } = useTranslation('parking');
  const { t: tProjects } = useTranslation('projects');
  const iconSizes = useIconSizes();

  const handleSelect = () => {
    onSelectionChange(isSelected ? [] : [spot.id]);
  };

  return (
    <div
      className={cn(
        styles.tableRow,
        isSelected ? styles.tableRowSelected : '',
        INTERACTIVE_PATTERNS.SUBTLE_HOVER
      )}
      onClick={handleSelect}
      role="row"
      aria-selected={isSelected}
      aria-label={`Parking spot ${spot.number}`}
    >
      {/* Checkbox */}
      <div className={cn(styles.tableColumn, styles.columnCheckbox)} role="gridcell" aria-label="Selection">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleSelect}
          className={styles.tableCheckbox}
          aria-label={`Select parking spot ${spot.number}`}
        />
      </div>

      {/* Number (was code) */}
      <div className={cn(styles.tableColumn, styles.columnText)} role="gridcell" aria-label="Number">
        {spot.number}
      </div>

      {/* Type */}
      <div className={cn(styles.tableColumn, styles.columnText)} role="gridcell" aria-label="Type">
        {t(`types.${spot.type || 'standard'}`)}
      </div>

      {/* Floor (was level) */}
      <div className={cn(styles.tableColumn, styles.columnText)} role="gridcell" aria-label="Floor">
        {spot.floor || '—'}
      </div>

      {/* Area */}
      <div className={cn(styles.tableColumn, styles.columnNumber)} role="gridcell" aria-label="Area">
        {formatNumber(spot.area ?? 0)}
      </div>

      {/* Price */}
      <div className={cn(styles.tableColumn, styles.columnNumber)} role="gridcell" aria-label="Price">
        {formatNumber(spot.price ?? 0)}
      </div>

      {/* Status */}
      <div className={cn(styles.tableColumn, styles.columnBadge)} role="gridcell" aria-label="Status">
        <UnitBadge
          status={spot.status || 'available'}
          variant="outline"
          size="sm"
          className="text-xs"
        />
      </div>

      {/* Location */}
      <div className={cn(styles.tableColumn, styles.columnText)} role="gridcell" aria-label="Location">
        {spot.location || '—'}
      </div>

      {/* Actions */}
      <div className={cn(styles.tableColumn, styles.columnActions)} role="gridcell" aria-label="Actions">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(styles.actionButton, iconSizes.md)}
              aria-label={`Actions for parking spot ${spot.number}`}
            >
              <MoreVertical className={iconSizes.xs} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(spot)}>
              <Eye className={`${iconSizes.sm} mr-2`} />
              {tProjects('parking.actions.view')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(spot)}>
              <Pencil className={`${iconSizes.sm} mr-2`} />
              {tProjects('parking.actions.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewFloorPlan(spot)}>
              <Map className={`${iconSizes.sm} mr-2`} />
              {tProjects('parking.actions.floorPlan')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className={`${iconSizes.sm} mr-2`} />
              {tProjects('parking.actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
