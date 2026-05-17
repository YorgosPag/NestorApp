'use client';

import * as React from 'react';
import { BookmarkPlus, Download, Library, Settings, Upload } from 'lucide-react';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import type { LayerStateDropdownActions, LayerStateDropdownState } from './useLayerStateDropdown';
import type { LasImportSummary } from '../../../stores/LayerStateStore';

export interface LayerStatePopoverFooterProps {
  readonly state: LayerStateDropdownState;
  readonly actions: LayerStateDropdownActions;
  readonly onClose: () => void;
}

export function LayerStatePopoverFooter({
  state,
  actions,
  onClose: _onClose,
}: LayerStatePopoverFooterProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [lasFeedback, setLasFeedback] = React.useState<LasFeedback | null>(null);
  const isReady = state.isReady;
  const hasStates = state.snapshot.states.length > 0;

  const handleExportLas = (): void => {
    const payload = actions.exportLas();
    if (!payload) {
      setLasFeedback({ kind: 'error', message: t('layerState.exportLasNoneToExport') });
      return;
    }
    triggerExportDownload({
      blob: new Blob([payload.content], { type: 'application/octet-stream' }),
      filename: payload.filename,
    });
    setLasFeedback(null);
  };

  const handleImportChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.las')) {
      setLasFeedback({ kind: 'error', message: t('layerState.importLasInvalidExtension') });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () =>
      setLasFeedback({ kind: 'error', message: t('layerState.importLasReadFailure') });
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const summary = actions.importLas(text);
      setLasFeedback(buildImportFeedback(summary, t));
    };
    reader.readAsText(file);
  };

  return (
    <>
      <footer className={FOOTER_CLASS}>
        <FooterAction
          icon={<Download className="h-3.5 w-3.5" aria-hidden />}
          label={t('layerState.importLas')}
          hint={t('layerState.importLasHint')}
          disabled={!isReady}
          onClick={() => fileInputRef.current?.click()}
          testId="layer-state-import-las"
        />
        <FooterAction
          icon={<Upload className="h-3.5 w-3.5" aria-hidden />}
          label={t('layerState.exportLas')}
          hint={t('layerState.exportLasHint')}
          disabled={!isReady || !hasStates}
          onClick={handleExportLas}
          testId="layer-state-export-las"
        />
        <FooterAction
          icon={<Settings className="h-3.5 w-3.5" aria-hidden />}
          label={t('layerState.manage')}
          hint={t('layerState.manage')}
          disabled={!isReady}
          onClick={actions.openManagePanel}
          testId="layer-state-manage"
        />
      </footer>
      <footer className={FOOTER_CLASS}>
        <FooterAction
          icon={<Library className="h-3.5 w-3.5" aria-hidden />}
          label={t('layerState.templates.dropdownBrowseTemplates')}
          hint={state.templates.isReady ? t('layerState.templates.browserDescription') : t('layerState.templates.dropdownNotReady')}
          disabled={!state.templates.isReady}
          onClick={actions.openTemplateBrowser}
          testId="layer-state-templates-browse"
        />
        <FooterAction
          icon={<BookmarkPlus className="h-3.5 w-3.5" aria-hidden />}
          label={t('layerState.templates.dropdownSaveAsTemplate')}
          hint={state.templates.isReady ? t('layerState.templates.saveAsDescription') : t('layerState.templates.dropdownNotReady')}
          disabled={!state.templates.isReady || !isReady}
          onClick={() => actions.openSaveAsTemplate()}
          testId="layer-state-templates-save-as"
        />
      </footer>
      <input
        ref={fileInputRef}
        type="file"
        accept=".las,text/plain"
        className="hidden"
        onChange={handleImportChange}
        data-testid="layer-state-import-las-input"
      />
      {lasFeedback && (
        <p
          className={lasFeedback.kind === 'error' ? FEEDBACK_ERROR_CLASS : FEEDBACK_INFO_CLASS}
          data-testid="layer-state-las-feedback"
          role="status"
        >
          {lasFeedback.message}
        </p>
      )}
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface FooterActionProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly hint: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly testId: string;
}

function FooterAction({ icon, label, hint, disabled, onClick, testId }: FooterActionProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={FOOTER_BTN_CLASS}
          aria-label={label}
          data-testid={testId}
        >
          {icon}
          <span className="truncate">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface LasFeedback { kind: 'info' | 'error'; message: string; }

function buildImportFeedback(
  summary: LasImportSummary,
  t: (k: string, opts?: Record<string, unknown>) => string,
): LasFeedback {
  if (summary.added === 0 && summary.skipped === 0 && summary.errors.length === 0)
    return { kind: 'error', message: t('layerState.importLasEmpty') };
  const main = t('layerState.importLasSuccess', { added: summary.added, skipped: summary.skipped });
  if (summary.errors.length === 0) return { kind: 'info', message: main };
  return { kind: 'error', message: `${main} — ${t('layerState.importLasErrorsHeader')} ${summary.errors.join('; ')}` };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FOOTER_CLASS = 'flex items-center gap-1 px-2 py-2 border-t border-border bg-muted/30';
const FOOTER_BTN_CLASS =
  'flex items-center gap-1 flex-1 min-w-0 h-6 px-2 rounded text-xs ' +
  'text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed';
const FEEDBACK_INFO_CLASS = 'px-3 py-2 border-t border-border bg-muted/20 text-xs text-foreground';
const FEEDBACK_ERROR_CLASS = 'px-3 py-2 border-t border-border bg-destructive/10 text-xs text-destructive';
