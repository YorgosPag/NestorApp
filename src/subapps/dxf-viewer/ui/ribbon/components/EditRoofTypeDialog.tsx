'use client';

/**
 * ADR-417 §10 #3 — «Edit Roof Type» dialog. Roof analogue of `EditSlabTypeDialog`.
 *
 * Edits a roof TYPE's `typeParams` (material / thickness / full layer build-up).
 * Changes re-flow to EVERY instance of the type, all floors (Revit «Edit Type»).
 * One undoable op via `controller.updateTypeParams` → `UpdateRoofFamilyTypeCommand`.
 * Built-ins are read-only — Duplicate first.
 *
 * Mounted always-on in `RoofPersistenceHost`; opened via `openEditRoofType`.
 * Reuses `SlabDnaEditor` + `SlabTypePreviewPanel` (roof DNA IS `SlabDna`, zero
 * fork). A roof has no sub-kind, so the kind field of the slab dialog is dropped;
 * the DNA editor receives `'roof'` purely for its «load preset» convenience.
 *
 * @see ./EditSlabTypeDialog.tsx — the slab sibling
 * @see ../hooks/useRoofFamilyTypeController.ts §updateTypeParams
 * @see ../../../bim/family-types/edit-roof-type-store.ts
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
import { useRoofFamilyTypeController } from '../hooks/useRoofFamilyTypeController';
import { SlabDnaEditor } from './SlabDnaEditor';
import { SlabTypePreviewPanel } from './SlabTypePreviewPanel';
import { MaterialSwatch } from '../../components/shared/MaterialSwatch';
import {
  CONSTRUCTION_MATERIAL_IDS,
  constructionMaterialLabelKey,
} from '../../../bim/materials/construction-materials';
import { useBimFamilyTypeStore } from '../../../bim/family-types/bim-family-type-store';
import { asRoofFamilyType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import {
  closeEditRoofType,
  getEditRoofTypeState,
  openEditRoofType,
  subscribeEditRoofType,
} from '../../../bim/family-types/edit-roof-type-store';
import type { SlabDna } from '../../../bim/types/slab-dna-types';
import type { RoofTypeParams } from '../../../bim/types/bim-family-type';
import {
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_SOFFIT_MODE,
  type RoofSoffitMode,
} from '../../../bim/types/roof-types';

const PANEL_DIMENSIONS = { width: 1010, height: 620 } as const;
const SSR_FALLBACK_POSITION = { x: 220, y: 80 } as const;
const getClientPosition = (): { x: number; y: number } =>
  PanelPositionCalculator.getTopRightPosition(PANEL_DIMENSIONS.width);

export function EditRoofTypeDialog(): React.ReactElement | null {
  const state = useSyncExternalStore(subscribeEditRoofType, getEditRoofTypeState, getEditRoofTypeState);
  if (!state.open || !state.typeId) return null;
  return <EditRoofTypeDialogContent typeId={state.typeId} />;
}

function EditRoofTypeDialogContent({ typeId }: { typeId: string }): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { updateTypeParams, duplicateCurrent, countRoofsOfType, roof } =
    useRoofFamilyTypeController();
  const getType = useBimFamilyTypeStore((s) => s.getType);
  const type = asRoofFamilyType(getType(typeId));
  const isBuiltIn = type?.origin === 'built-in';
  const affectedCount = countRoofsOfType(typeId);

  const [draft, setDraft] = useState<RoofTypeParams | null>(
    type ? structuredClone(type.typeParams) : null,
  );
  const [highlightLayerId, setHighlightLayerId] = useState<string | null>(null);

  // Non-modal: follow the canvas selection to its roof type (Revit Properties idiom).
  const selectedTypeId = roof?.typeId ?? null;
  useEffect(() => {
    if (selectedTypeId && selectedTypeId !== typeId) openEditRoofType(selectedTypeId);
  }, [selectedTypeId, typeId]);

  useEffect(() => {
    setDraft(type ? structuredClone(type.typeParams) : null);
    setHighlightLayerId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  const onClose = useCallback(() => closeEditRoofType(), []);

  const onSave = useCallback(() => {
    if (draft && !isBuiltIn) updateTypeParams(typeId, draft);
  }, [draft, isBuiltIn, typeId, updateTypeParams]);

  const onDuplicateAndEdit = useCallback(async () => {
    if (!type) return;
    const baseName = resolveTypeDisplayName(type, t);
    const newName = `${baseName} ${t('ribbon.commands.roofFamilyType.duplicateNamePrefix')}`;
    const newId = await duplicateCurrent(newName);
    if (newId) openEditRoofType(newId);
  }, [type, t, duplicateCurrent]);

  const onDnaChange = useCallback((next: SlabDna | undefined) => {
    setDraft((d) =>
      d ? { ...d, dna: next, thickness: next ? next.totalThickness : d.thickness } : d,
    );
  }, []);

  if (!type || !draft) return null;
  const title = `${t('ribbon.commands.roofFamilyType.editTypeTitle')} · ${resolveTypeDisplayName(type, t)}`;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      draggableOptions={{ getClientPosition }}
      className="w-[1010px] max-w-[95vw]"
      data-testid="edit-roof-type-panel"
    >
      <FloatingPanel.Header title={title} icon={<Pencil />} />
      <FloatingPanel.Content className="max-h-[80vh] overflow-y-auto">
        <p className="mb-2 text-xs text-muted-foreground">
          {t('ribbon.commands.roofFamilyType.editTypeDescription')}
        </p>

        {isBuiltIn ? (
          <p
            className="mb-2 rounded border border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--bg-warning))]/10 px-2 py-1 text-xs text-[hsl(var(--text-warning))]"
            role="note"
          >
            {t('ribbon.commands.roofFamilyType.editTypeBuiltinNotice')}
          </p>
        ) : (
          affectedCount > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              {t('ribbon.commands.roofFamilyType.editTypeAffectsCount', { count: affectedCount })}
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
              <span className="w-24 shrink-0">{t('ribbon.commands.roofFamilyType.paramMaterial')}</span>
              <Select
                value={draft.material ?? SELECT_CLEAR_VALUE}
                onValueChange={(v) =>
                  setDraft((d) =>
                    d ? { ...d, material: v === SELECT_CLEAR_VALUE ? undefined : v } : d,
                  )
                }
              >
                <SelectTrigger size="sm" aria-label={t('ribbon.commands.roofFamilyType.paramMaterial')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-auto min-w-[9rem]">
                  <SelectItem value={SELECT_CLEAR_VALUE}>
                    {t('ribbon.commands.roofFamilyType.materialNone')}
                  </SelectItem>
                  {CONSTRUCTION_MATERIAL_IDS.map((id) => (
                    <SelectItem key={id} value={id} className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <MaterialSwatch materialId={id} />
                        <span>{t(constructionMaterialLabelKey(id))}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex items-center gap-2 text-xs text-foreground">
              <span className="w-24 shrink-0">{t('ribbon.commands.roofFamilyType.paramThickness')}</span>
              {draft.dna ? (
                <span className="dxf-ribbon-wall-length-value">
                  {Math.round(draft.thickness)} {t('ribbon.commands.roofFamilyType.thicknessUnit')}
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
                  aria-label={t('ribbon.commands.roofFamilyType.paramThickness')}
                  className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                />
              )}
            </label>

            <SlabDnaEditor
              dna={draft.dna}
              kind="roof"
              fallbackThickness={draft.thickness}
              onChange={onDnaChange}
              highlightLayerId={highlightLayerId}
              onHighlightLayer={setHighlightLayerId}
            />

            {/* ADR-417 Φ2b — Eave detailing (γείσο): fascia/soffit appearance. */}
            <fieldset className="mt-1 flex flex-col gap-3 border-t border-border pt-3">
              <legend className="text-xs font-medium text-foreground">
                {t('ribbon.commands.roofFamilyType.eaveSection')}
              </legend>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <span className="w-24 shrink-0">{t('ribbon.commands.roofFamilyType.paramFasciaMaterial')}</span>
                <Select
                  value={draft.fasciaMaterial ?? SELECT_CLEAR_VALUE}
                  onValueChange={(v) =>
                    setDraft((d) =>
                      d ? { ...d, fasciaMaterial: v === SELECT_CLEAR_VALUE ? undefined : v } : d,
                    )
                  }
                >
                  <SelectTrigger size="sm" aria-label={t('ribbon.commands.roofFamilyType.paramFasciaMaterial')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-[9rem]">
                    <SelectItem value={SELECT_CLEAR_VALUE}>
                      {t('ribbon.commands.roofFamilyType.materialNone')}
                    </SelectItem>
                    {CONSTRUCTION_MATERIAL_IDS.map((id) => (
                      <SelectItem key={id} value={id} className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <MaterialSwatch materialId={id} />
                          <span>{t(constructionMaterialLabelKey(id))}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <span className="w-24 shrink-0">{t('ribbon.commands.roofFamilyType.paramSoffitMaterial')}</span>
                <Select
                  value={draft.soffitMaterial ?? SELECT_CLEAR_VALUE}
                  onValueChange={(v) =>
                    setDraft((d) =>
                      d ? { ...d, soffitMaterial: v === SELECT_CLEAR_VALUE ? undefined : v } : d,
                    )
                  }
                >
                  <SelectTrigger size="sm" aria-label={t('ribbon.commands.roofFamilyType.paramSoffitMaterial')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-[9rem]">
                    <SelectItem value={SELECT_CLEAR_VALUE}>
                      {t('ribbon.commands.roofFamilyType.materialNone')}
                    </SelectItem>
                    {CONSTRUCTION_MATERIAL_IDS.map((id) => (
                      <SelectItem key={id} value={id} className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <MaterialSwatch materialId={id} />
                          <span>{t(constructionMaterialLabelKey(id))}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <span className="w-24 shrink-0">{t('ribbon.commands.roofFamilyType.paramFasciaHeight')}</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.fasciaHeightMm ?? DEFAULT_FASCIA_HEIGHT_MM}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, fasciaHeightMm: parseFloat(e.target.value) || undefined } : d,
                    )
                  }
                  aria-label={t('ribbon.commands.roofFamilyType.paramFasciaHeight')}
                  className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                />
                <span className="text-muted-foreground">
                  {t('ribbon.commands.roofFamilyType.thicknessUnit')}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <span className="w-24 shrink-0">{t('ribbon.commands.roofFamilyType.paramSoffitMode')}</span>
                <Select
                  value={draft.soffitMode ?? DEFAULT_SOFFIT_MODE}
                  onValueChange={(v) =>
                    setDraft((d) => (d ? { ...d, soffitMode: v as RoofSoffitMode } : d))
                  }
                >
                  <SelectTrigger size="sm" aria-label={t('ribbon.commands.roofFamilyType.paramSoffitMode')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-[9rem]">
                    <SelectItem value="horizontal">
                      {t('ribbon.commands.roofFamilyType.soffitModeHorizontal')}
                    </SelectItem>
                    <SelectItem value="sloped">
                      {t('ribbon.commands.roofFamilyType.soffitModeSloped')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </fieldset>
          </div>
        </div>

        <footer className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            {t('ribbon.commands.roofFamilyType.cancel')}
          </button>
          {isBuiltIn ? (
            <button
              type="button"
              onClick={onDuplicateAndEdit}
              className="rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {t('ribbon.commands.roofFamilyType.duplicateAndEdit')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSave}
              className="rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {t('ribbon.commands.roofFamilyType.save')}
            </button>
          )}
        </footer>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}
