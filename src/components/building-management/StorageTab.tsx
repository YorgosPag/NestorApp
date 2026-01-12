
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { StorageList } from './StorageList';
import { StorageForm } from './StorageForm/index';
import { StorageTabHeader } from './StorageTab/StorageTabHeader';
import { StorageTabStats } from './StorageTab/StorageTabStats';
import { StorageTabFilters } from './StorageTab/StorageTabFilters';
import { StorageMapPlaceholder } from './StorageTab/StorageMapPlaceholder';
// 🏢 ENTERPRISE: Centralized spinner component
import { Spinner } from '@/components/ui/spinner';
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
    id: string;
    name: string;
    project: string;
    company: string;
  };
}

export function StorageTab({ building }: StorageTabProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');

  const [units, setUnits] = useState<StorageUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // 🏢 ENTERPRISE: i18n-enabled wrapper functions for utilities
  const translatedGetStatusLabel = useCallback(
    (status: StorageStatus) => getStatusLabel(status, t),
    [t]
  );

  const translatedGetTypeLabel = useCallback(
    (type: StorageType) => getTypeLabel(type, t),
    [t]
  );

  // 🔥 ΦΟΡΤΩΣΗ ΠΡΑΓΜΑΤΙΚΩΝ STORAGE UNITS ΑΠΟ FIREBASE
  useEffect(() => {
    const fetchStorageUnits = async () => {
      try {
        setLoading(true);

        // Φόρτωση storage units για το συγκεκριμένο κτίριο
        const storageQuery = query(
          collection(db, COLLECTIONS.STORAGE),
          where('building', '==', building.name)
        );

        const snapshot = await getDocs(storageQuery);
        const storageUnits = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StorageUnit[];

        setUnits(storageUnits);
        console.log(`✅ Loaded ${storageUnits.length} storage units for building: ${building.name}`);

      } catch (error) {
        console.error('❌ Error fetching storage units from Firebase:', error);
        setUnits([]); // Κενό array αντί για mock data
      } finally {
        setLoading(false);
      }
    };

    fetchStorageUnits();
  }, [building.name]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<StorageType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StorageStatus | 'all'>('all');
  // 🏢 ENTERPRISE: filterFloor ready for future floor filter UI implementation
  const filterFloor = 'all'; // Static value until floor filter UI is added
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

  // 🏢 ENTERPRISE: Loading state with centralized spinner
  if (loading) {
    return (
      <section className="flex items-center justify-center py-12" role="status" aria-live="polite">
        <div className="text-center">
          <Spinner size="large" className="mx-auto mb-4" />
          <p className="text-muted-foreground">{t('tabs.storageTab.loading')}</p>
        </div>
      </section>
    );
  }

  return (
    <article className="space-y-6">
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
          getStatusLabel={translatedGetStatusLabel}
          getTypeIcon={getTypeIcon}
          getTypeLabel={translatedGetTypeLabel}
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
    </article>
  );
}
