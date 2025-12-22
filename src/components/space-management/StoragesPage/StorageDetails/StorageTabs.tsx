'use client';

import React from 'react';
import type { Storage } from '@/types/storage/contracts';
import { getSortedStorageTabs } from '@/config/storage-tabs-config';
import { UniversalTabsRenderer, STORAGE_COMPONENT_MAPPING, convertToUniversalConfig } from '@/components/generic';

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
      theme="default"
    />
  );
}