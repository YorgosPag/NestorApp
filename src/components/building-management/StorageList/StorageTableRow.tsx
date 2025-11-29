'use client';

import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { CommonBadge } from "@/core/badges";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, Ruler, Euro, Building } from 'lucide-react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { formatPrice, formatArea } from '../StorageCard/StorageCardUtils';
import { cn } from '@/lib/utils';
import { StorageRowActions } from './StorageRowActions';

interface StorageTableRowProps {
  unit: StorageUnit;
  isSelected: boolean;
  onSelectUnit: (unitId: string) => void;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (unitId: string) => void;
  getStatusColor: (status: StorageStatus) => string;
  getStatusLabel: (status: StorageStatus) => string;
  getTypeIcon: (type: StorageType) => React.ElementType;
  getTypeLabel: (type: StorageType) => string;
}

export function StorageTableRow({
  unit,
  isSelected,
  onSelectUnit,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel,
}: StorageTableRowProps) {
  const TypeIcon = getTypeIcon(unit.type);

  return (
    <TableRow data-state={isSelected ? "selected" : ""}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelectUnit(unit.id)}
          aria-label={`Select row ${unit.code}`}
        />
      </TableCell>
      <TableCell>
        <div className="font-medium text-foreground">{unit.code}</div>
        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
          {unit.description}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4" />
          <span className="text-sm">{getTypeLabel(unit.type)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <Building className="w-3 h-3 text-muted-foreground" />
          {unit.floor}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <Ruler className="w-3 h-3 text-muted-foreground" />
          {formatArea(unit.area)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm font-medium">
          <Euro className="w-3 h-3 text-muted-foreground" />
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
            <Link className="w-3 h-3" />
            {unit.linkedProperty}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <StorageRowActions unit={unit} onEdit={onEdit} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
}
