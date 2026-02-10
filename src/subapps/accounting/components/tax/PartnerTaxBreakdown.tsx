'use client';

/**
 * @fileoverview Tax Page — Partner Tax Breakdown Cards
 * @description Per-partner φόρου cards (ΟΕ pass-through)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/intl-utils';
import type { PartnershipTaxResult } from '../../types/tax';

// ============================================================================
// TYPES
// ============================================================================

interface PartnerTaxBreakdownProps {
  result: PartnershipTaxResult;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PartnerTaxBreakdown({ result }: PartnerTaxBreakdownProps) {
  const { t } = useTranslation('accounting');

  return (
    <section className="space-y-4">
      {/* Entity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('tax.partnerBreakdown.entitySummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.totalIncome')}</dt>
              <dd className="text-lg font-semibold">{formatCurrency(result.totalEntityIncome)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.totalExpenses')}</dt>
              <dd className="text-lg font-semibold">{formatCurrency(result.totalEntityExpenses)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.totalProfit')}</dt>
              <dd className="text-lg font-semibold">{formatCurrency(result.totalEntityProfit)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.professionalTax')}</dt>
              <dd className="text-lg font-semibold">{formatCurrency(result.entityProfessionalTax)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Per-partner cards */}
      {result.partnerResults.map((pr) => (
        <Card key={pr.partnerId}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{pr.partnerName}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {pr.profitSharePercent}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.profitShare')}</dt>
                <dd className="font-semibold">{formatCurrency(pr.profitShare)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.taxableIncome')}</dt>
                <dd className="font-semibold">{formatCurrency(pr.taxResult.taxableIncome)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.incomeTax')}</dt>
                <dd className="font-semibold">{formatCurrency(pr.taxResult.incomeTax)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('tax.partnerBreakdown.finalAmount')}</dt>
                <dd className="font-semibold text-primary">{formatCurrency(pr.taxResult.finalAmount)}</dd>
              </div>
            </dl>

            {/* Bracket breakdown */}
            {pr.taxResult.bracketBreakdown.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  {t('tax.partnerBreakdown.bracketDetails')}
                </summary>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-1 text-left font-medium">{t('tax.partnerBreakdown.bracket')}</th>
                      <th className="py-1 text-right font-medium">{t('tax.partnerBreakdown.taxableAmount')}</th>
                      <th className="py-1 text-right font-medium">{t('tax.partnerBreakdown.taxAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pr.taxResult.bracketBreakdown.map((bb) => (
                      <tr key={bb.bracket.from} className="border-b border-border/50">
                        <td className="py-1">{bb.bracket.rate}%</td>
                        <td className="py-1 text-right">{formatCurrency(bb.taxableAmount)}</td>
                        <td className="py-1 text-right">{formatCurrency(bb.taxAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
