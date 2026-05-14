'use client';

/**
 * ADR-345 Fase 6 — Insert token widget for the Text Editor contextual tab.
 *
 * Renders the 4 special-character insertion buttons (stack ¹⁄₂, diameter ⌀,
 * degree °, plus-minus ±). Dispatches `InsertTextTokenCommand` directly —
 * same pattern as the former `TextPropertiesPanelHost.onInsertToken`.
 *
 * Micro-leaf: reads `selectedIds` from `useTextSelectionStore`,
 * services from `useDxfTextServices` (ADR-040 compliant).
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTextSelectionStore } from '../../../state/text-toolbar';
import { useDxfTextServices } from '../../text-toolbar/hooks/useDxfTextServices';
import { InsertTextTokenCommand } from '../../../core/commands/text/InsertTextTokenCommand';
import { getGlobalCommandHistory } from '../../../core/commands';

const TOKENS = [
  { token: '\\S', display: '¹⁄₂', labelKey: 'textToolbar:insert.stack' },
  { token: '%%c', display: '⌀', labelKey: 'textToolbar:insert.diameter' },
  { token: '%%d', display: '°', labelKey: 'textToolbar:insert.degree' },
  { token: '%%p', display: '±', labelKey: 'textToolbar:insert.plusMinus' },
] as const;

export function RibbonInsertTokenWidget() {
  const { t } = useTranslation(['textToolbar']);
  const selectedIds = useTextSelectionStore((s) => s.selectedIds);
  const services = useDxfTextServices();

  const handleInsert = useCallback((token: string) => {
    if (!services || selectedIds.length === 0) return;
    const h = getGlobalCommandHistory();
    for (const entityId of selectedIds) {
      h.execute(new InsertTextTokenCommand(
        { entityId, token },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      ));
    }
  }, [services, selectedIds]);

  return (
    <div className="inline-flex gap-1 flex-wrap">
      {TOKENS.map(({ token, display, labelKey }) => (
        <Button
          key={token}
          variant="outline"
          size="sm"
          onClick={() => handleInsert(token)}
          aria-label={t(labelKey)}
          className={cn('min-h-[32px] px-2 text-xs font-mono')}
        >
          {display}
        </Button>
      ))}
    </div>
  );
}
