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

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Badge } from '@/components/ui/badge';
import type { VATQuarterSummary, VATQuarterStatus, FiscalQuarter } from '@/subapps/accounting/types';
import { formatCurrency } from '@/subapps/accounting/utils/format';

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
// SINGLE QUARTER CARD
// ============================================================================

interface QuarterCardProps {
  quarter: VATQuarterSummary;
}

function QuarterCard({ quarter }: QuarterCardProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {t('quarterCard', { quarter: quarter.quarter })}
          </CardTitle>
          <Badge variant={STATUS_BADGE_VARIANTS[quarter.status]}>
            {t(`vat.statuses.${quarter.status}`)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {QUARTER_PERIOD_LABELS[quarter.quarter]}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('vat.outputVat')}</dt>
            <dd className="font-medium">{formatCurrency(quarter.totalOutputVat)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('vat.deductibleVat')}</dt>
            <dd className="font-medium">{formatCurrency(quarter.totalDeductibleInputVat)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-medium">{t('vat.vatPayable')}</dt>
            <dd className={`font-bold ${quarter.vatPayable >= 0 ? colors.text.error : colors.text.success}`}>
              {formatCurrency(quarter.vatPayable)}
            </dd>
          </div>
          {quarter.vatCredit > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('vat.vatCredit')}</dt>
              <dd className={`font-medium ${colors.text.success}`}>{formatCurrency(quarter.vatCredit)}</dd>
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
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();

  return (
    <Card className="opacity-60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {t('quarterCard', { quarter: quarterNumber })}
          </CardTitle>
          <Badge variant="outline">{t('vat.statuses.open')}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {QUARTER_PERIOD_LABELS[quarterNumber]}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('vat.outputVat')}</dt>
            <dd className="font-medium">{formatCurrency(0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('vat.deductibleVat')}</dt>
            <dd className="font-medium">{formatCurrency(0)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-medium">{t('vat.vatPayable')}</dt>
            <dd className="font-bold">{formatCurrency(0)}</dd>
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

