'use client';

/**
 * **Μία λίστα μεριδίων που αθροίζουν 100%** (ADR-928 §5.4 · §5.4.1 · Φ3γ-2 απόφαση 8). Ίδιοι τέσσερις καταναλωτές με τον
 * ΕΝΑ έλεγχο `validateShares`: στάδια γραμμής · μέσα πληρωμής · επιμερισμός κόστους · δόσεις κράτησης.
 *
 * 🔑 Σ ζωντανά, με λέξη και εικονίδιο (όχι μόνο χρώμα, ADR-771).
 * 🔑 «Υπόλοιπο» σε κάθε μερίδιο: το συμπληρώνει ώστε η λίστα να κάνει ακριβώς 100% (`remainderShare`). Δεν προσφέρεται όταν
 *    δεν υπάρχει τέτοια τιμή.
 * 🔑 Ευρήματα: της λίστας στο `path` (`sharesEmpty` · `sharesNotWhole`), του μεριδίου στο `path.i` (ίδια μονοπάτια με τον
 *    επικυρωτή). Ό,τι ορίζει το στοιχείο (στάδιο, μέσο, μέρος) το ζωγραφίζει ο καταναλωτής (`renderFields`).
 */

import type { ReactNode } from 'react';
import { CircleCheck, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PercentField } from '@/components/ui/numeric-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { removeAt, replaceAt } from '@/lib/array-utils';
import { BP_PER_WHOLE, type BasisPoints } from '@/lib/pricing/discount-rule';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath, type SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { remainderShare, shareTotal } from '@/subapps/procurement/subcontracts/lines/line-edits';
import type { HumanLanguage } from '@/i18n/languages';
import { FieldIssues } from '../editor/FieldIssues';

export interface SharesEditorProps<T> {
  readonly id: string;
  readonly legend: string;
  readonly items: readonly T[];
  readonly onChange: (items: readonly T[]) => void;
  readonly shareOf: (item: T) => BasisPoints;
  readonly withShare: (item: T, share: BasisPoints) => T;
  readonly newItem: () => T;
  readonly addLabel: string;
  readonly path: string;
  readonly issues: readonly SubcontractIssue[];
  readonly language: HumanLanguage;
  /** Τα πεδία που ορίζουν το στοιχείο (ετικέτα σταδίου, μέσο, μέρος…) — το μερίδιο το βάζει η λίστα. */
  readonly renderFields: (item: T, update: (next: T) => void, index: number) => ReactNode;
}

function ShareTotal({ shares, language }: { readonly shares: readonly BasisPoints[]; readonly language: HumanLanguage }) {
  const { t } = useTranslation('procurement');
  const total = shareTotal(shares);
  if (total === null || shares.length === 0) return null;
  const whole = total === BP_PER_WHOLE;
  const Icon = whole ? CircleCheck : ShieldAlert;
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden />
      {t(whole ? 'subcontracts.sections.shares.whole' : 'subcontracts.sections.shares.partial', { total: documentLocaleOf(language).percent(total) })}
    </p>
  );
}

export function SharesEditor<T>(props: SharesEditorProps<T>) {
  const { t } = useTranslation('procurement');
  const { id, legend, items, onChange, shareOf, withShare, path, issues, language, renderFields } = props;
  const shares = items.map(shareOf);
  const update = (index: number) => (next: T) => onChange(replaceAt(items, index, next));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <ul className="space-y-2">
        {items.map((item, index) => {
          const remainder = remainderShare(shares, index);
          const rowId = `${id}-${index}`;
          return (
            <li key={rowId} className="flex flex-wrap items-end gap-2">
              {renderFields(item, update(index), index)}
              <span className="grid w-24 gap-1">
                <PercentField id={`${rowId}-share`} label={t('subcontracts.sections.shares.share')} value={shareOf(item)} onValueChange={(share) => update(index)(withShare(item, share))} />
              </span>
              {remainder !== null && remainder !== shareOf(item) && (
                <Button type="button" variant="ghost" size="sm" onClick={() => update(index)(withShare(item, remainder))}>{t('subcontracts.sections.shares.remainder')}</Button>
              )}
              <Button type="button" variant="ghost" size="icon" aria-label={t('subcontracts.sections.shares.remove', { position: index + 1 })} onClick={() => onChange(removeAt(items, index))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
              <FieldIssues issues={issuesAt(issues, joinPath(path, index))} />
            </li>
          );
        })}
      </ul>
      <ShareTotal shares={shares} language={language} />
      <FieldIssues issues={issuesAt(issues, path)} />
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, props.newItem()])}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{props.addLabel}
      </Button>
    </fieldset>
  );
}
