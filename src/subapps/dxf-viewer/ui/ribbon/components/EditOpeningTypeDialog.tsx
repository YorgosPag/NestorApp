'use client';

/**
 * ADR-421 SLICE C — «Edit Opening Type» dialog.
 *
 * Edits an opening TYPE's `typeParams` (nominal width / height / frame width /
 * glazing panes / material / fire rating). Changes re-flow to EVERY instance of
 * the type, on all floors (Revit «Edit Type»). One undoable op via
 * `controller.updateTypeParams` → generic `UpdateFamilyTypeCommand` (optimistic
 * store + persist + audit + BOQ re-feed). Built-ins are read-only — the trigger
 * Duplicates first.
 *
 * No DNA/preview (openings carry no layered cross-section) — a plain dimensional
 * form. Mounted always-on in `OpeningPersistenceHost`; opened via
 * `openEditOpeningType`. The heavy controller runs only while open. Mirror of
 * `EditWallTypeDialog`.
 *
 * @see ../hooks/useOpeningFamilyTypeController.ts §updateTypeParams
 * @see ../../../bim/family-types/edit-opening-type-store.ts
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
import { useOpeningFamilyTypeController } from '../hooks/useOpeningFamilyTypeController';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import { asOpeningFamilyType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import {
  closeEditOpeningType,
  getEditOpeningTypeState,
  openEditOpeningType,
  subscribeEditOpeningType,
} from '../../../bim/family-types/edit-opening-type-store';
import type { OpeningTypeParams } from '../../../bim/types/bim-family-type';
import { OpeningMaterialSelectCell } from './OpeningMaterialSelectCell';
import { useOpeningMaterialCatalog } from '../hooks/useOpeningMaterialCatalog';

/** The 4 opening "family surfaces" a Type owns a material for (ADR-421 SLICE C follow-up). */
const MATERIAL_PARTS = ['frame', 'leaf', 'glass', 'hardware'] as const;
type OpeningMaterialPart = (typeof MATERIAL_PARTS)[number];

/** Glazing-pane options (1 single / 2 double / 3 triple). */
const GLAZING_OPTIONS: readonly (1 | 2 | 3)[] = [1, 2, 3] as const;

/** Floating-panel size (px) — used for drag-bounds + top-right anchoring. */
const PANEL_DIMENSIONS = { width: 480, height: 420 } as const;
/** SSR-safe fallback; the real spot is computed client-side (top-right). */
const SSR_FALLBACK_POSITION = { x: 220, y: 80 } as const;
const getClientPosition = (): { x: number; y: number } =>
  PanelPositionCalculator.getTopRightPosition(PANEL_DIMENSIONS.width);

export function EditOpeningTypeDialog(): React.ReactElement | null {
  const state = useSyncExternalStore(
    subscribeEditOpeningType,
    getEditOpeningTypeState,
    getEditOpeningTypeState,
  );
  if (!state.open || !state.typeId) return null;
  return <EditOpeningTypeDialogContent typeId={state.typeId} />;
}

