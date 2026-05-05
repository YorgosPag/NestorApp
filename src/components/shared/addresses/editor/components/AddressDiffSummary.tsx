'use client';

import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FIELD_LABEL_I18N_KEY } from '../helpers/fieldLabels';
import type { AddressFieldConflict } from '../types';

export interface AddressDiffSummaryProps {
  conflicts: AddressFieldConflict[];
  className?: string;
}

export function AddressDiffSummary({ conflicts, className }: AddressDiffSummaryProps) {
  const { t } = useTranslation('addresses');

  return (
    <section className={cn('rounded-md border overflow-hidden', className)}>
      <header className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b">
        <span className="text-xs font-medium">{t('editor.diff.title')}</span>
        <span className="text-xs text-muted-foreground">
          {conflicts.length === 0
            ? t('editor.diff.noChanges')
            : t('editor.diff.fieldsChanged', { count: conflicts.length })}
        </span>
      </header>

      {conflicts.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">{t('editor.diff.noChanges')}</p>
      ) : (
        <ul className="divide-y">
          {conflicts.map((c) => (
            <li key={c.field} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="w-24 shrink-0 text-muted-foreground font-medium">
                {t(FIELD_LABEL_I18N_KEY[c.field])}
              </span>
              <span className="truncate text-muted-foreground line-through">
                {c.userValue || '—'}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
              <span className="truncate font-medium text-foreground">{c.resolvedValue || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
