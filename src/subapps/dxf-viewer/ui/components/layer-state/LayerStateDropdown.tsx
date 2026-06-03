'use client';

/**
 * LayerStateDropdown — ADR-358 §5.9 Q12 Phase 12.
 *
 * Status-bar dropdown for Save/Restore of `LayerState`s. Renders a trigger
 * that reflects the current applied state (or "(none)") + a Radix Popover
 * with the list, inline save form, and per-row rename/delete actions.
 *
 * Phase 12 scope: list + save current + rename + delete + restore (click row).
 * Phase 13 will surface `.las` import/export + cross-project templates + the
 * full "Manage…" panel — those buttons are pre-wired but disabled with
 * tooltip-only feedback.
 *
 * Restore is dispatched via `RestoreLayerStateCommand` through the caller's
 * `executeCommand` (CommandHistory entry point) so undo/redo round-trips
 * correctly.
 */

import * as React from 'react';
import { ChevronDown, History, Save } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { ICommand } from '../../../core/commands/interfaces';
import { useLayerStateDropdown } from './useLayerStateDropdown';
import { LayerStateDropdownPopover } from './LayerStateDropdownPopover';

function useTemplatesAuth(): { companyId: string; userId: string } {
  const { user } = useAuth();
  const companyResult = useCompanyId();
  return {
    companyId: companyResult?.companyId ?? '',
    userId: user?.uid ?? '',
  };
}

export interface LayerStateDropdownProps {
  readonly executeCommand: (cmd: ICommand) => void;
  readonly className?: string;
}

export function LayerStateDropdown({
  executeCommand,
  className,
}: LayerStateDropdownProps): React.ReactElement {
  const auth = useTemplatesAuth();
  const { state, actions } = useLayerStateDropdown(executeCommand, auth);
  const { t } = useTranslation('dxf-viewer-shell');
  const [isOpen, setIsOpen] = React.useState(false);

  const triggerLabel = state.currentState?.name ?? t('layerState.placeholder');
  const tooltipLabel = state.currentState
    ? t('layerState.tooltipCurrent', { name: state.currentState.name })
    : t('layerState.tooltipEmpty');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="layer-state-dropdown-trigger"
              aria-label={tooltipLabel}
              disabled={!state.isReady}
              className={`${TRIGGER_CLASS} ${className ?? ''}`.trim()}
            >
              <History className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className={LABEL_CLASS}>{triggerLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipLabel}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className={POPOVER_CONTENT_CLASS}
        data-testid="layer-state-dropdown-popover"
      >
        <LayerStateDropdownPopover
          state={state}
          actions={actions}
          onClose={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Icon-only "Save current state" affordance, for ribbons where the trigger above is too wide. */
export function LayerStateSaveButton({
  executeCommand,
  className,
}: LayerStateDropdownProps): React.ReactElement {
  const auth = useTemplatesAuth();
  const { actions, state } = useLayerStateDropdown(executeCommand, auth);
  const { t } = useTranslation('dxf-viewer-shell');
  const [draftName, setDraftName] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSave = (): void => {
    const created = actions.saveCurrent(draftName);
    if (created) {
      setDraftName('');
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('layerState.saveCurrent')}
              disabled={!state.isReady}
              className={`${ICON_BUTTON_CLASS} ${className ?? ''}`.trim()}
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t('layerState.saveCurrent')}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" sideOffset={6} className="w-[240px] p-3">
        <label className="text-xs font-medium" htmlFor="layer-state-save-input">
          {t('layerState.savePrompt')}
        </label>
        <input
          id="layer-state-save-input"
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            // ADR-364: Escape handled by Radix Popover onEscapeKeyDown → onOpenChange.
          }}
          placeholder={t('layerState.namePlaceholder')}
          className={INPUT_CLASS}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setIsOpen(false)}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={handleSave}
            disabled={!draftName.trim()}
          >
            {t('layerState.save')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const TRIGGER_CLASS =
  'flex items-center gap-1.5 h-6 max-w-[180px] min-w-[120px] px-2 rounded ' +
  'border border-border bg-background/80 text-xs leading-none ' +
  'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed';

const LABEL_CLASS = 'truncate flex-1 text-left font-medium';

const POPOVER_CONTENT_CLASS = 'z-[1800] w-[320px] p-0';

const ICON_BUTTON_CLASS =
  'inline-flex items-center justify-center h-6 w-6 rounded ' +
  'border border-border bg-background/80 ' +
  'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed';

const INPUT_CLASS =
  'mt-1 w-full h-7 px-2 rounded border border-border bg-background text-xs ' +
  'focus:outline-none focus:ring-1 focus:ring-primary';

const PRIMARY_BUTTON_CLASS =
  'h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium ' +
  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed';

const SECONDARY_BUTTON_CLASS =
  'h-7 px-3 rounded border border-border bg-background text-xs ' +
  'hover:bg-muted';
