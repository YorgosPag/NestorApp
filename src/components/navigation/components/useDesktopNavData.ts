/**
 * useDesktopNavData — Memoized data and filtering logic for DesktopMultiColumn.
 *
 * Extracts all useMemo computations, data hooks, and tab-selection callbacks
 * so the main component stays under 500 lines (Google SRP).
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import { EntityLinkingService } from '@/services/entity-linking';
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { NavigationProperty, NavigationParkingSpot } from '@/components/navigation/core/types';
import type { StorageUnit, SelectedBuildingSpace } from '@/components/navigation/components/BuildingSpacesTabs';

const logger = createModuleLogger('useDesktopNavData');

/** Generic filter for navigation items by search term and active filters. */
export function filterData<T extends { companyName?: string; name?: string; industry?: string }>(
  data: T[],
  searchTerm: string,
  _activeFilters: string[]
): T[] {
  return data.filter(item => {
    const searchMatch = !searchTerm ||
      (item.companyName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.name?.toLowerCase().includes(searchTerm.toLowerCase()));

    // Active filters — simplified for now
    const filterMatch = _activeFilters.length === 0 || true; // TODO: implement proper filtering

    return searchMatch && filterMatch;
  });
}

/** Static placeholder data — will be replaced by real API data. */
export const AVAILABLE_PROJECTS = [
  { id: 'proj_1', name: 'Νέο Έργο Αθήνας', subtitle: 'Διαθέσιμο για σύνδεση' },
  { id: 'proj_2', name: 'Κτίριο Γραφείων Πειραιά', subtitle: 'Διαθέσιμο για σύνδεση' },
  { id: 'proj_3', name: 'Οικιστικό Συγκρότημα', subtitle: 'Διαθέσιμο για σύνδεση' },
];

export const AVAILABLE_UNITS = [
  { id: 'unit_1', name: 'Διαμέρισμα 1.1', subtitle: 'Διαθέσιμο για σύνδεση' },
  { id: 'unit_2', name: 'Διαμέρισμα 1.2', subtitle: 'Διαθέσιμο για σύνδεση' },
  { id: 'unit_3', name: 'Γραφείο Α1', subtitle: 'Διαθέσιμο για σύνδεση' },
  { id: 'unit_4', name: 'Αποθήκη', subtitle: 'Διαθέσιμο για σύνδεση' },
];

/**
 * Hook that computes all memoized navigation data for the multi-column layout.
 *
 * Returns derived collections (buildings, units, storages, parking) and
 * tab-selection callbacks so the rendering component stays thin.
 */
