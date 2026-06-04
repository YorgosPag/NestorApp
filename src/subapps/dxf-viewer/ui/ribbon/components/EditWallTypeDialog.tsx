'use client';

/**
 * ADR-412 Φ5 — «Edit Wall Type» dialog.
 *
 * Edits a wall TYPE's `typeParams` (category / material / thickness / full DNA
 * layer composition). Changes re-flow to EVERY instance of the type, on all
 * floors (Revit «Edit Type»). One undoable op via `controller.updateTypeParams`
 * → `UpdateWallFamilyTypeCommand` (optimistic store + persist + audit + BOQ
 * re-feed). Built-ins are read-only — the trigger Duplicates first.
 *
 * Mounted always-on in `WallPersistenceHost`; opened via `openEditWallType`
 * (RibbonWallTypePropertiesWidget «Edit type…» button). The heavy controller
 * runs only while the dialog is open (inner component).
 *
 * Reuses `WallDnaEditor` (entity-agnostic) for the layer editor — zero new DNA
 * UI/i18n. Thickness is derived (read-only) when DNA is present, manual
 * otherwise (SSoT `thickness === dna.totalThickness`).
 *
 * @see ../hooks/useWallFamilyTypeController.ts §updateTypeParams
 * @see ../../wall-advanced-panel/sections/WallDnaEditor.tsx
 * @see ../../../bim/family-types/edit-wall-type-store.ts
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
import { useWallFamilyTypeController } from '../hooks/useWallFamilyTypeController';
import { WallDnaEditor } from '../../wall-advanced-panel/sections/WallDnaEditor';
import { WallTypePreviewPanel } from './WallTypePreviewPanel';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import { asWallFamilyType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import {
  closeEditWallType,
  getEditWallTypeState,
  openEditWallType,
  subscribeEditWallType,
} from '../../../bim/family-types/edit-wall-type-store';
import type { WallCategory } from '../../../bim/types/wall-types';
import type { WallDna } from '../../../bim/types/wall-dna-types';
import type { WallTypeParams } from '../../../bim/types/bim-family-type';

const CATEGORY_VALUES: readonly WallCategory[] = [
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
] as const;

/** Wall-level material value → i18n key suffix (mirror RibbonWallTypePropertiesWidget). */
const MATERIAL_OPTIONS: readonly { value: string; key: string }[] = [
  { value: 'rc', key: 'rc' },
  { value: 'masonry', key: 'masonry' },
  { value: 'aerated-concrete', key: 'aeratedConcrete' },
  { value: 'gypsum', key: 'gypsum' },
] as const;

/** Floating-panel size (px) — used for drag-bounds + top-right anchoring. */
const PANEL_DIMENSIONS = { width: 1010, height: 620 } as const;
/** SSR-safe fallback; the real spot is computed client-side (top-right). */
const SSR_FALLBACK_POSITION = { x: 220, y: 80 } as const;
/** SSoT top-right anchor (same calculator as the other floating panels). */
const getClientPosition = (): { x: number; y: number } =>
  PanelPositionCalculator.getTopRightPosition(PANEL_DIMENSIONS.width);

export function EditWallTypeDialog(): React.ReactElement | null {
  const state = useSyncExternalStore(subscribeEditWallType, getEditWallTypeState, getEditWallTypeState);
  if (!state.open || !state.typeId) return null;
  return <EditWallTypeDialogContent typeId={state.typeId} />;
}

