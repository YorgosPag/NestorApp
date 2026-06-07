'use client';

/**
 * ADR-421 SLICE C — Opening Family Type selector (contextual Opening ribbon).
 *
 * Radix `Select` (ADR-001 canonical) listing the built-in + user opening types
 * plus a «no type (ad-hoc)» clear option (`SELECT_CLEAR_VALUE`, NOT '' — ADR-411
 * lesson). Selecting a type assigns it via the undoable `AssignOpeningTypeCommand`
 * (a Type can switch the family → 2D symbol / 3D mesh / IFC routing follow);
 * «no type» detaches it (non-destructive). «Duplicate» (Revit clone-to-edit)
 * forks the current type into an editable user copy — the only way to edit a
 * read-only built-in.
 *
 * All logic lives in `useOpeningFamilyTypeController` (SSoT); this widget is
 * presentational. Mirror of `RibbonWallFamilyTypeWidget`.
 *
 * @see ../hooks/useOpeningFamilyTypeController.ts
 */

import React, { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import { useOpeningFamilyTypeController } from '../hooks/useOpeningFamilyTypeController';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';

export function RibbonOpeningFamilyTypeWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { opening, openingTypes, currentType, canWrite, assignType, duplicateCurrent } =
    useOpeningFamilyTypeController();

  const handleChange = useCallback(
    (value: string) => assignType(isSelectClearValue(value) ? undefined : value),
    [assignType],
  );

  const handleDuplicate = useCallback(() => {
    if (!currentType) return;
    const base = resolveTypeDisplayName(currentType, t);
    void duplicateCurrent(`${t('ribbon.commands.bimFamilyType.duplicateNamePrefix')} - ${base}`);
  }, [currentType, duplicateCurrent, t]);

  if (!opening) return null;

  const label = t('ribbon.commands.bimFamilyType.label');
  const builtinSuffix = ` · ${t('ribbon.commands.bimFamilyType.builtinBadge')}`;

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact flex items-center gap-1">
        <Select value={opening.typeId ?? SELECT_CLEAR_VALUE} onValueChange={handleChange}>
          <SelectTrigger size="sm" aria-label={label}>
            <SelectValue placeholder={t('ribbon.commands.bimFamilyType.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[11rem]">
            <SelectItem value={SELECT_CLEAR_VALUE} className="whitespace-nowrap">
              {t('ribbon.commands.bimFamilyType.noType')}
            </SelectItem>
            {openingTypes.map((type) => (
              <SelectItem key={type.id} value={type.id} className="whitespace-nowrap">
                {resolveTypeDisplayName(type, t)}
                {isBuiltInType(type) ? builtinSuffix : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentType && canWrite && (
          <button
            type="button"
            className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
            aria-label={t('ribbon.commands.bimFamilyType.duplicateTooltip')}
            onClick={handleDuplicate}
          >
            {t('ribbon.commands.bimFamilyType.duplicate')}
          </button>
        )}
      </span>
    </span>
  );
}