export function useDesktopNavData(isBuildingModalOpen: boolean) {
  const {
    selectedProject,
    selectedBuilding,
    selectProperty,
    getBuildingsForProject,
    getPropertiesForBuilding,
  } = useNavigation();

  const { t } = useTranslation('navigation');

  // Parking spots for selected building
  const { parkingSpots } = useFirestoreParkingSpots({
    buildingId: selectedBuilding?.id,
    autoFetch: !!selectedBuilding,
  });

  // Storages — loaded globally, filtered by building
  const { storages } = useFirestoreStorages();

  // State for available buildings (loaded via EntityLinkingService)
  const [availableBuildings, setAvailableBuildings] = useState<
    Array<{ id: string; name: string; subtitle: string }>
  >([]);
  const [, setLoadingBuildings] = useState(false);

  // Selected building space (units / storage / parking)
  const [selectedBuildingSpace, setSelectedBuildingSpace] =
    useState<SelectedBuildingSpace | null>(null);

  // ── Memoized buildings for the selected project ──
  const projectBuildings = useMemo(() => {
    if (!selectedProject) return [];
    return getBuildingsForProject(selectedProject.id);
  }, [selectedProject, getBuildingsForProject]);

  // ── Load available buildings via EntityLinkingService ──
  const loadAvailableBuildings = useCallback(async () => {
    if (!selectedProject) return;
    setLoadingBuildings(true);
    try {
      const result = await EntityLinkingService.getAvailableBuildingsForProject(selectedProject.id);
      if (result.success) {
        const projectBuildingIds = new Set(projectBuildings.map(b => b.id));
        const filtered = result.entities
          .filter(b => !projectBuildingIds.has(b.id))
          .map(b => ({
            id: b.id,
            name: b.name,
            subtitle: b.subtitle || t('modals.availableForLinking'),
          }));
        setAvailableBuildings(filtered);
        logger.info('Loaded available buildings via EntityLinkingService', { count: filtered.length });
      } else {
        logger.error('EntityLinkingService error', { error: result.error });
        setAvailableBuildings([]);
      }
    } catch (error) {
      logger.error('Error loading available buildings', { error });
      setAvailableBuildings([]);
    } finally {
      setLoadingBuildings(false);
    }
  }, [selectedProject, projectBuildings, t]);

  // Re-load buildings when modal opens
  useEffect(() => {
    if (isBuildingModalOpen) {
      loadAvailableBuildings();
    }
  }, [isBuildingModalOpen, loadAvailableBuildings]);

  // ── Storage type check ──
  const isStorageType = useCallback((item: NavigationProperty): boolean => {
    const type = (item.type || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    return (
      type.includes('storage') ||
      type.includes('αποθήκη') ||
      type.includes('αποθηκη') ||
      name.includes('αποθήκη') ||
      name.includes('αποθηκη')
    );
  }, []);

  // ── Building properties (excluding storages) ──
  const buildingProperties = useMemo((): NavigationProperty[] => {
    if (!selectedBuilding) return [];
    const realtimeProperties = getPropertiesForBuilding(selectedBuilding.id);
    return realtimeProperties
      .filter(prop => !isStorageType(prop as unknown as NavigationProperty))
      .map(prop => ({
        id: prop.id,
        name: prop.name,
        type: (prop.type || 'apartment') as NavigationProperty['type'],
        floor: prop.floor || 0,
        area: prop.area || 0,
        status: (prop.status || 'owner') as NavigationProperty['status'],
      }));
  }, [selectedBuilding, getPropertiesForBuilding, isStorageType]);

  // ── Building storages (API + legacy) ──
  const buildingStorages = useMemo((): StorageUnit[] => {
    if (!selectedBuilding) return [];

    const apiStorages: StorageUnit[] = (storages || [])
      .filter(storage => {
        if (storage.buildingId) return storage.buildingId === selectedBuilding.id;
        return storage.building === selectedBuilding.name;
      })
      .map(storage => ({
        id: storage.id,
        name: storage.name,
        type: storage.type as 'basement' | 'ground' | 'external' | undefined,
        area: storage.area,
        status: storage.status as StorageUnit['status'],
      }));

    const realtimeProperties = getPropertiesForBuilding(selectedBuilding.id);
    const legacyStorages: StorageUnit[] = realtimeProperties
      .filter(prop => isStorageType(prop as unknown as NavigationProperty))
      .map(prop => ({
        id: prop.id,
        name: prop.name,
        type: 'basement' as const,
        area: prop.area,
        status: (prop.status || 'owner') as StorageUnit['status'],
      }));

    const allStorages = [...apiStorages];
    legacyStorages.forEach(legacy => {
      if (!allStorages.some(s => s.id === legacy.id)) {
        allStorages.push(legacy);
      }
    });
    return allStorages;
  }, [selectedBuilding, storages, getPropertiesForBuilding, isStorageType]);

  // ── Building parking spots ──
  const buildingParkingSpots = useMemo((): NavigationParkingSpot[] => {
    if (!selectedBuilding || !parkingSpots) return [];
    return parkingSpots.map(spot => ({
      id: spot.id,
      number: spot.number,
      type: (spot.type || 'standard') as NavigationParkingSpot['type'],
      status: (spot.status || 'available') as 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved',
      location: (spot.location || 'ground') as NavigationParkingSpot['location'],
    }));
  }, [selectedBuilding, parkingSpots]);

  // ── Tab selection callbacks ──
  const handlePropertySelectFromTabs = useCallback(
    (property: NavigationProperty) => {
      selectProperty({ id: property.id, name: property.name, type: property.type });
      setSelectedBuildingSpace({ id: property.id, name: property.name, type: 'properties' });
    },
    [selectProperty]
  );

  const handleStorageSelectFromTabs = useCallback((storage: StorageUnit) => {
    setSelectedBuildingSpace({ id: storage.id, name: storage.name, type: 'storage' });
  }, []);

  const handleParkingSelectFromTabs = useCallback((parking: NavigationParkingSpot) => {
    setSelectedBuildingSpace({ id: parking.id, name: `Θέση ${parking.number}`, type: 'parking' });
  }, []);

  return {
    projectBuildings,
    availableBuildings,
    buildingProperties,
    buildingStorages,
    buildingParkingSpots,
    selectedBuildingSpace,
    handlePropertySelectFromTabs,
    handleStorageSelectFromTabs,
    handleParkingSelectFromTabs,
  };
}
