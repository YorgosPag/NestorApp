'use client';

/**
 * useQuoteDetailActions — η σύνδεση του `QuoteRightPane` για μια **μεμονωμένη** προσφορά (χωρίς RFQ ανάθεσης):
 * ενέργειες κεφαλίδας (`buildQuoteHeaderActions`) + αλλαγή κατάστασης (`usePatchQuoteStatus`) + PDF/σχόλια.
 *
 * Μοιράζεται από το κέντρο προσφορών (`procurement/quotes`) και τη σελίδα της προσφοράς (`quotes/[id]/review`,
 * ADR-327 §6.10). Το `RfqDetailClient` μένει χωριστά επίτηδες: εκεί η «Έγκριση» είναι **ανάθεση** με σύγκριση.
 */

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useConnectivity } from '@/hooks/useConnectivity';
import type { Quote } from '../types/quote';
import { buildQuoteHeaderActions, type QuoteHeaderActionsResult } from '../utils/quote-header-actions';
import { usePatchQuoteStatus } from './usePatchQuoteStatus';

export interface UseQuoteDetailActionsOptions {
  /** Μετά από επιτυχή αλλαγή κατάστασης (π.χ. `refetch`). */
  onStatusChanged?: () => void | Promise<void>;
  /** «Διαγραφή» από το μενού — ο καλών αποφασίζει τι σημαίνει (αρχειοθέτηση + πλοήγηση). */
  onDelete: () => void;
}

export interface UseQuoteDetailActionsResult extends QuoteHeaderActionsResult {
  pdfOpen: boolean;
  commentsOpen: boolean;
  togglePdf: () => void;
  toggleComments: () => void;
  /** Ενέργειες που δεν υλοποιήθηκαν ακόμη — ΕΝΑ μήνυμα «σύντομα». */
  notYetAvailable: () => void;
}

export function useQuoteDetailActions(
  quote: Quote | null,
  { onStatusChanged, onDelete }: UseQuoteDetailActionsOptions,
): UseQuoteDetailActionsResult {
  const { t } = useTranslation('quotes');
  const isConnected = useConnectivity();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const togglePdf = useCallback(() => setPdfOpen((v) => !v), []);
  const toggleComments = useCallback(() => setCommentsOpen((v) => !v), []);
  const notYetAvailable = useCallback(() => void toast.info(t('rfqs.quoteHeader.tooltip.comingSoon')), [t]);
  const patchStatus = usePatchQuoteStatus(quote, t, onStatusChanged);

  const actions = useMemo(
    () => quote
      ? buildQuoteHeaderActions({
          quote,
          rfq: null,
          onConfirm: () => void patchStatus('under_review'),
          onApprove: () => void patchStatus('accepted'),
          onReject: () => void patchStatus('rejected'),
          onRestore: () => void patchStatus('submitted'),
          onCreatePo: notYetAvailable,
          onViewPo: notYetAvailable,
          onDownload: togglePdf,
          onOpenComments: toggleComments,
          onEdit: notYetAvailable,
          onDuplicate: notYetAvailable,
          onDelete,
          t,
          isConnected,
        })
      : { primaryActions: [], secondaryActions: [], overflowActions: [] },
    [quote, patchStatus, notYetAvailable, togglePdf, toggleComments, onDelete, t, isConnected],
  );

  return { ...actions, pdfOpen, commentsOpen, togglePdf, toggleComments, notYetAvailable };
}
