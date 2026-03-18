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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { KPIAlertCard } from './KPIAlertCard';
import { DebtMaturityWall } from './DebtMaturityWall';
import { BudgetVarianceChart } from './BudgetVarianceChart';
import type {
  PortfolioSummary,
  ProjectFinancialSummary,
  DebtMaturityEntry,
  BudgetVarianceAnalysis,
  HealthStatus,
} from '@/types/interest-calculator';

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

// =============================================================================
// HEALTH STATUS BADGE MAP
// =============================================================================

const STATUS_BADGE: Record<HealthStatus, 'success' | 'info' | 'warning' | 'destructive'> = {
  excellent: 'success',
  good: 'info',
  warning: 'warning',
  critical: 'destructive',
};

// =============================================================================
// EURO FORMATTER
// =============================================================================

const fmtEuro = (val: number) =>
  new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

// =============================================================================
// COMPONENT
// =============================================================================

export function PortfolioDashboard() {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');

  // State
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [projects, setProjects] = useState<ProjectFinancialSummary[]>([]);
  const [debtEntries, setDebtEntries] = useState<DebtMaturityEntry[]>([]);
  const [budgetAnalysis, setBudgetAnalysis] = useState<BudgetVarianceAnalysis | null>(null);
  const [selectedBudgetProject, setSelectedBudgetProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/financial-intelligence/portfolio');
      if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`);
      const json = await res.json() as PortfolioApiResponse;
      setPortfolio(json.data.portfolio);
      setProjects(json.data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchDebtMaturity = useCallback(async () => {
    try {
      const res = await fetch('/api/financial-intelligence/debt-maturity');
      if (!res.ok) return;
      const json = await res.json() as DebtApiResponse;
      setDebtEntries(json.data.entries);
    } catch {
      // Non-critical — debt wall is optional
    }
  }, []);

  const fetchBudgetVariance = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/financial-intelligence/budget-variance?projectId=${projectId}`);
      if (!res.ok) return;
      const json = await res.json() as BudgetApiResponse;
      setBudgetAnalysis(json.data.analysis);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
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

  const handleAddDebt = useCallback(async (data: Parameters<typeof DebtMaturityWall>[0] extends { onAdd: (d: infer D) => Promise<void> } ? D : never) => {
    const res = await fetch('/api/financial-intelligence/debt-maturity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add debt entry');
    await fetchDebtMaturity();
  }, [fetchDebtMaturity]);

  const handleRemoveDebt = useCallback(async (loanId: string) => {
    const res = await fetch(`/api/financial-intelligence/debt-maturity?loanId=${loanId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove debt entry');
    await fetchDebtMaturity();
  }, [fetchDebtMaturity]);

  const handleSaveBudget = useCallback(async (data: { projectId: string; projectName: string; categories: Array<{ category: string; categoryKey: string; budgetAmount: number; actualAmount: number }> }) => {
    const res = await fetch('/api/financial-intelligence/budget-variance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save budget variance');
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
        <p className="text-sm" style={{ color: colors.textMuted }}>{error}</p>
      </section>
    );
  }

  if (!portfolio) return null;

  // =========================================================================
  // PORTFOLIO HEALTH — worst across all projects
  // =========================================================================

  const portfolioHealth: HealthStatus = projects.length > 0
    ? projects.reduce<HealthStatus>((worst, p) => {
        const priority: Record<HealthStatus, number> = { critical: 0, warning: 1, good: 2, excellent: 3 };
        return priority[p.healthStatus] < priority[worst] ? p.healthStatus : worst;
      }, 'excellent')
    : 'good';

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
          status={portfolioHealth}
          icon={DollarSign}
          subtitle={`${portfolio.activeProjects} ${t('portfolio.projects')} · ${portfolio.totalUnits} ${t('portfolio.units')}`}
        />
        <KPIAlertCard
          title={t('portfolio.collected')}
          value={portfolio.totalCollected}
          format="currency"
          status={portfolio.totalCollected > portfolio.totalPortfolioValue * 0.5 ? 'good' : 'warning'}
          icon={TrendingUp}
          subtitle={`${t('portfolio.outstanding')}: ${fmtEuro(portfolio.totalOutstanding)}`}
        />
        <KPIAlertCard
          title={t('portfolio.avgCostOfMoney')}
          value={portfolio.weightedAvgCostOfMoney}
          format="percent"
          status={
            portfolio.weightedAvgCostOfMoney < 3 ? 'excellent'
              : portfolio.weightedAvgCostOfMoney < 5 ? 'good'
              : portfolio.weightedAvgCostOfMoney < 8 ? 'warning'
              : 'critical'
          }
          icon={BarChart3}
          subtitle={`${t('portfolio.timeCost')}: ${fmtEuro(portfolio.totalTimeCost)}`}
        />
        <KPIAlertCard
          title={t('portfolio.avgCollectionDays')}
          value={portfolio.weightedAvgCollectionDays}
          format="days"
          status={
            portfolio.weightedAvgCollectionDays < 180 ? 'excellent'
              : portfolio.weightedAvgCollectionDays < 365 ? 'good'
              : portfolio.weightedAvgCollectionDays < 540 ? 'warning'
              : 'critical'
          }
          icon={Clock}
          subtitle={`${portfolio.soldUnits}/${portfolio.totalUnits} ${t('portfolio.unitsSold')}`}
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
                  <TableCell className="text-right">{proj.totalUnits}</TableCell>
                  <TableCell className="text-right">{proj.soldUnits}</TableCell>
                  <TableCell className="text-right">{fmtEuro(proj.totalValue)}</TableCell>
                  <TableCell className="text-right">{fmtEuro(proj.collected)}</TableCell>
                  <TableCell className="text-right">{proj.costOfMoney.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{proj.avgCollectionDays}d</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={STATUS_BADGE[proj.healthStatus]}>
                      {proj.healthStatus}
                    </Badge>
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
    </section>
  );
}
