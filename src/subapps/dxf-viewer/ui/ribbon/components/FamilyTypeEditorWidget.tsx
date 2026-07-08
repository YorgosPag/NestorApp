'use client';

/**
 * ADR-604 Φ4 — «Family Type» selector-with-edit/delete ribbon widget (SSoT).
 *
 * The Slab and Roof contextual selectors shared one design (Radix `Select` +
 * «Edit Type» / «Delete Type» affordances, built-in → clone-to-edit) differing
 * only in their i18n namespace and their `openEdit{X}Type` store. This
 * presentational component owns that design once; each entity wrapper resolves
 * its own static i18n labels (so the runtime resolver reachability check, CHECK
 * 3.13, stays satisfied) and passes them in with its controller data.
 *
 * NOTE: the Wall/Opening selectors are a DIFFERENT design (duplicate-only) —
 * those use `createFamilyTypeSelectorWidget`. The families are deliberately NOT
 * merged (that would be a UX change).
 *
 * @see ./create-family-type-selector-widget.tsx — the wall/opening sibling design
 * @see docs/centralized-systems/reference/adrs/ADR-604-generic-family-type-framework.md
 */

import React, { useCallback } from 'react';
import { isBuiltInType } from '../../../bim/family-types/family-type-ui-helpers';
import type { BimFamilyType } from '../../../bim/types/bim-family-type';
import { FamilyTypeSelect, type FamilyTypeWidgetCommon } from './FamilyTypeSelect';

/** Pre-translated labels (resolved by the entity wrapper — keeps i18n static). */
export interface FamilyTypeEditorLabels {
  readonly type: string;
  readonly typeNone: string;
  readonly duplicateNamePrefix: string;
  readonly duplicateAndEdit: string;
  readonly editType: string;
  readonly deleteType: string;
}

export interface FamilyTypeEditorWidgetProps extends FamilyTypeWidgetCommon {
  /** Whether an entity of this kind is selected (false → self-hide). */
  readonly visible: boolean;
  readonly deleteType: (typeId: string) => Promise<void>;
  /** Open the full «Edit {X} Type» dialog for a type id (entity's store fn). */
  readonly openEditType: (typeId: string) => void;
  /** Resolve a type's localized display name (wrapper binds its `t`). */
  readonly resolveDisplayName: (type: BimFamilyType) => string;
  readonly labels: FamilyTypeEditorLabels;
}

export function FamilyTypeEditorWidget(props: FamilyTypeEditorWidgetProps): React.JSX.Element | null {
  const {
    visible,
    types,
    currentType,
    canWrite,
    assignType,
    duplicateCurrent,
    deleteType,
    openEditType,
    resolveDisplayName,
    labels,
  } = props;

  // Open the full Edit-Type dialog. Built-ins → clone-to-edit first.
  const onEditType = useCallback(async () => {
    if (!currentType) return;
    if (isBuiltInType(currentType)) {
      const baseName = resolveDisplayName(currentType);
      const newId = await duplicateCurrent(`${baseName} ${labels.duplicateNamePrefix}`);
      if (newId) openEditType(newId);
    } else {
      openEditType(currentType.id);
    }
  }, [currentType, duplicateCurrent, openEditType, resolveDisplayName, labels.duplicateNamePrefix]);

  if (!visible) return null;

  const editable = currentType && !isBuiltInType(currentType) && canWrite;

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">{labels.type}</span>
        <FamilyTypeSelect
          value={currentType?.id}
          onAssign={assignType}
          ariaLabel={labels.type}
          placeholder={labels.typeNone}
          clearLabel={labels.typeNone}
          items={types.map((type) => ({ id: type.id, label: resolveDisplayName(type) }))}
        />
      </span>

      {currentType && canWrite && (
        <span className="flex items-center gap-1">
          <button
            type="button"
            className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
            onClick={onEditType}
          >
            {isBuiltInType(currentType) ? labels.duplicateAndEdit : labels.editType}
          </button>
          {editable && (
            <button
              type="button"
              className="text-xs px-1.5 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap"
              onClick={() => void deleteType(currentType.id)}
            >
              {labels.deleteType}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
