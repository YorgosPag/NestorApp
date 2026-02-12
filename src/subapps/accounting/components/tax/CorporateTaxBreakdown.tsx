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

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/intl-utils';
import type { EPETaxResult } from '../../types/tax';

// ============================================================================
// TYPES
// ============================================================================

interface CorporateTaxBreakdownProps {
  result: EPETaxResult;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CorporateTaxBreakdown({ result }: CorporateTaxBreakdownProps) {
  const { t } = useTranslation('accounting');
  const { corporateTax, memberDividends, profitAfterTax, distributedDividends, retainedEarnings, totalDividendTax } = result;

  return (
    <section className="space-y-4">
      {/* Corporate Tax Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('setup.corporateTax.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('tax.totalIncome')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.grossIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('tax.totalExpenses')}</dt>
              <dd className="font-medium">-{formatCurrency(corporateTax.deductibleExpenses)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ΕΦΚΑ</dt>
              <dd className="font-medium">-{formatCurrency(corporateTax.efkaContributions)}</dd>
            </div>
            <hr />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('tax.taxableIncome')}</dt>
              <dd className="font-semibold">{formatCurrency(corporateTax.taxableIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('setup.corporateTax.flatRate')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.corporateTaxAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('setup.corporateTax.professionalTax')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.professionalTax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('setup.corporateTax.prepayment')}</dt>
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
              <dt className="text-muted-foreground">{t('setup.corporateTax.profitAfterTax')}</dt>
              <dd className="font-medium">{formatCurrency(profitAfterTax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('setup.corporateTax.dividends')}</dt>
              <dd className="font-medium">{formatCurrency(distributedDividends)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('setup.corporateTax.dividendTax')}</dt>
              <dd className="font-medium text-destructive">{formatCurrency(totalDividendTax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('setup.corporateTax.retainedEarnings')}</dt>
              <dd className="font-medium">{formatCurrency(retainedEarnings)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Per-member dividends */}
      {memberDividends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('setup.corporateTax.memberDividends')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {memberDividends.map((md) => (
                <article key={md.memberId} className="rounded-md border p-3">
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{md.memberName}</h4>
                    <span className="text-xs text-muted-foreground">
                      {md.dividendSharePercent}%
                    </span>
                  </header>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">{t('setup.corporateTax.grossDividend')}</dt>
                      <dd className="font-medium">{formatCurrency(md.grossDividend)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('setup.corporateTax.dividendTax')}</dt>
                      <dd className="font-medium text-destructive">{formatCurrency(md.dividendTaxAmount)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('setup.corporateTax.netDividend')}</dt>
                      <dd className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(md.netDividend)}</dd>
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
