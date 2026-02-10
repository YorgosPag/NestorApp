'use client';

/**
 * @fileoverview Accounting Subapp — Tax Brackets Visual
 * @description Visual representation of Greek progressive tax brackets
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { TaxBracketResult } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface TaxBracketsVisualProps {
  bracketBreakdown: TaxBracketResult[];
  taxableIncome: number;
}

// ============================================================================
// CONSTANTS — Greek Tax Brackets 2024+
// ============================================================================

interface StaticBracketDisplay {
  from: number;
  to: number | null;
  rate: number;
  label: string;
  colorClass: string;
  bgClass: string;
}

const GREEK_TAX_BRACKETS: StaticBracketDisplay[] = [
  {
    from: 0,
    to: 10000,
    rate: 9,
    label: '0 - 10.000',
    colorClass: COLOR_BRIDGE.text.success,
    bgClass: COLOR_BRIDGE.bg.success,
  },
  {
    from: 10000,
    to: 20000,
    rate: 22,
    label: '10.000 - 20.000',
    colorClass: COLOR_BRIDGE.text.info,
    bgClass: COLOR_BRIDGE.bg.info,
  },
  {
    from: 20000,
    to: 30000,
    rate: 28,
    label: '20.000 - 30.000',
    colorClass: COLOR_BRIDGE.text.warning,
    bgClass: COLOR_BRIDGE.bg.warning,
  },
  {
    from: 30000,
    to: 40000,
    rate: 36,
    label: '30.000 - 40.000',
    colorClass: COLOR_BRIDGE.text.orange,
    bgClass: COLOR_BRIDGE.bg.orange,
  },
  {
    from: 40000,
    to: null,
    rate: 44,
    label: '40.000+',
    colorClass: COLOR_BRIDGE.text.error,
    bgClass: COLOR_BRIDGE.bg.error,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

/**
 * Calculate the fill percentage for a bracket based on taxable income
 */
function getBracketFillPercent(bracket: StaticBracketDisplay, taxableIncome: number): number {
  if (taxableIncome <= bracket.from) return 0;

  const bracketRange = bracket.to !== null ? bracket.to - bracket.from : 50000;
  const incomeInBracket = Math.min(taxableIncome - bracket.from, bracketRange);

  return Math.min((incomeInBracket / bracketRange) * 100, 100);
}

/**
 * Find tax amount for a specific rate from the bracket breakdown
 */
function findTaxForRate(breakdown: TaxBracketResult[], rate: number): number {
  const match = breakdown.find((b) => b.bracket.rate === rate);
  return match?.taxAmount ?? 0;
}

/**
 * Find taxable amount for a specific rate from the bracket breakdown
 */
function findAmountForRate(breakdown: TaxBracketResult[], rate: number): number {
  const match = breakdown.find((b) => b.bracket.rate === rate);
  return match?.taxableAmount ?? 0;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaxBracketsVisual({ bracketBreakdown, taxableIncome }: TaxBracketsVisualProps) {
  const { t } = useTranslation('accounting');

  return (
    <section aria-label={t('reports.taxBrackets')}>
      <h3 className="text-sm font-semibold text-foreground mb-3">{t('reports.taxBrackets')}</h3>

      <div className="space-y-3">
        {GREEK_TAX_BRACKETS.map((bracket) => {
          const fillPercent = getBracketFillPercent(bracket, taxableIncome);
          const taxAmount = findTaxForRate(bracketBreakdown, bracket.rate);
          const taxableAmount = findAmountForRate(bracketBreakdown, bracket.rate);
          const isActive = fillPercent > 0;

          return (
            <article
              key={bracket.rate}
              className={`rounded-lg border p-3 transition-opacity ${
                isActive ? 'border-border opacity-100' : 'border-border/50 opacity-50'
              }`}
            >
              {/* Bracket Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${bracket.colorClass}`}>
                    {bracket.rate}%
                  </span>
                  <span className="text-xs text-muted-foreground">{bracket.label}</span>
                </div>
                {isActive && (
                  <span className="text-xs font-medium text-foreground">
                    {formatCurrency(taxAmount)}
                  </span>
                )}
              </div>

              {/* Progress Bar — dynamic width requires CSS custom property */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${bracket.bgClass}`}
                  role="progressbar"
                  aria-valuenow={fillPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${bracket.rate}% ${t('reports.bracket')}`}
                  /* Dynamic width for progress bar — cannot be expressed in static Tailwind */
                  style={{ width: `${fillPercent}%` } as React.CSSProperties}
                />
              </div>

              {/* Taxable Amount */}
              {isActive && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('reports.taxableInBracket')}: {formatCurrency(taxableAmount)}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

