'use client';

import React, { useState } from 'react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';

import { StorageListHeader } from './StorageList/StorageListHeader';
import { StorageCardsView } from './StorageList/StorageCardsView';
import { StorageTableView } from './StorageList/StorageTableView';
import { StorageListSummary } from './StorageList/StorageListSummary';
import { EmptyList } from './StorageList/EmptyList';

interface StorageListProps {
  units: StorageUnit[];
  onEdit: (unit: StorageUnit) => void;
  onDelete: (unitId: string) => void;
  getStatusColor: (status: StorageStatus) => string;
  getStatusLabel: (status: StorageStatus) => string;
  getTypeIcon: (type: StorageType) => React.ElementType;
  getTypeLabel: (type: StorageType) => string;
}

export function StorageList({ 
  units, 
  onEdit, 
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel
}: StorageListProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  const handleSelectUnit = (unitId: string) => {
    setSelectedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedUnits(units.map(u => u.id));
    } else {
      setSelectedUnits([]);
    }
  };

  const handleBulkDelete = () => {
    // A confirmation dialog would be ideal here in a real app
    selectedUnits.forEach(unitId => onDelete(unitId));
    setSelectedUnits([]);
  };

  if (units.length === 0) {
    return <EmptyList />;
  }

  return (
    <div className="space-y-2">
      <StorageListHeader
        totalCount={units.length}
        selectedCount={selectedUnits.length}
        onBulkDelete={handleBulkDelete}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'cards' ? (
        <StorageCardsView
          units={units}
          selectedUnits={selectedUnits}
          onSelectUnit={handleSelectUnit}
          onEdit={onEdit}
          onDelete={onDelete}
          getStatusColor={getStatusColor}
          getStatusLabel={getStatusLabel}
          getTypeIcon={getTypeIcon}
          getTypeLabel={getTypeLabel}
        />
      ) : (
        <StorageTableView
          units={units}
          selectedUnits={selectedUnits}
          onSelectUnit={handleSelectUnit}
          onSelectAll={handleSelectAll}
          onEdit={onEdit}
          onDelete={onDelete}
          getStatusColor={getStatusColor}
          getStatusLabel={getStatusLabel}
          getTypeIcon={getTypeIcon}
          getTypeLabel={getTypeLabel}
        />
      )}

      <StorageListSummary units={units} />
    </div>
  );
}
