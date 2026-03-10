'use client';

/**
 * 📦 ENTERPRISE STORAGE DETAILS COMPONENT
 *
 * Λεπτομέρειες αποθήκης.
 * ADR-193: Aligned with Units prototype — supports inline editing via lifted state + saveRef delegation.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Warehouse } from 'lucide-react';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { Storage } from '@/types/storage/contracts';
import { StorageDetailsHeader } from './StorageDetailsHeader';
import { StorageTabs } from './StorageTabs';
import { DetailsContainer } from '@/core/containers';

interface StorageDetailsProps {
  storage: Storage | null;
  /** Open the Add Storage dialog */
  onNewStorage?: () => void;
  /** Delete the current storage */
  onDelete?: () => void;
}

export function StorageDetails({ storage, onNewStorage, onDelete }: StorageDetailsProps) {
  const emptyStateMessages = useEmptyStateMessages();

  // Inline editing state (lifted for header ↔ tab coordination)
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Save delegation ref — StorageGeneralTab registers its handleSave here
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!saveRef.current) return;
    setIsSaving(true);
    try {
      await saveRef.current();
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Reset editing state when storage selection changes
  React.useEffect(() => {
    setIsEditing(false);
  }, [storage?.id]);

  return (
    <DetailsContainer
      selectedItem={storage}
      header={
        storage ? (
          <StorageDetailsHeader
            storage={storage}
            isEditing={isEditing}
            isSaving={isSaving}
            onStartEdit={handleStartEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            onNewStorage={onNewStorage}
            onDelete={onDelete}
          />
        ) : null
      }
      tabsRenderer={
        storage ? (
          <StorageTabs
            storage={storage}
            isEditing={isEditing}
            onEditingChange={setIsEditing}
            saveRef={saveRef}
          />
        ) : null
      }
      emptyStateProps={{
        icon: Warehouse,
        ...emptyStateMessages.storage
      }}
    />
  );
}
