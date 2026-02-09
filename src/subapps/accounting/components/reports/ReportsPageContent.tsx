'use client';

/**
 * @fileoverview Accounting Subapp — Reports Page Content
 * @description Main reports page with VAT, Tax Estimate, and Tax Dashboard cards
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine, ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { VATReportCard } from './VATReportCard';
import { TaxEstimateCard } from './TaxEstimateCard';
import { TaxDashboard } from './TaxDashboard';

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportsPageContent() {
  const { t } = useTranslation('accounting');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('reports.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('reports.description')}</p>
          </div>
          <div className="w-32">
            <FiscalYearPicker value={selectedYear} onValueChange={setSelectedYear} />
          </div>
        </div>
      </header>

      {/* Report Cards Grid */}
      <section className="p-6 space-y-6">
        {/* Top Row: VAT and Tax Estimate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VATReportCard fiscalYear={selectedYear} />
          <TaxEstimateCard fiscalYear={selectedYear} />
        </div>

        {/* Bottom Row: Tax Dashboard (full width) */}
        <TaxDashboard fiscalYear={selectedYear} />
      </section>
    </main>
  );
}
