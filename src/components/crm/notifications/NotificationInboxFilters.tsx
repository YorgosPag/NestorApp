'use client';

/**
 * @fileoverview **ΤΑ ΦΙΛΤΡΑ ΤΟΥ INBOX** — προβολή (Όλες / Μη αναγνωσμένες) και κατηγορία, με μετρητές.
 * @related ADR-927 · notification-inbox-model.ts (`categoryFacets`) · notification-inbox-url.ts
 * @module components/crm/notifications/NotificationInboxFilters
 *
 * Κουμπιά εναλλαγής (`aria-pressed`), όχι tabs: το φίλτρο **στενεύει** την ίδια λίστα, δεν αλλάζει πίνακα
 * (WAI-ARIA APG: tabs = εναλλαγή πινάκων). Ο μετρητής «μη αναγνωσμένες» ανά κατηγορία είναι το σήμα
 * «πού να κοιτάξω πρώτα» — όπως οι μετρητές ανά αποθετήριο του GitHub.
 */

import { ToggleButton } from '@/components/ui/toggle-button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  INBOX_VIEWS,
  type CategoryFacet,
  type InboxCategory,
  type InboxFilter,
  type InboxView,
} from '@/components/notifications/notification-inbox-model';
import { useCategoryPresenter } from './inbox-category-presentation';

export interface NotificationInboxFiltersProps {
  readonly filter: InboxFilter;
  readonly facets: readonly CategoryFacet[];
  readonly unreadTotal: number;
  readonly onChange: (next: InboxFilter) => void;
}

/** Πλήρη κλειδιά σε πίνακα — ο γεννήτορας του route slice (ADR-744) λύνει literals, όχι template strings. */
const VIEW_LABEL_KEYS: Readonly<Record<InboxView, string>> = {
  all: 'notifications.inbox.views.all',
  unread: 'notifications.inbox.views.unread',
};

interface ChipProps {
  readonly pressed: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function Chip({ pressed, onClick, children }: ChipProps) {
  return (
    <ToggleButton
      type="button"
      size="sm"
      variant="outline"
      pressed={pressed}
      onClick={onClick}
      className="gap-1.5 rounded-full"
    >
      {children}
    </ToggleButton>
  );
}

function Count({ value }: { readonly value: number }) {
  if (value === 0) return null;
  return <span className="tabular-nums opacity-80">{value}</span>;
}

export function NotificationInboxFilters({ filter, facets, unreadTotal, onChange }: NotificationInboxFiltersProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const present = useCategoryPresenter();
  const setCategory = (category: InboxCategory | null) => onChange({ ...filter, category });

  return (
    <nav aria-label={t('notifications.inbox.filterLabel')} className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2">
        {INBOX_VIEWS.map((view) => (
          <li key={view}>
            <Chip pressed={filter.view === view} onClick={() => onChange({ ...filter, view })}>
              {t(VIEW_LABEL_KEYS[view])}
              {view === 'unread' && <Count value={unreadTotal} />}
            </Chip>
          </li>
        ))}
      </ul>
      {(facets.length > 1 || filter.category !== null) && (
        <ul aria-label={t('notifications.inbox.categoriesLabel')} className="flex flex-wrap gap-2">
          <li>
            <Chip pressed={filter.category === null} onClick={() => setCategory(null)}>
              {t('notifications.inbox.categoryAll')}
            </Chip>
          </li>
          {facets.map((facet) => {
            const { Icon, label } = present(facet.category);
            return (
              <li key={facet.category}>
                <Chip pressed={filter.category === facet.category} onClick={() => setCategory(facet.category)}>
                  <Icon className={cn(iconSizes.sm)} aria-hidden="true" />
                  {label}
                  <Count value={facet.unread} />
                </Chip>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
