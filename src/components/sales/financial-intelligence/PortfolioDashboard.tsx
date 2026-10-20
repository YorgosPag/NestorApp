/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * PortfolioDashboard — Master container for SPEC-242C
 *
 * Fetches from 3 API routes, renders:
 * 1. KPI row (4x KPIAlertCard)
 * 2. Projects Table
 * 3. DebtMaturityWall
 * 4. BudgetVarianceChart
 *
 * @enterprise SPEC-242C — Portfolio Dashboard & Debt Maturity Wall
 */

import React, { useEffect, useState, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import {
  DollarSign,
  TrendingUp,
  Clock,
  BarChart3,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { KPIAlertCard } from './KPIAlertCard';
import { HealthStatusBadge } from './HealthStatusBadge';
import { DebtMaturityWall } from './DebtMaturityWall';
import type { DebtMaturityFormData } from './DebtMaturityWall';
import { BudgetVarianceChart } from './BudgetVarianceChart';
import { FinancialQueryChat } from './FinancialQueryChat';
import type {
  PortfolioSummary,
  ProjectFinancialSummary,
  DebtMaturityEntry,
  BudgetVarianceAnalysis,
} from '@/types/interest-calculator';
import { assessPortfolioKpis } from '@/services/financial-intelligence/portfolio-health';
import {
  addDebtMaturityEntryWithPolicy,
  removeDebtMaturityEntryWithPolicy,
  saveBudgetVarianceWithPolicy,
} from '@/services/financial-intelligence/financial-intelligence-mutation-gateway';
import { createStaleCache } from '@/lib/stale-cache';

// =============================================================================
// TYPES
// =============================================================================

interface PortfolioApiResponse {
  data: {
    portfolio: PortfolioSummary;
    projects: ProjectFinancialSummary[];
  };
}

interface DebtApiResponse {
  data: {
    entries: DebtMaturityEntry[];
  };
}

interface BudgetApiResponse {
  data: {
    analysis: BudgetVarianceAnalysis | null;
  };
}

// ADR-300: Module-level caches — survive React unmount/remount (navigation)
const portfolioCache = createStaleCache<{ portfolio: PortfolioSummary; projects: ProjectFinancialSummary[] }>('portfolio-summary');
const debtMaturityCache = createStaleCache<DebtMaturityEntry[]>('portfolio-debt-maturity');

// =============================================================================
// EURO FORMATTER
// =============================================================================

const fmtEuro = (val: number) => formatCurrencyWhole(val) ?? '';

// =============================================================================
// COMPONENT
// =============================================================================

export function PortfolioDashboard() {
  const colors = useSemanticColors();
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);

  // State — ADR-300: Seed from module-level cache → zero flash on re-navigation
  const cachedPortfolio = portfolioCache.get();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(cachedPortfolio?.portfolio ?? null);
  const [projects, setProjects] = useState<ProjectFinancialSummary[]>(cachedPortfolio?.projects ?? []);
  const [debtEntries, setDebtEntries] = useState<DebtMaturityEntry[]>(debtMaturityCache.get() ?? []);
  const [budgetAnalysis, setBudgetAnalysis] = useState<BudgetVarianceAnalysis | null>(null);
  const [selectedBudgetProject, setSelectedBudgetProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(!portfolioCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.FINANCIAL_INTELLIGENCE.PORTFOLIO);
      if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`);
      const json = await res.json() as PortfolioApiResponse;
      // ADR-300: Write to module-level cache so next remount skips spinner
      portfolioCache.set({ portfolio: json.data.portfolio, projects: json.data.projects });
      setPortfolio(json.data.portfolio);
      setProjects(json.data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchDebtMaturity = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.FINANCIAL_INTELLIGENCE.DEBT_MATURITY);
      if (!res.ok) return;
      const json = await res.json() as DebtApiResponse;
      // ADR-300: Write to module-level cache so next remount skips spinner
      debtMaturityCache.set(json.data.entries);
      setDebtEntries(json.data.entries);
    } catch {
      // Non-critical — debt wall is optional
    }
  }, []);

  const fetchBudgetVariance = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`${API_ROUTES.FINANCIAL_INTELLIGENCE.BUDGET_VARIANCE}?projectId=${projectId}`);
      if (!res.ok) return;
      const json = await res.json() as BudgetApiResponse;
      setBudgetAnalysis(json.data.analysis);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    async function init() {
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!portfolioCache.hasLoaded()) setLoading(true);
      await Promise.all([fetchPortfolio(), fetchDebtMaturity()]);
      setLoading(false);
    }
    void init();
  }, [fetchPortfolio, fetchDebtMaturity]);

  useEffect(() => {
    if (selectedBudgetProject) {
      void fetchBudgetVariance(selectedBudgetProject);
    }
  }, [selectedBudgetProject, fetchBudgetVariance]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleAddDebt = useCallback(async (data: DebtMaturityFormData) => {
    await addDebtMaturityEntryWithPolicy(data);
    await fetchDebtMaturity();
  }, [fetchDebtMaturity]);

  const handleRemoveDebt = useCallback(async (loanId: string) => {
    await removeDebtMaturityEntryWithPolicy(loanId);
    await fetchDebtMaturity();
  }, [fetchDebtMaturity]);

  const handleSaveBudget = useCallback(async (data: { projectId: string; projectName: string; categories: Array<{ category: string; categoryKey: string; budgetAmount: number; actualAmount: number }> }) => {
    await saveBudgetVarianceWithPolicy(data);
    if (selectedBudgetProject) {
      await fetchBudgetVariance(selectedBudgetProject);
    }
  }, [selectedBudgetProject, fetchBudgetVariance]);

  const handleBudgetProjectSelect = useCallback((projectId: string) => {
    setSelectedBudgetProject(projectId);
  }, []);

  // =========================================================================
  // LOADING STATE
  // =========================================================================

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-6 text-center">
        <p className={cn('text-sm', colors.text.muted)}>{error}</p>
      </section>
    );
  }

  if (!portfolio) return null;

  // ADR SPEC-242C: one rulebook for every traffic light on this page
  const kpiHealth = assessPortfolioKpis(portfolio, projects);
  const notMeasured = t('portfolio.notMeasured');

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <section className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPIAlertCard
          title={t('portfolio.totalValue')}
          value={portfolio.totalPortfolioValue}
          format="currency"
          health={kpiHealth.totalValue}
          icon={DollarSign}
          subtitle={`${portfolio.activeProjects} ${t('portfolio.projects')} · ${portfolio.totalProperties} ${t('portfolio.units')}`}
        />
        <KPIAlertCard
          title={t('portfolio.collected')}
          value={portfolio.totalCollected}
          format="currency"
          health={kpiHealth.collected}
          icon={TrendingUp}
          subtitle={`${t('portfolio.outstanding')}: ${fmtEuro(portfolio.totalOutstanding)}`}
        />
        <KPIAlertCard
          title={t('portfolio.avgCostOfMoney')}
          value={portfolio.weightedAvgCostOfMoney}
          format="percent"
          health={kpiHealth.costOfMoney}
          icon={BarChart3}
          subtitle={`${t('portfolio.timeCost')}: ${fmtEuro(portfolio.totalTimeCost)}`}
        />
        <KPIAlertCard
          title={t('portfolio.avgCollectionDays')}
          value={portfolio.weightedAvgCollectionDays}
          format="days"
          health={kpiHealth.collectionDays}
          icon={Clock}
          subtitle={`${portfolio.soldProperties}/${portfolio.totalProperties} ${t('portfolio.unitsSold')}`}
        />
      </div>

      {/* Projects Table */}
      {projects.length > 0 && (
        <section className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('portfolio.projectName')}</TableHead>
                <TableHead className="text-right">{t('portfolio.units')}</TableHead>
                <TableHead className="text-right">{t('portfolio.sold')}</TableHead>
                <TableHead className="text-right">{t('portfolio.value')}</TableHead>
                <TableHead className="text-right">{t('portfolio.collected')}</TableHead>
                <TableHead className="text-right">{t('portfolio.costOfMoney')}</TableHead>
                <TableHead className="text-right">{t('portfolio.collectionDays')}</TableHead>
                <TableHead className="text-center">{t('portfolio.health')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map(proj => (
                <TableRow key={proj.projectId}>
                  <TableCell className="font-medium">{proj.projectName}</TableCell>
                  <TableCell className="text-right">{proj.totalProperties}</TableCell>
                  <TableCell className="text-right">{proj.soldProperties}</TableCell>
                  <TableCell className="text-right">{fmtEuro(proj.totalValue)}</TableCell>
                  <TableCell className="text-right">{fmtEuro(proj.collected)}</TableCell>
                  <TableCell className="text-right">
                    {proj.costOfMoney === null ? notMeasured : `${proj.costOfMoney.toFixed(2)}%`}
                  </TableCell>
                  <TableCell className="text-right">
                    {proj.avgCollectionDays === null ? notMeasured : `${proj.avgCollectionDays}d`}
                  </TableCell>
                  <TableCell className="text-center">
                    <HealthStatusBadge status={proj.healthStatus} drivers={proj.healthDrivers} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Debt Maturity Wall */}
      <DebtMaturityWall
        entries={debtEntries}
        projects={projects}
        onAdd={handleAddDebt}
        onRemove={handleRemoveDebt}
        t={t}
      />

      {/* Budget Variance Chart */}
      <BudgetVarianceChart
        analysis={budgetAnalysis}
        projects={projects}
        selectedProjectId={selectedBudgetProject}
        onProjectSelect={handleBudgetProjectSelect}
        onSave={handleSaveBudget}
        t={t}
      />

      {/* Financial Assistant — SPEC-242E D3 */}
      <FinancialQueryChat />
    </section>
  );
}
