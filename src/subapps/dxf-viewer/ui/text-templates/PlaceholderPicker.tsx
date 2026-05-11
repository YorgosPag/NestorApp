/**
 * ADR-344 Phase 7.D — Placeholder sidebar inside the editor dialog.
 *
 * Lists every path in `PLACEHOLDER_REGISTRY` grouped by source namespace.
 * Clicking a path emits the wrapped token (`{{namespace.key}}`) so the
 * editor can splice it at the textarea's caret position.
 *
 * Labels resolve via i18n (`textTemplates:placeholders.<source>.<key>`) so
 * the picker is fully localised — UX strings live in JSON, not in code.
 */
'use client';

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  PLACEHOLDER_REGISTRY,
  type PlaceholderPath,
  type PlaceholderSource,
} from '@/subapps/dxf-viewer/text-engine/templates';

interface PlaceholderPickerProps {
  readonly onInsert: (token: string) => void;
}

interface GroupEntry {
  readonly source: PlaceholderSource;
  readonly paths: readonly PlaceholderPath[];
}

function buildGroups(): readonly GroupEntry[] {
  const map = new Map<PlaceholderSource, PlaceholderPath[]>();
  (Object.keys(PLACEHOLDER_REGISTRY) as PlaceholderPath[]).forEach((path) => {
    const meta = PLACEHOLDER_REGISTRY[path];
    const bucket = map.get(meta.source) ?? [];
    bucket.push(path);
    map.set(meta.source, bucket);
  });
  return Array.from(map.entries()).map(([source, paths]) => ({
    source,
    paths: paths.slice().sort(),
  }));
}

const GROUPS = buildGroups();

export const PlaceholderPicker: React.FC<PlaceholderPickerProps> = ({ onInsert }) => {
  const { t } = useTranslation(['textTemplates']);
  const groups = useMemo(() => GROUPS, []);
  return (
    <nav aria-label={t('textTemplates:editor.placeholderPicker.title')} className="flex flex-col gap-3 w-56 shrink-0 border-l border-zinc-200 dark:border-zinc-800 pl-3 overflow-auto">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {t('textTemplates:editor.placeholderPicker.title')}
      </h4>
      {groups.map((group) => (
        <section key={group.source} className="flex flex-col gap-1">
          <h5 className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
            {t(`textTemplates:editor.placeholderPicker.source.${group.source}`)}
          </h5>
          <ul className="flex flex-col gap-0.5" role="list">
            {group.paths.map((path) => {
              const meta = PLACEHOLDER_REGISTRY[path];
              return (
                <li key={path}>
                  <button
                    type="button"
                    className="w-full text-left text-xs px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 flex flex-col"
                    onClick={() => onInsert(`{{${path}}}`)}
                  >
                    <span className="font-medium">{t(meta.labelI18nKey)}</span>
                    <code className="text-[10px] text-zinc-500">{`{{${path}}}`}</code>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
};
