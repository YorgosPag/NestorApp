'use client';

/**
 * ADR-680 — κουμπί «ΜΕΤΡΗΣΗ» για το εφήμερο tape-measure (DIST), κάτω-αριστερά στην κάτω
 * μπάρα δίπλα στη γραμμή εντολών. Toggle: ενεργοποιεί/απενεργοποιεί το πραγματικό tool
 * `dist` μέσω `toolStateStore.selectTool` (παίρνει ΔΩΡΕΑΝ tool-exclusivity + snap). Το
 * «εφήμερο» εξασφαλίζεται αλλού (click branch → in-memory store, ΟΧΙ scene/DB write).
 *
 * Extracted από το `CadStatusBar` (N.7.1 500-line budget), sibling του `AutoAlignToggle`.
 *
 * @module subapps/dxf-viewer/statusbar/DistMeasureButton
 */

import { Ruler } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';
import { toolStateStore, useActiveTool } from '../stores/ToolStateStore';

export function DistMeasureButton({ id }: { id: string }) {
  const { t } = useTranslation('dxf-viewer-panels');
  const active = useActiveTool() === 'dist';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          id={id}
          type="button"
          onClick={() => toolStateStore.selectTool(active ? 'select' : 'dist')}
          aria-pressed={active}
          aria-label={t('cadDock.statusBar.distMeasure')}
          className={`flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold transition-colors ${
            active
              ? 'text-[hsl(var(--text-success))] bg-muted'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
          {t('cadDock.statusBar.distMeasure')}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{t('cadDock.statusBar.distMeasureDesc')}</TooltipContent>
    </Tooltip>
  );
}
