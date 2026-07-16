'use client';

/**
 * family-type-properties-parts — the presentational SSoT shared by the BIM Family Type
 * Properties widgets (ADR-412 Φ4 wall / ADR-421 SLICE C opening).
 *
 * Every category's properties widget frames the SAME chrome around its own params: a header
 * (label + inline rename input / built-in badge + «Reset to type»), override badges, and a
 * footer («Edit type…» / «Delete»). Only the PARAMS between header and footer are
 * category-specific — those stay in each widget. Extracted for the CHECK 3.28 clone the two
 * widgets carried (ADR-584 / N.18).
 *
 * Behaviour lives in the sibling `useFamilyTypeEditor` hook; these parts are pure render.
 *
 * @see ../hooks/useFamilyTypeEditor.ts
 * @module ui/ribbon/components/family-type-properties-parts
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './RibbonTooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FamilyTypeEditor, FamilyTypeEditorController } from '../hooks/useFamilyTypeEditor';

/** The «Override ✕» badge — clears one param's per-instance override. */
export function FamilyTypeOverrideBadge(props: {
  readonly onClear: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <button
      type="button"
      className="text-xs px-1 py-0.5 rounded bg-accent text-accent-foreground border border-border whitespace-nowrap"
      aria-label={t('ribbon.commands.bimFamilyType.overrideTooltip')}
      onClick={props.onClear}
    >
      {t('ribbon.commands.bimFamilyType.override')} ✕
    </button>
  );
}

/** A read-only effective param row, with a clear-override badge when overridden. */
export function FamilyTypeParamRow(props: {
  readonly label: string;
  readonly value: string;
  readonly overridden: boolean;
  readonly onClear: () => void;
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="dxf-ribbon-combobox-label">{props.label}</span>
      <span className="dxf-ribbon-wall-length-value">{props.value}</span>
      {props.overridden && <FamilyTypeOverrideBadge onClear={props.onClear} />}
    </span>
  );
}

/**
 * Read-only «Thickness · N mm» row. Wall and roof types both report thickness as a plain
 * type-level param — never overridden per instance, so this carries no badge (unlike
 * `FamilyTypeParamRow`). Rounded to whole mm: the widget is a readout, not an editor.
 */
export function FamilyTypeThicknessRow(props: {
  readonly thicknessMm: number;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.bimFamilyType.paramThickness')}
      </span>
      <span className="dxf-ribbon-wall-length-value">
        {Math.round(props.thicknessMm)} {t('ribbon.commands.bimFamilyType.thicknessUnit')}
      </span>
    </span>
  );
}

/**
 * Header row: the «Properties» label, the type identity (inline rename input for editable
 * types, name + built-in badge otherwise), and «Reset to type» while any override is set.
 */
export function FamilyTypePropertiesHeader(props: {
  readonly ctrl: FamilyTypeEditorController;
  readonly editor: FamilyTypeEditor;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { ctrl, editor } = props;

  return (
    <span className="flex items-center gap-1">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.bimFamilyType.properties')}
      </span>
      {editor.editable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              className="text-xs px-1.5 py-0.5 rounded border border-border bg-muted/40 text-foreground min-w-[7rem] focus:outline-none focus:ring-1 focus:ring-ring"
              value={editor.draft}
              onChange={(e) => editor.setDraft(e.target.value)}
              onBlur={editor.commitRename}
              onKeyDown={editor.onNameKeyDown}
              aria-label={t('ribbon.commands.bimFamilyType.rename')}
            />
          </TooltipTrigger>
          <TooltipContent>{t('ribbon.commands.bimFamilyType.renameTooltip')}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="dxf-ribbon-wall-length-value">
          {editor.isBuiltIn
            ? `${editor.typeName} · ${t('ribbon.commands.bimFamilyType.builtinBadge')}`
            : editor.typeName}
        </span>
      )}
      {ctrl.overriddenKeys.length > 0 && (
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
  );
}

/**
 * Footer actions: «Edit type…» (or «Duplicate & edit» for a built-in) and, for editable
 * types, «Delete». Renders nothing without write permission.
 */
export function FamilyTypeActions(props: {
  readonly ctrl: FamilyTypeEditorController;
  readonly editor: FamilyTypeEditor;
}): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { ctrl, editor } = props;

  if (!ctrl.canWrite || !ctrl.currentType) return null;
  const typeId = ctrl.currentType.id;

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        className="text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap"
        onClick={editor.onEditType}
      >
        {editor.isBuiltIn
          ? t('ribbon.commands.bimFamilyType.duplicateAndEdit')
          : t('ribbon.commands.bimFamilyType.editType')}
      </button>
      {editor.editable && (
        <button
          type="button"
          className="text-xs px-1.5 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap"
          onClick={() => void ctrl.deleteType(typeId)}
        >
          {t('ribbon.commands.bimFamilyType.deleteType')}
        </button>
      )}
    </span>
  );
}