function EditOpeningTypeDialogContent({ typeId }: { typeId: string }): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { updateTypeParams, duplicateCurrent, countOpeningsOfType, opening } =
    useOpeningFamilyTypeController();
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const materialCatalog = useOpeningMaterialCatalog();
  const type = asOpeningFamilyType(getType(typeId));
  const isBuiltIn = type?.origin === 'built-in';
  const affectedCount = countOpeningsOfType(typeId);

  // Independent deep copy so editing the draft can NEVER bleed into the live
  // store object (Cancel must fully discard).
  const [draft, setDraft] = useState<OpeningTypeParams | null>(
    type ? structuredClone(type.typeParams) : null,
  );

  // Non-modal panel: follow the canvas selection (Revit Properties-palette idiom).
  const selectedTypeId = opening?.typeId ?? null;
  useEffect(() => {
    if (selectedTypeId && selectedTypeId !== typeId) openEditOpeningType(selectedTypeId);
  }, [selectedTypeId, typeId]);

  // (Re)seed the draft (deep copy) when the target type changes.
  useEffect(() => {
    setDraft(type ? structuredClone(type.typeParams) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  const onClose = useCallback(() => closeEditOpeningType(), []);

  const onSave = useCallback(() => {
    if (draft && !isBuiltIn) updateTypeParams(typeId, draft);
  }, [draft, isBuiltIn, typeId, updateTypeParams]);

  const onDuplicateAndEdit = useCallback(async () => {
    if (!type) return;
    const baseName = resolveTypeDisplayName(type, t);
    const newName = `${baseName} ${t('ribbon.commands.bimFamilyType.duplicateNamePrefix')}`;
    const newId = await duplicateCurrent(newName);
    if (newId) openEditOpeningType(newId);
  }, [type, t, duplicateCurrent]);

  const setNum = useCallback(
    (key: 'width' | 'height' | 'frameWidth', raw: string) =>
      setDraft((d) => (d ? { ...d, [key]: parseFloat(raw) || 0 } : d)),
    [],
  );

  // Per-part surface material (κάσα/φύλλο/υαλοστάσιο/μηχανισμός). Immutable patch of
  // `typeParams.materials`; `undefined` deletes the key entirely so
  // `resolveOpeningMaterial` falls back to its part default (zero regression).
  const setMaterialPart = useCallback(
    (part: OpeningMaterialPart, value: string | undefined) =>
      setDraft((d) => {
        if (!d) return d;
        const nextMaterials = { ...d.materials };
        if (value === undefined) delete nextMaterials[part];
        else nextMaterials[part] = value;
        return { ...d, materials: nextMaterials };
      }),
    [],
  );

  if (!type || !draft) return null;
  const unit = t('ribbon.commands.bimFamilyType.thicknessUnit');
  const none = t('ribbon.commands.bimFamilyType.materialNone');
  const title = `${t('ribbon.commands.bimFamilyType.editTypeOpeningTitle')} · ${resolveTypeDisplayName(type, t)}`;
  const fieldClass =
    'w-32 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground';

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      draggableOptions={{ getClientPosition }}
      className="w-[480px] max-w-[95vw]"
      data-testid="edit-opening-type-panel"
    >
      <FloatingPanel.Header title={title} icon={<Pencil />} />
      <FloatingPanel.Content className="max-h-[80vh] overflow-y-auto">
        <p className="mb-2 text-xs text-muted-foreground">
          {t('ribbon.commands.bimFamilyType.editTypeOpeningDescription')}
        </p>

        {isBuiltIn ? (
          <p
            className="mb-2 rounded border border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--bg-warning))]/10 px-2 py-1 text-xs text-[hsl(var(--text-warning))]"
            role="note"
          >
            {t('ribbon.commands.bimFamilyType.editTypeOpeningBuiltinNotice')}
          </p>
        ) : (
          affectedCount > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              {t('ribbon.commands.bimFamilyType.editTypeAffectsCountOpening', { count: affectedCount })}
            </p>
          )
        )}

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-28 shrink-0">{t('ribbon.commands.bimFamilyType.paramWidth')}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={draft.width}
              onChange={(e) => setNum('width', e.target.value)}
              aria-label={t('ribbon.commands.bimFamilyType.paramWidth')}
              className={fieldClass}
            />
            <span className="text-muted-foreground">{unit}</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-28 shrink-0">{t('ribbon.commands.bimFamilyType.paramHeight')}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={draft.height}
              onChange={(e) => setNum('height', e.target.value)}
              aria-label={t('ribbon.commands.bimFamilyType.paramHeight')}
              className={fieldClass}
            />
            <span className="text-muted-foreground">{unit}</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-28 shrink-0">{t('ribbon.commands.bimFamilyType.paramFrameWidth')}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.frameWidth ?? 0}
              onChange={(e) => setNum('frameWidth', e.target.value)}
              aria-label={t('ribbon.commands.bimFamilyType.paramFrameWidth')}
              className={fieldClass}
            />
            <span className="text-muted-foreground">{unit}</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-28 shrink-0">{t('ribbon.commands.bimFamilyType.paramGlazingPanes')}</span>
            <Select
              value={draft.glazingPanes !== undefined ? String(draft.glazingPanes) : SELECT_CLEAR_VALUE}
              onValueChange={(v) =>
                setDraft((d) =>
                  d
                    ? { ...d, glazingPanes: v === SELECT_CLEAR_VALUE ? undefined : (Number(v) as 1 | 2 | 3) }
                    : d,
                )
              }
            >
              <SelectTrigger size="sm" aria-label={t('ribbon.commands.bimFamilyType.paramGlazingPanes')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-[7rem]">
                <SelectItem value={SELECT_CLEAR_VALUE}>{none}</SelectItem>
                {GLAZING_OPTIONS.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-28 shrink-0">{t('ribbon.commands.bimFamilyType.paramMaterial')}</span>
            <input
              type="text"
              value={draft.material ?? ''}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, material: e.target.value.trim() || undefined } : d))
              }
              aria-label={t('ribbon.commands.bimFamilyType.paramMaterial')}
              className={fieldClass}
            />
          </label>

          <OpeningMaterialSelectCell
            label={t('ribbon.commands.bimFamilyType.paramFrameMaterial')}
            material={draft.materials?.frame}
            onChange={(v) => setMaterialPart('frame', v)}
            catalog={materialCatalog}
          />

          <OpeningMaterialSelectCell
            label={t('ribbon.commands.bimFamilyType.paramLeafMaterial')}
            material={draft.materials?.leaf}
            onChange={(v) => setMaterialPart('leaf', v)}
            catalog={materialCatalog}
          />

          <OpeningMaterialSelectCell
            label={t('ribbon.commands.bimFamilyType.paramGlassMaterial')}
            material={draft.materials?.glass}
            onChange={(v) => setMaterialPart('glass', v)}
            catalog={materialCatalog}
          />

          <OpeningMaterialSelectCell
            label={t('ribbon.commands.bimFamilyType.paramHardwareMaterial')}
            material={draft.materials?.hardware}
            onChange={(v) => setMaterialPart('hardware', v)}
            catalog={materialCatalog}
          />

          <label className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-28 shrink-0">{t('ribbon.commands.bimFamilyType.paramFireRating')}</span>
            <input
              type="text"
              value={draft.fireRating ?? ''}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, fireRating: e.target.value.trim() || undefined } : d))
              }
              aria-label={t('ribbon.commands.bimFamilyType.paramFireRating')}
              className={fieldClass}
            />
          </label>
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
