'use client';

/**
 * @fileoverview Invoices Page Content — Σελίδα Τιμολογίων
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel + InvoicesTable
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Receipt,
  CreditCard,
  Clock,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { useAuth } from '@/hooks/useAuth';
import type { Invoice } from '@/subapps/accounting/types';
import { formatCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { InvoicesTable } from './InvoicesTable';

// ============================================================================
// TYPES
// ============================================================================

interface InvoiceFilterState extends GenericFilterState {
  fiscalYear: string;
  type: string;
  paymentStatus: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FILTERS: InvoiceFilterState = {
  fiscalYear: String(new Date().getFullYear()),
  type: 'all',
  paymentStatus: 'all',
};

// ============================================================================
// HELPERS
// ============================================================================

function buildFilterConfig(t: (key: string) => string): FilterPanelConfig {
  return {
    title: 'filters.title',
    i18nNamespace: 'accounting',
    rows: [
      {
        id: 'invoices-main',
        fields: [
          {
            id: 'fiscalYear',
            type: 'select',
            label: 'filterLabels.fiscalYear',
            ariaLabel: 'Fiscal year',
            width: 1,
            options: [
              { value: String(new Date().getFullYear()), label: String(new Date().getFullYear()) },
              { value: String(new Date().getFullYear() - 1), label: String(new Date().getFullYear() - 1) },
              { value: String(new Date().getFullYear() - 2), label: String(new Date().getFullYear() - 2) },
            ],
          },
          {
            id: 'type',
            type: 'select',
            label: 'filterLabels.type',
            ariaLabel: 'Invoice type',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allTypes') },
              { value: 'service_invoice', label: t('invoices.types.service_invoice') },
              { value: 'sales_invoice', label: t('invoices.types.sales_invoice') },
              { value: 'retail_receipt', label: t('invoices.types.retail_receipt') },
              { value: 'service_receipt', label: t('invoices.types.service_receipt') },
              { value: 'credit_invoice', label: t('invoices.types.credit_invoice') },
            ],
          },
          {
            id: 'paymentStatus',
            type: 'select',
            label: 'filterLabels.paymentStatus',
            ariaLabel: 'Payment status',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allStatuses') },
              { value: 'unpaid', label: t('invoices.paymentStatuses.unpaid') },
              { value: 'partial', label: t('invoices.paymentStatuses.partial') },
              { value: 'paid', label: t('invoices.paymentStatuses.paid') },
            ],
          },
        ],
      },
    ],
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InvoicesPageContent() {
  const { t } = useTranslation('accounting');
  const router = useRouter();
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFilterState>({ ...DEFAULT_FILTERS });
  const [showDashboard, setShowDashboard] = useState(true);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  const fetchInvoices = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      params.set('fiscalYear', filters.fiscalYear);
      if (filters.type && filters.type !== 'all') params.set('type', filters.type);
      if (filters.paymentStatus && filters.paymentStatus !== 'all') params.set('paymentStatus', filters.paymentStatus);

      const res = await fetch(`/api/accounting/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      setInvoices(json.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Compute dashboard stats from loaded invoices
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const totalRevenue = invoices.reduce((s, inv) => s + inv.totalGrossAmount, 0);
    const unpaidBalance = invoices
      .filter((inv) => inv.paymentStatus !== 'paid')
      .reduce((s, inv) => s + inv.balanceDue, 0);
    const thisMonthCount = invoices.filter((inv) => {
      const d = new Date(inv.issueDate);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const pendingMydata = invoices.filter((inv) => inv.mydata?.status === 'draft').length;

    return [
      {
        title: t('dashboard.totalInvoices'),
        value: invoices.length,
        icon: Receipt,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('dashboard.unpaidBalance'),
        value: formatCurrency(unpaidBalance),
        icon: CreditCard,
        color: 'red' as const,
        loading,
      },
      {
        title: t('dashboard.thisMonth'),
        value: thisMonthCount,
        icon: Clock,
        color: 'green' as const,
        loading,
      },
      {
        title: t('dashboard.pendingMydata'),
        value: pendingMydata,
        icon: Send,
        color: 'orange' as const,
        loading,
      },
    ];
  }, [invoices, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
      <AccountingPageHeader
        icon={Receipt}
        titleKey="invoices.title"
        descriptionKey="invoices.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={[
          <Button key="new-invoice" onClick={() => router.push('/accounting/invoices/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('invoices.newInvoice')}
          </Button>,
        ]}
      />

      {/* Stats Dashboard */}
      {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={4} />}

      {/* Filters */}
      <AdvancedFiltersPanel
        config={filterConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={DEFAULT_FILTERS}
      />

      {/* Content */}
      <section className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" onClick={fetchInvoices}>
              {t('common.retry')}
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-foreground mb-1">{t('invoices.noInvoices')}</p>
            <p className="text-muted-foreground mb-4">{t('invoices.noInvoicesDescription')}</p>
            <Button onClick={() => router.push('/accounting/invoices/new')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('invoices.newInvoice')}
            </Button>
          </div>
        ) : (
          <InvoicesTable invoices={invoices} onRefresh={fetchInvoices} />
        )}
      </section>
    </main>
  );
}
