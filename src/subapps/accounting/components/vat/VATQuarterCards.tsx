/**
 * @fileoverview VAT Quarter Cards — Grid 4 τριμηνιαίων καρτών ΦΠΑ
 * @description Εμφανίζει status, output VAT, deductible input VAT, vatPayable ανά τρίμηνο
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderBar } from '@/components/ui/header-bar';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Badge } from '@/components/ui/badge';
import type { VATQuarterSummary, VATQuarterStatus, FiscalQuarter } from '@/subapps/accounting/types';
import { formatAccountingCurrency } from '@/subapps/accounting/utils/format';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface VATQuarterCardsProps {
  quarters: VATQuarterSummary[];
  fiscalYear: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_BADGE_VARIANTS: Record<VATQuarterStatus, 'outline' | 'secondary' | 'default'> = {
  open: 'outline',
  calculated: 'secondary',
  submitted: 'default',
  paid: 'default',
};

const QUARTER_PERIOD_LABELS: Record<FiscalQuarter, string> = {
  1: 'Ιαν - Μαρ',
  2: 'Απρ - Ιουν',
  3: 'Ιουλ - Σεπ',
  4: 'Οκτ - Δεκ',
};

// ============================================================================
// SHARED PARTS — ίδια κεφαλίδα και ίδια γραμμή ποσού για γεμάτο και κενό τρίμηνο
// ============================================================================

interface QuarterCardHeaderProps {
  quarterNumber: FiscalQuarter;
  /** Το σήμα κατάστασης του τριμήνου, απέναντι από τον τίτλο. */
  badge: ReactNode;
}

function QuarterCardHeader({ quarterNumber, badge }: QuarterCardHeaderProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  return (
    <CardHeader className="pb-3">
      <HeaderBar actions={badge}>
        <CardTitle className="text-base">
          {t('quarterCard', { quarter: quarterNumber })}
        </CardTitle>
      </HeaderBar>
      <p className={cn("text-xs", colors.text.muted)}>
        {QUARTER_PERIOD_LABELS[quarterNumber]}
      </p>
    </CardHeader>
  );
}

interface VatAmountRowProps {
  label: string;
  amount: number;
}

function VatAmountRow({ label, amount }: VatAmountRowProps) {
  const colors = useSemanticColors();

  return (
    <div className="flex justify-between">
      <dt className={colors.text.muted}>{label}</dt>
      <dd className="font-medium">{formatAccountingCurrency(amount)}</dd>
    </div>
  );
}

// ============================================================================
// SINGLE QUARTER CARD
// ============================================================================

interface QuarterCardProps {
  quarter: VATQuarterSummary;
}

function QuarterCard({ quarter }: QuarterCardProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  return (
    <Card>
      <QuarterCardHeader
        quarterNumber={quarter.quarter}
        badge={
          <Badge variant={STATUS_BADGE_VARIANTS[quarter.status]}>
            {t(`vat.statuses.${quarter.status}`)}
          </Badge>
        }
      />
      <CardContent>
        <dl className="space-y-2 text-sm">
          <VatAmountRow label={t('vat.outputVat')} amount={quarter.totalOutputVat} />
          <VatAmountRow label={t('vat.deductibleVat')} amount={quarter.totalDeductibleInputVat} />
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-medium">{t('vat.vatPayable')}</dt>
            <dd className={`font-bold ${quarter.vatPayable >= 0 ? colors.text.error : colors.text.success}`}>
              {formatAccountingCurrency(quarter.vatPayable)}
            </dd>
          </div>
          {quarter.vatCredit > 0 && (
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('vat.vatCredit')}</dt>
              <dd className={`font-medium ${colors.text.success}`}>{formatAccountingCurrency(quarter.vatCredit)}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EMPTY QUARTER CARD (placeholder for quarters without data)
// ============================================================================

interface EmptyQuarterCardProps {
  quarterNumber: FiscalQuarter;
}

function EmptyQuarterCard({ quarterNumber }: EmptyQuarterCardProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);

  return (
    <Card className="opacity-60">
      <QuarterCardHeader
        quarterNumber={quarterNumber}
        badge={<Badge variant="outline">{t('vat.statuses.open')}</Badge>}
      />
      <CardContent>
        <dl className="space-y-2 text-sm">
          <VatAmountRow label={t('vat.outputVat')} amount={0} />
          <VatAmountRow label={t('vat.deductibleVat')} amount={0} />
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-medium">{t('vat.vatPayable')}</dt>
            <dd className="font-bold">{formatAccountingCurrency(0)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT — GRID OF 4 QUARTERS
// ============================================================================

export function VATQuarterCards({ quarters }: VATQuarterCardsProps) {
  const allQuarters: FiscalQuarter[] = [1, 2, 3, 4];
  const quarterMap = new Map(quarters.map((q) => [q.quarter, q]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {allQuarters.map((qNum) => {
        const quarterData = quarterMap.get(qNum);
        return quarterData ? (
          <QuarterCard key={qNum} quarter={quarterData} />
        ) : (
          <EmptyQuarterCard key={qNum} quarterNumber={qNum} />
        );
      })}
    </div>
  );
}

