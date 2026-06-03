'use client';

import * as React from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/intl-formatting';
import { LayerStateContextMenu } from './LayerStateContextMenu';
import type { LayerStateContextMenuActions } from './LayerStateContextMenu';
import type { LayerState } from '../../../types/layer-state';

export interface ManageRowProps {
  readonly entry: LayerState;
  readonly isSelected: boolean;
  readonly isEditingName: boolean;
  readonly isEditingCategory: boolean;
  readonly draftName: string;
  readonly draftCategory: string;
  readonly onToggleSelect: () => void;
  readonly onRestore: () => void;
  readonly onStartRename: () => void;
  readonly onCommitRename: () => void;
  readonly onCancelRename: () => void;
  readonly onChangeName: (v: string) => void;
  readonly onStartCategory: () => void;
  readonly onCommitCategory: () => void;
  readonly onCancelCategory: () => void;
  readonly onChangeCategory: (v: string) => void;
  readonly onDelete: () => void;
  readonly contextActions: LayerStateContextMenuActions;
  readonly t: (k: string, opts?: Record<string, unknown>) => string;
}

export function ManageRow({
  entry,
  isSelected,
  isEditingName,
  isEditingCategory,
  draftName,
  draftCategory,
  onToggleSelect,
  onRestore,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onChangeName,
  onStartCategory,
  onCommitCategory,
  onCancelCategory,
  onChangeCategory,
  onDelete,
  contextActions,
  t,
}: ManageRowProps): React.ReactElement {
  return (
    <LayerStateContextMenu stateId={entry.id} actions={contextActions}>
      <tr className={ROW_CLASS} data-testid={`manage-row-${entry.id}`}>
        <td className="px-2 py-1">
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        </td>
        <td className="px-2 py-1">
          {isEditingName ? (
            <InlineInput
              value={draftName}
              onChange={onChangeName}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
              testId={`manage-rename-${entry.id}`}
            />
          ) : (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={onRestore}
                className="truncate text-left hover:underline max-w-[160px]"
              >
                {entry.name}
              </button>
              <button
                type="button"
                onClick={onStartRename}
                className={ICON_BTN}
                aria-label={t('layerState.rename')}
              >
                <Pencil className="h-3 w-3" aria-hidden />
              </button>
            </span>
          )}
        </td>
        <td className="px-2 py-1">
          {isEditingCategory ? (
            <InlineInput
              value={draftCategory}
              onChange={onChangeCategory}
              onCommit={onCommitCategory}
              onCancel={onCancelCategory}
              testId={`manage-category-${entry.id}`}
            />
          ) : (
            <button
              type="button"
              onClick={onStartCategory}
              className="truncate text-left hover:underline max-w-[100px] text-muted-foreground"
            >
              {entry.category ?? '—'}
            </button>
          )}
        </td>
        <td className="px-2 py-1 text-muted-foreground">
          {entry.tags?.length ? entry.tags.join(', ') : '—'}
        </td>
        <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
          {formatDate(entry.updatedAt)}
        </td>
        <td className="px-2 py-1">
          <button
            type="button"
            onClick={onDelete}
            className={ICON_BTN}
            aria-label={t('layerState.delete')}
            data-testid={`manage-delete-${entry.id}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
          </button>
        </td>
      </tr>
    </LayerStateContextMenu>
  );
}

function InlineInput({
  value,
  onChange,
  onCommit,
  onCancel,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  testId: string;
}): React.ReactElement {
  return (
    <span className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
          // ADR-364: Escape handled by useEscapeHandler in LayerStateManagePanel parent.
        }}
        className="flex-1 h-5 px-1.5 rounded border border-primary text-xs focus:outline-none min-w-0"
        autoFocus
        data-testid={testId}
      />
      <button type="button" onClick={onCommit} className={ICON_BTN}>
        <Check className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}


const ROW_CLASS = 'border-b border-border/50 hover:bg-muted/30 last:border-b-0';
const ICON_BTN = 'inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted shrink-0';
