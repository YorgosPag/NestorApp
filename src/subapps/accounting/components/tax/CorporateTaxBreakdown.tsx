'use client';

/**
 * @fileoverview Tax Page — Corporate Tax Breakdown (EPE)
 * @description Εταιρικός φόρος 22%, μερίσματα 5%, retained earnings
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-12
 * @version 1.0.0
 * @see ADR-ACC-014 EPE LLC Support
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/intl-utils';
import type { EPETaxResult, AETaxResult } from '../../types/tax';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface CorporateTaxBreakdownProps {
  result: EPETaxResult | AETaxResult;
  entityType: 'epe' | 'ae';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CorporateTaxBreakdown({ result, entityType }: CorporateTaxBreakdownProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices', 'accounting-setup']);
  const colors = useSemanticColors();
  const { corporateTax, profitAfterTax, distributedDividends, retainedEarnings, totalDividendTax } = result;

  // Normalize per-member/shareholder dividends for both EPE and AE
  const dividendItems = entityType === 'ae'
    ? (result as AETaxResult).shareholderDividends.map((sd) => ({
        id: sd.shareholderId,
        name: sd.shareholderName,
        dividendSharePercent: sd.dividendSharePercent,
        grossDividend: sd.grossDividend,
        dividendTaxAmount: sd.dividendTaxAmount,
        netDividend: sd.netDividend,
      }))
    : (result as EPETaxResult).memberDividends.map((md) => ({
        id: md.memberId,
        name: md.memberName,
        dividendSharePercent: md.dividendSharePercent,
        grossDividend: md.grossDividend,
        dividendTaxAmount: md.dividendTaxAmount,
        netDividend: md.netDividend,
      }));

  const dividendsTitle = entityType === 'ae'
    ? t('setup.corporateTax.shareholderDividends')
    : t('setup.corporateTax.memberDividends');

  const taxTitle = entityType === 'ae'
    ? t('setup.corporateTax.titleAE')
    : t('setup.corporateTax.title');

  return (
    <section className="space-y-4">
      {/* Corporate Tax Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{taxTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('tax.totalIncome')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.grossIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('tax.totalExpenses')}</dt>
              <dd className="font-medium">-{formatCurrency(corporateTax.deductibleExpenses)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.efkaLabel')}</dt>
              <dd className="font-medium">-{formatCurrency(corporateTax.efkaContributions)}</dd>
            </div>
            <hr />
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('tax.taxableIncome')}</dt>
              <dd className="font-semibold">{formatCurrency(corporateTax.taxableIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.flatRate')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.corporateTaxAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.professionalTax')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.professionalTax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.prepayment')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.prepaymentAmount)}</dd>
            </div>
            <hr />
            <div className="flex justify-between text-base">
              <dt className="font-semibold">{t('setup.corporateTax.totalObligation')}</dt>
              <dd className="font-bold text-destructive">{formatCurrency(corporateTax.totalObligation)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Dividends Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('setup.corporateTax.dividends')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.profitAfterTax')}</dt>
              <dd className="font-medium">{formatCurrency(profitAfterTax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.dividends')}</dt>
              <dd className="font-medium">{formatCurrency(distributedDividends)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.dividendTax')}</dt>
              <dd className="font-medium text-destructive">{formatCurrency(totalDividendTax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.retainedEarnings')}</dt>
              <dd className="font-medium">{formatCurrency(retainedEarnings)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Per-member/shareholder dividends */}
      {dividendItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{dividendsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dividendItems.map((item) => (
                <article key={item.id} className="rounded-md border p-3">
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <span className={cn("text-xs", colors.text.muted)}>
                      {item.dividendSharePercent}%
                    </span>
                  </header>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className={colors.text.muted}>{t('setup.corporateTax.grossDividend')}</dt>
                      <dd className="font-medium">{formatCurrency(item.grossDividend)}</dd>
                    </div>
                    <div>
                      <dt className={colors.text.muted}>{t('setup.corporateTax.dividendTax')}</dt>
                      <dd className="font-medium text-destructive">{formatCurrency(item.dividendTaxAmount)}</dd>
                    </div>
                    <div>
                      <dt className={colors.text.muted}>{t('setup.corporateTax.netDividend')}</dt>
                      <dd className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(item.netDividend)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
