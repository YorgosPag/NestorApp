'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users2 } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { VendorList } from '@/components/procurement/vendors/VendorList';
import { VendorDetail } from '@/components/procurement/vendors/VendorDetail';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { useSupplierComparison } from '@/hooks/procurement/useSupplierMetrics';
import { getContactDisplayName } from '@/types/contacts';
import type { Contact } from '@/types/contacts';
import type { VendorCardData } from '@/components/procurement/vendors/VendorCard';

export default function VendorsPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');

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

  // ── Master-detail: URL-persistent selection ──────────────────────────────
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
    search,
    onSearchChange: setSearch,
    selectedVendorId,
    onSelectVendor: handleSelectVendor,
  };

  const rightPane = selectedVendor ? <VendorDetail data={selectedVendor} /> : null;

  return (
    <PageContainer ariaLabel={t('hub.vendorMaster.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <ListContainer>
        <>
          {/* ── Desktop: split list + detail ───────────────────────────────── */}
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

          {/* ── Mobile: list (hidden when vendor selected) ─────────────────── */}
          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${selectedVendor ? 'hidden' : 'block'}`}
            aria-label={t('hub.vendorMaster.title')}
          >
            <VendorList {...listProps} />
          </section>

          {/* ── Mobile: slide-in detail overlay ────────────────────────────── */}
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
