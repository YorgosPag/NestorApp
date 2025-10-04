'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from "@/components/ui/checkbox";
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { StorageTableRow } from './StorageTableRow';

interface StorageTableViewProps {
  units: StorageUnit[];
  selectedUnits: string[];
  onSelectUnit: (unitId: string) => void;
  onSelectAll: (checked: boolean | 'indeterminate') => void;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (unitId: string) => void;
  getStatusColor: (status: StorageStatus) => string;
  getStatusLabel: (status: StorageStatus) => string;
  getTypeIcon: (type: StorageType) => React.ElementType;
  getTypeLabel: (type: StorageType) => string;
}

export function StorageTableView({
  units,
  selectedUnits,
  onSelectUnit,
  onSelectAll,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel
}: StorageTableViewProps) {
  const allSelected = selectedUnits.length === units.length && units.length > 0;
  const isIndeterminate = selectedUnits.length > 0 && !allSelected;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                    aria-label="Select all rows"
                    data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
                  />
                </TableHead>
                <TableHead>Κωδικός</TableHead>
                <TableHead>Τύπος</TableHead>
                <TableHead>Όροφος</TableHead>
                <TableHead>Επιφάνεια</TableHead>
                <TableHead>Τιμή</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead>Συνδεδεμένο</TableHead>
                <TableHead className="text-right">Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <StorageTableRow
                  key={unit.id}
                  unit={unit}
                  isSelected={selectedUnits.includes(unit.id)}
                  onSelectUnit={onSelectUnit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                  getTypeIcon={getTypeIcon}
                  getTypeLabel={getTypeLabel}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
