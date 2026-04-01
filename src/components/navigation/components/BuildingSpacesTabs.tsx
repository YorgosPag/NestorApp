'use client';

/**
 * 🏢 ENTERPRISE: Building Spaces Tabs Component
 *
 * Εμφανίζει tabs για τις τρεις ισότιμες κατηγορίες χώρων μέσα σε ένα Building:
 * - Μονάδες (Units)
 * - Αποθήκες (Storage)
 * - Θέσεις Στάθμευσης (Parking)
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ (local_4.log):
 * ❌ ΟΧΙ: Parking/Storage ως "παρακολουθήματα" ή children των Units
 * ✅ ΝΑΙ: Parking/Storage/Units ως ισότιμες παράλληλες κατηγορίες στο Building context
 *
 * @see REAL_ESTATE_HIERARCHY_DOCUMENTATION.md
 * @see navigation-entities.ts - Single Source of Truth για icons/colors
 */

import React, { useState, useMemo } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
import { NavigationButton } from './NavigationButton';
import { NavigationCardToolbar } from './NavigationCardToolbar';
import { NAVIGATION_ENTITIES } from '../config';
import { ContextualNavigationService } from '@/services/navigation/ContextualNavigationService';
import type { NavigationProperty, NavigationParkingSpot } from '../core/types';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

// =============================================================================
// 🏢 ENTERPRISE TYPE DEFINITIONS
// =============================================================================

/**
 * Storage unit interface - matches database structure
 */
export interface StorageUnit {
  id: string;
  name: string;
  type?: 'basement' | 'ground' | 'external';
  area?: number;
  status?: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
}

/**
 * Tab identifiers for building spaces
 */
export type BuildingSpaceTab = 'properties' | 'storage' | 'parking';

/**
 * Selected item state - can be any of the three types
 */
export interface SelectedBuildingSpace {
  id: string;
  name: string;
  type: BuildingSpaceTab;
}

/**
 * Props for the BuildingSpacesTabs component
 */
interface BuildingSpacesTabsProps {
  /** List of units in the building */
  units: NavigationProperty[];
  /** List of storage areas in the building */
  storages: StorageUnit[];
  /** List of parking spots in the building */
  parkingSpots: NavigationParkingSpot[];
  /** Currently selected item (any type) */
  selectedItem: SelectedBuildingSpace | null;
  /** Callback when a unit is selected */
  onPropertySelect: (property: NavigationProperty) => void;
  /** Callback when a storage is selected */
  onStorageSelect: (storage: StorageUnit) => void;
  /** Callback when a parking spot is selected */
  onParkingSelect: (parking: NavigationParkingSpot) => void;
  /** Callback for adding new item */
  onAddItem?: (tab: BuildingSpaceTab) => void;
  /** Callback for unlinking item */
  onUnlinkItem?: (tab: BuildingSpaceTab) => void;
  /** Default active tab */
  defaultTab?: BuildingSpaceTab;
  /** Optional className for container */
  className?: string;
}

// =============================================================================
// 🏢 ENTERPRISE COMPONENT
// =============================================================================

/**
 * BuildingSpacesTabs
 *
 * Enterprise-grade tabs component για τις τρεις ισότιμες κατηγορίες χώρων.
 * Χρησιμοποιεί:
 * - TabsOnlyTriggers (κεντρικοποιημένο) για consistent tab styling
 * - NAVIGATION_ENTITIES (κεντρικοποιημένο) για icons/colors
 * - NavigationButton (κεντρικοποιημένο) για consistent item styling
 */
