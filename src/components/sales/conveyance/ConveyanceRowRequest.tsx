'use client';

/**
 * ADR-901 Φ4.5 — το «Ζήτησε έγγραφο» μιας γραμμής καταλόγου: **ποιος** οφείλει το έγγραφο (Procore «Ball in Court»)
 * και το κουμπί που τον ειδοποιεί — για οικοδεσπότη **και** επαγγελματία, ίδιο component.
 *
 * Τίποτα δεν αποφασίζεται εδώ: ο παραλήπτης ή ο λόγος άρνησης έρχεται από τον **ίδιο** καθαρό κριτή που τρέχει ο
 * server (`document-request-policy.ts`) — ο άνθρωπος βλέπει **πριν** το πάτημα σε ποιον θα πάει, ή γιατί δεν γίνεται.
 * Το «Εκκρεμεί από» **παράγεται** (Α31): σβήνει μόνο του όταν φτάσει το έγγραφο.
 * Π1: όταν ζητήθηκε **από εμένα**, η γραμμή λέει «Σας ζητήθηκε από: X» (όχι «Εκκρεμεί από: <ο ρόλος μου>»)· σε έγγραφο
 * που στέλνω **εκ μέρους** του εντολέα μου (Π2), και το «πώς»: συλλέξτε το από τον εντολέα και στείλτε το.
 *
 * @module components/sales/conveyance/ConveyanceRowRequest
 */

import React from 'react';
import { BellRing, Hourglass, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { sentOnBehalf } from '@/lib/conveyance/contribution-audience';
import type { ChecklistRow } from '@/types/conveyance-case';
import type { DocumentRequestTarget, PendingDocumentRequest } from '@/types/conveyance-document-request';

/** Οι ενέργειες αιτήματος μιας όψης — απούσες ⇒ η γραμμή δεν προσφέρει «Ζήτησε» (π.χ. χωρίς δικαίωμα διαχείρισης). */
export interface RowRequest {
  /** Σε ποιον θα πήγαινε τώρα το αίτημα — `null` ⇒ η γραμμή δεν οφείλεται (τίποτα να ζητηθεί). */
  readonly targetOf: (row: ChecklistRow) => DocumentRequestTarget | null;
  readonly pendingOf: (row: ChecklistRow) => PendingDocumentRequest | null;
  readonly requestingIds: ReadonlySet<string>;
  readonly onRequest: (row: ChecklistRow) => void;
}

/** «Εκκρεμεί από: Συμβολαιογράφος · ζητήθηκε 3/10» — ή, προς εμένα, «Σας ζητήθηκε από: Υπεύθυνος υπόθεσης · 3/10». */
function PendingLine({ row, pending }: { readonly row: ChecklistRow; readonly pending: PendingDocumentRequest }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const date = formatDate(pending.lastRequestedAt);
  const askedBy = pending.askedOfViewerBy;
  return (
    <p className={cn('flex flex-wrap items-center gap-1 text-xs', colors.text.warning)}>
      <Hourglass className={iconSizes.xs} aria-hidden="true" />
      {askedBy === null
        ? t('requests.pending', { recipient: t(`engagement.roles.${pending.recipient}`), date })
        : t('requests.pendingToMe', { requester: t(`engagement.roles.${askedBy}`), date })}
      {askedBy !== null && sentOnBehalf(row.item) && <span className={colors.text.muted}>{t('requests.onBehalfHint')}</span>}
    </p>
  );
}

function RequestButton({ row, request, target, requestedToday }: {
  readonly row: ChecklistRow;
  readonly request: RowRequest;
  readonly target: Extract<DocumentRequestTarget, { ok: true }>;
  readonly requestedToday: boolean;
}) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const busy = request.requestingIds.has(row.itemId);
  const label = busy ? t('requests.requesting') : requestedToday ? t('requests.requestedToday') : t('requests.action', { recipient: t(`engagement.roles.${target.recipient}`) });
  return (
    <Button variant="outline" size="sm" className="gap-1" disabled={busy || requestedToday} aria-busy={busy} onClick={() => request.onRequest(row)}>
      {busy ? <Loader2 className={cn(iconSizes.xs, 'animate-spin')} aria-hidden="true" /> : <BellRing className={iconSizes.xs} aria-hidden="true" />}
      {label}
    </Button>
  );
}

/** Η ενέργεια της γραμμής: «Εκκρεμεί από» + «Ζήτησε από: X» — ή το «γιατί όχι» όταν δεν υπάρχει παραλήπτης. */
export function RowRequestAction({ row, request }: { readonly row: ChecklistRow; readonly request?: RowRequest }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  if (!request) return null;
  const target = request.targetOf(row);
  if (!target) return null;
  const pending = request.pendingOf(row);
  return (
    <>
      {pending && <PendingLine row={row} pending={pending} />}
      {target.ok && <RequestButton row={row} request={request} target={target} requestedToday={pending?.requestedTodayByViewer ?? false} />}
      {!target.ok && target.refusal === 'no-recipient' && <p className={cn('text-xs', colors.text.muted)}>{t('requests.noRecipient')}</p>}
    </>
  );
}
