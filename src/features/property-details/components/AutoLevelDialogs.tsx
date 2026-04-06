/**
 * ADR-236 Phase 4: Auto-level creation dialogs
 * Extracted from PropertyFieldsBlock for SRP compliance (N.7.1).
 */

'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface AutoLevelDialogsProps {
  dialogState: { type: 'warning' | 'confirm' | null; pendingType: string | null };
  onConfirm: () => void;
  onDismiss: () => void;
}

export function AutoLevelDialogs({ dialogState, onConfirm, onDismiss }: AutoLevelDialogsProps) {
  const { t } = useTranslation(['properties', 'common']);

  if (!dialogState.type) return null;

  if (dialogState.type === 'warning') {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => { if (!open) onDismiss(); }}
        title={t('properties:multiLevel.noNextFloor.title')}
        description={t('properties:multiLevel.noNextFloor.description')}
        variant="warning"
        confirmText={t('common:deletionGuard.understood')}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onDismiss(); }}
      title={t('properties:multiLevel.optionalConfirm.title')}
      description={t('properties:multiLevel.optionalConfirm.description')}
      variant="default"
      confirmText={t('properties:multiLevel.optionalConfirm.yes')}
      cancelText={t('properties:multiLevel.optionalConfirm.no')}
      onConfirm={onConfirm}
    />
  );
}
