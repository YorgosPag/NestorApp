'use client';

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
import { useAuth } from '@/hooks/useAuth';

interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  vatOwed: number;
  pendingInvoices: number;
}

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
    if (!user) return;
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

  const statCards = [
    {
      title: t('dashboard.totalIncome'),
      value: stats.totalIncome,
      icon: ArrowUpRight,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
    },
    {
      title: t('dashboard.totalExpenses'),
      value: stats.totalExpenses,
      icon: ArrowDownRight,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
    },
    {
      title: t('dashboard.vatOwed'),
      value: stats.vatOwed,
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    },
    {
      title: t('dashboard.pendingInvoices'),
      value: stats.pendingInvoices,
      icon: FileWarning,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      isCount: true,
    },
  ];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="large" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <section className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('pages.dashboard')}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date().getFullYear()}
              </p>
            </div>
            <nav className="flex gap-2">
              <Button onClick={() => router.push('/accounting/invoices/new')}>
                <Plus className="mr-2 h-4 w-4" />
                {t('invoices.newInvoice')}
              </Button>
            </nav>
          </div>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <Card key={card.title}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <span className={`p-2 rounded-lg ${card.bgColor}`}>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {card.isCount ? card.value : formatCurrency(card.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        </section>
      </header>

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