function EditWallTypeDialogContent({ typeId }: { typeId: string }): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { updateTypeParams, duplicateCurrent, countWallsOfType, wall } =
    useWallFamilyTypeController();
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const type = asWallFamilyType(getType(typeId));
  // Built-in types are read-only code constants (ADR-412 Q3) — edits go through
  // Duplicate-to-edit. The affected-wall count drives the «applies to N walls»
  // warning for editable (user) types.
  const isBuiltIn = type?.origin === 'built-in';
  const affectedCount = countWallsOfType(typeId);

  // Independent deep copy so editing the draft can NEVER bleed into the live
  // store object (Cancel must fully discard — ADR-414).
  const [draft, setDraft] = useState<WallTypeParams | null>(
    type ? structuredClone(type.typeParams) : null,
  );
  // ADR-414 — shared bidirectional highlight between the preview + the editor rows.
  const [highlightLayerId, setHighlightLayerId] = useState<string | null>(null);

  // ADR-414 — the panel is non-modal (floating), so the user can keep selecting
  // walls on the canvas. Follow the selection (Revit Properties-palette idiom):
  // when the selected wall carries a different family type, retarget the panel to
  // it. Untyped/ad-hoc walls (no typeId) leave the panel on its current type.
  const selectedTypeId = wall?.typeId ?? null;
  useEffect(() => {
    if (selectedTypeId && selectedTypeId !== typeId) openEditWallType(selectedTypeId);
  }, [selectedTypeId, typeId]);

  // (Re)seed the draft (deep copy) when the target type changes.
  useEffect(() => {
    setDraft(type ? structuredClone(type.typeParams) : null);
    setHighlightLayerId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  const onClose = useCallback(() => closeEditWallType(), []);

  // Save persists but KEEPS the panel open (ADR-414 — Giorgio: keep editing /
  // selecting walls after a save). Close is explicit (Cancel / X / Esc).
  // Built-ins are read-only — Save is disabled in the UI, but guard here too.
  const onSave = useCallback(() => {
    if (draft && !isBuiltIn) updateTypeParams(typeId, draft);
  }, [draft, isBuiltIn, typeId, updateTypeParams]);

  // Duplicate-to-edit (Revit «a copy will be made»): clone the built-in to a new
  // editable user type, assign it to the selected wall, and retarget the panel.
  const onDuplicateAndEdit = useCallback(async () => {
    if (!type) return;
    const baseName = resolveTypeDisplayName(type, t);
    const newName = `${baseName} ${t('ribbon.commands.bimFamilyType.duplicateNamePrefix')}`;
    const newId = await duplicateCurrent(newName);
    if (newId) openEditWallType(newId);
  }, [type, t, duplicateCurrent]);

  const onDnaChange = useCallback((next: WallDna | undefined) => {
    setDraft((d) =>
      d ? { ...d, dna: next, thickness: next ? next.totalThickness : d.thickness } : d,
    );
  }, []);

  if (!type || !draft) return null;
  const title = `${t('ribbon.commands.bimFamilyType.editTypeTitle')} · ${resolveTypeDisplayName(type, t)}`;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      draggableOptions={{ getClientPosition }}
      className="w-[1010px] max-w-[95vw]"
      data-testid="edit-wall-type-panel"
    >
      <FloatingPanel.Header title={title} icon={<Pencil />} />
      <FloatingPanel.Content className="max-h-[80vh] overflow-y-auto">
        <p className="mb-2 text-xs text-muted-foreground">
          {t('ribbon.commands.bimFamilyType.editTypeDescription')}
        </p>

        {isBuiltIn ? (
          <p
            className="mb-2 rounded border border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--bg-warning))]/10 px-2 py-1 text-xs text-[hsl(var(--text-warning))]"
            role="note"
          >
            {t('ribbon.commands.bimFamilyType.editTypeBuiltinNotice')}
          </p>
        ) : (
          affectedCount > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              {t('ribbon.commands.bimFamilyType.editTypeAffectsCount', { count: affectedCount })}
            </p>
          )
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_25rem]">
          <WallTypePreviewPanel
            dna={draft.dna}
            highlightLayerId={highlightLayerId}
            onHighlightLayer={setHighlightLayerId}
          />

          <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-24 shrink-0">{t('ribbon.commands.bimFamilyType.paramCategory')}</span>
            <Select
              value={draft.category}
              onValueChange={(v) => setDraft((d) => (d ? { ...d, category: v as WallCategory } : d))}
            >
              <SelectTrigger size="sm" aria-label={t('ribbon.commands.bimFamilyType.paramCategory')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-[9rem]">
                {CATEGORY_VALUES.map((c) => (
                  <SelectItem key={c} value={c} className="whitespace-nowrap">
                    {t(`ribbon.commands.wallEditor.category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-24 shrink-0">{t('ribbon.commands.bimFamilyType.paramMaterial')}</span>
            <Select
              value={draft.material ?? SELECT_CLEAR_VALUE}
              onValueChange={(v) =>
                setDraft((d) =>
                  d ? { ...d, material: v === SELECT_CLEAR_VALUE ? undefined : v } : d,
                )
              }
            >
              <SelectTrigger size="sm" aria-label={t('ribbon.commands.bimFamilyType.paramMaterial')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-[9rem]">
                <SelectItem value={SELECT_CLEAR_VALUE}>
                  {t('ribbon.commands.bimFamilyType.materialNone')}
                </SelectItem>
                {MATERIAL_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="whitespace-nowrap">
                    {t(`ribbon.commands.wallEditor.material.${m.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-24 shrink-0">{t('ribbon.commands.bimFamilyType.paramThickness')}</span>
            {draft.dna ? (
              // DNA present → thickness is derived (SSoT); show read-only.
              <span className="dxf-ribbon-wall-length-value">
                {Math.round(draft.thickness)} {t('ribbon.commands.bimFamilyType.thicknessUnit')}
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
                aria-label={t('ribbon.commands.bimFamilyType.paramThickness')}
                className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
              />
            )}
          </label>

            <WallDnaEditor
              dna={draft.dna}
              category={draft.category}
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
            {t('ribbon.commands.bimFamilyType.cancel')}
          </button>
          {isBuiltIn ? (
            <button
              type="button"
              onClick={onDuplicateAndEdit}
              className="rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {t('ribbon.commands.bimFamilyType.duplicateAndEdit')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSave}
              className="rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {t('ribbon.commands.bimFamilyType.save')}
            </button>
          )}
        </footer>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}
