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

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorplanFiles } from '@/hooks/useFloorplanFiles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface StepStoragePickerProps {
  uploadConfig: FloorplanUploadConfig;
  /** Currently selected file ID (controlled by parent wizard). */
  selectedFileId: string | null;
  /** Called when the user clicks a row to select a file. */
  onFileSelected: (fileId: string) => void;
  /** File IDs that failed to load (corrupt/invalid) — shown in red, not selectable. */
  corruptFileIds?: Set<string>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StepStoragePicker({ uploadConfig, selectedFileId, onFileSelected, corruptFileIds }: StepStoragePickerProps) {
  const { t } = useTranslation(['files-media']);
  const colors = useSemanticColors();

  const { files, loading } = useFloorplanFiles({
    companyId: uploadConfig.companyId,
    entityType: uploadConfig.entityType,
    entityId: uploadConfig.entityId,
    autoProcess: false,
  });

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
        {files.map((file) => {
          const isCorrupt = corruptFileIds?.has(file.id) ?? false;
          const isSelected = !isCorrupt && file.id === selectedFileId;
          return (
            <li
              key={file.id}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isCorrupt}
              onClick={isCorrupt ? undefined : () => onFileSelected(file.id)}
              className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                isCorrupt
                  ? 'border-destructive bg-destructive/5 opacity-60 cursor-not-allowed'
                  : isSelected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary cursor-pointer'
                    : `border-border ${colors.bg.surface} hover:bg-accent/50 cursor-pointer`
              }`}
            >
              <span className="flex-1 truncate text-sm font-medium">
                {file.originalFilename ?? file.displayName}
              </span>
              {isCorrupt && (
                <span className="text-xs text-destructive shrink-0">
                  {t('floorplanImport.storagePicker.corrupt')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
