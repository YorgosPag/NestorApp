'use client';

/**
 * LayerStateDropdownPopover — popover body for `LayerStateDropdown`
 * (ADR-358 §5.9 Q12 Phase 12).
 *
 * Sections:
 *   1. Saved states list — click row to restore. Per-row rename + delete.
 *   2. Save Current State — inline name input + Save button.
 *   3. Phase 13 affordances — disabled buttons (Import/Export .las, Manage…)
 *      with tooltip explaining future availability.
 */

import * as React from 'react';
import { Check, FileText, Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { useEscapeHandler, ESC_PRIORITY } from '@/subapps/dxf-viewer/systems/escape-bus';
import type {
  LayerStateDropdownActions,
  LayerStateDropdownState,
} from './useLayerStateDropdown';
import { LayerStateTemplateBrowser } from './LayerStateTemplateBrowser';
import { LayerStateSaveAsTemplateDialog } from './LayerStateSaveAsTemplateDialog';
import { LayerStatePopoverFooter } from './LayerStatePopoverFooter';
import { LayerStateManagePanel } from './LayerStateManagePanel';
import { LayerStateRestoreDialog } from './LayerStateRestoreDialog';
import type { LayerState } from '../../../types/layer-state';

export interface LayerStateDropdownPopoverProps {
  readonly state: LayerStateDropdownState;
  readonly actions: LayerStateDropdownActions;
  readonly onClose: () => void;
}

export function LayerStateDropdownPopover({
  state,
  actions,
  onClose,
}: LayerStateDropdownPopoverProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [draftRename, setDraftRename] = React.useState('');
  const [draftSaveName, setDraftSaveName] = React.useState('');

  // ADR-364: Esc cancels active rename — must consume so Radix Popover does NOT close
  // the whole popover (bus stopPropagation prevents Radix from seeing the key).
  const isRenaming = renameId !== null;
  useEscapeHandler({
    id: 'layer-state-rename',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => isRenaming,
    handle: () => {
      setRenameId(null);
      setDraftRename('');
      return true;
    },
  });
  const states = state.snapshot.states;
  const isReady = state.isReady;
  const currentId = state.snapshot.currentStateId;
  const handleSave = (): void => {
    const created = actions.saveCurrent(draftSaveName);
    if (created) {
      setDraftSaveName('');
    }
  };
  const handleRenameCommit = (id: string): void => {
    actions.rename(id, draftRename);
    setRenameId(null);
    setDraftRename('');
  };
  const handleRestore = (id: string): void => {
    actions.restore(id);
    onClose();
  };
  return (
    <section className="flex flex-col" aria-label={t('layerState.popoverLabel')}>
      <header className={HEADER_CLASS}>
        <FileText className="h-3.5 w-3.5" aria-hidden />
        <span>{t('layerState.savedStates')}</span>
        {!isReady && (
          <span className={HEADER_HINT_CLASS}>{t('layerState.notReady')}</span>
        )}
      </header>

      <ul className={LIST_CLASS} data-testid="layer-state-list">
        {states.length === 0 && (
          <li className={EMPTY_CLASS}>{t('layerState.empty')}</li>
        )}
        {states.map((s) => (
          <LayerStateRow
            key={s.id}
            entry={s}
            isCurrent={s.id === currentId}
            isRenaming={renameId === s.id}
            draftRename={draftRename}
            onStartRename={() => {
              setRenameId(s.id);
              setDraftRename(s.name);
            }}
            onCancelRename={() => {
              setRenameId(null);
              setDraftRename('');
            }}
            onCommitRename={() => handleRenameCommit(s.id)}
            onChangeRename={setDraftRename}
            onDelete={() => actions.remove(s.id)}
            onRestore={() => handleRestore(s.id)}
          />
        ))}
      </ul>

      <section className={SAVE_SECTION_CLASS} aria-label={t('layerState.saveSection')}>
        <label className="text-xs font-medium" htmlFor="layer-state-save-name">
          {t('layerState.savePrompt')}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="layer-state-save-name"
            type="text"
            value={draftSaveName}
            onChange={(e) => setDraftSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder={t('layerState.namePlaceholder')}
            disabled={!isReady}
            className={INPUT_CLASS}
            data-testid="layer-state-save-input"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!isReady || !draftSaveName.trim()}
            className={PRIMARY_BUTTON_CLASS}
            data-testid="layer-state-save-confirm"
          >
            {t('layerState.save')}
          </button>
        </div>
      </section>

      <LayerStatePopoverFooter state={state} actions={actions} onClose={onClose} />
      <LayerStateTemplateBrowser
        open={state.dialogs.browserOpen}
        onOpenChange={(next) => { if (!next) actions.closeTemplateBrowser(); }}
        categories={state.templates.categories}
        fetchSummaries={() => state.templates.searchTemplateSummaries()}
        onUseTemplate={(id) => state.templates.importTemplateAsState(id)}
      />
      <LayerStateSaveAsTemplateDialog
        open={state.dialogs.saveAsOpen}
        onOpenChange={(next) => { if (!next) actions.closeSaveAsTemplate(); }}
        categories={state.templates.categories}
        sourceStateId={state.dialogs.saveAsSourceStateId}
        onSave={(input) => state.templates.saveCurrentAsTemplate(input)}
      />
      <LayerStateManagePanel
        open={state.dialogs.managePanelOpen}
        onOpenChange={(next) => { if (!next) actions.closeManagePanel(); }}
        actions={actions}
      />
      {state.dialogs.restoreDialogStateId && (
        <LayerStateRestoreDialog
          open
          onOpenChange={(next) => { if (!next) actions.closeRestoreDialog(); }}
          stateId={state.dialogs.restoreDialogStateId}
          onApply={(options) => {
            actions.restoreWithOptions(state.dialogs.restoreDialogStateId!, options);
            actions.closeRestoreDialog();
          }}
        />
      )}
    </section>
  );
}

interface LayerStateRowProps {
  readonly entry: LayerState;
  readonly isCurrent: boolean;
  readonly isRenaming: boolean;
  readonly draftRename: string;
  readonly onStartRename: () => void;
  readonly onCancelRename: () => void;
  readonly onCommitRename: () => void;
  readonly onChangeRename: (value: string) => void;
  readonly onDelete: () => void;
  readonly onRestore: () => void;
}

function LayerStateRow({
  entry,
  isCurrent,
  isRenaming,
  draftRename,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onChangeRename,
  onDelete,
  onRestore,
}: LayerStateRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  if (isRenaming) {
    return (
      <li className={ROW_CLASS} data-testid={`layer-state-row-${entry.id}`}>
        <input
          type="text"
          value={draftRename}
          onChange={(e) => onChangeRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitRename();
            // ADR-364: Escape handled by useEscapeHandler in LayerStateDropdownPopover parent.
          }}
          className={INPUT_CLASS}
          autoFocus
          data-testid={`layer-state-rename-input-${entry.id}`}
        />
        <button
          type="button"
          onClick={onCommitRename}
          className={ICON_BUTTON_CLASS}
          aria-label={t('layerState.confirmRename')}
          data-testid={`layer-state-rename-confirm-${entry.id}`}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
      </li>
    );
  }

  return (
    <li className={ROW_CLASS} data-testid={`layer-state-row-${entry.id}`}>
      <button
        type="button"
        onClick={onRestore}
        className={ROW_NAME_BUTTON_CLASS}
        aria-label={t('layerState.restoreAriaLabel', { name: entry.name })}
      >
        {isCurrent && <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden />}
        <span className="truncate">{entry.name}</span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onStartRename}
            className={ICON_BUTTON_CLASS}
            aria-label={t('layerState.rename')}
            data-testid={`layer-state-rename-${entry.id}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('layerState.rename')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onDelete}
            className={ICON_BUTTON_CLASS}
            aria-label={t('layerState.delete')}
            data-testid={`layer-state-delete-${entry.id}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('layerState.delete')}</TooltipContent>
      </Tooltip>
    </li>
  );
}

