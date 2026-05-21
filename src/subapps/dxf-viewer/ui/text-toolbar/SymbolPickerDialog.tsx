'use client';

/**
 * ADR-345 Fase 5.5 — Symbol Picker Dialog.
 *
 * Small modal (~30 Unicode symbols) that inserts a symbol into selected
 * TEXT/MTEXT entities via InsertTextTokenCommand (undo/redo aware).
 * Triggered from ribbon Insert panel button `text-insert-symbol`.
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTextSelectionStore } from '../../state/text-toolbar';
import { useDxfTextServices } from './hooks/useDxfTextServices';
import { InsertTextTokenCommand } from '../../core/commands/text/InsertTextTokenCommand';
import { getGlobalCommandHistory } from '../../core/commands';

interface SymbolPickerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const SYMBOL_GROUPS: ReadonlyArray<{
  readonly groupKey: string;
  readonly symbols: ReadonlyArray<string>;
}> = [
  {
    groupKey: 'math',
    symbols: ['±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '°', 'Ø', '∅', 'Δ', 'Σ', 'π', 'μ'],
  },
  {
    groupKey: 'arrows',
    symbols: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇑', '⇓'],
  },
  {
    groupKey: 'legal',
    symbols: ['©', '®', '™', '§', '¶'],
  },
] as const;

export function SymbolPickerDialog({ open, onOpenChange }: SymbolPickerDialogProps) {
  const { t } = useTranslation(['dxf-viewer-shell']);
  const selectedIds = useTextSelectionStore((s) => s.selectedIds);
  const services = useDxfTextServices();

  const handleInsert = useCallback((symbol: string) => {
    if (!services || selectedIds.length === 0) return;
    const h = getGlobalCommandHistory();
    for (const entityId of selectedIds) {
      h.execute(new InsertTextTokenCommand(
        { entityId, token: symbol },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      ));
    }
    onOpenChange(false);
  }, [services, selectedIds, onOpenChange]);

  const disabled = !services || selectedIds.length === 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[340px] rounded-lg border bg-background p-4 shadow-lg',
            'focus:outline-none',
          )}
        >
          <header className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold">
              {t('ribbon.symbolPicker.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-0.5 hover:bg-muted"
                aria-label={t('ribbon.symbolPicker.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </header>

          <p className="mb-3 text-xs text-muted-foreground">
            {t('ribbon.symbolPicker.hint')}
          </p>

          <div className="flex flex-col gap-3">
            {SYMBOL_GROUPS.map(({ symbols }) => (
              <div key={symbols.join('')} className="flex flex-wrap gap-1">
                {symbols.map((sym) => (
                  <Button
                    key={sym}
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleInsert(sym)}
                    className="h-8 w-8 p-0 font-mono text-sm"
                    aria-label={sym}
                  >
                    {sym}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
