
'use client';

import React, { useState, useMemo } from 'react';
import type { StorageUnit, StorageType } from '@/types/storage';
import { mockStorageUnits } from './StorageTab/mock-data';

import { StorageList } from './StorageList';
import { StorageForm } from './StorageForm/index';
import { StorageTabHeader } from './StorageTab/StorageTabHeader';
import { StorageTabStats } from './StorageTab/StorageTabStats';
import { StorageTabFilters } from './StorageTab/StorageTabFilters';
import { StorageMapPlaceholder } from './StorageTab/StorageMapPlaceholder';
import {
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel,
  filterUnits,
  calculateStats,
} from './StorageTab/utils';

interface StorageTabProps {
  building: {
    id: number;
    name: string;
    project: string;
    company: string;
  };
}

export function StorageTab({ building }: StorageTabProps) {
  const [units, setUnits] = useState<StorageUnit[]>(mockStorageUnits);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<StorageType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<any>('all');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [editingUnit, setEditingUnit] = useState<StorageUnit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<StorageType>('storage');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const filteredUnits = useMemo(() => 
    filterUnits(units, searchTerm, filterType, filterStatus, filterFloor), 
    [units, searchTerm, filterType, filterStatus, filterFloor]
  );
  
  const stats = useMemo(() => calculateStats(filteredUnits), [filteredUnits]);

  const handleAddNew = (type: StorageType) => {
    setEditingUnit(null);
    setFormType(type);
    setShowForm(true);
  };

  const handleEdit = (unit: StorageUnit) => {
    setEditingUnit(unit);
    setFormType(unit.type);
    setShowForm(true);
  };

  const handleSave = (unit: StorageUnit) => {
    if (editingUnit) {
      setUnits(units => units.map(u => u.id === unit.id ? unit : u));
    } else {
      setUnits(units => [...units, { ...unit, id: `new_${Date.now()}` }]);
    }
    setShowForm(false);
    setEditingUnit(null);
  };

  const handleDelete = (unitId: string) => {
    setUnits(units => units.filter(u => u.id !== unitId));
  };

  return (
    <div className="space-y-6">
      <StorageTabHeader 
        buildingName={building.name}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onAddNew={handleAddNew}
      />
      
      <StorageTabStats 
        storageCount={stats.storageCount}
        parkingCount={stats.parkingCount}
        available={stats.available}
        totalValue={stats.totalValue}
      />

      <StorageTabFilters 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />

      {viewMode === 'list' ? (
        <StorageList
          units={filteredUnits}
          onEdit={handleEdit}
          onDelete={handleDelete}
          getStatusColor={getStatusColor}
          getStatusLabel={getStatusLabel}
          getTypeIcon={getTypeIcon}
          getTypeLabel={getTypeLabel}
        />
      ) : (
        <StorageMapPlaceholder />
      )}

      {showForm && (
        <StorageForm
          unit={editingUnit}
          building={building}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingUnit(null);
          }}
          formType={formType}
        />
      )}
    </div>
  );
}
