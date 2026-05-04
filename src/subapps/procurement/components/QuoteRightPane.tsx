'use client';

/**
 * QuoteRightPane — ADR-328 §5.O
 *
 * Right pane content for a selected quote: header + summary + optional PDF preview.
 * Desktop: side-by-side split when pdfOpen. Mobile: Dialog modal when pdfOpen.
 * Extracted from RfqDetailClient to keep that file within the 500-line budget.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useIsMobile } from '@/hooks/useMobile';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { QuoteDetailsHeader } from './QuoteDetailsHeader';
import { QuoteDetailSummary } from './QuoteDetailSummary';
import { QuoteEditMode } from './QuoteEditMode';
import { QuoteOriginalDocumentPanel } from './QuoteOriginalDocumentPanel';
import type { Quote } from '../types/quote';
import type {
  QuoteHeaderPrimaryAction,
  QuoteHeaderSecondaryAction,
  QuoteHeaderOverflowAction,
} from '../utils/quote-header-actions';
import { QuoteCommentsDrawer } from './QuoteCommentsDrawer';

// ============================================================================
// PROPS
// ============================================================================

export interface QuoteRightPaneProps {
  quote: Quote;
  pdfOpen: boolean;
  commentsOpen: boolean;
  onTogglePdf: () => void;
  onToggleComments: () => void;
  onSelectQuote: (q: Quote | null) => void;
  onRequestRenewal: () => void;
  primaryActions: QuoteHeaderPrimaryAction[];
  secondaryActions: QuoteHeaderSecondaryAction[];
  overflowActions: QuoteHeaderOverflowAction[];
  onCreateNew?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuoteRightPane({
  quote,
  pdfOpen,
  commentsOpen,
  onTogglePdf,
  onToggleComments,
  onSelectQuote,
  onRequestRenewal,
  primaryActions,
  secondaryActions,
  overflowActions,
  onCreateNew,
}: QuoteRightPaneProps) {
  const { t } = useTranslation('quotes');
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';
  const isMobile = useIsMobile();
  const hasPdf = quote.source === 'scan' || quote.source === 'email_inbox';

  const [editMode, setEditMode] = useState(false);

  const editableOverflowActions = useMemo(
    () => overflowActions.filter((a) => a.id !== 'edit'),
    [overflowActions]
  );

  const headerPrimaryActions = useMemo(
    () => primaryActions.filter((a) => a.id !== 'edit'),
    [primaryActions]
  );

  return (
    <>
      <button
        type="button"
        className="md:hidden mb-2 flex items-center gap-2 text-sm font-medium"
        onClick={() => onSelectQuote(null)}
        aria-label={t('rfqs.mobile.backToList')}
      >
        <ArrowLeft className="size-4" />
        {t('rfqs.mobile.backToList')}
      </button>

      <QuoteDetailsHeader
        quote={quote}
        onCreateNew={onCreateNew}
        onEdit={() => setEditMode(true)}
        onRequestRenewal={onRequestRenewal}
        primaryActions={headerPrimaryActions}
        secondaryActions={secondaryActions}
        overflowActions={editableOverflowActions}
        pdfOpen={pdfOpen}
        onTogglePdf={onTogglePdf}
        hasPdf={hasPdf}
      />

      {editMode ? (
        <QuoteEditMode
          quote={quote}
          onCancel={() => setEditMode(false)}
          onSaved={() => setEditMode(false)}
        />
      ) : (
        /* Desktop split: PDF left, summary right */
        <div className={cn('mt-2', pdfOpen && !isMobile && 'grid grid-cols-2 gap-3')}>
          {pdfOpen && !isMobile && (
            <QuoteOriginalDocumentPanel quoteId={quote.id} companyId={companyId} sticky />
          )}
          <QuoteDetailSummary quote={quote} />
        </div>
      )}

      {/* Mobile modal */}
      {isMobile && (
        <Dialog open={pdfOpen} onOpenChange={(open) => { if (!open) onTogglePdf(); }}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto p-4">
            <DialogTitle className="sr-only">{t('rfqs.pdfPanel.closeAria')}</DialogTitle>
            <QuoteOriginalDocumentPanel quoteId={quote.id} companyId={companyId} />
          </DialogContent>
        </Dialog>
      )}

      <QuoteCommentsDrawer
        quoteId={quote.id}
        open={commentsOpen}
        onClose={onToggleComments}
      />
    </>
  );
}
