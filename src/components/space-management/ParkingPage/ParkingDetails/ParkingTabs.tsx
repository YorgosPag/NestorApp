'use client';

/**
 * 🅿️ ENTERPRISE PARKING TABS COMPONENT
 *
 * ✅ ENTERPRISE MIGRATION: Χρησιμοποιεί UniversalTabsRenderer
 * ✅ ZERO HARDCODED VALUES: Όλα από centralized systems
 * ✅ ZERO INLINE STYLES: Following Fortune 500 protocol
 * ✅ CENTRALIZED CONFIGURATION: από parking-tabs-config.ts
 * ✅ INLINE EDITING: Passes editing state via globalProps
 *
 * @migrated 2025-01-09
 * @version 2.1.0
 */

import React from 'react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { getSortedParkingTabs } from '@/config/parking-tabs-config';
import { UniversalTabsRenderer, convertToUniversalConfig, type TabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import { PARKING_COMPONENT_MAPPING } from '@/components/generic/mappings/parkingMappings';

interface ParkingTabsProps {
  parking: ParkingSpot;
  /** Whether inline editing is active (controlled by parent header) */
  isEditing?: boolean;
  /** Callback when editing state changes (from child tab components) */
  onEditingChange?: (editing: boolean) => void;
  /** Ref for save delegation — ParkingGeneralTab registers its save here */
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

/**
 * 🏢 ENTERPRISE: Professional Parking Tabs Component
 *
 * Χρησιμοποιεί κεντρικοποιημένη διαμόρφωση από parking-tabs-config.ts
 * και UniversalTabsRenderer για consistent rendering.
 * ZERO HARDCODED VALUES - όλα από centralized configuration.
 * ZERO INLINE STYLES - τηρεί το Fortune 500 protocol.
 */
export function ParkingTabs({ parking, isEditing, onEditingChange, saveRef }: ParkingTabsProps) {
  // Get centralized tabs configuration
  const tabs = getSortedParkingTabs();

  return (
    <UniversalTabsRenderer
      tabs={tabs.map(convertToUniversalConfig)}
      data={parking}
      componentMapping={PARKING_COMPONENT_MAPPING as unknown as Record<string, React.ComponentType<TabComponentProps>>}
      defaultTab="general"
      theme="default"
      translationNamespace="building"
      globalProps={{
        isEditing,
        onEditingChange,
        onSaveRef: saveRef,
      }}
    />
  );
}
