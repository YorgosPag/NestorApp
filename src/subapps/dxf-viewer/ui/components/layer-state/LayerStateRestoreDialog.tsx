'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { getLayerState } from '../../../stores/LayerStateStore';
import { getAllLayers } from '../../../stores/LayerStore';
import { RestoreLayerStateCommand } from '../../../core/commands/layer/RestoreLayerStateCommand';
import type { ICommand } from '../../../core/commands/interfaces';
import type { LayerState, LayerStateEntry } from '../../../types/layer-state';

export interface LayerStateRestoreDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly stateId: string;
  readonly executeCommand: (cmd: ICommand) => void;
}

export function LayerStateRestoreDialog({
  open,
  onOpenChange,
  stateId,
  executeCommand,
}: LayerStateRestoreDialogProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const [createMissing, setCreateMissing] = React.useState(false);

  // Reset toggle to OFF every time dialog opens for a new state.
  React.useEffect(() => {
    if (open) setCreateMissing(false);
  }, [open, stateId]);

  const targetState = getLayerState(stateId);
  const unmatchedNames = React.useMemo(
    () => (targetState ? computeUnmatched(targetState.snapshot) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateId, open],
  );

  const handleApply = (): void => {
    const cmd = new RestoreLayerStateCommand({
      stateId,
      options: { createMissingLayers: createMissing },
    });
    executeCommand(cmd);
    onOpenChange(false);
  };

  if (!targetState) return null;

  const hasUnmatched = unmatchedNames.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('layerState.manage.restoreDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <StatePreview state={targetState} t={t} />
          {hasUnmatched && (
            <UnmatchedWarning count={unmatchedNames.length} t={t} />
          )}
          <CreateMissingToggle
            checked={createMissing}
            onChange={setCreateMissing}
            t={t}
          />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={CANCEL_CLASS}
            data-testid="restore-dialog-cancel"
          >
            {t('layerState.manage.restoreDialog.cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={APPLY_CLASS}
            data-testid="restore-dialog-apply"
          >
            {t('layerState.manage.restoreDialog.apply')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface Tf {
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function StatePreview({
  state,
  t,
}: { state: LayerState } & Tf): React.ReactElement {
  return (
    <div className="rounded border border-border bg-muted/30 px-3 py-2">
      <p className="text-sm font-medium">{state.name}</p>
      {state.description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{state.description}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {t('layerState.manage.restoreDialog.entryCount', { count: state.snapshot.length })}
      </p>
    </div>
  );
}

function UnmatchedWarning({ count, t }: { count: number } & Tf): React.ReactElement {
  return (
    <div className={UNMATCHED_CLASS} role="alert" data-testid="restore-dialog-unmatched">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
      <span>{t('layerState.manage.restoreDialog.unmatchedWarning', { count })}</span>
    </div>
  );
}

function CreateMissingToggle({
  checked,
  onChange,
  t,
}: { checked: boolean; onChange: (v: boolean) => void } & Tf): React.ReactElement {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        data-testid="restore-dialog-create-missing"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm">{t('layerState.manage.restoreDialog.createMissingLayersLabel')}</span>
        <span className="text-xs text-muted-foreground">
          {t('layerState.manage.restoreDialog.createMissingLayersHint')}
        </span>
      </span>
    </label>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeUnmatched(snapshot: ReadonlyArray<LayerStateEntry>): ReadonlyArray<string> {
  const live = getAllLayers();
  const liveById = new Set(live.map((l) => l.id));
  const liveByName = new Set(live.map((l) => l.name.toLowerCase()));
  return snapshot
    .filter((e) => !liveById.has(e.layerId) && !liveByName.has(e.layerName.toLowerCase()))
    .map((e) => e.layerName);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const UNMATCHED_CLASS =
  'flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 ' +
  'px-3 py-2 text-xs text-destructive';

const CANCEL_CLASS =
  'h-8 px-3 rounded border border-border text-xs hover:bg-muted ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const APPLY_CLASS =
  'h-8 px-4 rounded bg-primary text-primary-foreground text-xs font-medium ' +
  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed';
