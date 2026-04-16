'use client';

/**
 * =============================================================================
 * SPEC-237D: Storage Picker Step (Step 6 — load mode)
 * =============================================================================
 *
 * Lists saved DXF floorplans for the entity selected in steps 1–5.
 * Renders instead of StepUpload when FloorplanImportWizard mode='load'.
 *
 * @module features/floorplan-import/components/StepStoragePicker
 */

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorplanFiles } from '@/hooks/useFloorplanFiles';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface StepStoragePickerProps {
  uploadConfig: FloorplanUploadConfig;
  /**
   * Called when the user picks a file.
   * Throws on failure — StepStoragePicker catches and shows inline error per row.
   */
  onSelect: (fileId: string) => Promise<void>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StepStoragePicker({ uploadConfig, onSelect }: StepStoragePickerProps) {
  const { t } = useTranslation(['files-media']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [errorFileId, setErrorFileId] = useState<string | null>(null);

  const { files, loading } = useFloorplanFiles({
    companyId: uploadConfig.companyId,
    entityType: uploadConfig.entityType,
    entityId: uploadConfig.entityId,
    autoProcess: false,
  });

  const handleSelect = async (fileId: string) => {
    if (loadingFileId) return;
    setLoadingFileId(fileId);
    setErrorFileId(null);
    try {
      await onSelect(fileId);
    } catch {
      setErrorFileId(fileId);
    } finally {
      setLoadingFileId(null);
    }
  };

  if (loading) {
    return (
      <p className={`text-center py-8 text-sm ${colors.text.muted}`}>
        {t('floorplanImport.storagePicker.loading')}
      </p>
    );
  }

  if (files.length === 0) {
    return (
      <p className={`text-center py-8 text-sm ${colors.text.muted}`}>
        {t('floorplanImport.storagePicker.empty')}
      </p>
    );
  }

  return (
    <ScrollArea className="h-72">
      <ul className="space-y-2 p-1" role="listbox" aria-label={t('floorplanImport.loadTitle')}>
        {files.map((file) => (
          <li
            key={file.id}
            className={`flex items-center justify-between gap-3 p-3 rounded-md border ${
              errorFileId === file.id ? 'border-destructive bg-destructive/5' : `border-border ${colors.bg.surface}`
            }`}
          >
            <span className="flex-1 truncate text-sm font-medium">
              {file.originalFilename ?? file.displayName}
            </span>
            <Button
              size="sm"
              variant={errorFileId === file.id ? 'destructive' : 'outline'}
              disabled={!!loadingFileId}
              onClick={() => handleSelect(file.id)}
              aria-label={`${t('floorplanImport.storagePicker.loadButton')} ${file.displayName}`}
            >
              <Download className={iconSizes.sm} />
              {errorFileId === file.id
                ? t('floorplanImport.storagePicker.error')
                : t('floorplanImport.storagePicker.loadButton')}
            </Button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
