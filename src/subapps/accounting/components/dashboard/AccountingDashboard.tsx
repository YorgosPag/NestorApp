'use client';

/**
 * @fileoverview Accounting Dashboard — Κεντρική σελίδα Λογιστικού
 * @description Κύριο dashboard με UnifiedDashboard stats, quick actions
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Migrated to UnifiedDashboard (centralized component)
 * @see ADR-ACC-000 Accounting Subapp Architecture
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  BookOpen,
  DollarSign,
  FileWarning,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  vatOwed: number;
  pendingInvoices: number;
}

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function AccountingDashboard() {
  const { t } = useTranslation('accounting');
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpenses: 0,
    vatOwed: 0,
    pendingInvoices: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const year = new Date().getFullYear();

      const [journalRes, vatRes, invoicesRes] = await Promise.all([
        fetch(`/api/accounting/journal?fiscalYear=${year}`, { headers }),
        fetch(`/api/accounting/vat/summary?fiscalYear=${year}`, { headers }),
        fetch(`/api/accounting/invoices?fiscalYear=${year}&paymentStatus=unpaid`, { headers }),
      ]);

      const journalData = journalRes.ok ? await journalRes.json() : null;
      const vatData = vatRes.ok ? await vatRes.json() : null;
      const invoicesData = invoicesRes.ok ? await invoicesRes.json() : null;

      const entries = journalData?.data?.items ?? [];
      const incomeEntries = entries.filter((e: { type: string }) => e.type === 'income');
      const expenseEntries = entries.filter((e: { type: string }) => e.type === 'expense');

      setStats({
        totalIncome: incomeEntries.reduce((s: number, e: { grossAmount: number }) => s + e.grossAmount, 0),
        totalExpenses: expenseEntries.reduce((s: number, e: { grossAmount: number }) => s + e.grossAmount, 0),
        vatOwed: vatData?.data?.annualVatPayable ?? vatData?.data?.vatPayable ?? 0,
        pendingInvoices: invoicesData?.data?.items?.length ?? 0,
      });
    } catch {
      // Stats will remain at defaults
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Build UnifiedDashboard stats
  const dashboardStats: DashboardStat[] = [
    {
      title: t('dashboard.totalIncome'),
      value: formatCurrency(stats.totalIncome),
      icon: ArrowUpRight,
      color: 'green',
      loading,
    },
    {
      title: t('dashboard.totalExpenses'),
      value: formatCurrency(stats.totalExpenses),
      icon: ArrowDownRight,
      color: 'red',
      loading,
    },
    {
      title: t('dashboard.vatOwed'),
      value: formatCurrency(stats.vatOwed),
      icon: DollarSign,
      color: 'orange',
      loading,
    },
    {
      title: t('dashboard.pendingInvoices'),
      value: stats.pendingInvoices,
      icon: FileWarning,
      color: 'blue',
      loading,
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="large" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('pages.dashboard')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().getFullYear()}
            </p>
          </div>
          <Button onClick={() => router.push('/accounting/invoices/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('invoices.newInvoice')}
          </Button>
        </div>
      </header>

      {/* Stats Dashboard */}
      <UnifiedDashboard stats={dashboardStats} columns={4} />

      {/* Quick Actions */}
      <section className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/invoices')}
              >
                <Receipt className="mr-3 h-5 w-5 text-muted-foreground" />
                <span>{t('pages.invoices')}</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/journal')}
              >
                <BookOpen className="mr-3 h-5 w-5 text-muted-foreground" />
                <span>{t('pages.journal')}</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/vat')}
              >
                <DollarSign className="mr-3 h-5 w-5 text-muted-foreground" />
                <span>{t('pages.vat')}</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/reports')}
              >
                <FileWarning className="mr-3 h-5 w-5 text-muted-foreground" />
                <span>{t('pages.reports')}</span>
              </Button>
            </nav>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
