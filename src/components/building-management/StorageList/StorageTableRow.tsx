'use client';

import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { CommonBadge } from "@/core/badges";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, Ruler, Euro } from 'lucide-react';
import type { StorageUnit } from '@/types/storage';

// 🏢 ENTERPRISE: Type aliases for StorageUnit (legacy interface)
type StorageUnitType = StorageUnit['type']; // 'storage' | 'parking'
type StorageUnitStatus = StorageUnit['status']; // 'available' | 'sold' | 'reserved' | 'maintenance'
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { formatPrice, formatArea } from '../StorageCard/StorageCardUtils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { StorageRowActions } from './StorageRowActions';
import '@/lib/design-system';

interface StorageTableRowProps {
  unit: StorageUnit;
  isSelected: boolean;
  onSelectProperty: (propertyId: string) => void;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (propertyId: string) => void;
  getStatusColor: (status: StorageUnitStatus) => string;
  getStatusLabel: (status: StorageUnitStatus) => string;
  getTypeIcon: (type: StorageUnitType) => React.ElementType;
  getTypeLabel: (type: StorageUnitType) => string;
}

export function StorageTableRow({
  unit,
  isSelected,
  onSelectProperty,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel,
}: StorageTableRowProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const TypeIcon = getTypeIcon(unit.type);

  return (
    <TableRow data-state={isSelected ? "selected" : ""}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelectProperty(unit.id)}
          aria-label={`Select row ${unit.code}`}
        />
      </TableCell>
      <TableCell>
        <div className="font-medium text-foreground">{unit.code}</div>
        <div className={cn("text-sm truncate max-w-[200px]", colors.text.muted)}>
          {unit.description}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <TypeIcon className={iconSizes.sm} />
          <span className="text-sm">{getTypeLabel(unit.type)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          {/* 🏢 ENTERPRISE: Using centralized floor icon/color for floor display */}
          <NAVIGATION_ENTITIES.floor.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.floor.color)} />
          {unit.floor}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <Ruler className={`${iconSizes.xs} ${colors.text.muted}`} />
          {formatArea(unit.area)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm font-medium">
          <Euro className={`${iconSizes.xs} ${colors.text.muted}`} />
          {formatPrice(unit.price)}
        </div>
      </TableCell>
      <TableCell>
        <CommonBadge
          status="building"
          customLabel={getStatusLabel(unit.status)}
          className={cn("text-xs text-white", getStatusColor(unit.status))}
        />
      </TableCell>
      <TableCell>
        {unit.linkedProperty ? (
          <div className="flex items-center gap-1 text-sm text-primary">
            <Link className={iconSizes.xs} />
            {unit.linkedProperty}
          </div>
        ) : (
          <span className={cn("text-sm", colors.text.muted)}>-</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <StorageRowActions unit={unit} onEdit={onEdit} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
}
