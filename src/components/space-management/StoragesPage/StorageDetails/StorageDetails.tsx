'use client';

/**
 * 📦 ENTERPRISE STORAGE DETAILS COMPONENT
 *
 * Λεπτομέρειες αποθήκης.
 * ADR-193: Aligned with Units prototype — supports inline editing via lifted state + saveRef delegation.
 */

import { Warehouse } from 'lucide-react';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { Storage } from '@/types/storage/contracts';
import { StorageDetailsHeader } from './StorageDetailsHeader';
import { StorageTabs } from './StorageTabs';
import { DetailsContainer } from '@/core/containers';
import { useAuth } from '@/auth/hooks/useAuth';
import { UnifiedShareDialog } from '@/components/sharing/UnifiedShareDialog';
import { useInlineEditSession } from '@/hooks/useInlineEditSession';
import { useShowcaseDialog } from '@/hooks/useShowcaseDialog';

interface StorageDetailsProps {
  storage: Storage | null;
  /** Open the Add Storage dialog */
  onNewStorage?: () => void;
  /** Delete the current storage */
  onDelete?: () => void;
  /** Whether the storage is displayed in the trash view — hides mutating actions */
  isInTrash?: boolean;
}

export function StorageDetails({ storage, onNewStorage, onDelete, isInTrash = false }: StorageDetailsProps) {
  const emptyStateMessages = useEmptyStateMessages();
  const { user } = useAuth();

  // Inline editing (header ↔ tab), reset when the selection changes — StorageGeneralTab registers its save in saveRef
  const edit = useInlineEditSession(storage?.id);
  const showcase = useShowcaseDialog();

  return (
    <>
    <DetailsContainer
      selectedItem={storage}
      header={
        storage ? (
          <StorageDetailsHeader
            storage={storage}
            isEditing={edit.isEditing}
            isSaving={edit.isSaving}
            onStartEdit={edit.startEdit}
            onSave={edit.handleSave}
            onCancel={edit.cancelEdit}
            onNewStorage={onNewStorage}
            onDelete={onDelete}
            onShowcaseStorage={isInTrash || !storage?.id ? undefined : showcase.openDialog}
            isInTrash={isInTrash}
          />
        ) : null
      }
      tabsRenderer={
        storage ? (
          <StorageTabs
            storage={storage}
            isEditing={edit.isEditing}
            onEditingChange={edit.setIsEditing}
            saveRef={edit.saveRef}
          />
        ) : null
      }
      onCreateAction={onNewStorage}
      emptyStateProps={{
        icon: Warehouse,
        ...emptyStateMessages.storage
      }}
    />
    {storage?.id && user?.companyId && user?.uid && (
      <UnifiedShareDialog
        open={showcase.open}
        onOpenChange={showcase.setOpen}
        entityType="storage_showcase"
        entityId={storage.id}
        entityTitle={storage.name}
        companyId={user.companyId}
      />
    )}
    </>
  );
}
