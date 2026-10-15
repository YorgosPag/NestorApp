'use client';

/**
 * @fileoverview PagedListFooter — «φόρτωση περισσότερων» κάτω από μια λίστα με δρομέα (ADR-ACC-010 §2.1.1 Φάση 3β)
 * @description Κοινό για ημερολόγιο / τιμολόγια / τράπεζα / πάγια. Δείχνει πόσες εγγραφές φαίνονται, το κουμπί
 *   επόμενης σελίδας, και — αν απέτυχε η επόμενη σελίδα — ρητό μήνυμα (η λίστα που ήδη φαίνεται μένει).
 *   Μαζί του το `pagedListErrorKey`: κωδικός διακομιστή → κλειδί i18n, ποτέ το τεχνικό μήνυμα στην οθόνη.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML, i18n (N.11)
 */

import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PagedListError } from '@/hooks/useCursorPagedList';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

/** Κωδικός άρνησης διακομιστή → κλειδί μηνύματος (`accounting:common.pagedList.errors.*`). */
export function pagedListErrorKey(error: PagedListError): string {
  switch (error.code) {
    case 'INVALID_PAGE_TOKEN':
      return 'common.pagedList.errors.invalidPageToken';
    case 'UNSUPPORTED_LIST_FILTER':
      return 'common.pagedList.errors.unsupportedFilter';
    default:
      return 'common.pagedList.errors.generic';
  }
}

interface PagedListFooterProps {
  readonly shownCount: number;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  /** Σφάλμα της ΕΠΟΜΕΝΗΣ σελίδας (η πρώτη έχει δική της κατάσταση σφάλματος στη σελίδα). */
  readonly error: PagedListError | null;
  readonly onLoadMore: () => void;
}

export function PagedListFooter({ shownCount, hasMore, loadingMore, error, onLoadMore }: PagedListFooterProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();

  return (
    <footer className="flex flex-col items-center gap-2 pt-4">
      <p className={cn('text-sm', colors.text.muted)}>{t('common.pagedList.shown', { count: shownCount })}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('common.pagedList.loadMoreFailed')} {t(pagedListErrorKey(error))}
        </p>
      )}
      {hasMore && (
        <Button variant="outline" onClick={onLoadMore} disabled={loadingMore} aria-busy={loadingMore}>
          {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {loadingMore ? t('common.pagedList.loadingMore') : t('common.pagedList.loadMore')}
        </Button>
      )}
    </footer>
  );
}
