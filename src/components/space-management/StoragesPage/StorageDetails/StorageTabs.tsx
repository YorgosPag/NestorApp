'use client';

import React from 'react';
import type { Storage } from '@/types/storage/contracts';
import { getSortedStorageTabs } from '@/config/storage-tabs-config';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
import { STORAGE_COMPONENT_MAPPING } from '@/components/generic/mappings/storageMappings';

interface StorageTabsProps {
  storage: Storage;
}

/**
 * Professional Storage Tabs Component
 *
 * Χρησιμοποιεί κεντρικοποιημένη διαμόρφωση από storage-tabs-config.ts
 * και UniversalTabsRenderer για consistent rendering.
 * ZERO HARDCODED VALUES - όλα από centralized configuration.
 */
export function StorageTabs({ storage }: StorageTabsProps) {
  // Get centralized tabs configuration
  const tabs = getSortedStorageTabs();

  return (
    <UniversalTabsRenderer
      tabs={tabs.map(convertToUniversalConfig)}
      data={storage}
      componentMapping={STORAGE_COMPONENT_MAPPING}
      defaultTab="general"
      theme="clean"
      // 🏢 ENTERPRISE: i18n - Use building namespace for tab labels
      translationNamespace="building"
    />
  );
}