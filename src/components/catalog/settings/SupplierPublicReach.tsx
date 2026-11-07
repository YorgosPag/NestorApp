'use client';

/**
 * @fileoverview **Δημόσια ορατά: X από Y — γιατί** (ADR-923 §5.13 Σ9), μέσα στο πάνελ «Επιβεβαίωση προμηθευτή».
 * @module components/catalog/settings/SupplierPublicReach
 *
 * 🔑 Ο αριθμός και οι αιτίες έρχονται από τον διακομιστή, από την ίδια κρίση με τη δημόσια προβολή. Εδώ δεν υπολογίζεται τίποτα.
 * 🔑 Κάθε αιτία που διορθώνεται με κλικ δείχνει **εκεί όπου διορθώνεται**. Βλάβη ανάγνωσης ⇒ ρητό μήνυμα, ποτέ «0 από Y».
 */

import React from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatDateTime } from '@/lib/intl-formatting';
import { Link } from '@/lib/workspace/navigation';
import { typedHref } from '@/lib/workspace/route-worlds';
import { CATALOG_PAGES, VISIBILITY_TAB_QUERY } from '@/subapps/catalog/catalog-routes';
import type { PublicCatalogReach, PublicReachReason, PublicReachReasonKind } from '@/subapps/catalog/public/public-reach';

import { useCatalogText } from '../shared/catalog-ui-hooks';

const REACH_URL = '/api/catalog/supplier-showcase';

const VISIBILITY_FIX = { href: typedHref(`${CATALOG_PAGES.discounts}${VISIBILITY_TAB_QUERY}` as const), labelKey: 'supplierVerification.reach.fix.visibility' } as const;
const PRODUCTS_FIX = { href: typedHref(CATALOG_PAGES.products), labelKey: 'supplierVerification.reach.fix.products' } as const;

/** Εξαντλητικό: νέα αιτία χωρίς κείμενο δεν μεταγλωττίζεται. Κυριολεκτικά, ώστε η πύλη 3.34 να επιλύει την κλήση. */
const REASON_KEYS: Readonly<Record<PublicReachReasonKind, string>> = {
  catalogEmpty: 'supplierVerification.reach.reason.catalogEmpty',
  conditionClosed: 'supplierVerification.reach.reason.conditionClosed',
  conditionUnknown: 'supplierVerification.reach.reason.conditionUnknown',
  syncing: 'supplierVerification.reach.reason.syncing',
  noRuleForPublic: 'supplierVerification.reach.reason.noRuleForPublic',
  catalogRuleHides: 'supplierVerification.reach.reason.catalogRuleHides',
  specificRulesHide: 'supplierVerification.reach.reason.specificRulesHide',
  noVisibleVariant: 'supplierVerification.reach.reason.noVisibleVariant',
};

/** Πού διορθώνεται κάθε αιτία. `null` ⇒ όχι με κλικ: περιμένει τη σάρωση ή την επιβεβαίωση. */
const REASON_FIX: Readonly<Record<PublicReachReasonKind, typeof VISIBILITY_FIX | typeof PRODUCTS_FIX | null>> = {
  catalogEmpty: PRODUCTS_FIX,
  conditionClosed: null,
  conditionUnknown: null,
  syncing: null,
  noRuleForPublic: VISIBILITY_FIX,
  catalogRuleHides: VISIBILITY_FIX,
  specificRulesHide: VISIBILITY_FIX,
  noVisibleVariant: PRODUCTS_FIX,
};

type ReachState = { readonly kind: 'loading' } | { readonly kind: 'failed' } | { readonly kind: 'ready'; readonly reach: PublicCatalogReach };

function useReach(): ReachState {
  const [state, setState] = React.useState<ReachState>({ kind: 'loading' });
  React.useEffect(() => {
    let live = true;
    apiClient
      .get<{ reach: PublicCatalogReach }>(REACH_URL)
      .then((body) => live && setState({ kind: 'ready', reach: body.reach }))
      .catch(() => live && setState({ kind: 'failed' }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function ReasonItem({ reason }: { readonly reason: PublicReachReason }) {
  const { t } = useCatalogText();
  const fix = REASON_FIX[reason.kind];
  const count = 'count' in reason ? reason.count : undefined;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span>{t(REASON_KEYS[reason.kind], { count })}</span>
      {fix !== null && <Link href={fix.href} className="font-medium underline underline-offset-4">{t(fix.labelKey)}</Link>}
    </li>
  );
}

function ReachSummary({ reach }: { readonly reach: PublicCatalogReach }) {
  const { t } = useCatalogText();
  return (
    <>
      <p className="m-0 text-sm font-medium text-foreground" role="status">
        {t('supplierVerification.reach.summary', { published: reach.published, total: reach.total })}
      </p>
      {reach.reasons.length > 0 && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          {reach.reasons.map((reason) => <ReasonItem key={reason.kind} reason={reason} />)}
        </ul>
      )}
      {reach.fullPassAtMs !== null && (
        <p className="m-0 text-xs text-muted-foreground">{t('supplierVerification.reach.lastPass', { date: formatDateTime(new Date(reach.fullPassAtMs)) })}</p>
      )}
    </>
  );
}

export function SupplierPublicReach(): React.ReactElement {
  const { t } = useCatalogText();
  const state = useReach();
  return (
    <section className="flex flex-col gap-1 border-t pt-2">
      <h3 className="m-0 text-sm font-semibold">{t('supplierVerification.reach.title')}</h3>
      {state.kind === 'loading' && <p className="m-0 text-sm text-muted-foreground" role="status">{t('supplierVerification.reach.loading')}</p>}
      {state.kind === 'failed' && <p className="m-0 text-sm text-destructive" role="alert">{t('supplierVerification.reach.failed')}</p>}
      {state.kind === 'ready' && <ReachSummary reach={state.reach} />}
    </section>
  );
}
