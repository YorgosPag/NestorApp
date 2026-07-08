'use client';

/**
 * ADR-603 Φ4 — «Family Type» selector-with-duplicate ribbon widget factory (SSoT).
 *
 * The Wall and Opening contextual selectors were byte-identical (same `bimFamilyType`
 * i18n keys, same Radix `Select` + «Duplicate» affordance) apart from which
 * controller they read and the entity field name. This factory owns that widget
 * once; each entity binds it with a `useModel` adapter over its controller.
 *
 * NOTE: the Slab/Roof selectors are a DIFFERENT design (edit/delete affordance,
 * per-entity i18n namespace) — those share `FamilyTypeEditorWidget` instead. The
 * two families are deliberately NOT merged (that would be a UX change).
 *
 * @see ./FamilyTypeEditorWidget.tsx — the slab/roof sibling design
 * @see docs/centralized-systems/reference/adrs/ADR-603-generic-family-type-framework.md
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
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import type { BimFamilyType } from '../../../bim/types/bim-family-type';

/** Minimal controller slice the selector widget needs. */
export interface FamilyTypeSelectorModel {
  /** Selected entity (null → widget self-hides). Only `typeId` is read. */
  readonly entity: { readonly typeId?: string } | null;
  /** Entity-category catalog slice (built-in + user), reactive. */
  readonly types: readonly BimFamilyType[];
  /** The entity's resolved family type, or `null` when ad-hoc/untyped. */
  readonly currentType: BimFamilyType | null;
  /** Can the user create/edit types (auth ready)? Gates Duplicate. */
  readonly canWrite: boolean;
  /** Assign a type (or `undefined` to detach to ad-hoc). */
  readonly assignType: (typeId: string | undefined) => void;
  /** Clone the current type to an editable user copy and assign it. */
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
}

/**
 * Build a contextual «Family Type» selector widget (Wall/Opening design) bound to
 * one entity's controller via `useModel`.
 */
export function createFamilyTypeSelectorWidget(
  useModel: () => FamilyTypeSelectorModel,
): () => React.JSX.Element | null {
  return function RibbonFamilyTypeSelectorWidget(): React.JSX.Element | null {
    const { t } = useTranslation('dxf-viewer-shell');
    const { entity, types, currentType, canWrite, assignType, duplicateCurrent } = useModel();

    const handleChange = useCallback(
      (value: string) => assignType(isSelectClearValue(value) ? undefined : value),
      [assignType],
    );

    const handleDuplicate = useCallback(() => {
      if (!currentType) return;
      const base = resolveTypeDisplayName(currentType, t);
      void duplicateCurrent(`${t('ribbon.commands.bimFamilyType.duplicateNamePrefix')} - ${base}`);
    }, [currentType, duplicateCurrent, t]);

    if (!entity) return null;

    const label = t('ribbon.commands.bimFamilyType.label');
    const builtinSuffix = ` · ${t('ribbon.commands.bimFamilyType.builtinBadge')}`;

    return (
      <span className="dxf-ribbon-combobox-row">
        <span className="dxf-ribbon-combobox-label">{label}</span>
        <span className="dxf-ribbon-widget-compact flex items-center gap-1">
          <Select value={entity.typeId ?? SELECT_CLEAR_VALUE} onValueChange={handleChange}>
            <SelectTrigger size="sm" aria-label={label}>
              <SelectValue placeholder={t('ribbon.commands.bimFamilyType.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-[11rem]">
              <SelectItem value={SELECT_CLEAR_VALUE} className="whitespace-nowrap">
                {t('ribbon.commands.bimFamilyType.noType')}
              </SelectItem>
              {types.map((type) => (
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
  };
}
