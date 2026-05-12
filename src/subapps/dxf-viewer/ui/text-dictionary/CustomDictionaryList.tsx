/**
 * ADR-344 Phase 8 — Read-only list of custom dictionary entries.
 *
 * Renders a semantic <table> per CLAUDE.md N.4 — no div soup. Action
 * buttons (edit / delete) are gated by `canManage` (admin-only); read-only
 * users see the list but no action column buttons.
 */
'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import type { SpellLanguage } from '@/subapps/dxf-viewer/text-engine/spell';
import type { SerializedCustomDictionaryEntry } from '@/app/api/dxf/custom-dictionary/_helpers';

interface ListProps {
  readonly entries: readonly SerializedCustomDictionaryEntry[];
  readonly canManage: boolean;
  readonly onEdit: (entry: SerializedCustomDictionaryEntry) => void;
  readonly onDelete: (entry: SerializedCustomDictionaryEntry) => void;
}

type LanguageFilter = SpellLanguage | 'all';

const LANGUAGE_FILTERS: readonly LanguageFilter[] = ['all', 'el', 'en'] as const;

function toLocalDateStr(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

export const CustomDictionaryList: React.FC<ListProps> = ({
  entries,
  canManage,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation(['textSpell']);
  const [filter, setFilter] = useState<LanguageFilter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.language === filter)),
    [entries, filter],
  );

  return (
    <section className="flex flex-col gap-3">
      <nav className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">{t('textSpell:manager.filterByLanguage')}:</span>
        {LANGUAGE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded ${
              filter === f ? 'bg-blue-600 text-white' : 'border'
            }`}
          >
            {f === 'all' ? t('textSpell:manager.allLanguages') : t(`textSpell:languages.${f}`)}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('textSpell:manager.empty')}</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1.5 pr-2">{t('textSpell:manager.columns.term')}</th>
              <th className="py-1.5 pr-2">{t('textSpell:manager.columns.language')}</th>
              <th className="py-1.5 pr-2">{t('textSpell:manager.columns.createdBy')}</th>
              <th className="py-1.5 pr-2">{t('textSpell:manager.columns.createdAt')}</th>
              {canManage ? (
                <th className="py-1.5 pr-2 text-right">
                  {t('textSpell:manager.columns.actions')}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr key={entry.id} className="border-b last:border-0">
                <td className="py-1.5 pr-2 font-medium">{entry.term}</td>
                <td className="py-1.5 pr-2">{t(`textSpell:languages.${entry.language}`)}</td>
                <td className="py-1.5 pr-2 text-zinc-600 dark:text-zinc-400">
                  {entry.createdByName ?? entry.createdBy}
                </td>
                <td className="py-1.5 pr-2 text-zinc-600 dark:text-zinc-400">
                  {toLocalDateStr(entry.createdAt)}
                </td>
                {canManage ? (
                  <td className="py-1.5 pr-2">
                    <nav className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        className="text-xs px-2 py-0.5 rounded border"
                      >
                        {t('textSpell:manager.actions.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(entry)}
                        className="text-xs px-2 py-0.5 rounded border text-red-700"
                      >
                        {t('textSpell:manager.actions.delete')}
                      </button>
                    </nav>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
