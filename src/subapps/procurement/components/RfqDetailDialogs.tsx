'use client';

import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AwardReasonDialog } from '@/subapps/procurement/components/AwardReasonDialog';
import { QuoteRevisionDetectedDialog } from '@/subapps/procurement/components/QuoteRevisionDetectedDialog';
import { ExpiredAwardWarningDialog } from '@/subapps/procurement/components/ExpiredAwardWarningDialog';
import { QuoteRenewalRequestDialog } from '@/subapps/procurement/components/QuoteRenewalRequestDialog';
import { VendorNotificationDialog } from '@/subapps/procurement/components/VendorNotificationDialog';
import { RfqCancelDialog } from '@/subapps/procurement/components/RfqCancelDialog';
import { formatValidUntilDate, daysUntilExpiry } from '@/subapps/procurement/utils/quote-expiration';
import type { Quote } from '@/subapps/procurement/types/quote';
import type { RFQ, RfqCancellationReason } from '@/subapps/procurement/types/rfq';
import type { QuoteComparisonEntry } from '@/subapps/procurement/types/comparison';

interface RfqDetailDialogsProps {
  rfqId: string;
  rfq: RFQ | null;
  activeQuotes: Quote[];
  quotes: Quote[];
  pendingEntry: QuoteComparisonEntry | null;
  cheapestEntry: QuoteComparisonEntry | null;
  pendingExpiredEntry: { quoteId: string; vendorName: string } | null;
  pendingExpiredQuote: Quote | null;
  pendingDetection: {
    detection: Parameters<typeof QuoteRevisionDetectedDialog>[0]['detection'];
    existingQuote: Parameters<typeof QuoteRevisionDetectedDialog>[0]['existingQuote'];
    newQuote: Parameters<typeof QuoteRevisionDetectedDialog>[0]['newQuote'];
  } | null;
  renewalQuote: Quote | null;
  notifyDialogOpen: boolean;
  cancelDialogOpen: boolean;
  setNotifyDialogOpen: (open: boolean) => void;
  setRenewalQuoteId: (id: string | null) => void;
  handleDialogConfirm: (category: string, note: string) => Promise<void>;
  handleDialogCancel: () => void;
  handleExpiredDialogAction: (action: string) => void;
  dismissDetection: () => void;
  onCancelConfirm: (payload: {
    reason: RfqCancellationReason | null;
    detail: string | null;
    notifyVendors: boolean;
  }) => Promise<void>;
  onCancelDialogClose: () => void;
}

export function RfqDetailDialogs(p: RfqDetailDialogsProps) {
  const { t } = useTranslation('quotes');
  return (
    <>
      <AwardReasonDialog
        open={!!p.pendingEntry}
        entry={p.pendingEntry}
        cheapestEntry={p.cheapestEntry}
        onConfirm={p.handleDialogConfirm}
        onCancel={p.handleDialogCancel}
      />
      {p.pendingDetection && (
        <QuoteRevisionDetectedDialog
          open
          detection={p.pendingDetection.detection}
          existingQuote={p.pendingDetection.existingQuote}
          newQuote={p.pendingDetection.newQuote}
          onConfirm={p.dismissDetection}
          onCancel={p.dismissDetection}
        />
      )}
      {p.pendingExpiredEntry && (
        <ExpiredAwardWarningDialog
          open
          vendorName={p.pendingExpiredEntry.vendorName}
          validUntilDate={p.pendingExpiredQuote ? formatValidUntilDate(p.pendingExpiredQuote) : ''}
          daysAgo={p.pendingExpiredQuote ? Math.abs(daysUntilExpiry(p.pendingExpiredQuote) ?? 0) : 0}
          onAction={(action) => {
            if (action === 'request_renewal' && p.pendingExpiredQuote) {
              p.setRenewalQuoteId(p.pendingExpiredQuote.id);
            }
            p.handleExpiredDialogAction(action);
          }}
        />
      )}
      {p.renewalQuote && (
        <QuoteRenewalRequestDialog
          open
          vendorEmail={p.renewalQuote.extractedData?.vendorEmails?.value?.[0] ?? ''}
          vendorName={p.renewalQuote.extractedData?.vendorName?.value ?? p.renewalQuote.vendorContactId}
          rfqTitle={p.rfq?.title ?? p.rfqId}
          quoteNumber={p.renewalQuote.displayNumber}
          validUntilDate={formatValidUntilDate(p.renewalQuote)}
          total={String(p.renewalQuote.totals?.total ?? '')}
          senderName=""
          onSend={async (to, subject, body) => {
            if (!p.renewalQuote) return;
            const res = await fetch(`/api/quotes/${p.renewalQuote.id}/request-renewal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to, subject, body }),
            });
            if (!res.ok) { toast.error(t('quotes.errors.updateFailed')); return; }
            p.setRenewalQuoteId(null);
          }}
          onCancel={() => p.setRenewalQuoteId(null)}
        />
      )}
      <VendorNotificationDialog
        open={p.notifyDialogOpen}
        rfq={p.rfq}
        quotes={p.activeQuotes}
        senderName=""
        companyName=""
        onOpenChange={p.setNotifyDialogOpen}
      />
      <RfqCancelDialog
        open={p.cancelDialogOpen}
        rfqStatus={p.rfq?.status ?? null}
        hasInvitedVendors={(p.rfq?.invitedVendorIds?.length ?? 0) > 0}
        onConfirm={p.onCancelConfirm}
        onCancel={p.onCancelDialogClose}
      />
    </>
  );
}
