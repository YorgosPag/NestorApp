'use client';

import { useState, useMemo } from 'react';
import { Users2, Search } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { useSupplierComparison } from '@/hooks/procurement/useSupplierMetrics';
import { VendorCard, type VendorCardData } from '@/components/procurement/vendors/VendorCard';
import type { Contact } from '@/types/contacts';

// ============================================================================
// LOADING SKELETON
// ============================================================================

function VendorGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-lg" />
      ))}
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function VendorsPage() {
  const { t } = useTranslation('procurement');
  const [search, setSearch] = useState('');

  const { suppliers, loading: contactsLoading } = usePOSupplierContacts();
  const { comparison, isLoading: metricsLoading } = useSupplierComparison();

  const isLoading = contactsLoading || metricsLoading;

  // Merge contacts (master list) with metrics (KPI data per vendor with POs)
  const metricsById = useMemo(() => {
    if (!comparison) return new Map();
    return new Map(comparison.suppliers.map((m) => [m.supplierId, m]));
  }, [comparison]);

  const vendorCards: VendorCardData[] = useMemo(() => {
    return suppliers.map((contact: Contact) => ({
      contact,
      metrics: contact.id ? (metricsById.get(contact.id) ?? null) : null,
    }));
  }, [suppliers, metricsById]);

  // Client-side search by vendor name
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendorCards;
    return vendorCards.filter((v) => {
      const name = (v.contact.displayName ?? v.contact.companyName ?? '').toLowerCase();
      return name.includes(q);
    });
  }, [vendorCards, search]);

  return (
    <PageContainer ariaLabel={t('hub.vendorMaster.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Users2 className="h-6 w-6 text-green-600" aria-hidden />
            <h1 className="text-xl font-semibold">{t('hub.vendorMaster.title')}</h1>
            {!isLoading && (
              <Badge variant="secondary">
                {t('hub.vendorMaster.supplierCount', { count: suppliers.length })}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            {t('hub.vendorMaster.description')}
          </p>
        </header>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder={t('hub.vendorMaster.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('hub.vendorMaster.searchPlaceholder')}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <VendorGridSkeleton />
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users2 className="h-12 w-12 text-muted-foreground opacity-40" aria-hidden />
            <p className="text-muted-foreground">{t('hub.vendorMaster.noVendorsYet')}</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('hub.vendorMaster.addVendorHint')}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {t('hub.vendorMaster.emptySearch')}
          </p>
        ) : (
          <section
            aria-label={t('hub.vendorMaster.title')}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {filtered.map((v, idx) => (
              <VendorCard key={v.contact.id ?? idx} data={v} />
            ))}
          </section>
        )}
      </div>
    </PageContainer>
  );
}
