'use client';

/**
 * 📦 ENTERPRISE STORAGE TABS COMPONENT
 *
 * ✅ ENTERPRISE MIGRATION: Χρησιμοποιεί UniversalTabsRenderer
 * ✅ ZERO HARDCODED VALUES: Όλα από centralized configuration
 * ✅ INLINE EDITING: Passes editing state via globalProps (ADR-193)
 * ✅ CENTRALIZED CONFIGURATION: από storage-tabs-config.ts
 */

import React from 'react';
import type { Storage } from '@/types/storage/contracts';
import { getSortedStorageTabs } from '@/config/storage-tabs-config';
import {
  UniversalTabsRenderer,
  convertToUniversalConfig,
  type StorageTabComponentProps,
  type StorageTabGlobalProps,
} from '@/components/generic/UniversalTabsRenderer';
import { STORAGE_COMPONENT_MAPPING } from '@/components/generic/mappings/storageMappings';

interface StorageTabsProps {
  storage: Storage;
  /** Whether inline editing is active (controlled by parent header) */
  isEditing?: boolean;
  /** Callback when editing state changes (from child tab components) */
  onEditingChange?: (editing: boolean) => void;
  /** Ref for save delegation — StorageGeneralTab registers its save here */
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

/**
 * Professional Storage Tabs Component
 *
 * Χρησιμοποιεί κεντρικοποιημένη διαμόρφωση από storage-tabs-config.ts
 * και UniversalTabsRenderer για consistent rendering.
 * ZERO HARDCODED VALUES - όλα από centralized configuration.
 */
export function StorageTabs({ storage, isEditing, onEditingChange, saveRef }: StorageTabsProps) {
  const tabs = getSortedStorageTabs();
  const globalProps: StorageTabGlobalProps = {
    isEditing,
    onEditingChange,
    onSaveRef: saveRef,
  };

  return (
    <UniversalTabsRenderer<Storage, StorageTabComponentProps, Record<string, never>, StorageTabGlobalProps>
      tabs={tabs.map(convertToUniversalConfig)}
      data={storage}
      componentMapping={STORAGE_COMPONENT_MAPPING}
      defaultTab="info"
      theme="default"
      translationNamespace="building"
      globalProps={globalProps}
    />
  );
}
