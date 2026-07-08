'use client';

/**
 * ADR-604 Φ4 — «Family Type» selector-with-duplicate ribbon widget factory (SSoT).
 *
 * The Wall and Opening contextual selectors were byte-identical (same `bimFamilyType`
 * i18n keys, same dropdown + «Duplicate» affordance) apart from which controller
 * they read and the entity field name. This factory owns that widget once; each
 * entity binds it with a `useModel` adapter over its controller. The dropdown
 * scaffolding itself is the shared `FamilyTypeSelect`.
 *
 * NOTE: the Slab/Roof selectors are a DIFFERENT design (edit/delete affordance,
 * per-entity i18n namespace) — those share `FamilyTypeEditorWidget` instead. The
 * two families are deliberately NOT merged (that would be a UX change).
 *
 * @see ./FamilyTypeSelect.tsx — shared dropdown · ./FamilyTypeEditorWidget.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-604-generic-family-type-framework.md
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import { FamilyTypeSelect, type FamilyTypeWidgetCommon } from './FamilyTypeSelect';

/** Minimal controller slice the selector widget needs. */
export interface FamilyTypeSelectorModel extends FamilyTypeWidgetCommon {
  /** Selected entity (null → widget self-hides). Only `typeId` is read. */
  readonly entity: { readonly typeId?: string } | null;
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
          <FamilyTypeSelect
            value={entity.typeId}
            onAssign={assignType}
            ariaLabel={label}
            placeholder={t('ribbon.commands.bimFamilyType.selectPlaceholder')}
            clearLabel={t('ribbon.commands.bimFamilyType.noType')}
            items={types.map((type) => ({
              id: type.id,
              label: `${resolveTypeDisplayName(type, t)}${isBuiltInType(type) ? builtinSuffix : ''}`,
            }))}
          />
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
