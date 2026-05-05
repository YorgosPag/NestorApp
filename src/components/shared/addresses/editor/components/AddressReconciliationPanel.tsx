'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FIELD_LABEL_I18N_KEY } from '../helpers/fieldLabels';
import type { AddressFieldConflict, ResolvedAddressFields } from '../types';
import type { ReconciliationDecision, ReconciliationDecisionMap } from '../hooks/useAddressReconciliation';

export interface AddressReconciliationPanelProps {
  conflicts: AddressFieldConflict[];
  pending: AddressFieldConflict[];
  decisions: ReconciliationDecisionMap;
  resolved: boolean;
  applyField: (field: keyof ResolvedAddressFields) => void;
  keepField: (field: keyof ResolvedAddressFields) => void;
  applyAll: () => void;
  keepAll: () => void;
  onTrySuggestions?: () => void;
  className?: string;
}

function decisionVariant(
  decision: ReconciliationDecision | undefined,
): 'success' | 'muted' | 'warning' {
  if (decision === 'apply') return 'success';
  if (decision === 'keep') return 'muted';
  return 'warning';
}

function FieldRow({
  conflict,
  decision,
  onApply,
  onKeep,
  t,
}: {
  conflict: AddressFieldConflict;
  decision: ReconciliationDecision | undefined;
  onApply: () => void;
  onKeep: () => void;
  t: (key: string) => string;
}) {
  const fieldLabel = t(FIELD_LABEL_I18N_KEY[conflict.field]);

  return (
    <li className="grid grid-cols-[6rem_1fr_1fr_auto] items-center gap-2 py-1.5 border-b last:border-0 text-xs">
      <span className="font-medium text-muted-foreground truncate">{fieldLabel}</span>

      <span
        className={cn(
          'truncate px-1.5 py-0.5 rounded',
          decision === 'keep' ? 'bg-muted font-medium' : 'text-muted-foreground',
        )}
      >
        {conflict.userValue || '—'}
      </span>

      <span
        className={cn(
          'truncate px-1.5 py-0.5 rounded',
          decision === 'apply' ? 'bg-green-100 dark:bg-green-900/30 font-medium text-green-700 dark:text-green-300' : 'text-muted-foreground',
        )}
      >
        {conflict.resolvedValue || '—'}
      </span>

      <span className="flex gap-1">
        <Button
          size="sm"
          variant={decision === 'apply' ? 'default' : 'outline'}
          className="h-6 px-2 text-xs"
          onClick={onApply}
          aria-pressed={decision === 'apply'}
        >
          {t('editor.reconciliation.apply')}
        </Button>
        <Button
          size="sm"
          variant={decision === 'keep' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-xs"
          onClick={onKeep}
          aria-pressed={decision === 'keep'}
        >
          {t('editor.reconciliation.keep')}
        </Button>
      </span>
    </li>
  );
}

export function AddressReconciliationPanel({
  conflicts,
  pending,
  decisions,
  resolved,
  applyField,
  keepField,
  applyAll,
  keepAll,
  onTrySuggestions,
  className,
}: AddressReconciliationPanelProps) {
  const { t } = useTranslation('addresses');

  if (conflicts.length === 0) return null;

  return (
    <section className={cn('border rounded-md overflow-hidden', className)}>
      <header className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
        <div>
          <p className="text-xs font-semibold text-foreground">
            {t('editor.reconciliation.title')}
          </p>
          <p className="text-xs text-muted-foreground">{t('editor.reconciliation.subtitle')}</p>
        </div>

        {resolved ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('editor.reconciliation.allResolved')}
          </Badge>
        ) : (
          <Badge variant="warning">
            {t('editor.reconciliation.pending', { count: pending.length })}
          </Badge>
        )}
      </header>

      <div className="px-3">
        <div className="grid grid-cols-[6rem_1fr_1fr_auto] gap-2 py-1 text-xs text-muted-foreground border-b">
          <span />
          <span>{t('editor.reconciliation.yourValue')}</span>
          <span>{t('editor.reconciliation.systemValue')}</span>
          <span />
        </div>

        <ul>
          {conflicts.map((c) => (
            <FieldRow
              key={c.field}
              conflict={c}
              decision={decisions[c.field]}
              onApply={() => applyField(c.field)}
              onKeep={() => keepField(c.field)}
              t={t}
            />
          ))}
        </ul>
      </div>

      <footer className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-t flex-wrap">
        <Button size="sm" variant="default" className="h-7 text-xs" onClick={applyAll}>
          {t('editor.reconciliation.applyAll')}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={keepAll}>
          {t('editor.reconciliation.keepAll')}
        </Button>
        {onTrySuggestions && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs ml-auto"
            onClick={onTrySuggestions}
          >
            {t('editor.reconciliation.trySuggestions')}
          </Button>
        )}
      </footer>
    </section>
  );
}

export { decisionVariant };
