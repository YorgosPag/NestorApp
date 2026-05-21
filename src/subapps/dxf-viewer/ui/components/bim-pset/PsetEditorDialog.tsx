'use client';

/**
 * IFC Pset Editor Dialog (ADR-369 §9 Q8.2)
 *
 * Radix Dialog wrapper around `PsetEditor`. Manages a local draft copy of the
 * pset so the user can cancel without committing changes. On confirm → calls
 * `onSave(draft)`. On cancel → discards draft.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §Q8.2
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IfcPropertySet } from '../../../bim/types/ifc-entity-mixin';
import { PsetEditor } from './PsetEditor';
import { DEFAULT_PSET_FOR_ENTITY, type BimPsetEntityType } from './pset-templates';

export interface PsetEditorDialogProps {
  readonly open: boolean;
  readonly entityId: string | null;
  readonly entityType: BimPsetEntityType | null;
  readonly currentPset: IfcPropertySet | undefined;
  readonly onSave: (next: IfcPropertySet | undefined) => void;
  readonly onCancel: () => void;
}

export function PsetEditorDialog({
  open,
  entityId,
  entityType,
  currentPset,
  onSave,
  onCancel,
}: PsetEditorDialogProps): React.ReactElement | null {
  const { t } = useTranslation('bim3d');
  const [draft, setDraft] = useState<IfcPropertySet | undefined>(currentPset);

  useEffect(() => {
    if (open) setDraft(currentPset);
  }, [open, currentPset]);

  const handleSave = useCallback((): void => {
    onSave(draft);
  }, [draft, onSave]);

  const handleOpenChange = useCallback((next: boolean): void => {
    if (!next) onCancel();
  }, [onCancel]);

  if (!entityId || !entityType) return null;

  const psetName = DEFAULT_PSET_FOR_ENTITY[entityType] ?? 'Pset_Custom';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pset.dialogTitle')}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          <PsetEditor
            psetName={psetName}
            pset={draft}
            onChange={setDraft}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('pset.cancelButton')}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t('pset.saveButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
