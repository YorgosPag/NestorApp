'use client';

/**
 * @fileoverview Invoices Page Content — Σελίδα Τιμολογίων
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel + InvoicesTable
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useMemo } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Receipt,
  CreditCard,
  Clock,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import type { InvoicePaymentStatus, InvoiceType } from '@/subapps/accounting/types';
import { useInvoices } from '../../hooks/useInvoices';
import { formatAccountingCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { PagedListSection } from '../shared/PagedListSection';
import { buildFiscalYearFilterField, currentFiscalYearValue } from '../shared/accounting-filter-fields';
import { AccountingListBody } from '../shared/AccountingListBody';
import { useAccountingFilterPanel } from '../../hooks/useAccountingFilterPanel';
import { InvoicesTable } from './InvoicesTable';
import { InvoiceDetails } from './details/InvoiceDetails';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

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
  fiscalYear: currentFiscalYearValue(),
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
          buildFiscalYearFilterField(),
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
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Detail view — ?view=invoiceId
  const viewInvoiceId = searchParams.get('view');

  const [showDashboard, setShowDashboard] = useState(true);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);
  const { filters, filterPanel } = useAccountingFilterPanel<InvoiceFilterState>(DEFAULT_FILTERS, filterConfig);

  const invoiceList = useInvoices({
    fiscalYear: Number(filters.fiscalYear),
    type: filters.type !== 'all' ? (filters.type as InvoiceType) : undefined,
    paymentStatus: filters.paymentStatus !== 'all' ? (filters.paymentStatus as InvoicePaymentStatus) : undefined,
  });
  const { items: invoices, loading, refetch } = invoiceList;

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
        value: formatAccountingCurrency(unpaidBalance),
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

  // ── Detail View ──────────────────────────────────────────────────────────
  if (viewInvoiceId) {
    return (
      <main className="min-h-screen bg-background p-6">
        <InvoiceDetails
          invoiceId={viewInvoiceId}
          onBack={() => router.push('/accounting/invoices')}
        />
      </main>
    );
  }

  // ── List View ──────────────────────────────────────────────────────────
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

      <AccountingListBody
        showDashboard={showDashboard}
        stats={dashboardStats}
        filterPanel={filterPanel}
      >
        <PagedListSection
          list={invoiceList}
          icon={Receipt}
          loadingKey="invoices.loading"
          loadErrorKey="invoices.loadError"
          empty={
            <div className="text-center py-12">
              <p className="text-lg font-medium text-foreground mb-1">{t('invoices.noInvoices')}</p>
              <p className={cn("mb-4", colors.text.muted)}>{t('invoices.noInvoicesDescription')}</p>
              <Button onClick={() => router.push('/accounting/invoices/new')}>
                <Plus className="mr-2 h-4 w-4" />
                {t('invoices.newInvoice')}
              </Button>
            </div>
          }
        >
          {(items) => <InvoicesTable invoices={items} onRefresh={refetch} />}
        </PagedListSection>
      </AccountingListBody>
    </main>
  );
}
