'use client';

import React, { useSyncExternalStore, useState, useCallback } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import {
  getDimStyleRegistry,
  type CreateCustomStyleInput,
  type UpdateCustomStylePatch,
} from '../../../systems/dimensions/dim-style-registry';
import type { DimStyle } from '../../../types/dimension';
import { DimStyleList } from './DimStyleList';
import { DimStyleCreateDialog } from './DimStyleCreateDialog';
import { DimStyleAccordion } from './DimStyleAccordion';

type DialogMode = 'create' | 'duplicate';

interface DialogState {
  open: boolean;
  mode: DialogMode;
  initialName: string;
  sourceId: string | null;
}

const CLOSED_DIALOG: DialogState = { open: false, mode: 'create', initialName: '', sourceId: null };

function useRegistrySnapshot() {
  const registry = getDimStyleRegistry();
  return useSyncExternalStore(
    (cb) => registry.subscribe(cb),
    () => registry.getSnapshot(),
    () => registry.getSnapshot(),
  );
}

export function DimensionsTab() {
  const { t } = useTranslation('dxf-viewer-panels');
  const colors = useSemanticColors();
  const { styles, activeStyleId } = useRegistrySnapshot();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(CLOSED_DIALOG);
  const [deleteTarget, setDeleteTarget] = useState<DimStyle | null>(null);

  const openCreate = useCallback(() => {
    setDialog({ open: true, mode: 'create', initialName: '', sourceId: null });
  }, []);

  const openDuplicate = useCallback((id: string) => {
    const style = getDimStyleRegistry().getStyle(id);
    if (!style) return;
    const copyName = `${style.name} (2)`;
    setDialog({ open: true, mode: 'duplicate', initialName: copyName, sourceId: id });
  }, []);

  const handleDialogConfirm = useCallback((name: string) => {
    const registry = getDimStyleRegistry();
    if (dialog.mode === 'create') {
      const created = registry.createCustomStyle({ name, ...defaultStyleFields() });
      setSelectedId(created.id);
    } else if (dialog.sourceId) {
      const duped = registry.duplicateStyle(dialog.sourceId, name);
      setSelectedId(duped.id);
    }
    setDialog(CLOSED_DIALOG);
  }, [dialog]);

  const handleDelete = useCallback((id: string) => {
    const style = getDimStyleRegistry().getStyle(id);
    if (style) setDeleteTarget(style);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    getDimStyleRegistry().deleteCustomStyle(deleteTarget.id);
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteTarget(null);
  }, [deleteTarget, selectedId]);

  const handleSetActive = useCallback((id: string) => {
    getDimStyleRegistry().setActiveStyleId(id);
  }, []);

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleStyleChange = useCallback((patch: UpdateCustomStylePatch) => {
    if (!editingId) return;
    getDimStyleRegistry().updateCustomStyle(editingId, patch);
  }, [editingId]);

  const existingNames = styles.map((s) => s.name);
  const editingStyle = editingId ? getDimStyleRegistry().getStyle(editingId) : null;

  if (editingStyle) {
    return (
      <section aria-label={t('panels.dimensions.styleManager')} className="flex flex-col gap-2">
        <header className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-6 w-6 p-0">
            <ArrowLeft size={14} />
          </Button>
          <h3 className={`text-xs font-semibold truncate ${colors.text.primary}`}>
            {t('panels.dimensions.editor.editingTitle', { name: editingStyle.name })}
          </h3>
        </header>
        <DimStyleAccordion style={editingStyle} onChange={handleStyleChange} />
      </section>
    );
  }

  return (
    <section aria-label={t('panels.dimensions.styleManager')} className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${colors.text.muted}`}>
          {t('panels.dimensions.styleManager')}
        </h3>
        <Button variant="ghost" size="sm" onClick={openCreate} className="h-6 px-2 text-xs gap-1">
          <Plus size={12} />
          {t('panels.dimensions.newStyle')}
        </Button>
      </header>

      <DimStyleList
        styles={styles}
        activeStyleId={activeStyleId}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onSetActive={handleSetActive}
        onDuplicate={openDuplicate}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />

      <DimStyleCreateDialog
        open={dialog.open}
        mode={dialog.mode}
        initialName={dialog.initialName}
        existingNames={existingNames}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialog(CLOSED_DIALOG)}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function defaultStyleFields(): Omit<CreateCustomStyleInput, 'name'> {
  const registry = getDimStyleRegistry();
  const active = registry.getActiveStyle();
  const { id: _id, isBuiltIn: _bi, name: _n, ...rest } = active;
  return rest;
}

interface DeleteConfirmDialogProps {
  target: DimStyle | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ target, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  return (
    <AlertDialog.Root open={!!target} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <AlertDialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 max-w-sm w-full flex flex-col gap-4">
          <AlertDialog.Title className="text-sm font-semibold">
            {t('panels.dimensions.deleteConfirm.title')}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">
            {t('panels.dimensions.deleteConfirm.description', { name: target?.name ?? '' })}
          </AlertDialog.Description>
          <footer className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button type="button" className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={onCancel}>
                {t('panels.dimensions.deleteConfirm.cancel')}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="px-3 py-1.5 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
                {t('panels.dimensions.deleteConfirm.confirm')}
              </button>
            </AlertDialog.Action>
          </footer>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
