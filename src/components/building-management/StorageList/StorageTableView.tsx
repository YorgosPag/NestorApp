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
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

interface StorageTableViewProps {
  units: StorageUnit[];
  selectedProperties: string[];
  onSelectProperty: (propertyId: string) => void;
  onSelectAll: (checked: boolean | 'indeterminate') => void;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (propertyId: string) => void;
  getStatusColor: (status: StorageStatus) => string;
  getStatusLabel: (status: StorageStatus) => string;
  getTypeIcon: (type: StorageType) => React.ElementType;
  getTypeLabel: (type: StorageType) => string;
}

export function StorageTableView({
  units,
  selectedProperties,
  onSelectProperty,
  onSelectAll,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel
}: StorageTableViewProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const allSelected = selectedProperties.length === units.length && units.length > 0;
  const isIndeterminate = selectedProperties.length > 0 && !allSelected;

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
                    aria-label={t('storageTable.selectAll')}
                    data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
                  />
                </TableHead>
                <TableHead>{t('storageTable.columns.code')}</TableHead>
                <TableHead>{t('storageTable.columns.type')}</TableHead>
                <TableHead>{t('storageTable.columns.floor')}</TableHead>
                <TableHead>{t('storageTable.columns.area')}</TableHead>
                <TableHead>{t('storageTable.columns.price')}</TableHead>
                <TableHead>{t('storageTable.columns.status')}</TableHead>
                <TableHead>{t('storageTable.columns.linked')}</TableHead>
                <TableHead className="text-right">{t('storageTable.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <StorageTableRow
                  key={unit.id}
                  unit={unit}
                  isSelected={selectedProperties.includes(unit.id)}
                  onSelectProperty={onSelectProperty}
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
