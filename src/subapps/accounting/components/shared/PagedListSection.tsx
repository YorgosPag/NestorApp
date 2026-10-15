'use client';

/**
 * @fileoverview PagedListSection — οι τέσσερις καταστάσεις μιας λίστας με δρομέα, μία φορά (ADR-ACC-010 §2.1.1 Φάση 3β)
 * @description Φόρτωση → σφάλμα (ρητό, με «ξαναδοκιμή») → κενό → γραμμές + `PagedListFooter`. Ήταν η ίδια αλυσίδα
 *   τριαδικών σε ημερολόγιο / τιμολόγια / τράπεζα / πάγια· εδώ ζει μία φορά, και καμία σελίδα δεν μπορεί πια να
 *   δείξει «κενή λίστα» όταν η ανάγνωση απέτυχε.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML, i18n (N.11)
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

import { PageLoadingState, PageErrorState } from '@/core/states';
import type { UseCursorPagedListReturn } from '@/hooks/useCursorPagedList';

import { PagedListFooter, pagedListErrorKey } from './PagedListFooter';

interface PagedListSectionProps<T> {
  readonly list: UseCursorPagedListReturn<T>;
  readonly icon: LucideIcon;
  /** Κλειδί i18n (namespace `accounting`) του μηνύματος φόρτωσης. */
  readonly loadingKey: string;
  /** Κλειδί i18n (namespace `accounting`) του τίτλου σφάλματος. */
  readonly loadErrorKey: string;
  /** Τι δείχνεται όταν η λίστα είναι ΟΝΤΩΣ κενή (απάντησε ο διακομιστής, μηδέν γραμμές). */
  readonly empty: ReactNode;
  readonly children: (items: T[]) => ReactNode;
}

export function PagedListSection<T>({ list, icon, loadingKey, loadErrorKey, empty, children }: PagedListSectionProps<T>) {
  const { t } = useTranslation('accounting');
  const { items, loading, loadingMore, error, hasMore, loadMore, refetch } = list;

  if (loading && items.length === 0) {
    return <PageLoadingState icon={icon} message={t(loadingKey)} layout="contained" />;
  }
  // Σφάλμα ΧΩΡΙΣ γραμμές = απέτυχε η πρώτη σελίδα. Σφάλμα ΜΕ γραμμές = απέτυχε η επόμενη: φαίνεται στο υποσέλιδο.
  if (error && items.length === 0) {
    return (
      <PageErrorState
        title={t(loadErrorKey)}
        message={t(pagedListErrorKey(error))}
        onRetry={() => void refetch()}
        retryLabel={t('common.retry')}
        layout="contained"
      />
    );
  }
  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      {children(items)}
      <PagedListFooter
        shownCount={items.length}
        hasMore={hasMore}
        loadingMore={loadingMore}
        error={error}
        onLoadMore={() => void loadMore()}
      />
    </>
  );
}
