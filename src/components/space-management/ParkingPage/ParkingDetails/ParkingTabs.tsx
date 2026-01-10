'use client';

/**
 * 🅿️ ENTERPRISE PARKING TABS COMPONENT
 *
 * ✅ ENTERPRISE MIGRATION: Χρησιμοποιεί UniversalTabsRenderer
 * ✅ ZERO HARDCODED VALUES: Όλα από centralized systems
 * ✅ ZERO INLINE STYLES: Following Fortune 500 protocol
 * ✅ CENTRALIZED CONFIGURATION: από parking-tabs-config.ts
 *
 * @migrated 2025-01-09
 * @version 2.0.0
 */

import React from 'react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { getSortedParkingTabs } from '@/config/parking-tabs-config';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
import { PARKING_COMPONENT_MAPPING } from '@/components/generic/mappings/parkingMappings';

interface ParkingTabsProps {
  parking: ParkingSpot;
}

/**
 * 🏢 ENTERPRISE: Professional Parking Tabs Component
 *
 * Χρησιμοποιεί κεντρικοποιημένη διαμόρφωση από parking-tabs-config.ts
 * και UniversalTabsRenderer για consistent rendering.
 * ZERO HARDCODED VALUES - όλα από centralized configuration.
 * ZERO INLINE STYLES - τηρεί το Fortune 500 protocol.
 */
export function ParkingTabs({ parking }: ParkingTabsProps) {
  // Get centralized tabs configuration
  const tabs = getSortedParkingTabs();

  return (
    <UniversalTabsRenderer
      tabs={tabs.map(convertToUniversalConfig)}
      data={parking}
      componentMapping={PARKING_COMPONENT_MAPPING}
      defaultTab="general"
      theme="default"
    />
  );
}