'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import type { Invoice, InvoiceType } from '@/subapps/accounting/types';
import { InvoicesTable } from './InvoicesTable';
import { InvoiceFilters } from './InvoiceFilters';

interface InvoiceFilterState {
  fiscalYear: number;
  type: InvoiceType | '';
  paymentStatus: '' | 'unpaid' | 'partial' | 'paid';
}

export function InvoicesPageContent() {
  const { t } = useTranslation('accounting');
  const router = useRouter();
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFilterState>({
    fiscalYear: new Date().getFullYear(),
    type: '',
    paymentStatus: '',
  });

  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      params.set('fiscalYear', String(filters.fiscalYear));
      if (filters.type) params.set('type', filters.type);
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);

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

  const handleFilterChange = useCallback((partial: Partial<InvoiceFilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('invoices.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('invoices.description')}</p>
          </div>
          <Button onClick={() => router.push('/accounting/invoices/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('invoices.newInvoice')}
          </Button>
        </div>
        <InvoiceFilters filters={filters} onFilterChange={handleFilterChange} />
      </header>

      <section className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" onClick={fetchInvoices}>
              {t('invoices.actions')}
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
