'use client';

/**
 * ADR-417 §10 #3 — Roof Type Properties + per-parameter override editor. Roof
 * analogue of `RibbonWallTypePropertiesWidget`.
 *
 * Surfaces the EFFECTIVE («type-resolved») type-governed params of the selected
 * typed roof and lets a single instance deviate per-parameter (Revit «by-instance»).
 * A roof has no sub-kind, so `material` is the only overridable param; `thickness`
 * (DNA-governed) is read-only — edited on the type itself via the Edit-Type dialog.
 * Overridden material carries a badge; «Reset to type» clears every override.
 * User types are renamable inline; built-ins are read-only.
 *
 * All mutations route through `useRoofFamilyTypeController` (SSoT). Edit/Delete
 * live in the sibling `RibbonRoofFamilyTypeWidget`. Self-hides for untyped roofs.
 *
 * @see ../hooks/useRoofFamilyTypeController.ts
 * @see ./RibbonWallTypePropertiesWidget.tsx — the wall sibling
 * @see ./RibbonRoofFamilyTypeWidget.tsx — sibling selector (edit/delete)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRoofFamilyTypeController } from '../hooks/useRoofFamilyTypeController';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';

/** Roof-level material value → i18n key suffix (mirror the Edit dialog list). */
const MATERIAL_OPTIONS: readonly { value: string; key: string }[] = [
  { value: 'rc', key: 'rc' },
  { value: 'tile', key: 'tile' },
  { value: 'wood', key: 'wood' },
] as const;

export function RibbonRoofTypePropertiesWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useRoofFamilyTypeController();
  const { roof, currentType, overriddenKeys, canWrite } = ctrl;

  const typeName = currentType ? resolveTypeDisplayName(currentType, t) : '';
  const [draft, setDraft] = useState(typeName);
  // Re-sync the rename draft when the selected type changes (not mid-edit).
  useEffect(() => setDraft(typeName), [typeName]);

  const commitRename = useCallback(() => {
    if (!currentType || isBuiltInType(currentType)) return;
    const next = draft.trim();
    if (!next || next === currentType.name) return;
    void ctrl.renameType(currentType.id, next);
  }, [ctrl, currentType, draft]);

  const onNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter':
          e.currentTarget.blur();
          break;
        case 'Escape':
          setDraft(typeName);
          e.currentTarget.blur();
          break;
        default:
          break;
      }
    },
    [typeName],
  );

  if (!roof || !currentType) return null;

  const editable = !isBuiltInType(currentType) && canWrite;
  const materialOverridden = overriddenKeys.includes('material');

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.roofFamilyType.properties')}
        </span>
        {editable ? (
          <input
            className="text-xs px-1 py-0.5 rounded border border-black/20 bg-transparent"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={onNameKeyDown}
            aria-label={t('ribbon.commands.roofFamilyType.rename')}
          />
        ) : (
          <span className="dxf-ribbon-wall-length-value">
            {typeName} · {t('ribbon.commands.roofFamilyType.builtinBadge')}
          </span>
        )}
        {overriddenKeys.length > 0 && (
          <button
            type="button"
            className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
            aria-label={t('ribbon.commands.roofFamilyType.resetToTypeTooltip')}
            onClick={ctrl.resetOverrides}
          >
            {t('ribbon.commands.roofFamilyType.resetToType')}
          </button>
        )}
      </span>

      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.roofFamilyType.paramMaterial')}
        </span>
        <Select
          value={roof.params.material ?? SELECT_CLEAR_VALUE}
          onValueChange={(v) =>
            ctrl.setOverride('material', v === SELECT_CLEAR_VALUE ? undefined : v)
          }
        >
          <SelectTrigger size="sm" aria-label={t('ribbon.commands.roofFamilyType.paramMaterial')}>
            <SelectValue placeholder={t('ribbon.commands.roofFamilyType.materialNone')} />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[9rem]">
            <SelectItem value={SELECT_CLEAR_VALUE}>
              {t('ribbon.commands.roofFamilyType.materialNone')}
            </SelectItem>
            {MATERIAL_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="whitespace-nowrap">
                {t(`ribbon.commands.roofFamilyType.material.${m.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {materialOverridden && (
          <button
            type="button"
            className="text-xs px-1 py-0.5 rounded bg-accent text-accent-foreground border border-border whitespace-nowrap"
            aria-label={t('ribbon.commands.roofFamilyType.overrideTooltip')}
            onClick={() => ctrl.clearOverride('material')}
          >
            {t('ribbon.commands.roofFamilyType.override')} ✕
          </button>
        )}
      </span>

      <span className="flex items-center gap-2 text-xs">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.roofFamilyType.paramThickness')}
        </span>
        <span className="dxf-ribbon-wall-length-value">
          {Math.round(roof.params.thickness)} {t('ribbon.commands.roofFamilyType.thicknessUnit')}
        </span>
      </span>
    </span>
  );
}
