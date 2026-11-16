'use client';

/**
 * ADR-942 Φ1 — **«Έγγραφα για την έκδοση»** στον χώρο του μηχανικού: ζητά από το γραφείο ό,τι λείπει, ένα ένα ή «όλα
 * τα ελλείποντα» με **ένα** αίτημα (μία ειδοποίηση στο γραφείο).
 *
 * Ο παραλήπτης δεν διαλέγεται: είναι **πάντα** το γραφείο της ανάθεσης (Α29). Ό,τι υπάρχει ήδη στον φάκελο του κατόχου
 * δεν ζητείται — φαίνεται «Υπάρχει στον φάκελο». Ό,τι του **δόθηκε** το ανοίγει/κατεβάζει εδώ (ADR-942 Φ2).
 *
 * @module components/conveyance/my-cases/EngagedIssuanceDocumentRequests
 */

import React, { useCallback, useMemo, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCaseFileOpening } from '@/components/conveyance/shared/CaseFileOpening';
import { IssuanceDocumentRequestList } from '@/components/document-registry/IssuanceDocumentRequestList';
import { ISSUANCE_REQUEST_KEYS } from '@/components/document-registry/issuance-request-labels';
import { useDocumentRequestSend } from '@/hooks/document-requests/useDocumentRequestSend';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuanceRequestableNow } from '@/lib/document-requests/issuance-request-policy';
import { cn } from '@/lib/utils';
import { requestIssuanceDocumentsRequest } from '@/services/conveyance/conveyance-document-request-gateway';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { IssuanceDocumentRequests, IssuancePendingRequest, IssuanceRequestItemView } from '@/types/issuance-document-request';
import { GivenFilesAccessNote, GivenFilesEngaged } from './EngagedIssuanceGivenFiles';

interface Props {
  readonly engagementId: string;
  readonly panel: IssuanceDocumentRequests;
  readonly onChanged: () => void;
}

/** «Ζήτησε από το γραφείο» — ή το «γιατί όχι» όταν δεν υπάρχει παραλήπτης. Τίποτα όταν υπάρχει ήδη. */
function RequestAction({ item, pending, panel, busy, onRequest }: {
  readonly item: IssuanceRequestItemView;
  readonly pending: IssuancePendingRequest | null;
  readonly panel: IssuanceDocumentRequests;
  readonly busy: boolean;
  readonly onRequest: () => void;
}) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const target = panel.targets[item.itemId];
  if (!target) return null;
  if (!target.ok) {
    return target.refusal === 'no-recipient' ? <p className={cn('text-xs', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.noRecipient)}</p> : null;
  }
  const requestedToday = pending?.requestedTodayByViewer ?? false;
  const label = busy ? t(ISSUANCE_REQUEST_KEYS.requesting) : requestedToday ? t(ISSUANCE_REQUEST_KEYS.requestedToday) : t(ISSUANCE_REQUEST_KEYS.request);
  return (
    <Button variant="outline" size="sm" className="gap-1" disabled={busy || requestedToday} aria-busy={busy} onClick={onRequest}>
      {busy ? <Loader2 className={cn(iconSizes.xs, 'animate-spin')} aria-hidden="true" /> : <BellRing className={iconSizes.xs} aria-hidden="true" />}
      {label}
    </Button>
  );
}

/** «Ζήτησε όλα τα ελλείποντα (N)» — μόνο από 2 και πάνω, με επιβεβαίωση. */
function RequestAllBar({ count, onConfirm }: { readonly count: number; readonly onConfirm: () => void }) {
  const { t } = useTranslation(['document-registry']);
  const iconSizes = useIconSizes();
  const [open, setOpen] = useState(false);
  if (count < 2) return null;
  return (
    <footer className="flex justify-end">
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
        <BellRing className={iconSizes.xs} aria-hidden="true" />
        {t(ISSUANCE_REQUEST_KEYS.requestAll, { count })}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t(ISSUANCE_REQUEST_KEYS.requestAllTitle)}
        description={t(ISSUANCE_REQUEST_KEYS.requestAllDescription, { count })}
        confirmText={t(ISSUANCE_REQUEST_KEYS.requestAllConfirm)}
        cancelText={t(ISSUANCE_REQUEST_KEYS.requestAllCancel)}
        onConfirm={() => { setOpen(false); onConfirm(); }}
      />
    </footer>
  );
}

export function EngagedIssuanceDocumentRequests({ engagementId, panel, onChanged }: Props) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const post = useCallback((itemIds: readonly string[]) => requestIssuanceDocumentsRequest(engagementId, itemIds), [engagementId]);
  const { log, requestingIds, send } = useDocumentRequestSend(post, panel.log, panel.today, onChanged);
  const requestable = useMemo(() => issuanceRequestableNow(panel.items, panel.targets, log, panel.today), [panel.items, panel.targets, log, panel.today]);
  const fileTarget = useMemo(() => ({ kind: 'engagement' as const, engagementId }), [engagementId]);
  const { openFile, previewDialog } = useCaseFileOpening(fileTarget);
  return (
    <Card asChild className="space-y-4 p-4">
      <section aria-labelledby="issuance-requests-title">
        <header className="space-y-1">
          <h2 id="issuance-requests-title" className="text-sm font-semibold">{t(ISSUANCE_REQUEST_KEYS.title)}</h2>
          <p className={cn('text-xs', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.leadEngaged)}</p>
          <GivenFilesAccessNote access={panel.access} />
        </header>
        <IssuanceDocumentRequestList
          panel={panel}
          log={log}
          action={(item, pending) => (
            <RequestAction item={item} pending={pending} panel={panel} busy={requestingIds.has(item.itemId)} onRequest={() => { void send([item.itemId]); }} />
          )}
          files={(item) => <GivenFilesEngaged item={item} openFile={openFile} />}
        />
        {previewDialog}
        <RequestAllBar count={requestable.length} onConfirm={() => { void send(requestable.map((item) => item.itemId)); }} />
      </section>
    </Card>
  );
}

/** «Δεν φορτώθηκαν» — ποτέ μισή λίστα που μοιάζει πλήρης. */
export function EngagedIssuanceDocumentRequestsUnknown() {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  return (
    <Card asChild className="p-4">
      <section aria-label={t(ISSUANCE_REQUEST_KEYS.title)}>
        <p className={cn('text-xs', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.unknown)}</p>
      </section>
    </Card>
  );
}
