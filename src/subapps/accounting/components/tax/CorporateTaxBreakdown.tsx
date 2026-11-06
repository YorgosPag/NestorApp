'use client';

/**
 * @fileoverview Tax Page — Entity Tax Breakdown (ΟΕ / ΕΠΕ / ΑΕ)
 * @description Φόρος οντότητας 22%, προκαταβολή με εξήγηση, διανομή κερδών ανά εταίρο/μέλος/μέτοχο.
 *   Η ΟΕ φορολογείται ως οντότητα από 2026-11-06 (ADR-ACC-024 §6) — δεν έχει πια δική της κάρτα κλίμακας.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-12
 * @version 2.0.0
 * @see ADR-ACC-014 EPE LLC Support · ADR-ACC-016 · ADR-ACC-024 §6
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/intl-utils';
import type {
  EPETaxResult,
  AETaxResult,
  PartnershipTaxResult,
  LegalEntityType,
  DistributionCoverage,
} from '../../types/tax';
import { PrepaymentBasisNote } from './PrepaymentBasisNote';
import { DistributionCoverageNote } from './DistributionCoverageNote';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type CorporateTaxBreakdownProps =
  | { entityType: 'oe'; result: PartnershipTaxResult }
  | { entityType: 'epe'; result: EPETaxResult }
  | { entityType: 'ae'; result: AETaxResult };

/** Μία γραμμή διανομής — ουδέτερη για εταίρο / μέλος / μέτοχο. */
interface DistributionItem {
  id: string;
  name: string;
  sharePercent: number;
  gross: number;
  withholding: number;
  net: number;
}

/** Σύνοψη διανομής — ουδέτερη για τις τρεις μορφές. */
interface DistributionSummary {
  profitAfterTax: number;
  distributed: number;
  totalWithholding: number;
  retainedEarnings: number;
  items: DistributionItem[];
  coverage: DistributionCoverage;
}

/** Ετικέτες ανά νομική μορφή — η ΟΕ διανέμει «κέρδη», όχι «μερίσματα». */
interface EntityLabels {
  tax: string;
  summary: string;
  distributions: string;
  withholding: string;
  gross: string;
  net: string;
}

/** Κλειδιά γραμμένα ολόκληρα — στατικά ορατά στις πύλες i18n. */
const DIVIDEND_LABELS: Omit<EntityLabels, 'tax' | 'distributions'> = {
  summary: 'setup.corporateTax.dividends',
  withholding: 'setup.corporateTax.dividendTax',
  gross: 'setup.corporateTax.grossDividend',
  net: 'setup.corporateTax.netDividend',
};

const LABEL_KEYS: Readonly<Record<LegalEntityType, EntityLabels>> = {
  oe: {
    tax: 'setup.corporateTax.titleOE',
    summary: 'setup.corporateTax.profitDistribution',
    distributions: 'setup.corporateTax.partnerDistributions',
    withholding: 'setup.corporateTax.distributionWithholding',
    gross: 'setup.corporateTax.grossDistribution',
    net: 'setup.corporateTax.netDistribution',
  },
  epe: { ...DIVIDEND_LABELS, tax: 'setup.corporateTax.title', distributions: 'setup.corporateTax.memberDividends' },
  ae: { ...DIVIDEND_LABELS, tax: 'setup.corporateTax.titleAE', distributions: 'setup.corporateTax.shareholderDividends' },
};

/**
 * Σήμα «δεν υπολογίζεται» — η λογιστική σύμβαση για ποσό που δεν προκύπτει (όχι «0 €», που θα σήμαινε
 * «υπολογίστηκε και είναι μηδέν»). Ο αναγνώστης οθόνης ακούει το μεταφρασμένο κείμενο, όχι την παύλα.
 */
const NOT_COMPUTED_MARK = '—';

function distributionSummaryOf(props: CorporateTaxBreakdownProps): DistributionSummary {
  switch (props.entityType) {
    case 'oe': {
      const r = props.result;
      return {
        profitAfterTax: r.profitAfterTax, distributed: r.distributedProfits,
        totalWithholding: r.totalDistributionWithholding, retainedEarnings: r.retainedEarnings,
        coverage: r.distributionCoverage,
        items: r.partnerDistributions.map((d) => ({
          id: d.partnerId, name: d.partnerName, sharePercent: d.profitSharePercent,
          gross: d.grossDistribution, withholding: d.withholdingAmount, net: d.netDistribution,
        })),
      };
    }
    case 'epe': {
      const r = props.result;
      return {
        profitAfterTax: r.profitAfterTax, distributed: r.distributedDividends,
        totalWithholding: r.totalDividendTax, retainedEarnings: r.retainedEarnings,
        coverage: r.distributionCoverage,
        items: r.memberDividends.map((d) => ({
          id: d.memberId, name: d.memberName, sharePercent: d.dividendSharePercent,
          gross: d.grossDividend, withholding: d.dividendTaxAmount, net: d.netDividend,
        })),
      };
    }
    case 'ae': {
      const r = props.result;
      return {
        profitAfterTax: r.profitAfterTax, distributed: r.distributedDividends,
        totalWithholding: r.totalDividendTax, retainedEarnings: r.retainedEarnings,
        coverage: r.distributionCoverage,
        items: r.shareholderDividends.map((d) => ({
          id: d.shareholderId, name: d.shareholderName, sharePercent: d.dividendSharePercent,
          gross: d.grossDividend, withholding: d.dividendTaxAmount, net: d.netDividend,
        })),
      };
    }
  }
}

