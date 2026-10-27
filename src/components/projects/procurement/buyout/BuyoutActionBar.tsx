'use client';

/**
 * Buyout action bar — closes the loop: the selected open work → ONE new request for quotation (ADR-330 §5.1 S3.2).
 *
 * Two guards the big players leave to the user:
 *   - the 30-item limit of `POST /api/rfqs/from-boq` is SAID before the click, never discovered as a 400;
 *   - work already out for quotes / being ordered is flagged, so a second RFQ for it is a decision, not an accident.
 */

import { AlertTriangle, Send, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRouter } from '@/lib/workspace/navigation';
import { Button } from '@/components/ui/button';
import { getNewRfqUrl } from '@/lib/navigation/procurement-urls';
import { RFQ_FROM_BOQ_MAX_ITEMS } from '@/subapps/procurement/types/rfq';

interface BuyoutActionBarProps {
  projectId: string;
  selectedIds: readonly string[];
  inProgressCount: number;
  onClear: () => void;
}

export function BuyoutActionBar({ projectId, selectedIds, inProgressCount, onClear }: BuyoutActionBarProps) {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  if (selectedIds.length === 0) return null;
  const excess = selectedIds.length - RFQ_FROM_BOQ_MAX_ITEMS;

  return (
    <aside
      aria-live="polite"
      className="sticky bottom-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3 shadow-md"
    >
      <p className="text-sm font-medium tabular-nums">{t('buyout.actions.selected', { count: selectedIds.length })}</p>
      {inProgressCount > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-warning))]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t('buyout.actions.inProgress', { count: inProgressCount })}
        </p>
      )}
      {excess > 0 && (
        <p className="text-xs text-destructive">{t('buyout.actions.limit', { max: RFQ_FROM_BOQ_MAX_ITEMS, excess })}</p>
      )}
      <span className="ml-auto flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" aria-hidden />
          {t('buyout.actions.clearSelection')}
        </Button>
        <Button size="sm" disabled={excess > 0} onClick={() => router.push(getNewRfqUrl(projectId, selectedIds))}>
          <Send className="mr-1 h-4 w-4" aria-hidden />
          {t('buyout.actions.createRfq')}
        </Button>
      </span>
    </aside>
  );
}