const HEADER_CLASS =
  'flex items-center gap-1.5 px-3 py-2 border-b border-border text-xs font-semibold ' +
  'text-muted-foreground';

const HEADER_HINT_CLASS = 'ml-auto text-[10px] font-normal';

const LIST_CLASS = 'flex flex-col max-h-[240px] overflow-y-auto';

const EMPTY_CLASS = 'px-3 py-4 text-xs text-muted-foreground text-center';

const ROW_CLASS =
  'flex items-center gap-1 px-2 py-1 border-b border-border/50 last:border-b-0 ' +
  'hover:bg-muted/50';

const ROW_NAME_BUTTON_CLASS =
  'flex items-center gap-1.5 flex-1 min-w-0 h-6 px-1 text-left text-xs ' +
  'hover:underline';

const SAVE_SECTION_CLASS = 'border-t border-border px-3 py-2';

const INPUT_CLASS =
  'flex-1 h-6 px-2 rounded border border-border bg-background text-xs ' +
  'focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50';

const PRIMARY_BUTTON_CLASS =
  'h-6 px-3 rounded bg-primary text-primary-foreground text-xs font-medium ' +
  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed';

const ICON_BUTTON_CLASS =
  'inline-flex items-center justify-center h-6 w-6 rounded ' +
  'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed';
