/**
 * IsolateStatusIndicator — ADR-358 §5.6.bis (Phase 10).
 *
 * Status-bar badge `🎯 Isolated: <category>` shown while a Layer Isolate
 * session is active. Click → dispatch `LayerUnisolateCommand` via the global
 * command history (undo-safe). Hidden when no session is active — zero-cost
 * passthrough until `setIsolateEffects` is called.
 */

'use client';

import React, { useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getIsolateEffectsSnapshot,
  subscribeIsolateEffects,
} from '../systems/isolate/IsolateEffectsStore';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LayerUnisolateCommand } from '../core/commands/layer';

export function IsolateStatusIndicator(): JSX.Element | null {
  const { t } = useTranslation('dxf-viewer');
  const { execute } = useCommandHistory();
  const snapshot = useSyncExternalStore(
    subscribeIsolateEffects,
    getIsolateEffectsSnapshot,
    getIsolateEffectsSnapshot,
  );

  const handleClick = useCallback(() => {
    execute(new LayerUnisolateCommand());
  }, [execute]);

  if (!snapshot.active) return null;

  const labelKey =
    snapshot.mode === 'dim'
      ? 'layer.isolate.statusBadge.dim'
      : 'layer.isolate.statusBadge.freeze';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          aria-label={t('layer.isolate.tooltipClickToUnisolate')}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[hsl(var(--bg-warning))]/15 text-[hsl(var(--bg-warning))] hover:bg-[hsl(var(--bg-warning))]/25 transition-colors"
        >
          <span aria-hidden="true">🎯</span>
          <span>
            {t(labelKey, {
              category: snapshot.category ?? t('layer.isolate.statusBadge.unnamed'),
            })}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {t('layer.isolate.tooltipClickToUnisolate')}
      </TooltipContent>
    </Tooltip>
  );
}
