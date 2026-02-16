/**
 * StorageTab — Building Storage Management Tab (Storage-only, no parking)
 *
 * Lists, creates, edits and deletes storage units for a building.
 * Uses API routes (/api/storages) for proper tenant isolation.
 *
 * ARCHITECTURE FIX (2026-02-17):
 * - Removed parking (now in separate ParkingTabContent — ADR-184)
 * - Replaced Client SDK with API-based approach for tenant isolation
 * - CRUD operations now persist to Firestore via API endpoints
 *
 * @module components/building-management/StorageTab
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { useEffect } from 'react';

const logger = createModuleLogger('StorageTab');

import { StorageList } from './StorageList';
import { StorageForm } from './StorageForm/index';
import { StorageTabHeader } from './StorageTab/StorageTabHeader';
import { StorageTabStats } from './StorageTab/StorageTabStats';
import { StorageTabFilters } from './StorageTab/StorageTabFilters';
import { StorageMapPlaceholder } from './StorageTab/StorageMapPlaceholder';
import { Spinner } from '@/components/ui/spinner';
import {
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel,
  filterUnits,
  calculateStats,
} from './StorageTab/utils';

// ============================================================================
// TYPES
// ============================================================================

interface StorageTabProps {
  building: {
    id: string;
    name: string;
    project: string;
    company: string;
  };
}

interface StoragesApiResponse {
  storages: StorageUnit[];
  count: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageTab({ building }: StorageTabProps) {
  const { t } = useTranslation('building');

  const [units, setUnits] = useState<StorageUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const translatedGetStatusLabel = useCallback(
    (status: StorageStatus) => getStatusLabel(status, t),
    [t]
  );

  const translatedGetTypeLabel = useCallback(
    (type: StorageType) => getTypeLabel(type, t),
    [t]
  );

  // ============================================================================
  // FETCH — API-based with tenant isolation
  // ============================================================================

  const fetchStorageUnits = useCallback(async () => {
    try {
      setLoading(true);

      const result = await apiClient.get<StoragesApiResponse>(
        `/api/storages?buildingId=${building.id}`
      );

      if (result?.storages) {
        // Map API Storage type to StorageUnit (compatibility layer)
        const storageUnits: StorageUnit[] = result.storages.map(s => ({
          id: s.id,
          code: s.code || `S-${s.id.substring(0, 6)}`,
          type: (s.type || 'small') as StorageType,
          status: (s.status || 'available') as StorageStatus,
          floor: s.floor || '',
          area: typeof s.area === 'number' ? s.area : 0,
          price: typeof s.price === 'number' ? s.price : 0,
          description: s.description || '',
          building: s.building || building.name,
          project: s.project || '',
          company: s.company || '',
          linkedProperty: s.linkedProperty ?? null,
          features: s.features || [],
          coordinates: s.coordinates || { x: 0, y: 0 },
        }));

        setUnits(storageUnits);
        logger.info('Loaded storage units via API', { count: storageUnits.length, buildingId: building.id });
      }
    } catch (error) {
      logger.error('Error fetching storage units', { error });
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [building.id, building.name]);

  useEffect(() => {
    fetchStorageUnits();
  }, [fetchStorageUnits]);

  // ============================================================================
  // STATE
  // ============================================================================

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<StorageType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StorageStatus | 'all'>('all');
  const filterFloor = 'all';
  const [editingUnit, setEditingUnit] = useState<StorageUnit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const formType: StorageType = 'storage';
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const filteredUnits = useMemo(() =>
    filterUnits(units, searchTerm, filterType, filterStatus, filterFloor),
    [units, searchTerm, filterType, filterStatus, filterFloor]
  );

  const stats = useMemo(() => calculateStats(filteredUnits), [filteredUnits]);

  // ============================================================================
  // CRUD HANDLERS — API-based (persist to Firestore)
  // ============================================================================

  const handleAddNew = () => {
    setEditingUnit(null);
    setShowForm(true);
  };

  const handleEdit = (unit: StorageUnit) => {
    setEditingUnit(unit);
    setShowForm(true);
  };

  const handleSave = async (unit: StorageUnit) => {
    try {
      if (editingUnit) {
        // UPDATE — PATCH /api/storages/[id]
        await apiClient.patch(`/api/storages/${editingUnit.id}`, {
          name: unit.code,
          type: unit.type,
          status: unit.status,
          floor: unit.floor || null,
          area: unit.area || null,
          price: unit.price || null,
          description: unit.description || null,
        });
        logger.info('Storage unit updated via API', { id: editingUnit.id });
      } else {
        // CREATE — POST /api/storages
        await apiClient.post('/api/storages', {
          name: unit.code,
          buildingId: building.id,
          type: unit.type || 'small',
          status: unit.status || 'available',
          floor: unit.floor || undefined,
          area: unit.area || undefined,
          price: unit.price || undefined,
          description: unit.description || undefined,
          building: building.name,
        });
        logger.info('Storage unit created via API', { buildingId: building.id });
      }

      // Re-fetch to get fresh data from server
      await fetchStorageUnits();
    } catch (error) {
      logger.error('Error saving storage unit', { error });
    }

    setShowForm(false);
    setEditingUnit(null);
  };

  const handleDelete = async (unitId: string) => {
    try {
      await apiClient.delete(`/api/storages/${unitId}`);
      logger.info('Storage unit deleted via API', { id: unitId });

      // Re-fetch to get fresh data
      await fetchStorageUnits();
    } catch (error) {
      logger.error('Error deleting storage unit', { error });
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

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
        available={stats.available}
        totalValue={stats.totalValue}
        totalArea={stats.totalArea}
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
