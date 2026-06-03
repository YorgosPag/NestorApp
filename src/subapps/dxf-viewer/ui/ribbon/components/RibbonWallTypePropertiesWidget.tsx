'use client';

/**
 * ADR-412 Φ4 — Wall Type Properties + per-parameter override editor.
 *
 * Surfaces the EFFECTIVE («type-resolved») type-governed params of the selected
 * typed wall and lets a single instance deviate per-parameter (Vectorworks
 * «by-style / by-instance», Q4). Overridden params carry a badge; «Reset to type»
 * clears every override (Revit). User types are renamable inline; built-ins are
 * read-only (clone-to-edit via the sibling selector's «Duplicate»).
 *
 * Φ4 exposes `category` as the overridable param (always defined → no
 * none-ambiguity); `thickness`/`material` are shown read-only (structural / DNA-
 * governed — edited on the type itself). All mutations route through
 * `useWallFamilyTypeController` (SSoT). Self-hides for untyped/ad-hoc walls.
 *
 * @see ../hooks/useWallFamilyTypeController.ts
 * @see ./RibbonWallFamilyTypeWidget.tsx — sibling selector
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useWallFamilyTypeController } from '../hooks/useWallFamilyTypeController';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import { openEditWallType } from '../../../bim/family-types/edit-wall-type-store';
import type { WallCategory } from '../../../bim/types/wall-types';

const CATEGORY_VALUES: readonly WallCategory[] = [
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
] as const;

/** Material value → i18n key suffix (handles the hyphenated `aerated-concrete`). */
const MATERIAL_KEY: Record<string, string> = {
  rc: 'rc',
  masonry: 'masonry',
  'aerated-concrete': 'aeratedConcrete',
  gypsum: 'gypsum',
};

export function RibbonWallTypePropertiesWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useWallFamilyTypeController();
  const { wall, currentType, overriddenKeys, canWrite } = ctrl;

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
      // Local input-scoped keys (a controlled-input rename, NOT a global Escape
      // command → ADR-364 escape-bus does not apply). Enter commits via blur;
      // cancel reverts the rename draft then blurs.
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

  // ADR-412 Φ5 — open the full Edit-Type dialog (thickness / material / category
  // / DNA). Built-ins are read-only → clone-to-edit first, then open on the clone.
  const onEditType = useCallback(async () => {
    if (!currentType) return;
    if (isBuiltInType(currentType)) {
      const baseName = resolveTypeDisplayName(currentType, t);
      const newId = await ctrl.duplicateCurrent(
        `${t('ribbon.commands.bimFamilyType.duplicateNamePrefix')} ${baseName}`,
      );
      if (newId) openEditWallType(newId);
    } else {
      openEditWallType(currentType.id);
    }
  }, [ctrl, currentType, t]);

  if (!wall || !currentType) return null;

  const editable = !isBuiltInType(currentType) && canWrite;
  const categoryOverridden = overriddenKeys.includes('category');
  const materialLabel = wall.params.material
    ? t(`ribbon.commands.wallEditor.material.${MATERIAL_KEY[wall.params.material] ?? 'rc'}`)
    : t('ribbon.commands.bimFamilyType.materialNone');

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.properties')}
        </span>
        {editable ? (
          <input
            className="text-xs px-1 py-0.5 rounded border border-black/20 bg-transparent"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={onNameKeyDown}
            aria-label={t('ribbon.commands.bimFamilyType.rename')}
          />
        ) : (
          <span className="dxf-ribbon-wall-length-value">
            {typeName} · {t('ribbon.commands.bimFamilyType.builtinBadge')}
          </span>
        )}
        {overriddenKeys.length > 0 && (
          <button
            type="button"
            className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
            aria-label={t('ribbon.commands.bimFamilyType.resetToTypeTooltip')}
            onClick={ctrl.resetOverrides}
          >
            {t('ribbon.commands.bimFamilyType.resetToType')}
          </button>
        )}
      </span>

      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.paramCategory')}
        </span>
        <Select
          value={wall.params.category}
          onValueChange={(v) => ctrl.setOverride('category', v as WallCategory)}
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
        {categoryOverridden && (
          <button
            type="button"
            className="text-xs px-1 py-0.5 rounded bg-accent text-accent-foreground border border-border whitespace-nowrap"
            aria-label={t('ribbon.commands.bimFamilyType.overrideTooltip')}
            onClick={() => ctrl.clearOverride('category')}
          >
            {t('ribbon.commands.bimFamilyType.override')} ✕
          </button>
        )}
      </span>

      <span className="flex items-center gap-2 text-xs">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.paramThickness')}
        </span>
        <span className="dxf-ribbon-wall-length-value">
          {Math.round(wall.params.thickness)} {t('ribbon.commands.bimFamilyType.thicknessUnit')}
        </span>
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.paramMaterial')}
        </span>
        <span className="dxf-ribbon-wall-length-value">{materialLabel}</span>
      </span>

      {canWrite && (
        <span className="flex items-center gap-1">
          <button
            type="button"
            className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
            onClick={onEditType}
          >
            {isBuiltInType(currentType)
              ? t('ribbon.commands.bimFamilyType.duplicateAndEdit')
              : t('ribbon.commands.bimFamilyType.editType')}
          </button>
          {editable && (
            <button
              type="button"
              className="text-xs px-1.5 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap"
              onClick={() => void ctrl.deleteType(currentType.id)}
            >
              {t('ribbon.commands.bimFamilyType.deleteType')}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
