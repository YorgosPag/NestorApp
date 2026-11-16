'use client';

/**
 * ADR-942 Φ1 — **η λίστα «Έγγραφα για την έκδοση»**, ίδια για μηχανικό και γραφείο: ανά βαθμίδα («τι κοστίζει η
 * απουσία»), ανά είδος η κατάστασή του, και μια ενέργεια που δίνει **η όψη** (μηχανικός: «Ζήτησε» · γραφείο: «Ανέβασμα»).
 *
 * Τίποτα δεν αποφασίζεται εδώ: «υπάρχει» και «εκκρεμεί» **παράγονται** από τον κοινό κριτή (`issuance-request-policy`)
 * — ίδιο με τον server. Το «εκκρεμεί» σβήνει μόνο του όταν ανέβει το αρχείο.
 *
 * @module components/document-registry/IssuanceDocumentRequestList
 */

import React from 'react';
import { CheckCircle2, Hourglass } from 'lucide-react';
import { ISSUANCE_REQUEST_TIERS, type IssuanceRequestTier } from '@/config/document-requests/issuance-request-catalog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuancePendingOf } from '@/lib/document-requests/issuance-request-policy';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type {
  IssuanceDocumentRequests,
  IssuancePendingRequest,
  IssuanceRequestItemView,
  IssuanceRequestView,
} from '@/types/issuance-document-request';
import { ISSUANCE_REQUEST_ITEM_KEYS, ISSUANCE_REQUEST_KEYS, ISSUANCE_REQUEST_TIER_KEYS } from './issuance-request-labels';

/** Η ενέργεια ενός είδους — τη δίνει η όψη. `null` ⇒ καμία. */
export type IssuanceRequestAction = (item: IssuanceRequestItemView, pending: IssuancePendingRequest | null) => React.ReactNode;

interface IssuanceDocumentRequestListProps {
  readonly panel: Pick<IssuanceDocumentRequests, 'items' | 'today' | 'tiersVerified'>;
  /** Το ίχνος του θεατή (του server + τα αισιόδοξα τοπικά). */
  readonly log: readonly IssuanceRequestView[];
  readonly action: IssuanceRequestAction;
  /** ADR-942 Φ2 — τα αρχεία του στοιχείου κάτω από την κατάσταση (μηχανικός: άνοιγμα · γραφείο: ανάκληση). */
  readonly files?: (item: IssuanceRequestItemView) => React.ReactNode;
}

/** «Υπάρχει στον φάκελο · 3/10» · «Εκκρεμεί από το γραφείο · 3/10» · «Το ζήτησε ο μηχανικός · 3/10». */
function ItemStatus({ item, pending }: { readonly item: IssuanceRequestItemView; readonly pending: IssuancePendingRequest | null }) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  if (item.providedAt !== null) {
    const text = item.providedAt === '' ? t(ISSUANCE_REQUEST_KEYS.providedUndated) : t(ISSUANCE_REQUEST_KEYS.provided, { date: formatDate(item.providedAt) });
    return (
      <p className={cn('flex items-center gap-1 text-xs', colors.text.success)}>
        <CheckCircle2 className={iconSizes.xs} aria-hidden="true" />
        {text}
      </p>
    );
  }
  if (pending === null) return null;
  const date = formatDate(pending.lastRequestedAt);
  return (
    <p className={cn('flex items-center gap-1 text-xs', colors.text.warning)}>
      <Hourglass className={iconSizes.xs} aria-hidden="true" />
      {pending.askedOfViewerBy === null ? t(ISSUANCE_REQUEST_KEYS.pendingFromOffice, { date }) : t(ISSUANCE_REQUEST_KEYS.askedOfOffice, { date })}
    </p>
  );
}

function TierSection({ tier, items, props }: {
  readonly tier: IssuanceRequestTier;
  readonly items: readonly IssuanceRequestItemView[];
  readonly props: IssuanceDocumentRequestListProps;
}) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const headingId = `issuance-request-tier-${tier}`;
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <header>
        <h3 id={headingId} className="text-sm font-medium">{t(ISSUANCE_REQUEST_TIER_KEYS[tier].title)}</h3>
        <p className={cn('text-xs', colors.text.muted)}>{t(ISSUANCE_REQUEST_TIER_KEYS[tier].ifMissing)}</p>
      </header>
      <ul className="divide-y rounded-md border">
        {items.map((item) => {
          const pending = issuancePendingOf(item, props.log, props.panel.today);
          return (
            <li key={item.itemId} className="flex flex-wrap items-center justify-between gap-2 p-2">
              <span className="space-y-1">
                <span className="block text-sm">{t(ISSUANCE_REQUEST_ITEM_KEYS[item.itemId])}</span>
                <ItemStatus item={item} pending={pending} />
              </span>
              {props.action(item, pending)}
              {props.files?.(item)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function IssuanceDocumentRequestList(props: IssuanceDocumentRequestListProps) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  return (
    <>
      {ISSUANCE_REQUEST_TIERS.map((tier) => {
        const items = props.panel.items.filter((item) => item.tier === tier);
        return items.length === 0 ? null : <TierSection key={tier} tier={tier} items={items} props={props} />;
      })}
      {!props.panel.tiersVerified && <p className={cn('text-xs', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.tiersUnverified)}</p>}
    </>
  );
}