/** ΟΕ με απλογραφικά: παρακράτηση 0% — τα κέρδη φορολογήθηκαν μόνο στο όνομα της εταιρείας (ADR-ACC-024 §6.1 γ). */
function isUnwithheldPartnership(props: CorporateTaxBreakdownProps): boolean {
  // Χωρίς εταίρους το `every` είναι κενά αληθές — η εξήγηση θα έλεγε «απλογραφικά» και σε διπλογραφική ΟΕ.
  if (props.entityType !== 'oe' || props.result.distributionCoverage.status === 'none') return false;
  return props.result.partnerDistributions.every((d) => d.withholdingRate === 0);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CorporateTaxBreakdown(props: CorporateTaxBreakdownProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const { corporateTax } = props.result;
  const summary = distributionSummaryOf(props);
  const labels = LABEL_KEYS[props.entityType];

  return (
    <section className="space-y-4">
      {/* Entity Tax Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t(labels.tax)}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('tax.totalIncome')}</dt>
              <dd className="font-medium">{formatCurrency(corporateTax.grossIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('tax.totalExpenses')}</dt>
              <dd className="font-medium">{formatCurrency(-corporateTax.deductibleExpenses)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.efkaLabel')}</dt>
              <dd className="font-medium">{formatCurrency(-corporateTax.efkaContributions)}</dd>
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
            <div className="flex flex-wrap justify-between gap-y-1">
              <dt className={colors.text.muted}>
                {t('setup.corporateTax.prepaymentAt', { rate: corporateTax.prepaymentRate })}
              </dt>
              <dd className="font-medium">{formatCurrency(corporateTax.prepaymentAmount)}</dd>
              <dd className="basis-full">
                <PrepaymentBasisNote basis={corporateTax.prepaymentBasis} />
              </dd>
            </div>
            <hr />
            <div className="flex justify-between text-base">
              <dt className="font-semibold">{t('setup.corporateTax.totalObligation')}</dt>
              <dd className="font-bold text-destructive">{formatCurrency(corporateTax.totalObligation)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Distribution Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t(labels.summary)}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.profitAfterTax')}</dt>
              <dd className="font-medium">{formatCurrency(summary.profitAfterTax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t(labels.summary)}</dt>
              <dd className="font-medium">{formatCurrency(summary.distributed)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t(labels.withholding)}</dt>
              {summary.coverage.status === 'none' ? (
                <dd className={cn('font-medium', colors.text.muted)}>
                  <span aria-hidden="true">{NOT_COMPUTED_MARK}</span>
                  <span className="sr-only">{t('setup.distributionCoverage.notComputed')}</span>
                </dd>
              ) : (
                <dd className="font-medium text-destructive">{formatCurrency(summary.totalWithholding)}</dd>
              )}
            </div>
            <div className="flex justify-between">
              <dt className={colors.text.muted}>{t('setup.corporateTax.retainedEarnings')}</dt>
              <dd className="font-medium">{formatCurrency(summary.retainedEarnings)}</dd>
            </div>
          </dl>
          <DistributionCoverageNote entityType={props.entityType} coverage={summary.coverage} />
          {isUnwithheldPartnership(props) && (
            <p className={cn('mt-2 text-xs', colors.text.muted)}>{t('setup.corporateTax.noWithholdingSimplified')}</p>
          )}
        </CardContent>
      </Card>

      {/* Per-partner / member / shareholder distributions */}
      {summary.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t(labels.distributions)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.items.map((item) => (
                <article key={item.id} className="rounded-md border p-3">
                  <header className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <span className={cn("text-xs", colors.text.muted)}>
                      {item.sharePercent}%
                    </span>
                  </header>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className={colors.text.muted}>{t(labels.gross)}</dt>
                      <dd className="font-medium">{formatCurrency(item.gross)}</dd>
                    </div>
                    <div>
                      <dt className={colors.text.muted}>{t(labels.withholding)}</dt>
                      <dd className="font-medium text-destructive">{formatCurrency(item.withholding)}</dd>
                    </div>
                    <div>
                      <dt className={colors.text.muted}>{t(labels.net)}</dt>
                      <dd className="font-semibold text-[hsl(var(--text-success))]">{formatCurrency(item.net)}</dd>
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
