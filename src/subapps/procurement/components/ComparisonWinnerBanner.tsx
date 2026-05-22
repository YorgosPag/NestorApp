'use client';

/**
 * Winner banner shown in the Comparison tab after award is committed.
 * Contains: winner name + total, "Notify vendors" CTA, "Create PO" CTA.
 * §5.F.6 + §5.V.1 (Phase 12).
 *
 * @module subapps/procurement/components/ComparisonWinnerBanner
 * @see ADR-328 §5.V.1
 */

import { CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { Quote } from '@/subapps/procurement/types/quote';

// ============================================================================
// PROPS
// ============================================================================

interface ComparisonWinnerBannerProps {
  winnerQuote: Quote;
  allVendorNotified: boolean;
  onNotifyVendors: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ComparisonWinnerBanner({
  winnerQuote,
  allVendorNotified,
  onNotifyVendors,
}: ComparisonWinnerBannerProps) {
  const { t } = useTranslation('quotes');

  const vendorName = winnerQuote.extractedData?.vendorName?.value ?? '—';
  const total = winnerQuote.totals?.total ?? 0;

  return (
    <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--bg-success))]/40 bg-[hsl(var(--bg-success))]/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700" />
        <div>
          <p className="text-sm font-semibold">
            {t('rfqs.award.winnerBanner.title', { vendor: vendorName })}
          </p>
          <p className="text-xs text-muted-foreground">{formatCurrency(total)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onNotifyVendors}>
          <Mail className="mr-1 h-4 w-4" />
          {allVendorNotified
            ? t('rfqs.notify.triggerButtonResend')
            : t('rfqs.notify.triggerButton')}
        </Button>
        <Button size="sm" variant="outline" disabled>
          {t('rfqs.award.createPO')}
        </Button>
      </div>
    </div>
  );
}
