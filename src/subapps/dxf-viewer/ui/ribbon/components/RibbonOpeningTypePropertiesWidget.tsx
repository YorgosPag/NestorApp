'use client';

/**
 * ADR-421 SLICE C — Opening Type Properties widget (contextual Opening ribbon).
 *
 * Surfaces the EFFECTIVE («type-resolved») type-governed params of the selected
 * typed opening (width / height / frame / glazing / material / fire-rating).
 * Per Revit, dimensions are TYPE-governed → shown read-only here and edited via
 * «Edit type…». Any per-instance overrides present carry a badge with a clear (✕)
 * action; «Reset to type» clears them all. User types are renamable inline;
 * built-ins are read-only (clone-to-edit via the sibling selector's «Duplicate»).
 *
 * All mutations route through `useOpeningFamilyTypeController` (SSoT). Self-hides
 * for untyped/ad-hoc openings. Mirror of `RibbonWallTypePropertiesWidget`.
 *
 * @see ../hooks/useOpeningFamilyTypeController.ts
 * @see ./RibbonOpeningFamilyTypeWidget.tsx — sibling selector
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './RibbonTooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useOpeningFamilyTypeController } from '../hooks/useOpeningFamilyTypeController';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import { openEditOpeningType } from '../../../bim/family-types/edit-opening-type-store';
import type { OpeningTypeParams } from '../../../bim/types/bim-family-type';

/** A read-only effective param row, with a clear-override badge when overridden. */
function ParamRow(props: {
  readonly label: string;
  readonly value: string;
  readonly overridden: boolean;
  readonly onClear: () => void;
  readonly overrideLabel: string;
  readonly overrideTooltip: string;
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="dxf-ribbon-combobox-label">{props.label}</span>
      <span className="dxf-ribbon-wall-length-value">{props.value}</span>
      {props.overridden && (
        <button
          type="button"
          className="text-xs px-1 py-0.5 rounded bg-accent text-accent-foreground border border-border whitespace-nowrap"
          aria-label={props.overrideTooltip}
          onClick={props.onClear}
        >
          {props.overrideLabel} ✕
        </button>
      )}
    </span>
  );
}

export function RibbonOpeningTypePropertiesWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const ctrl = useOpeningFamilyTypeController();
  const { opening, currentType, overriddenKeys, canWrite } = ctrl;

  const typeName = currentType ? resolveTypeDisplayName(currentType, t) : '';
  const [draft, setDraft] = useState(typeName);
  useEffect(() => setDraft(typeName), [typeName]);

  const commitRename = useCallback(() => {
    if (!currentType || isBuiltInType(currentType)) return;
    const next = draft.trim();
    if (!next || next === typeName) return;
    void ctrl.renameType(currentType.id, next);
  }, [ctrl, currentType, draft, typeName]);

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

  const onEditType = useCallback(async () => {
    if (!currentType) return;
    if (isBuiltInType(currentType)) {
      const baseName = resolveTypeDisplayName(currentType, t);
      const newId = await ctrl.duplicateCurrent(
        `${t('ribbon.commands.bimFamilyType.duplicateNamePrefix')} ${baseName}`,
      );
      if (newId) openEditOpeningType(newId);
    } else {
      openEditOpeningType(currentType.id);
    }
  }, [ctrl, currentType, t]);

  if (!opening || !currentType) return null;

  const editable = !isBuiltInType(currentType) && canWrite;
  const unit = t('ribbon.commands.bimFamilyType.thicknessUnit');
  const none = t('ribbon.commands.bimFamilyType.materialNone');
  const overrideLabel = t('ribbon.commands.bimFamilyType.override');
  const overrideTooltip = t('ribbon.commands.bimFamilyType.overrideTooltip');
  const isOverridden = (k: keyof OpeningTypeParams) => overriddenKeys.includes(k);

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">
          {t('ribbon.commands.bimFamilyType.properties')}
        </span>
        {editable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <input
                className="text-xs px-1.5 py-0.5 rounded border border-border bg-muted/40 text-foreground min-w-[7rem] focus:outline-none focus:ring-1 focus:ring-ring"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={onNameKeyDown}
                aria-label={t('ribbon.commands.bimFamilyType.rename')}
              />
            </TooltipTrigger>
            <TooltipContent>{t('ribbon.commands.bimFamilyType.renameTooltip')}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="dxf-ribbon-wall-length-value">
            {isBuiltInType(currentType)
              ? `${typeName} · ${t('ribbon.commands.bimFamilyType.builtinBadge')}`
              : typeName}
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

      <span className="flex items-center gap-3 flex-wrap">
        <ParamRow
          label={t('ribbon.commands.bimFamilyType.paramWidth')}
          value={`${Math.round(opening.params.width)} ${unit}`}
          overridden={isOverridden('width')}
          onClear={() => ctrl.clearOverride('width')}
          overrideLabel={overrideLabel}
          overrideTooltip={overrideTooltip}
        />
        <ParamRow
          label={t('ribbon.commands.bimFamilyType.paramHeight')}
          value={`${Math.round(opening.params.height)} ${unit}`}
          overridden={isOverridden('height')}
          onClear={() => ctrl.clearOverride('height')}
          overrideLabel={overrideLabel}
          overrideTooltip={overrideTooltip}
        />
        <ParamRow
          label={t('ribbon.commands.bimFamilyType.paramFrameWidth')}
          value={
            opening.params.frameWidth !== undefined
              ? `${Math.round(opening.params.frameWidth)} ${unit}`
              : none
          }
          overridden={isOverridden('frameWidth')}
          onClear={() => ctrl.clearOverride('frameWidth')}
          overrideLabel={overrideLabel}
          overrideTooltip={overrideTooltip}
        />
      </span>

      <span className="flex items-center gap-3 flex-wrap">
        <ParamRow
          label={t('ribbon.commands.bimFamilyType.paramGlazingPanes')}
          value={opening.params.glazingPanes !== undefined ? String(opening.params.glazingPanes) : none}
          overridden={isOverridden('glazingPanes')}
          onClear={() => ctrl.clearOverride('glazingPanes')}
          overrideLabel={overrideLabel}
          overrideTooltip={overrideTooltip}
        />
        <ParamRow
          label={t('ribbon.commands.bimFamilyType.paramMaterial')}
          value={opening.params.material ?? none}
          overridden={isOverridden('material')}
          onClear={() => ctrl.clearOverride('material')}
          overrideLabel={overrideLabel}
          overrideTooltip={overrideTooltip}
        />
        <span className="flex items-center gap-1 text-xs">
          <span className="dxf-ribbon-combobox-label">
            {t('ribbon.commands.bimFamilyType.paramFireRating')}
          </span>
          <span className="dxf-ribbon-wall-length-value">
            {currentType.typeParams.fireRating ?? none}
          </span>
        </span>
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
