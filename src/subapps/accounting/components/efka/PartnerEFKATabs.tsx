'use client';

/**
 * @fileoverview EFKA Page — Partner EFKA Tabs
 * @description Tabs ανά εταίρο + ΕΦΚΑ details (ΟΕ)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/intl-utils';
import type { PartnershipEFKASummary } from '../../types/efka';

// ============================================================================
// TYPES
// ============================================================================

interface PartnerEFKATabsProps {
  summary: PartnershipEFKASummary;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PartnerEFKATabs({ summary }: PartnerEFKATabsProps) {
  const { t } = useTranslation('accounting');

  if (summary.partnerSummaries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('efka.partnerTabs.noPartners')}
        </CardContent>
      </Card>
    );
  }

  const firstPartnerId = summary.partnerSummaries[0]?.partnerId ?? '';

  return (
    <section className="space-y-4">
      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>{t('efka.partnerTabs.totalAllPartners')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">{t('efka.totalPaid')}</dt>
              <dd className="text-lg font-semibold">{formatCurrency(summary.totalAllPartnersPaid)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('efka.totalDue')}</dt>
              <dd className="text-lg font-semibold">{formatCurrency(summary.totalAllPartnersDue)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Per-partner tabs */}
      <Tabs defaultValue={firstPartnerId}>
        <TabsList>
          {summary.partnerSummaries.map((ps) => (
            <TabsTrigger key={ps.partnerId} value={ps.partnerId}>
              {ps.partnerName}
            </TabsTrigger>
          ))}
        </TabsList>

        {summary.partnerSummaries.map((ps) => (
          <TabsContent key={ps.partnerId} value={ps.partnerId}>
            <Card>
              <CardHeader>
                <CardTitle>{ps.partnerName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary stats */}
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">{t('efka.totalPaid')}</dt>
                    <dd className="font-semibold">{formatCurrency(ps.summary.totalPaid)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t('efka.totalDue')}</dt>
                    <dd className="font-semibold">{formatCurrency(ps.summary.totalDue)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t('efka.balanceDue')}</dt>
                    <dd className="font-semibold">{formatCurrency(ps.summary.balanceDue)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t('efka.partnerTabs.paidMonths')}</dt>
                    <dd className="font-semibold">{ps.summary.paidMonths}/12</dd>
                  </div>
                </dl>

                {/* Monthly breakdown table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium">{t('efka.month')}</th>
                      <th className="py-2 text-right font-medium">{t('efka.mainPension')}</th>
                      <th className="py-2 text-right font-medium">{t('efka.supplementary')}</th>
                      <th className="py-2 text-right font-medium">{t('efka.lumpSum')}</th>
                      <th className="py-2 text-right font-medium">{t('efka.healthcare')}</th>
                      <th className="py-2 text-right font-medium">{t('efka.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ps.summary.monthlyBreakdown.map((mb) => (
                      <tr key={mb.month} className="border-b border-border/50">
                        <td className="py-1.5">{t(`common.months.${mb.month}`)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(mb.mainPensionAmount)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(mb.supplementaryAmount)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(mb.lumpSumAmount)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(mb.healthAmount)}</td>
                        <td className="py-1.5 text-right font-medium">{formatCurrency(mb.totalMonthly)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
