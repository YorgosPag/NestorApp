/**
 * ADR-344 Phase 7.D — Templates list (left pane of the manager).
 *
 * Two sections: built-ins (read-only) + user templates (CRUD). Filter chrome
 * sits above both. Each row is selectable; selecting drives the preview pane.
 * Row actions (Edit / Duplicate / Delete) are surfaced inline and gated on
 * the capabilities returned by `useCanEditText()` (Q4 → show + disabled +
 * tooltip).
 */
'use client';

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type {
  TextTemplate,
  TextTemplateCategory,
} from '@/subapps/dxf-viewer/text-engine/templates';
import type { TextEditCapabilities } from '@/subapps/dxf-viewer/hooks/useCanEditText';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const CATEGORIES: readonly TextTemplateCategory[] = [
  'title-block',
  'stamp',
  'revision',
  'notes',
  'scale-bar',
  'custom',
];

type CategoryFilter = TextTemplateCategory | 'all';

interface ListProps {
  readonly builtIn: readonly TextTemplate[];
  readonly user: readonly TextTemplate[];
  readonly selectedId: string | null;
  readonly onSelect: (template: TextTemplate) => void;
  readonly onDuplicate: (template: TextTemplate) => void;
  readonly onEdit: (template: TextTemplate) => void;
  readonly onDelete: (template: TextTemplate) => void;
  readonly capabilities: TextEditCapabilities;
  readonly loading: boolean;
  readonly searchQuery: string;
  readonly onSearchChange: (next: string) => void;
  readonly categoryFilter: CategoryFilter;
  readonly onCategoryChange: (next: CategoryFilter) => void;
}

function filterTemplates(
  list: readonly TextTemplate[],
  query: string,
  category: CategoryFilter,
): readonly TextTemplate[] {
  const q = query.trim().toLowerCase();
  return list.filter((t) => {
    if (category !== 'all' && t.category !== category) return false;
    if (q.length === 0) return true;
    return t.name.toLowerCase().includes(q);
  });
}

export const TextTemplateList: React.FC<ListProps> = ({
  builtIn,
  user,
  selectedId,
  onSelect,
  onDuplicate,
  onEdit,
  onDelete,
  capabilities,
  loading,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
}) => {
  const { t } = useTranslation(['textTemplates']);

  const filteredBuiltIn = useMemo(
    () => filterTemplates(builtIn, searchQuery, categoryFilter),
    [builtIn, searchQuery, categoryFilter],
  );
  const filteredUser = useMemo(
    () => filterTemplates(user, searchQuery, categoryFilter),
    [user, searchQuery, categoryFilter],
  );

  return (
    <aside aria-label={t('textTemplates:manager.listAriaLabel')} className="tt-list flex flex-col gap-3 p-3 border-r border-zinc-200 dark:border-zinc-800 w-72 shrink-0">
      <header className="flex flex-col gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('textTemplates:manager.search')}
          className="rounded border px-2 py-1 text-sm"
          aria-label={t('textTemplates:manager.search')}
        />
        <Select value={categoryFilter} onValueChange={(v) => onCategoryChange(v as CategoryFilter)}>
          <SelectTrigger className="h-8 text-sm" aria-label={t('textTemplates:manager.categoryFilter')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('textTemplates:manager.category.all')}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`textTemplates:manager.category.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {loading ? (
        <p className="text-xs text-zinc-500">{t('textTemplates:manager.loading')}</p>
      ) : null}

      <section aria-label={t('textTemplates:manager.builtInSection')} className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t('textTemplates:manager.builtInSection')}
        </h3>
        <TemplateRows
          items={filteredBuiltIn}
          selectedId={selectedId}
          onSelect={onSelect}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onDelete={onDelete}
          capabilities={capabilities}
        />
      </section>

      <section aria-label={t('textTemplates:manager.userSection')} className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t('textTemplates:manager.userSection')}
        </h3>
        {filteredUser.length === 0 && !loading ? (
          <p className="text-xs text-zinc-500 italic px-2 py-3">
            {t('textTemplates:manager.emptyState')}
          </p>
        ) : (
          <TemplateRows
            items={filteredUser}
            selectedId={selectedId}
            onSelect={onSelect}
            onDuplicate={onDuplicate}
            onEdit={onEdit}
            onDelete={onDelete}
            capabilities={capabilities}
          />
        )}
      </section>
    </aside>
  );
};

interface RowsProps {
  readonly items: readonly TextTemplate[];
  readonly selectedId: string | null;
  readonly onSelect: (t: TextTemplate) => void;
  readonly onDuplicate: (t: TextTemplate) => void;
  readonly onEdit: (t: TextTemplate) => void;
  readonly onDelete: (t: TextTemplate) => void;
  readonly capabilities: TextEditCapabilities;
}

const TemplateRows: React.FC<RowsProps> = ({
  items,
  selectedId,
  onSelect,
  onDuplicate,
  onEdit,
  onDelete,
  capabilities,
}) => {
  const { t } = useTranslation(['textTemplates']);
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1" role="list">
      {items.map((tpl) => {
        const isSelected = tpl.id === selectedId;
        const canEdit = !tpl.isDefault && capabilities.canEdit;
        const canDelete = !tpl.isDefault && capabilities.canDelete;
        return (
          <li
            key={tpl.id}
            className={cn(
              'group rounded px-2 py-1.5 text-sm cursor-pointer flex flex-col gap-0.5 border',
              isSelected
                ? 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700'
                : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900',
            )}
            onClick={() => onSelect(tpl)}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate font-medium">{tpl.name}</span>
              {tpl.isDefault ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="text-[10px] uppercase px-1 py-0.5 rounded bg-zinc-200 text-zinc-700"
                      aria-label={t('textTemplates:manager.builtinReadOnlyTooltip')}
                    >
                      {t('textTemplates:manager.builtinBadge')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('textTemplates:manager.builtinReadOnlyTooltip')}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span>
                {t(`textTemplates:manager.category.${tpl.category}`)} ·{' '}
                {t('textTemplates:manager.placeholdersCount', { count: tpl.placeholders.length })}
              </span>
              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <RowAction
                  enabled={capabilities.canCreate}
                  label={t('textTemplates:manager.duplicate')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(tpl);
                  }}
                />
                {!tpl.isDefault && (
                  <>
                    <RowAction
                      enabled={canEdit}
                      label={t('textTemplates:manager.edit')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(tpl);
                      }}
                    />
                    <RowAction
                      enabled={canDelete}
                      label={t('textTemplates:manager.delete')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(tpl);
                      }}
                      variant="danger"
                    />
                  </>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

interface RowActionProps {
  readonly label: string;
  readonly enabled: boolean;
  readonly onClick: (e: React.MouseEvent) => void;
  readonly variant?: 'default' | 'danger';
}

const RowAction: React.FC<RowActionProps> = ({ label, enabled, onClick, variant = 'default' }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        disabled={!enabled}
        onClick={onClick}
        className={cn(
          'text-[11px] px-1.5 py-0.5 rounded',
          variant === 'danger' ? 'text-red-700' : 'text-zinc-700',
          enabled ? 'hover:bg-zinc-200 dark:hover:bg-zinc-800' : 'opacity-40 cursor-not-allowed',
        )}
      >
        {label}
      </button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);
