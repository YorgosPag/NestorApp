'use client';

/**
 * BudgetLineRow — one budget line, edited in place (ADR-917 Φ3γ).
 *
 * Amount and note are always-editable cells (Enter / blur commits, Esc restores). The amount is parsed in
 * either decimal convention (`1.200,50` · `1,200.50`) and must be a non-negative net figure (Ζ5); anything
 * else restores the confirmed value instead of sending a request the server would refuse. The effect
 * column reads the ledger (it is never computed here).
 *
 * @module components/projects/tabs/project-budget/BudgetLineRow
 */

import { useCallback } from 'react';
import { Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { BUDGET_LINE_NOTE_MAX } from '@/services/project-cost/budget-line-limits';
import type { BudgetLineDisplay, BudgetLineValues } from '@/services/project-cost/budget-lines-optimistic';
import { budgetLineLabel, parseBudgetAmount, type BudgetLineEffect } from './budget-line-presentation';
import { useInlineCellDraft } from './useInlineCellDraft';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface BudgetLineRowProps {
  line: BudgetLineDisplay;
  effect: BudgetLineEffect;
  readOnly: boolean;
  onSet: (costCode: string, values: BudgetLineValues) => void;
  onArchive: (line: BudgetLineDisplay) => void;
  t: Translate;
}

const AMOUNT_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

function EffectText({ effect, t }: { effect: BudgetLineEffect; t: Translate }) {
  if (effect.kind === 'soft') return <>{t('budgetEditor.effect.soft')}</>;
  if (effect.kind === 'superseded') return <>{t('budgetEditor.effect.superseded')}</>;
  if (effect.kind === 'unknown') return <>{t('budgetEditor.effect.unknown')}</>;
  return (
    <>
      {t('budgetEditor.effect.allowanceActive')}
      {effect.estimateDelta !== null ? (
        <small className="block text-muted-foreground">
          {t('budgetEditor.effect.estimateDelta', { delta: formatCurrency(effect.estimateDelta) })}
        </small>
      ) : null}
    </>
  );
}

export function BudgetLineRow({ line, effect, readOnly, onSet, onArchive, t }: BudgetLineRowProps) {
  const label = budgetLineLabel(line.costCode, t);

  const commitAmount = useCallback((text: string) => {
    const amount = parseBudgetAmount(text);
    if (amount === null) return false;
    if (amount !== line.amount) onSet(line.costCode, { amount, note: line.note });
    return true;
  }, [line, onSet]);

  const commitNote = useCallback((text: string) => {
    const note = text.trim() === '' ? null : text.trim();
    if (note !== line.note) onSet(line.costCode, { amount: line.amount, note });
    return true;
  }, [line, onSet]);

  const amount = useInlineCellDraft(formatNumber(line.amount, AMOUNT_FORMAT), commitAmount);
  const note = useInlineCellDraft(line.note ?? '', commitNote);

  return (
    <TableRow aria-busy={line.pending}>
      <TableCell>
        <span className="font-medium">{label}</span>
        <small className="block font-mono text-muted-foreground">{line.costCode}</small>
      </TableCell>
      <TableCell className="w-40">
        <Input
          inputMode="decimal"
          className="text-right tabular-nums"
          value={amount.draft}
          disabled={readOnly}
          aria-label={t('budgetEditor.row.amountAria', { code: label })}
          onChange={(event) => amount.setDraft(event.target.value)}
          onFocus={amount.onFocus}
          onBlur={amount.onBlur}
          onKeyDown={amount.onKeyDown}
        />
      </TableCell>
      <TableCell>
        <Input
          value={note.draft}
          maxLength={BUDGET_LINE_NOTE_MAX}
          disabled={readOnly}
          aria-label={t('budgetEditor.row.noteAria', { code: label })}
          onChange={(event) => note.setDraft(event.target.value)}
          onFocus={note.onFocus}
          onBlur={note.onBlur}
          onKeyDown={note.onKeyDown}
        />
      </TableCell>
      <TableCell className="text-sm">
        {line.pending ? <span className="text-muted-foreground">{t('budgetEditor.row.saving')}</span> : <EffectText effect={effect} t={t} />}
      </TableCell>
      <TableCell className="w-12 text-right">
        {readOnly ? null : (
          <Button variant="ghost" size="sm" onClick={() => onArchive(line)} aria-label={t('budgetEditor.row.archiveAria', { code: label })}>
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
