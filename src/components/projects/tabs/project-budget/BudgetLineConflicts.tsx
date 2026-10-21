'use client';

/**
 * BudgetLineConflicts — a 409 the human resolves, never a silent overwrite either way (ADR-917 Φ3γ · Α15).
 *
 * The server refused because someone else changed the line in between. Procore stops at the refusal; here the
 * human sees BOTH versions and chooses: keep theirs (close), or keep mine (re-sent on the revision just read).
 *
 * @module components/projects/tabs/project-budget/BudgetLineConflicts
 */

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/intl-utils';
import type { BudgetLineConflict } from '@/services/project-cost/budget-lines-optimistic';
import { budgetLineLabel } from './budget-line-presentation';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface BudgetLineConflictsProps {
  conflicts: readonly BudgetLineConflict[];
  onResolve: (costCode: string, keep: 'mine' | 'theirs') => void;
  t: Translate;
}

export function BudgetLineConflicts({ conflicts, onResolve, t }: BudgetLineConflictsProps) {
  if (conflicts.length === 0) return null;
  return (
    <ul className="space-y-2" aria-live="polite">
      {conflicts.map(({ costCode, mine, theirs }) => (
        <li key={costCode} role="alert" className="space-y-2 rounded-md border border-[hsl(var(--text-warning))] p-3 text-sm">
          <p className="font-semibold">{t('budgetEditor.conflict.title', { code: budgetLineLabel(costCode, t) })}</p>
          <p>{theirs ? t('budgetEditor.conflict.theirs', { value: formatCurrency(theirs.amount) }) : t('budgetEditor.conflict.theirsArchived')}</p>
          <p>{mine ? t('budgetEditor.conflict.mine', { value: formatCurrency(mine.amount) }) : t('budgetEditor.conflict.mineArchive')}</p>
          <nav className="flex gap-2">
            <Button size="sm" onClick={() => onResolve(costCode, 'mine')}>{t('budgetEditor.conflict.keepMine')}</Button>
            <Button size="sm" variant="outline" onClick={() => onResolve(costCode, 'theirs')}>{t('budgetEditor.conflict.keepTheirs')}</Button>
          </nav>
        </li>
      ))}
    </ul>
  );
}
