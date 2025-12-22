'use client';

import React from 'react';
import type { Storage } from '@/types/storage/contracts';
import { getSortedStorageTabs } from '@/config/storage-tabs-config';
import { GenericStorageTabsRenderer } from '@/components/generic/GenericStorageTabsRenderer';

interface StorageTabsProps {
  storage: Storage;
}

/**
 * Professional Storage Tabs Component
 *
 * Χρησιμοποιεί κεντρικοποιημένη διαμόρφωση από storage-tabs-config.ts
 * και GenericStorageTabsRenderer για consistent rendering.
 * ZERO HARDCODED VALUES - όλα από centralized configuration.
 */
export function StorageTabs({ storage }: StorageTabsProps) {
  // Get centralized tabs configuration
  const tabs = getSortedStorageTabs();

  return (
    <GenericStorageTabsRenderer
      tabs={tabs}
      storage={storage}
      defaultTab="general"
    />
  );
}