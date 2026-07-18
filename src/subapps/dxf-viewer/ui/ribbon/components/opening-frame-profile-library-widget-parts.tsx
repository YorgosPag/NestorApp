'use client';

/**
 * Presentational parts for `OpeningFrameProfileLibraryWidget` — the two
 * button-row / inline-form chrome pieces, split out to keep the widget file
 * itself under the Google file-size guidance (behaviour lives in the widget;
 * these are pure render, mirroring the `family-type-properties-parts.tsx`
 * split for the sibling family-type widgets).
 *
 * @see ./opening-frame-profile-library-widget.tsx — behaviour + composition
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export type FrameProfilePresetScope = 'user' | 'company' | 'project';

const ACTION_BUTTON_CLASS =
  'text-xs px-1.5 py-0.5 rounded border border-black/20 hover:bg-black/5 whitespace-nowrap';
const FORM_FIELD_CLASS = 'rounded border border-border bg-background px-2 py-1 text-xs text-foreground';

/** «Αποθήκευση ως δικό μου» / «Αντιγραφή & επεξεργασία» trigger row. */
export function OpeningFrameProfileLibraryActions(props: {
  readonly onSaveAsMine: () => void;
  readonly onDuplicateAndEdit: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <header className="flex items-center gap-1">
      <button type="button" className={ACTION_BUTTON_CLASS} onClick={props.onSaveAsMine}>
        {t('ribbon.commands.openingEditor.frameProfile.saveAsMine')}
      </button>
      <button type="button" className={ACTION_BUTTON_CLASS} onClick={props.onDuplicateAndEdit}>
        {t('ribbon.commands.openingEditor.frameProfile.duplicateAndEdit')}
      </button>
    </header>
  );
}

/** Inline name + scope entry form, shared by both save origins. */
export function OpeningFrameProfileLibrarySaveForm(props: {
  readonly name: string;
  readonly onNameChange: (value: string) => void;
  readonly onNameKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  readonly scope: FrameProfilePresetScope;
  readonly onScopeChange: (scope: FrameProfilePresetScope) => void;
  readonly projectAvailable: boolean;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <form
      className="flex flex-col gap-1 rounded border border-border bg-card/60 p-2"
      onSubmit={props.onSubmit}
    >
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {t('ribbon.commands.openingEditor.frameProfile.nameLabel')}
        <input
          autoFocus
          type="text"
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
          onKeyDown={props.onNameKeyDown}
          placeholder={t('ribbon.commands.openingEditor.frameProfile.namePlaceholder')}
          className={FORM_FIELD_CLASS}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {t('ribbon.commands.openingEditor.frameProfile.scopeLabel')}
        <select
          value={props.scope}
          onChange={(e) => props.onScopeChange(e.target.value as FrameProfilePresetScope)}
          className={FORM_FIELD_CLASS}
        >
          <option value="user">{t('ribbon.commands.openingEditor.frameProfile.scopeUser')}</option>
          <option value="company">{t('ribbon.commands.openingEditor.frameProfile.scopeCompany')}</option>
          {props.projectAvailable && (
            <option value="project">{t('ribbon.commands.openingEditor.frameProfile.scopeProject')}</option>
          )}
        </select>
      </label>
      <span className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!props.name.trim()}
          className="rounded border border-[hsl(var(--text-success))] bg-[hsl(var(--status-success))] px-2 py-1 text-xs text-white hover:bg-[hsl(var(--status-success))]/90 disabled:opacity-50"
        >
          {t('ribbon.commands.openingEditor.frameProfile.save')}
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent"
        >
          {t('ribbon.commands.openingEditor.frameProfile.cancel')}
        </button>
      </span>
    </form>
  );
}
