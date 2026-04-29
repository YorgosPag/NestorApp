'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AlertTriangle } from 'lucide-react';
import { useVendorQuotes } from '@/hooks/procurement/useVendorQuotes';
import { useVendorPurchaseOrders } from '@/hooks/procurement/useVendorPurchaseOrders';
import { useVendorRfqInvites } from '@/hooks/procurement/useVendorRfqInvites';
import { useSupplierMetricsForContact } from '@/hooks/procurement/useSupplierMetricsForContact';
import { SupplierMetricsCard } from '@/components/procurement/SupplierMetricsCard';
import { ManualQuoteDialog } from '@/subapps/procurement/components/ManualQuoteDialog';
import { ProcurementContactTabHeader } from './ProcurementContactTabHeader';
import { ProcurementContactTabSkeleton } from './ProcurementContactTabSkeleton';
import { ProcurementContactTabEmptyState } from './ProcurementContactTabEmptyState';
import { ContactQuotesSection } from './ContactQuotesSection';
import { ContactRfqInvitesSection } from './ContactRfqInvitesSection';
import { ContactPurchaseOrdersSection } from './ContactPurchaseOrdersSection';

interface ProcurementContactTabProps {
  contactId: string;
  contactType: 'individual' | 'company';
  archived: boolean;
}

export function ProcurementContactTab({
  contactId,
  archived,
}: ProcurementContactTabProps) {
  const { t } = useTranslation('contacts');
  const router = useRouter();
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);

  const handleCreateRfq = useCallback(() => {
    router.push(`/procurement/rfqs/new?vendorContactId=${encodeURIComponent(contactId)}`);
  }, [contactId, router]);

  const { quotes, loading: quotesLoading, error: quotesError } = useVendorQuotes(contactId);
  const { invites, loading: invitesLoading, error: invitesError } =
    useVendorRfqInvites(contactId);
  const { purchaseOrders, loading: poLoading, error: poError } =
    useVendorPurchaseOrders(contactId);
  const { metrics, loading: metricsLoading } = useSupplierMetricsForContact(contactId);

  const allLoading = quotesLoading && invitesLoading && poLoading && metricsLoading;
  if (allLoading) {
    return <ProcurementContactTabSkeleton />;
  }

  const allEmpty =
    !quotesLoading &&
    !invitesLoading &&
    !poLoading &&
    quotes.length === 0 &&
    invites.length === 0 &&
    purchaseOrders.filter((po) => !po.isDeleted).length === 0;

  if (allEmpty) {
    return (
      <>
        <ProcurementContactTabEmptyState
          contactId={contactId}
          archived={archived}
          onCreateManual={() => setQuoteDialogOpen(true)}
        />
        <ManualQuoteDialog
          open={quoteDialogOpen}
          onOpenChange={setQuoteDialogOpen}
          vendorContactId={contactId}
        />
      </>
    );
  }

  const errorMessage = pickErrorMessage(quotesError, invitesError, poError, t);

  return (
    <div className="space-y-4">
      {archived && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {t('procurementTab.archived.banner')}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {errorMessage}
        </div>
      )}

      <ProcurementContactTabHeader
        quotes={quotes}
        invites={invites}
        purchaseOrders={purchaseOrders}
      />

      {metrics && metrics.totalOrders > 0 && <SupplierMetricsCard metrics={metrics} />}

      <ManualQuoteDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        vendorContactId={contactId}
      />
      <ContactQuotesSection
        quotes={quotes}
        loading={quotesLoading}
        archived={archived}
        contactId={contactId}
        onCreateManual={() => setQuoteDialogOpen(true)}
      />

      <ContactRfqInvitesSection
        invites={invites}
        loading={invitesLoading}
        onCreateRfq={handleCreateRfq}
      />

      <ContactPurchaseOrdersSection purchaseOrders={purchaseOrders} loading={poLoading} />
    </div>
  );
}

function pickErrorMessage(
  quotesError: string | null,
  invitesError: string | null,
  poError: string | null,
  t: (key: string) => string,
): string | null {
  const first = quotesError ?? invitesError ?? poError;
  if (!first) return null;
  if (/forbidden|unauthorized/i.test(first)) {
    return t('procurementTab.error.permissionDenied');
  }
  return t('procurementTab.error.generic');
}
