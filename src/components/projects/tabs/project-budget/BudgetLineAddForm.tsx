'use client';

/**
 * BudgetLineAddForm — opens a new budget line under a taxonomy group (ADR-917 Φ3γ · Ζ1 · Ζ8).
 *
 * The code is CHOSEN from the taxonomy (never typed); only the optional lower level is typed, and it is
 * checked by the same shape rule as the server (`composeBudgetLineCode` ⇒ `isBudgetLineCostCode`) before any
 * request. One line per code (Ζ8): an existing code is refused here with a pointer to its row.
 *
 * @module components/projects/tabs/project-budget/BudgetLineAddForm
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { budgetLineGroupCodes, composeBudgetLineCode } from '@/config/cost-taxonomy';
import { BUDGET_LINE_NOTE_MAX } from '@/services/project-cost/budget-line-limits';
import type { BudgetLineValues } from '@/services/project-cost/budget-lines-optimistic';
import { budgetLineLabel, parseBudgetAmount } from './budget-line-presentation';

type Translate = (key: string, options?: Record<string, unknown>) => string;

type AddError = 'invalidCode' | 'duplicate' | 'invalidAmount';

interface BudgetLineAddFormProps {
  usedCodes: ReadonlySet<string>;
  onAdd: (costCode: string, values: BudgetLineValues) => void;
  t: Translate;
}

interface Draft { group: string; lowerLevel: string; amount: string; note: string }

const EMPTY_DRAFT: Draft = { group: '', lowerLevel: '', amount: '', note: '' };

/** The draft → a request, or the ONE reason it cannot be sent. */
export function validateBudgetLineDraft(
  draft: Draft,
  usedCodes: ReadonlySet<string>,
): { costCode: string; values: BudgetLineValues } | { error: AddError } {
  const costCode = draft.group ? composeBudgetLineCode(draft.group, draft.lowerLevel) : null;
  if (costCode === null) return { error: 'invalidCode' };
  if (usedCodes.has(costCode)) return { error: 'duplicate' };
  const amount = parseBudgetAmount(draft.amount);
  if (amount === null) return { error: 'invalidAmount' };
  return { costCode, values: { amount, note: draft.note.trim() === '' ? null : draft.note.trim() } };
}

interface FieldsProps { draft: Draft; edit: (patch: Partial<Draft>) => void; t: Translate }

function AddFormFields({ draft, edit, t }: FieldsProps) {
  return (
    <fieldset className="contents">
      <legend className="col-span-full text-sm font-semibold">{t('budgetEditor.add.title')}</legend>
      <Label className="space-y-1.5">
        <span>{t('budgetEditor.add.group')}</span>
        <Select value={draft.group} onValueChange={(group) => edit({ group })}>
          <SelectTrigger><SelectValue placeholder={t('budgetEditor.add.groupPlaceholder')} /></SelectTrigger>
          <SelectContent>
            {budgetLineGroupCodes().map((code) => (
              <SelectItem key={code} value={code}>{`${budgetLineLabel(code, t)} (${code})`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label className="space-y-1.5">
        <span>{t('budgetEditor.add.lowerLevel')}</span>
        <Input value={draft.lowerLevel} maxLength={16} placeholder={t('budgetEditor.add.lowerLevelHint')} onChange={(event) => edit({ lowerLevel: event.target.value })} />
      </Label>
      <Label className="space-y-1.5">
        <span>{t('budgetEditor.add.amount')}</span>
        <Input inputMode="decimal" className="text-right tabular-nums" value={draft.amount} onChange={(event) => edit({ amount: event.target.value })} />
      </Label>
      <Label className="space-y-1.5">
        <span>{t('budgetEditor.add.note')}</span>
        <Input value={draft.note} maxLength={BUDGET_LINE_NOTE_MAX} onChange={(event) => edit({ note: event.target.value })} />
      </Label>
      <Button type="submit">{t('budgetEditor.add.submit')}</Button>
    </fieldset>
  );
}

export function BudgetLineAddForm({ usedCodes, onAdd, t }: BudgetLineAddFormProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<AddError | null>(null);
  const edit = (patch: Partial<Draft>) => { setDraft(current => ({ ...current, ...patch })); setError(null); };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateBudgetLineDraft(draft, usedCodes);
    if ('error' in result) { setError(result.error); return; }
    onAdd(result.costCode, result.values);
    setDraft(EMPTY_DRAFT);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto] md:items-end">
      <AddFormFields draft={draft} edit={edit} t={t} />
      {error ? <p role="alert" className="col-span-full text-sm text-destructive">{t(`budgetEditor.add.${error}`)}</p> : null}
    </form>
  );
}
