'use client';

/**
 * Financial Intelligence Page — SPEC-242C
 *
 * Portfolio-level dashboard with KPIs, projects table,
 * debt maturity wall, and budget variance waterfall.
 *
 * @enterprise SPEC-242C — Portfolio Dashboard & Debt Maturity Wall
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { PortfolioDashboard } from '@/components/sales/financial-intelligence/PortfolioDashboard';

export default function FinancialIntelligencePage() {
  const { t } = useTranslation('payments');
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  return (
    <main className="container mx-auto p-6 space-y-6">
      <ModuleBreadcrumb />

      <header className="flex items-center gap-3">
        <BarChart3
          className={cn('h-7 w-7', colors.text.primary)}
        />
        <h1
          className={cn('text-2xl font-bold', colors.text.primary, quick)}
        >
          {t('portfolio.pageTitle')}
        </h1>
      </header>

      <PortfolioDashboard />
    </main>
  );
}