export function BuildingSpacesTabs({
  units,
  storages,
  parkingSpots,
  selectedItem,
  onPropertySelect,
  onStorageSelect,
  onParkingSelect,
  onAddItem,
  onUnlinkItem,
  defaultTab = 'properties',
  className
}: BuildingSpacesTabsProps) {
  // ==========================================================================
  // i18n HOOK
  // ==========================================================================

  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('navigation');
  const colors = useSemanticColors();

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  const [activeTab, setActiveTab] = useState<BuildingSpaceTab>(defaultTab);

  // Search states for each tab
  const [unitsSearch, setUnitsSearch] = useState('');
  const [storageSearch, setStorageSearch] = useState('');
  const [parkingSearch, setParkingSearch] = useState('');

  // Filter states (for future use)
  const [unitsFilters, setUnitsFilters] = useState<string[]>([]);
  const [storageFilters, setStorageFilters] = useState<string[]>([]);
  const [parkingFilters, setParkingFilters] = useState<string[]>([]);

  // ==========================================================================
  // MEMOIZED FILTERED DATA
  // ==========================================================================

  const filteredUnits = useMemo(() => {
    if (!unitsSearch.trim()) return units;
    const searchLower = unitsSearch.toLowerCase();
    return units.filter(unit =>
      unit.name.toLowerCase().includes(searchLower) ||
      unit.type?.toLowerCase().includes(searchLower)
    );
  }, [units, unitsSearch]);

  const filteredStorages = useMemo(() => {
    if (!storageSearch.trim()) return storages;
    const searchLower = storageSearch.toLowerCase();
    return storages.filter(storage =>
      storage.name.toLowerCase().includes(searchLower) ||
      storage.type?.toLowerCase().includes(searchLower)
    );
  }, [storages, storageSearch]);

  const filteredParkingSpots = useMemo(() => {
    if (!parkingSearch.trim()) return parkingSpots;
    const searchLower = parkingSearch.toLowerCase();
    return parkingSpots.filter(spot =>
      spot.number.toLowerCase().includes(searchLower) ||
      spot.type?.toLowerCase().includes(searchLower)
    );
  }, [parkingSpots, parkingSearch]);

  // ==========================================================================
  // TAB CONFIGURATION - Using centralized NAVIGATION_ENTITIES
  // ==========================================================================

  // 🏢 ENTERPRISE: Tab configuration με χρωματιστά icons για consistency
  // Τα χρώματα προέρχονται από το centralized NAVIGATION_ENTITIES
  // 🏢 ENTERPRISE: Labels χρησιμοποιούν i18n keys για πλήρη μετάφραση
  const tabs: TabDefinition[] = [
    {
      id: 'properties',
      label: t('buildingSpaces.units.title'),
      icon: NAVIGATION_ENTITIES.property.icon,
      iconColor: NAVIGATION_ENTITIES.property.color, // 🟠 text-orange-600
      content: null // Content rendered separately via TabsContent
    },
    {
      id: 'storage',
      label: t('buildingSpaces.storage.title'),
      icon: NAVIGATION_ENTITIES.storage.icon,
      iconColor: NAVIGATION_ENTITIES.storage.color, // 🟡 text-amber-600
      content: null
    },
    {
      id: 'parking',
      label: t('buildingSpaces.parking.title'),
      icon: NAVIGATION_ENTITIES.parking.icon,
      iconColor: NAVIGATION_ENTITIES.parking.color, // 🔵 text-indigo-600
      content: null
    }
  ];

  // ==========================================================================
  // HELPER: Check if item is selected
  // ==========================================================================

  const isItemSelected = (id: string, type: BuildingSpaceTab): boolean => {
    return selectedItem?.id === id && selectedItem?.type === type;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <section
      className={`bg-white dark:bg-card border border-border rounded-lg p-3 overflow-hidden ${className || ''}`}
      role="region"
      aria-label={t('buildingSpaces.sectionLabel')}
    >
      <TabsOnlyTriggers
        tabs={tabs}
        value={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as BuildingSpaceTab)}
        alwaysShowLabels={false}
      >
        {/* ================================================================= */}
        {/* TAB 1: UNITS (Μονάδες) */}
        {/* ================================================================= */}
        <TabsContent value="properties" className="mt-3">
          <NavigationCardToolbar
            level="properties"
            searchTerm={unitsSearch}
            onSearchChange={setUnitsSearch}
            activeFilters={unitsFilters}
            onFiltersChange={setUnitsFilters}
            hasSelectedItems={selectedItem?.type === 'properties'}
            itemCount={filteredUnits.length}
            onNewItem={onAddItem ? () => onAddItem('properties') : undefined}
            onDeleteItem={onUnlinkItem ? () => onUnlinkItem('properties') : undefined}
          />

          <ul
            className="space-y-2 list-none max-h-48 pr-2 overflow-y-auto mt-2"
            role="list"
            aria-label={t('buildingSpaces.units.listLabel')}
            data-navigation-scroll="true"
          >
            {filteredUnits.length === 0 ? (
              <li className={cn("text-center py-4 text-sm", colors.text.muted)}>
                {t('buildingSpaces.units.empty')}
              </li>
            ) : (
              filteredUnits.map(unit => (
                <li key={unit.id}>
                  <NavigationButton
                    onClick={() => onPropertySelect(unit)}
                    icon={NAVIGATION_ENTITIES.property.icon}
                    iconColor={NAVIGATION_ENTITIES.property.color}
                    title={unit.name}
                    subtitle={unit.type || t('buildingSpaces.units.defaultSubtitle')}
                    isSelected={isItemSelected(unit.id, 'properties')}
                    variant="compact"
                    // 🔗 ENTERPRISE: Navigation to Units page
                    navigationHref={ContextualNavigationService.generateRoute('property', unit.id, { action: 'select' })}
                    navigationTooltip={t('buildingSpaces.units.openTooltip')}
                  />
                </li>
              ))
            )}
          </ul>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: STORAGE (Αποθήκες) */}
        {/* ================================================================= */}
        <TabsContent value="storage" className="mt-3">
          <NavigationCardToolbar
            level="storage"
            searchTerm={storageSearch}
            onSearchChange={setStorageSearch}
            activeFilters={storageFilters}
            onFiltersChange={setStorageFilters}
            hasSelectedItems={selectedItem?.type === 'storage'}
            itemCount={filteredStorages.length}
            onNewItem={onAddItem ? () => onAddItem('storage') : undefined}
            onDeleteItem={onUnlinkItem ? () => onUnlinkItem('storage') : undefined}
          />

          <ul
            className="space-y-2 list-none max-h-48 pr-2 overflow-y-auto mt-2"
            role="list"
            aria-label={t('buildingSpaces.storage.listLabel')}
            data-navigation-scroll="true"
          >
            {filteredStorages.length === 0 ? (
              <li className={cn("text-center py-4 text-sm", colors.text.muted)}>
                {t('buildingSpaces.storage.empty')}
              </li>
            ) : (
              filteredStorages.map(storage => (
                <li key={storage.id}>
                  <NavigationButton
                    onClick={() => onStorageSelect(storage)}
                    icon={NAVIGATION_ENTITIES.storage.icon}
                    iconColor={NAVIGATION_ENTITIES.storage.color}
                    title={storage.name}
                    subtitle={storage.type || t('buildingSpaces.storage.defaultSubtitle')}
                    isSelected={isItemSelected(storage.id, 'storage')}
                    variant="compact"
                    // 🔗 ENTERPRISE: Navigation to Storage page
                    navigationHref={ContextualNavigationService.generateRoute('storage', storage.id, { action: 'select' })}
                    navigationTooltip={t('buildingSpaces.storage.openTooltip')}
                  />
                </li>
              ))
            )}
          </ul>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: PARKING (Θέσεις Στάθμευσης) */}
        {/* ================================================================= */}
        <TabsContent value="parking" className="mt-3">
          <NavigationCardToolbar
            level="parking"
            searchTerm={parkingSearch}
            onSearchChange={setParkingSearch}
            activeFilters={parkingFilters}
            onFiltersChange={setParkingFilters}
            hasSelectedItems={selectedItem?.type === 'parking'}
            itemCount={filteredParkingSpots.length}
            onNewItem={onAddItem ? () => onAddItem('parking') : undefined}
            onDeleteItem={onUnlinkItem ? () => onUnlinkItem('parking') : undefined}
          />

          <ul
            className="space-y-2 list-none max-h-48 pr-2 overflow-y-auto mt-2"
            role="list"
            aria-label={t('buildingSpaces.parking.listLabel')}
            data-navigation-scroll="true"
          >
            {filteredParkingSpots.length === 0 ? (
              <li className={cn("text-center py-4 text-sm", colors.text.muted)}>
                {t('buildingSpaces.parking.empty')}
              </li>
            ) : (
              filteredParkingSpots.map(spot => (
                <li key={spot.id}>
                  <NavigationButton
                    onClick={() => onParkingSelect(spot)}
                    icon={NAVIGATION_ENTITIES.parking.icon}
                    iconColor={NAVIGATION_ENTITIES.parking.color}
                    title={t('buildingSpaces.parking.spotTitle', { number: spot.number })}
                    subtitle={spot.location || spot.type || t('buildingSpaces.parking.defaultSubtitle')}
                    isSelected={isItemSelected(spot.id, 'parking')}
                    variant="compact"
                    // 🔗 ENTERPRISE: Navigation to Parking page
                    navigationHref={ContextualNavigationService.generateRoute('parking', spot.id, { action: 'select' })}
                    navigationTooltip={t('buildingSpaces.parking.openTooltip')}
                  />
                </li>
              ))
            )}
          </ul>
        </TabsContent>
      </TabsOnlyTriggers>
    </section>
  );
}

export default BuildingSpacesTabs;
