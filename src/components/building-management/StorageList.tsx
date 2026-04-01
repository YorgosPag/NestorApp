'use client';

import React, { useState } from 'react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';

import { StorageListHeader } from './StorageList/StorageListHeader';
import { StorageCardsView } from './StorageList/StorageCardsView';
import { StorageTableView } from './StorageList/StorageTableView';
import { StorageListSummary } from './StorageList/StorageListSummary';
import { EmptyList } from './StorageList/EmptyList';
import '@/lib/design-system';

interface StorageListProps {
  units: StorageUnit[];
  onEdit: (unit: StorageUnit) => void;
  onDelete: (propertyId: string) => void;
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
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  const handleSelectProperty = (propertyId: string) => {
    setSelectedProperties(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedProperties(units.map(u => u.id));
    } else {
      setSelectedProperties([]);
    }
  };

  const handleBulkDelete = () => {
    // A confirmation dialog would be ideal here in a real app
    selectedProperties.forEach(propertyId => onDelete(propertyId));
    setSelectedProperties([]);
  };

  if (units.length === 0) {
    return <EmptyList />;
  }

  return (
    <div className="space-y-2">
      <StorageListHeader
        totalCount={units.length}
        selectedCount={selectedProperties.length}
        onBulkDelete={handleBulkDelete}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'cards' ? (
        <StorageCardsView
          units={units}
          selectedProperties={selectedProperties}
          onSelectProperty={handleSelectProperty}
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
          selectedProperties={selectedProperties}
          onSelectProperty={handleSelectProperty}
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
