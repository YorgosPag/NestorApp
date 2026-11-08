'use client';

/**
 * @fileoverview **Τα δημοσιευμένα έντυπα μιας συνταγής** — σε ποιο κοινό, πότε, ποιο αντικατέστησε ποιο, προβολή και απόσυρση
 *   (ADR-923 §5.15.3). Το ράφι μιας συνταγής είναι η ίδια η συνταγή (`shelfKey === recipe.id`).
 * @module components/catalog/publishing/PublishedEditionList
 *
 * 🔑 Η κατάσταση **λέγεται με λέξη** (CHECK 3.41). Η αποσυρμένη μένει στη λίστα (ιστορικό, ADR-861), χωρίς πράξεις.
 * 🔑 Η απόσυρση της **ισχύουσας** επαναφέρει τον προκάτοχο (Θ.1β-2) — ο διάλογος το λέει πριν πατηθεί.
 * 🔑 «Προβολή» = ο ίδιος αναγνώστης με το κοινό, από την πόρτα του ιδιοκτήτη: ό,τι βλέπεις εδώ, βλέπουν κι εκείνοι.
 */

import React, { useCallback, useState } from 'react';

import { CatalogEditionReaderSlot } from '@/components/catalog/editions/edition-surfaces';
import { Badge, type BadgeVariantProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDiscountsView } from '@/hooks/catalog/usePriceListViews';
import { formatDate } from '@/lib/intl-formatting';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { catalogEditionLicenseIssuer, withdrawCatalogEdition } from '@/services/catalog/catalog-editions-api.client';
import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import { ownerEditionAsView } from '@/subapps/catalog/publishing/catalog-edition-policy';
import type { CatalogEditionAudience, CatalogEditionOwnerView, CatalogEditionStatus, CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import { AUDIENCE_KIND_KEYS } from '../pricing/pricing-labels';
import { useCatalogAccess, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';

const STATUS_BADGES: Readonly<Record<CatalogEditionStatus, NonNullable<BadgeVariantProps['variant']>>> = {
  published: 'success',
  superseded: 'secondary',
  withdrawn: 'outline',
};

const STATUS_KEYS: Readonly<Record<CatalogEditionStatus, string>> = {
  published: 'publishing.editionStatus.published',
  superseded: 'publishing.editionStatus.superseded',
  withdrawn: 'publishing.editionStatus.withdrawn',
};

const ownerIssueOf = (editionId: string) => catalogEditionLicenseIssuer(CATALOG_API.editions.file(editionId), 'signedIn');

function AudienceLabel({ audience }: { readonly audience: CatalogEditionAudience }) {
  const { t, text } = useCatalogText();
  const groupsApi = useDiscountsView();
  const kind = t(AUDIENCE_KIND_KEYS[audience.kind]);
  if (audience.kind !== 'customerGroup' || groupsApi.current.state !== 'ready') return <>{kind}</>;
  const group = groupsApi.current.view.customerGroups.find((candidate) => candidate.id === audience.customerGroupId);
  return <>{group ? `${kind} · ${text(group.labels, group.code)}` : kind}</>;
}

function useWithdraw(revalidate: () => Promise<void>) {
  const notifyFailure = useCatalogFailureNotice();
  const [withdrawing, setWithdrawing] = useState<CatalogEditionOwnerView | null>(null);
  const confirm = useCallback(async () => {
    if (withdrawing === null) return;
    try {
      await withdrawCatalogEdition(withdrawing.id);
    } catch (cause) {
      notifyFailure(catalogFailureOf(cause));
    }
    setWithdrawing(null);
    await revalidate();
  }, [withdrawing, notifyFailure, revalidate]);
  return { withdrawing, setWithdrawing, confirm };
}

interface RowProps {
  readonly edition: CatalogEditionOwnerView;
  readonly canWithdraw: boolean;
  readonly onView: (view: CatalogEditionView) => void;
  readonly onWithdraw: (edition: CatalogEditionOwnerView) => void;
}

function EditionRow({ edition, canWithdraw, onView, onWithdraw }: RowProps) {
  const { t } = useCatalogText();
  const view = ownerEditionAsView(edition);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
      <section className="flex min-w-0 flex-col gap-0.5">
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={STATUS_BADGES[edition.status]}>{t(STATUS_KEYS[edition.status])}</Badge>
          <AudienceLabel audience={edition.audience} />
        </p>
        <time className="text-xs text-muted-foreground" dateTime={edition.publishedAt}>{formatDate(edition.publishedAt)}</time>
      </section>
      <span className="flex flex-wrap gap-2">
        {view !== null ? <Button type="button" size="sm" variant="outline" onClick={() => onView(view)}>{t('publishing.editions.view')}</Button> : null}
        {canWithdraw && edition.status !== 'withdrawn' ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onWithdraw(edition)}>{t('publishing.editions.withdraw')}</Button>
        ) : null}
      </span>
    </li>
  );
}

export interface PublishedEditionListProps {
  readonly editions: readonly CatalogEditionOwnerView[];
  readonly revalidate: () => Promise<void>;
}

export function PublishedEditionList({ editions, revalidate }: PublishedEditionListProps) {
  const { t } = useCatalogText();
  const canWithdraw = useCatalogAccess('pricingPublish') === 'granted';
  const { withdrawing, setWithdrawing, confirm } = useWithdraw(revalidate);
  const [viewing, setViewing] = useState<CatalogEditionView | null>(null);
  if (editions.length === 0) return null;
  const views = editions.flatMap((edition) => ownerEditionAsView(edition) ?? []);
  return (
    <section className="flex flex-col gap-2" aria-label={t('publishing.editions.title')}>
      <h3 className="m-0 text-sm font-semibold text-foreground">{t('publishing.editions.title')}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {editions.map((edition) => (
          <EditionRow key={edition.id} edition={edition} canWithdraw={canWithdraw} onView={setViewing} onWithdraw={setWithdrawing} />
        ))}
      </ul>
      <ConfirmDialog open={withdrawing !== null} onOpenChange={(open) => { if (!open) setWithdrawing(null); }} variant="destructive"
        title={t('publishing.editions.withdrawTitle')}
        description={t(withdrawing?.status === 'published' ? 'publishing.editions.withdrawCurrentBody' : 'publishing.editions.withdrawBody')}
        confirmText={t('publishing.editions.withdraw')} onConfirm={confirm} />
      {viewing !== null ? <CatalogEditionReaderSlot edition={viewing} editions={views} issueOf={ownerIssueOf} onClose={() => setViewing(null)} /> : null}
    </section>
  );
}
