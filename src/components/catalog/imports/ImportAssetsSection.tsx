'use client';

/**
 * Τα μέσα της παρτίδας (ADR-934 §5.2.2 Μ-β4): πόσα κατέβηκαν, πόσα κατεβαίνουν, και **κάθε** αποτυχία με τον λόγο της και
 * «Ξαναδοκιμή». Η προεπισκόπηση και ο έλεγχος περιεχομένου ανήκουν στο Μ-γ· εδώ ο άνθρωπος ξέρει ότι τίποτα δεν χάθηκε σιωπηλά.
 * @module components/catalog/imports/ImportAssetsSection
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ImportAssetView } from '@/subapps/catalog/types/catalog-media';
import { ASSET_FETCH_FAILURE_KEYS, useImportText } from './import-text';

export interface ImportAssetsSectionProps {
  readonly assets: readonly ImportAssetView[];
  /** Η παρτίδα δέχεται ακόμη λήψεις (όχι κλειστή ή εγκαταλειμμένη). */
  readonly open: boolean;
  readonly onRetry: (asset: ImportAssetView) => void;
  readonly onRetryFailed: () => void;
}

function FailedAsset({ asset, open, onRetry }: { readonly asset: ImportAssetView; readonly open: boolean; readonly onRetry: (asset: ImportAssetView) => void }) {
  const { t } = useImportText();
  const { failure } = asset;
  return (
    <li className="flex flex-wrap items-start justify-between gap-2">
      <p className="m-0 flex min-w-0 flex-col">
        <span className="break-all font-medium text-foreground">{asset.filename ?? asset.uri}</span>
        {failure ? <span>{t(ASSET_FETCH_FAILURE_KEYS[failure.code])}</span> : null}
      </p>
      {open ? <Button type="button" size="sm" variant="outline" onClick={() => onRetry(asset)}>{t('assetFetch.retry')}</Button> : null}
    </li>
  );
}

export function ImportAssetsSection({ assets, open, onRetry, onRetryFailed }: ImportAssetsSectionProps) {
  const { t } = useImportText();
  const total = assets.length;
  const ready = assets.filter((asset) => asset.status === 'ready').length;
  const failed = assets.filter((asset) => asset.status === 'failed');
  const fetching = assets.filter((asset) => asset.status === 'fetching').length;
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm" aria-label={t('assetFetch.title')}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 font-medium">{t('assetFetch.title')}</h3>
        {open && failed.length > 0 ? <Button type="button" size="sm" variant="outline" onClick={onRetryFailed}>{t('assetFetch.retryFailed')}</Button> : null}
      </header>
      <Progress value={total === 0 ? 0 : (ready / total) * 100} aria-label={t('assetFetch.title')} />
      <p className="m-0 flex flex-wrap gap-x-3 text-muted-foreground" role="status">
        <span>{t('assetFetch.progress', { ready, total })}</span>
        {fetching > 0 ? <span>{t('assetFetch.fetching', { count: fetching })}</span> : null}
        {failed.length > 0 ? <span>{t('assetFetch.failedCount', { count: failed.length })}</span> : null}
      </p>
      {failed.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-muted-foreground">
          {failed.map((asset) => <FailedAsset key={asset.uri} asset={asset} open={open} onRetry={onRetry} />)}
        </ul>
      ) : null}
    </section>
  );
}
