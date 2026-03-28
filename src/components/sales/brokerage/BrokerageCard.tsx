'use client';

/**
 * BrokerageCard — Agent + commission terms + status
 *
 * @enterprise ADR-230 (SPEC-230B Task E)
 */

import React from 'react';
import { Building2, Percent, Banknote, Shield } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import type { BrokerageAgreement } from '@/types/brokerage';
import { formatCommission } from '@/components/projects/tabs/brokerage/brokerage-helpers';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// TYPES
// ============================================================================

interface BrokerageCardProps {
  agreements: BrokerageAgreement[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BrokerageCard({ agreements }: BrokerageCardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');

  if (agreements.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
          <Building2 className={cn("h-4 w-4", colors.text.muted)} />
          {t('sales.legal.brokerageTitle', { defaultValue: 'Μεσιτικές Συμβάσεις' })}
        </h3>
        <p className={cn("text-xs", colors.text.muted)}>
          {t('sales.legal.noBrokerage', { defaultValue: 'Δεν υπάρχουν μεσιτικές συμβάσεις.' })}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-3 space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Building2 className={cn("h-4 w-4", colors.text.muted)} />
        {t('sales.legal.brokerageTitle', { defaultValue: 'Μεσιτικές Συμβάσεις' })}
      </h3>

      <ul className="space-y-2">
        {agreements.map((agreement) => (
          <li key={agreement.id} className="rounded border p-2 space-y-1">
            <header className="flex items-center justify-between">
              <span className="font-medium text-sm">{agreement.agentName}</span>
              <Badge
                variant={agreement.status === 'active' ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {agreement.status === 'active'
                  ? t('sales.legal.activeAgreement', { defaultValue: 'Ενεργή' })
                  : agreement.status}
              </Badge>
            </header>

            <dl className={cn("grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs", colors.text.muted)}>
              <dt className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {t('sales.legal.exclusivity', { defaultValue: 'Τύπος' })}
              </dt>
              <dd className="font-medium text-foreground">
                {agreement.exclusivity === 'exclusive'
                  ? t('sales.legal.exclusive', { defaultValue: 'Αποκλειστική' })
                  : t('sales.legal.nonExclusive', { defaultValue: 'Απλή' })}
              </dd>

              <dt className="flex items-center gap-1">
                {agreement.commissionType === 'percentage'
                  ? <Percent className="h-3 w-3" />
                  : <Banknote className="h-3 w-3" />}
                {t('sales.legal.commission', { defaultValue: 'Προμήθεια' })}
              </dt>
              <dd className="font-medium text-foreground">
                {formatCommission(agreement)}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
