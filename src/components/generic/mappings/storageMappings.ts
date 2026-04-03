/**
 * 🏢 ENTERPRISE: Domain-scoped Storage Component Mapping
 *
 * Contains ONLY storage-related components.
 * This file is the ONLY mapping import needed for storage detail pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/unit/contact/parking/building components from storage pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/storageMappings
 */

import React, { type ComponentType } from 'react';
import type { AuditEntityType } from '@/types/audit-trail';
import type { Storage } from '@/types/storage/contracts';
import type { StorageTabComponentProps } from '@/components/generic/UniversalTabsRenderer';

import { StorageGeneralTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import { StorageDocumentsTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab';
import { StoragePhotosTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab';
import { StorageVideosTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageVideosTab';
import { StorageFloorplanTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageFloorplanTab';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';

function resolveStorage(props: StorageTabComponentProps): Storage | undefined {
  return props.storage ?? props.data;
}

function StorageGeneralTabAdapter(props: StorageTabComponentProps) {
  const storage = resolveStorage(props);
  if (!storage) {
    return null;
  }

  return React.createElement(StorageGeneralTab, {
    storage,
    isEditing: props.isEditing,
    onEditingChange: props.onEditingChange,
    onSaveRef: props.onSaveRef,
    createMode: props.createMode,
    onCreated: props.onCreated,
  });
}

function StorageDocumentsTabAdapter(props: StorageTabComponentProps) {
  const storage = resolveStorage(props);
  return storage ? React.createElement(StorageDocumentsTab, { storage }) : null;
}

function StoragePhotosTabAdapter(props: StorageTabComponentProps) {
  const storage = resolveStorage(props);
  return storage ? React.createElement(StoragePhotosTab, { storage }) : null;
}

function StorageVideosTabAdapter(props: StorageTabComponentProps) {
  const storage = resolveStorage(props);
  return storage ? React.createElement(StorageVideosTab, { storage }) : null;
}

function StorageFloorplanTabAdapter(props: StorageTabComponentProps) {
  const storage = resolveStorage(props);
  return storage ? React.createElement(StorageFloorplanTab, { storage }) : null;
}

function PlaceholderTabAdapter(props: StorageTabComponentProps) {
  return React.createElement(PlaceholderTab, {
    title: typeof props.title === 'string' ? props.title : undefined,
    icon: props.icon ?? undefined,
  });
}

function ActivityTabAdapter(props: StorageTabComponentProps) {
  const storage = resolveStorage(props);
  return React.createElement(ActivityTab, {
    ...props,
    entityType: (props.entityType as AuditEntityType | undefined) ?? 'storage',
    entityId: storage?.id,
    data: storage ?? props.data,
  });
}

export const STORAGE_COMPONENT_MAPPING: Record<string, ComponentType<StorageTabComponentProps>> = {
  StorageGeneralTab: StorageGeneralTabAdapter,
  StorageDocumentsTab: StorageDocumentsTabAdapter,
  StoragePhotosTab: StoragePhotosTabAdapter,
  StorageVideosTab: StorageVideosTabAdapter,
  StorageFloorplanTab: StorageFloorplanTabAdapter,
  PlaceholderTab: PlaceholderTabAdapter,
  ActivityTab: ActivityTabAdapter,
};

export type StorageComponentName = keyof typeof STORAGE_COMPONENT_MAPPING;
