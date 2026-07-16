'use client';

/**
 * useFamilyTypeEditor — the rename + edit-type behaviour shared by every BIM Family Type
 * Properties widget (ADR-412 Φ4 wall / ADR-421 SLICE C opening).
 *
 * Each category has its own controller (`useWallFamilyTypeController`,
 * `useOpeningFamilyTypeController`, …) with its own params and its own Edit-Type store, but
 * the TYPE-IDENTITY behaviour around them is category-agnostic: resolve the display name,
 * hold a rename draft, commit it on blur, revert it on Escape, and open the Edit-Type dialog
 * (cloning first when the type is a read-only built-in). That behaviour lives here once.
 *
 * Consumed via the presentational parts in `../components/family-type-properties-parts.tsx`.
 *
 * @see ../components/RibbonWallTypePropertiesWidget.tsx
 * @see ../components/RibbonOpeningTypePropertiesWidget.tsx
 * @module ui/ribbon/hooks/useFamilyTypeEditor
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isBuiltInType, resolveTypeDisplayName } from '../../../bim/family-types/family-type-ui-helpers';
import type { BimFamilyType } from '../../../bim/types/bim-family-type';

/**
 * The category-agnostic slice of a family-type controller this editor drives. Every
 * `useXFamilyTypeController` is structurally assignable — the category-specific members
 * (`wall`/`opening`, `setOverride`, `clearOverride`, …) stay with their own widget.
 */
export interface FamilyTypeEditorController {
  readonly currentType: BimFamilyType | null;
  readonly overriddenKeys: readonly string[];
  readonly canWrite: boolean;
  readonly resetOverrides: () => void;
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
  readonly renameType: (typeId: string, name: string) => Promise<void>;
  readonly deleteType: (typeId: string) => Promise<void>;
}

/** Rename-draft state + the two identity actions the properties widgets render. */
export interface FamilyTypeEditor {
  /** The type's resolved display name (built-in → translated, user → literal). */
  readonly typeName: string;
  /** Live rename draft — bound to the inline input. */
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  /** True when the type may be renamed / edited / deleted in place. */
  readonly editable: boolean;
  /** True when the type is a read-only built-in (clone-to-edit). */
  readonly isBuiltIn: boolean;
  /** Commit the rename draft (no-op when unchanged, empty, or built-in). */
  readonly commitRename: () => void;
  /** Enter commits via blur; Escape reverts the draft then blurs. */
  readonly onNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Open the Edit-Type dialog — built-ins are cloned first, then opened on the clone. */
  readonly onEditType: () => Promise<void>;
}

/**
 * Drives the rename draft + Edit-Type action for `ctrl`'s current type. `openEditor` is the
 * category's Edit-Type store opener (`openEditWallType`, `openEditOpeningType`, …) — the one
 * genuinely category-specific bit of this behaviour.
 */
export function useFamilyTypeEditor(
  ctrl: FamilyTypeEditorController,
  openEditor: (typeId: string) => void,
): FamilyTypeEditor {
  const { t } = useTranslation('dxf-viewer-shell');
  const { currentType, canWrite } = ctrl;

  const typeName = currentType ? resolveTypeDisplayName(currentType, t) : '';
  const [draft, setDraft] = useState(typeName);
  // Re-sync the rename draft when the selected type changes (not mid-edit).
  useEffect(() => setDraft(typeName), [typeName]);

  const commitRename = useCallback(() => {
    // Built-ins are read-only; auto + user types are renamable (Revit «rename the
    // type, it stays the same type» — auto keeps its signature grouping). Compare
    // to the DISPLAYED name: an auto type's stored name is the i18n key, not the
    // label, so the first rename turns the key into the literal the user typed.
    if (!currentType || isBuiltInType(currentType)) return;
    const next = draft.trim();
    if (!next || next === typeName) return;
    void ctrl.renameType(currentType.id, next);
  }, [ctrl, currentType, draft, typeName]);

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

  // Open the full Edit-Type dialog. Built-ins are read-only → clone-to-edit first,
  // then open on the clone.
  const onEditType = useCallback(async () => {
    if (!currentType) return;
    if (isBuiltInType(currentType)) {
      const baseName = resolveTypeDisplayName(currentType, t);
      const newId = await ctrl.duplicateCurrent(
        `${t('ribbon.commands.bimFamilyType.duplicateNamePrefix')} ${baseName}`,
      );
      if (newId) openEditor(newId);
    } else {
      openEditor(currentType.id);
    }
  }, [ctrl, currentType, t, openEditor]);

  const isBuiltIn = currentType ? isBuiltInType(currentType) : false;

  return {
    typeName,
    draft,
    setDraft,
    // Built-ins are read-only; auto + user types are editable (rename / Edit Type /
    // delete). An auto type renamed once becomes a literal-named, still-grouped type.
    // No type at all → nothing to edit (widgets self-hide before this shows).
    editable: currentType !== null && !isBuiltIn && canWrite,
    isBuiltIn,
    commitRename,
    onNameKeyDown,
    onEditType,
  };
}
