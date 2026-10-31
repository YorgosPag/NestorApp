'use client';

/**
 * @fileoverview **Μία παρτίδα** (ADR-923 §5.5 · κριτήριο εξόδου Φάσης 4): αριστερά οι προτάσεις, δεξιά το PDF στο σημείο της
 *   τιμής που εξετάζεις. Το κλικ σε πεδίο πηγαίνει στη σελίδα του και επισημαίνει την περιοχή που μετρήθηκε.
 * @module components/catalog/imports/ImportBatchWorkspace
 */

import React, { useEffect, useState } from 'react';

import { PdfCanvasViewer } from '@/components/file-manager/PdfCanvasViewer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';
import { useImportText } from './import-text';
import { ProposalReview } from './ProposalReview';
import { pagesToRead, useImportBatch } from './use-import-batch';

type Workspace = ReturnType<typeof useImportBatch>;

function PageProgress({ workspace }: { readonly workspace: Workspace }) {
  const { t } = useImportText();
  const pages = workspace.view?.batch.pages;
  if (!pages) return null;
  const total = pages.to - pages.from + 1;
  const judged = pages.done.length + pages.failed.length;
  const remaining = pagesToRead(pages, false).length;
  return (
    <section className="flex flex-col gap-2" aria-label={t('batch.pages')}>
      <Progress value={(judged / total) * 100} aria-label={t('batch.pages')} />
      <p className="m-0 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span role="status">{t('batch.pagesProgress', { done: pages.done.length, total, failed: pages.failed.length })}</span>
        <span className="flex gap-2">
          {remaining > 0 ? <Button type="button" disabled={workspace.reading} onClick={() => void workspace.readPages(false)}>{t('batch.readPages', { count: remaining })}</Button> : null}
          {pages.failed.length > 0 ? <Button type="button" variant="outline" disabled={workspace.reading} onClick={() => void workspace.readPages(true)}>{t('batch.retryFailed')}</Button> : null}
        </span>
      </p>
    </section>
  );
}

function SourcePane({ view, focused }: { readonly view: ImportBatchDetailView; readonly focused: ImportProposalField | null }) {
  const { t } = useImportText();
  const { batch, proposals } = view;
  if (batch.sourceKind !== 'pdf' || batch.fileId === null) return null;
  const anchor = focused?.anchor?.kind === 'page' ? focused.anchor : null;
  const page = anchor?.page ?? proposals[0]?.pages[0] ?? batch.pages?.from ?? 1;
  return (
    <aside className="flex min-h-0 flex-col" aria-label={t('review.source')}>
      <PdfCanvasViewer url="" fileId={batch.fileId} title={batch.fileName} page={page} highlights={anchor?.regions ?? []} className="min-h-0 flex-1" />
    </aside>
  );
}

function BatchProposals({ workspace, view, focused, onFocus }: { readonly workspace: Workspace; readonly view: ImportBatchDetailView; readonly focused: ImportProposalField | null; readonly onFocus: (field: ImportProposalField) => void }) {
  const { t } = useImportText();
  const { batch, proposals } = view;
  const open = batch.status !== 'discarded' && batch.status !== 'closed';
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-auto">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">{batch.fileName}</h2>
        {open ? <Button type="button" variant="outline" onClick={() => void workspace.discard()}>{t('batch.discard')}</Button> : null}
      </header>
      <PageProgress workspace={workspace} />
      {proposals.length === 0 ? <p className="m-0 text-muted-foreground">{t('batch.noProposals')}</p> : null}
      {proposals.map((proposal) => (
        <ProposalReview
          key={proposal.id}
          proposal={proposal}
          focused={focused}
          onFocus={onFocus}
          onChange={(target, change) => void workspace.change(target, change)}
          onApply={(target) => void workspace.apply(target)}
          onReject={(target) => void workspace.reject(target)}
        />
      ))}
    </div>
  );
}

export function ImportBatchWorkspace({ batchId }: { readonly batchId: string }) {
  const { t } = useImportText();
  const notify = useCatalogFailureNotice();
  const workspace = useImportBatch(batchId);
  const [focused, setFocused] = useState<ImportProposalField | null>(null);
  const { view, failure } = workspace;

  useEffect(() => {
    if (failure) notify(failure);
  }, [failure, notify]);

  if (!view) return <p className="m-0 text-muted-foreground" role="status">{t('batch.loading')}</p>;
  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2" aria-label={view.batch.fileName}>
      <BatchProposals workspace={workspace} view={view} focused={focused} onFocus={setFocused} />
      <SourcePane view={view} focused={focused} />
    </section>
  );
}
