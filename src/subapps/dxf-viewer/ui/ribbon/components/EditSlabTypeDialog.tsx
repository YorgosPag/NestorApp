'use client';

/**
 * ADR-412 — «Edit Slab Type» dialog. Slab analogue of `EditWallTypeDialog`.
 *
 * Edits a slab TYPE's `typeParams` (kind / material / thickness / full layer
 * build-up). Changes re-flow to EVERY instance of the type, all floors (Revit
 * «Edit Type»). One undoable op via `controller.updateTypeParams`
 * → `UpdateSlabFamilyTypeCommand`. Built-ins are read-only — Duplicate first.
 *
 * Mounted always-on in `SlabPersistenceHost`; opened via `openEditSlabType`
 * (the slab contextual ribbon «Edit type…» button). Reuses `SlabDnaEditor` +
 * `SlabTypePreviewPanel`.
 *
 * @see ./EditWallTypeDialog.tsx — the wall sibling
 * @see ../hooks/useSlabFamilyTypeController.ts §updateTypeParams
 * @see ../../../bim/family-types/edit-slab-type-store.ts
 */

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pencil } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PanelPositionCalculator } from '../../../config/panel-tokens';
import { useSlabFamilyTypeController } from '../hooks/useSlabFamilyTypeController';
import { SlabDnaEditor } from './SlabDnaEditor';
import { SlabTypePreviewPanel } from './SlabTypePreviewPanel';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import { asSlabFamilyType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import {
  closeEditSlabType,
  getEditSlabTypeState,
  openEditSlabType,
  subscribeEditSlabType,
} from '../../../bim/family-types/edit-slab-type-store';
import type { SlabKind } from '../../../bim/types/slab-types';
import type { SlabDna } from '../../../bim/types/slab-dna-types';
import type { SlabTypeParams } from '../../../bim/types/bim-family-type';

const KIND_VALUES: readonly SlabKind[] = ['floor', 'ceiling', 'roof', 'ground', 'foundation'] as const;

/** Slab-level material value → i18n key suffix (mirror the slab ribbon tab). */
const MATERIAL_OPTIONS: readonly { value: string; key: string }[] = [
  { value: 'rc', key: 'rc' },
  { value: 'composite', key: 'composite' },
  { value: 'wood', key: 'wood' },
] as const;

const PANEL_DIMENSIONS = { width: 1010, height: 620 } as const;
const SSR_FALLBACK_POSITION = { x: 220, y: 80 } as const;
const getClientPosition = (): { x: number; y: number } =>
  PanelPositionCalculator.getTopRightPosition(PANEL_DIMENSIONS.width);

export function EditSlabTypeDialog(): React.ReactElement | null {
  const state = useSyncExternalStore(subscribeEditSlabType, getEditSlabTypeState, getEditSlabTypeState);
  if (!state.open || !state.typeId) return null;
  return <EditSlabTypeDialogContent typeId={state.typeId} />;
}

function EditSlabTypeDialogContent({ typeId }: { typeId: string }): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { updateTypeParams, duplicateCurrent, countSlabsOfType, slab } =
    useSlabFamilyTypeController();
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const type = asSlabFamilyType(getType(typeId));
  const isBuiltIn = type?.origin === 'built-in';
  const affectedCount = countSlabsOfType(typeId);

  const [draft, setDraft] = useState<SlabTypeParams | null>(
    type ? structuredClone(type.typeParams) : null,
  );
  const [highlightLayerId, setHighlightLayerId] = useState<string | null>(null);

  // Non-modal: follow the canvas selection to its slab type (Revit Properties idiom).
  const selectedTypeId = slab?.typeId ?? null;
  useEffect(() => {
    if (selectedTypeId && selectedTypeId !== typeId) openEditSlabType(selectedTypeId);
  }, [selectedTypeId, typeId]);

  useEffect(() => {
    setDraft(type ? structuredClone(type.typeParams) : null);
    setHighlightLayerId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  const onClose = useCallback(() => closeEditSlabType(), []);

  const onSave = useCallback(() => {
    if (draft && !isBuiltIn) updateTypeParams(typeId, draft);
  }, [draft, isBuiltIn, typeId, updateTypeParams]);

  const onDuplicateAndEdit = useCallback(async () => {
    if (!type) return;
    const baseName = resolveTypeDisplayName(type, t);
    const newName = `${baseName} ${t('ribbon.commands.slabFamilyType.duplicateNamePrefix')}`;
    const newId = await duplicateCurrent(newName);
    if (newId) openEditSlabType(newId);
  }, [type, t, duplicateCurrent]);

  const onDnaChange = useCallback((next: SlabDna | undefined) => {
    setDraft((d) =>
      d ? { ...d, dna: next, thickness: next ? next.totalThickness : d.thickness } : d,
    );
  }, []);

  if (!type || !draft) return null;
  const title = `${t('ribbon.commands.slabFamilyType.editTypeTitle')} · ${resolveTypeDisplayName(type, t)}`;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      draggableOptions={{ getClientPosition }}
      className="w-[1010px] max-w-[95vw]"
      data-testid="edit-slab-type-panel"
    >
      <FloatingPanel.Header title={title} icon={<Pencil />} />
      <FloatingPanel.Content className="max-h-[80vh] overflow-y-auto">
        <p className="mb-2 text-xs text-muted-foreground">
          {t('ribbon.commands.slabFamilyType.editTypeDescription')}
        </p>

        {isBuiltIn ? (
          <p
            className="mb-2 rounded border border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--bg-warning))]/10 px-2 py-1 text-xs text-[hsl(var(--text-warning))]"
            role="note"
          >
            {t('ribbon.commands.slabFamilyType.editTypeBuiltinNotice')}
          </p>
        ) : (
          affectedCount > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              {t('ribbon.commands.slabFamilyType.editTypeAffectsCount', { count: affectedCount })}
            </p>
          )
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_25rem]">
          <SlabTypePreviewPanel
            dna={draft.dna}
            highlightLayerId={highlightLayerId}
            onHighlightLayer={setHighlightLayerId}
          />

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <span className="w-24 shrink-0">{t('ribbon.commands.slabFamilyType.paramKind')}</span>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft((d) => (d ? { ...d, kind: v as SlabKind } : d))}
              >
                <SelectTrigger size="sm" aria-label={t('ribbon.commands.slabFamilyType.paramKind')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-auto min-w-[9rem]">
                  {KIND_VALUES.map((k) => (
                    <SelectItem key={k} value={k} className="whitespace-nowrap">
                      {t(`ribbon.commands.slabEditor.kind.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex items-center gap-2 text-xs text-foreground">
              <span className="w-24 shrink-0">{t('ribbon.commands.slabFamilyType.paramMaterial')}</span>
              <Select
                value={draft.material ?? SELECT_CLEAR_VALUE}
                onValueChange={(v) =>
                  setDraft((d) =>
                    d ? { ...d, material: v === SELECT_CLEAR_VALUE ? undefined : v } : d,
                  )
                }
              >
                <SelectTrigger size="sm" aria-label={t('ribbon.commands.slabFamilyType.paramMaterial')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-auto min-w-[9rem]">
                  <SelectItem value={SELECT_CLEAR_VALUE}>
                    {t('ribbon.commands.slabFamilyType.materialNone')}
                  </SelectItem>
                  {MATERIAL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="whitespace-nowrap">
                      {t(`ribbon.commands.slabEditor.material.${m.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex items-center gap-2 text-xs text-foreground">
              <span className="w-24 shrink-0">{t('ribbon.commands.slabFamilyType.paramThickness')}</span>
              {draft.dna ? (
                <span className="dxf-ribbon-wall-length-value">
                  {Math.round(draft.thickness)} {t('ribbon.commands.slabFamilyType.thicknessUnit')}
                </span>
              ) : (
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.thickness}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, thickness: parseFloat(e.target.value) || 0 } : d))
                  }
                  aria-label={t('ribbon.commands.slabFamilyType.paramThickness')}
                  className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                />
              )}
            </label>

            <SlabDnaEditor
              dna={draft.dna}
              kind={draft.kind}
              fallbackThickness={draft.thickness}
              onChange={onDnaChange}
              highlightLayerId={highlightLayerId}
              onHighlightLayer={setHighlightLayerId}
            />
          </div>
        </div>

        <footer className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            {t('ribbon.commands.slabFamilyType.cancel')}
          </button>
          {isBuiltIn ? (
            <button
              type="button"
              onClick={onDuplicateAndEdit}
              className="rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {t('ribbon.commands.slabFamilyType.duplicateAndEdit')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSave}
              className="rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {t('ribbon.commands.slabFamilyType.save')}
            </button>
          )}
        </footer>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}
