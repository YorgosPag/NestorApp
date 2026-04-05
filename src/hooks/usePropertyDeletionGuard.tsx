'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { BuildingSpaceConfirmDialog } from '@/components/building-management/shared/BuildingSpaceConfirmDialog';

interface PropertyDeletionTarget {
  readonly id: string;
  readonly name?: string | null;
}

interface PendingPropertyDeletion {
  readonly target: PropertyDeletionTarget;
  readonly action: () => Promise<void>;
}

interface UsePropertyDeletionGuardReturn {
  readonly checking: boolean;
  readonly deleting: boolean;
  readonly requestDelete: (
    target: PropertyDeletionTarget,
    action: () => Promise<void>,
  ) => Promise<boolean>;
  readonly reset: () => void;
  readonly Dialogs: ReactNode;
}

export function usePropertyDeletionGuard(): UsePropertyDeletionGuardReturn {
  const { t } = useTranslation('properties');
  const {
    checking,
    checkBeforeDelete,
    checkResult,
    BlockedDialog,
  } = useDeletionGuard('property');

  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pendingDeletionRef = useRef<PendingPropertyDeletion | null>(null);

  const reset = useCallback(() => {
    setOpen(false);
    setDeleting(false);
    pendingDeletionRef.current = null;
  }, []);

  const requestDelete = useCallback(async (
    target: PropertyDeletionTarget,
    action: () => Promise<void>,
  ): Promise<boolean> => {
    const allowed = await checkBeforeDelete(target.id);
    if (!allowed) {
      return false;
    }

    pendingDeletionRef.current = { target, action };
    setOpen(true);
    return true;
  }, [checkBeforeDelete]);

  const handleConfirm = useCallback(async () => {
    const pendingDeletion = pendingDeletionRef.current;
    if (!pendingDeletion) {
      return;
    }

    setDeleting(true);
    try {
      await pendingDeletion.action();
      reset();
    } catch (error) {
      setDeleting(false);
      throw error;
    }
  }, [reset]);

  const targetName = pendingDeletionRef.current?.target.name?.trim();
  const dependencyCount = checkResult?.totalDependents ?? 0;
  const dialogDescription = dependencyCount > 0
    ? t('deletionGuard.confirm.descriptionWithDependencies', {
        count: dependencyCount,
        name: targetName ?? t('deletionGuard.confirm.unnamedProperty'),
      })
    : t('deletionGuard.confirm.description', {
        name: targetName ?? t('deletionGuard.confirm.unnamedProperty'),
      });

  const Dialogs = useMemo(() => (
    <>
      {BlockedDialog}
      <BuildingSpaceConfirmDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleting) {
            reset();
          }
        }}
        title={t('deletionGuard.confirm.title')}
        description={dialogDescription}
        confirmLabel={t('deletionGuard.confirm.action')}
        cancelLabel={t('impactGuard.actions.cancel')}
        onConfirm={() => {
          void handleConfirm();
        }}
        loading={deleting}
        variant="destructive"
      />
    </>
  ), [BlockedDialog, deleting, dialogDescription, handleConfirm, open, reset, t]);

  return {
    checking,
    deleting,
    requestDelete,
    reset,
    Dialogs,
  };
}
