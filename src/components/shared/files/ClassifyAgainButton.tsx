'use client';

/**
 * @fileoverview Το **ένα** κουμπί «ξανά ανάγνωση με AI» ενός αρχείου (`classifyFile(id, force=true)`).
 * @module components/shared/files/ClassifyAgainButton
 *
 * Δύο αφορμές, **μία** πράξη (ADR-950 §4.6): «Επανάληψη κατηγοριοποίησης» μετά από αποτυχία, και «Ανάγνωση στοιχείων»
 * για αρχείο επαφής που ταξινομήθηκε πριν υπάρξει ο χάρτης πεδίων. Μία πράξη = μία κλήση AI.
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

interface ClassifyAgainButtonProps {
  readonly label: string;
  readonly busy: boolean;
  readonly onClick: () => void;
}

export function ClassifyAgainButton({ label, busy, onClick }: ClassifyAgainButtonProps) {
  const iconSizes = useIconSizes();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-label={label}
          className={cn(
            'inline-flex items-center justify-center rounded p-0.5',
            // CHECK 3.38 (ADR-770): μελάνι = token ΣΚΟΠΟΥ· το `text-primary` στο σκοτεινό θέμα = 1,00:1 με το `--card`.
            'text-[hsl(var(--text-info))]',
            'hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity',
          )}
        >
          <RotateCcw className={cn(iconSizes.xs, busy && 'animate-spin')} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
