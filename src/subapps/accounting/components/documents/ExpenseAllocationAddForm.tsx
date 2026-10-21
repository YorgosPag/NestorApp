'use client';

/**
 * ExpenseAllocationAddForm — a DIRECT cost line (no purchase order): permits, notary, utilities… (ADR-917 Φ4).
 *
 * The project is chosen from the company's projects, the code from the ONE taxonomy (`budgetLineGroupCodes`,
 * never typed); the amount is text in either decimal convention. Lines against an order come from the order's
 * proposal, never from here — a hand-typed «PO» would be a link nobody checked.
 *
 * @module subapps/accounting/components/documents/ExpenseAllocationAddForm
 */

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POProjectSelector } from '@/components/procurement/POEntitySelectors';
import { budgetLineGroupCodes, costCodeLabelKey } from '@/config/cost-taxonomy';
import type { DirectLineInput } from './expense-allocation-draft';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface ExpenseAllocationAddFormProps {
  disabled: boolean;
  /** `false` ⇔ refused (missing field / duplicate) — the form keeps what was typed */
  onAdd: (input: DirectLineInput) => boolean;
  t: Translate;
}

const EMPTY: DirectLineInput = { projectId: '', costCode: '', amountText: '' };

export function ExpenseAllocationAddForm({ disabled, onAdd, t }: ExpenseAllocationAddFormProps) {
  const [input, setInput] = useState<DirectLineInput>(EMPTY);
  const projectFieldId = useId();
  const edit = (patch: Partial<DirectLineInput>) => setInput((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onAdd(input)) setInput(EMPTY);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-[2fr_2fr_1fr_auto] md:items-end">
      <fieldset className="contents" disabled={disabled}>
        <legend className="col-span-full text-sm font-semibold">{t('documents.allocation.add.title')}</legend>
        <div className="space-y-1.5">
          <Label htmlFor={projectFieldId}>{t('documents.allocation.add.project')}</Label>
          <POProjectSelector id={projectFieldId} value={input.projectId} onSelect={(projectId) => edit({ projectId })} disabled={disabled} />
        </div>
        <Label className="space-y-1.5">
          <span>{t('documents.allocation.add.costCode')}</span>
          <Select value={input.costCode} onValueChange={(costCode) => edit({ costCode })}>
            <SelectTrigger><SelectValue placeholder={t('documents.allocation.add.costCodePlaceholder')} /></SelectTrigger>
            <SelectContent>
              {budgetLineGroupCodes().map((code) => (
                <SelectItem key={code} value={code}>{`${t(costCodeLabelKey(code))} (${code})`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
        <Label className="space-y-1.5">
          <span>{t('documents.allocation.add.amount')}</span>
          <Input inputMode="decimal" className="text-right tabular-nums" value={input.amountText} onChange={(event) => edit({ amountText: event.target.value })} />
        </Label>
        <Button type="submit">{t('documents.allocation.add.submit')}</Button>
      </fieldset>
    </form>
  );
}
