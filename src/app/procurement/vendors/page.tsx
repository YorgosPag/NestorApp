'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users2, PackageCheck, DollarSign, TrendingUp, Star } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { VendorList } from '@/components/procurement/vendors/VendorList';
import { VendorDetail } from '@/components/procurement/vendors/VendorDetail';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { useSupplierComparison } from '@/hooks/procurement/useSupplierMetrics';
import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency } from '@/lib/intl-formatting';
import type { Contact } from '@/types/contacts';
import type { ViewMode } from '@/core/headers';
import type { VendorCardData } from '@/components/procurement/vendors/VendorCard';

export default function VendorsPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  const { suppliers, loading: contactsLoading } = usePOSupplierContacts();
  const { comparison, isLoading: metricsLoading } = useSupplierComparison();

  const isLoading = contactsLoading || metricsLoading;

  const metricsById = useMemo(() => {
    if (!comparison) return new Map();
    return new Map(comparison.suppliers.map((m) => [m.supplierId, m]));
  }, [comparison]);

  const vendorCards: VendorCardData[] = useMemo(
    () =>
      suppliers.map((contact: Contact) => ({
        contact,
        metrics: contact.id ? (metricsById.get(contact.id) ?? null) : null,
      })),
    [suppliers, metricsById],
  );

  const dashboardStats = useMemo(() => {
    const totalVendors = vendorCards.length;
    const activeVendors = vendorCards.filter((v) => (v.metrics?.totalOrders ?? 0) > 0).length;
    const totalSpend = vendorCards.reduce((sum, v) => sum + (v.metrics?.totalSpend ?? 0), 0);
    const avgOnTime = comparison?.suppliers.length
      ? Math.round(
          comparison.suppliers.reduce((s, m) => s + m.onTimeDeliveryRate, 0) /
            comparison.suppliers.length,
        )
      : 0;
    return [
      { title: t('hub.vendorMaster.title'), value: totalVendors, icon: Users2, color: 'blue' as const },
      { title: t('hub.vendorMaster.statusBadge.active'), value: activeVendors, icon: Star, color: 'green' as const },
      { title: t('hub.vendorMaster.totalSpend'), value: formatCurrency(totalSpend), icon: DollarSign, color: 'purple' as const },
      { title: t('hub.vendorMaster.onTimeRate'), value: `${avgOnTime}%`, icon: TrendingUp, color: 'orange' as const },
      { title: t('hub.vendorMaster.detail.kpis.totalOrders'), value: comparison?.suppliers.reduce((s, m) => s + m.totalOrders, 0) ?? 0, icon: PackageCheck, color: 'cyan' as const },
    ];
  }, [vendorCards, comparison, t]);

  const selectedVendorId = searchParams.get('vendorId') ?? undefined;

  const selectedVendor = useMemo(
    () => vendorCards.find((v) => v.contact.id === selectedVendorId) ?? null,
    [vendorCards, selectedVendorId],
  );

  const handleSelectVendor = useCallback(
    (data: VendorCardData) => {
      const params = new URLSearchParams(searchParams.toString());
      if (data.contact.id) params.set('vendorId', data.contact.id);
      router.replace(`/procurement/vendors?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleDeselectVendor = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vendorId');
    router.replace(`/procurement/vendors?${params.toString()}`);
  }, [router, searchParams]);

  const listProps = {
    vendors: vendorCards,
    loading: isLoading,
    selectedVendorId,
    onSelectVendor: handleSelectVendor,
    viewMode,
  };

  const rightPane = selectedVendor ? <VendorDetail data={selectedVendor} /> : null;

  return (
    <PageContainer ariaLabel={t('hub.vendorMaster.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{
          icon: Users2,
          title: t('hub.vendorMaster.title'),
          subtitle: t('hub.vendorMaster.description'),
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard((v) => !v),
          viewMode: viewMode as ViewMode,
          onViewModeChange: (m) => setViewMode(m as 'list' | 'grid'),
          viewModes: ['list', 'grid'] as ViewMode[],
        }}
      />

      {showDashboard && (
        <section role="region" aria-label={t('hub.vendorMaster.title')}>
          <UnifiedDashboard stats={dashboardStats} columns={5} />
        </section>
      )}

      <ListContainer>
        <>
          <section
            className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
            aria-label={t('hub.vendorMaster.title')}
          >
            <VendorList {...listProps} />

            {rightPane ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-card border rounded-lg shadow-sm p-4">
                {rightPane}
              </div>
            ) : (
              <DetailsContainer
                emptyStateProps={{
                  icon: Users2,
                  title: t('hub.vendorMaster.detail.emptyTitle'),
                  description: t('hub.vendorMaster.detail.emptyDescription'),
                }}
              />
            )}
          </section>

          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${selectedVendor ? 'hidden' : 'block'}`}
            aria-label={t('hub.vendorMaster.title')}
          >
            <VendorList {...listProps} />
          </section>

          <MobileDetailsSlideIn
            isOpen={!!selectedVendor}
            onClose={handleDeselectVendor}
            title={selectedVendor ? getContactDisplayName(selectedVendor.contact) : ''}
          >
            {rightPane}
          </MobileDetailsSlideIn>
        </>
      </ListContainer>
    </PageContainer>
  );
}
