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
import { cn } from '@/lib/utils';
import { pageDerivationOf } from '@/subapps/catalog/import/page-derivation';
import { attributesGroupKeyOf, pageTableGroupKey } from '@/subapps/catalog/import/import-keys';
import { lineKeyOf, pendingUnmappedLines } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportBatchPages, ImportLineOverride, ImportPageUnmappedLine, ImportProposalField, PageRegion } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, ImportMemoryHint, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_FINISHED_BATCH_STATUSES } from '@/subapps/catalog/vocabulary/catalog-import';
import { useCatalogAccess } from '../shared/catalog-neutral-hooks';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';
import { ImportPriceTarget } from './ImportPriceTarget';
import { LINE_REFUSAL_KEYS, SET_ASIDE_KEYS, TEXTLESS_KEYS, useImportText } from './import-text';
import { ProposalReview } from './ProposalReview';
import { costPerPage, pagesToRead, useImportBatch } from './use-import-batch';
import { ImportSupplierSlot, PriceLineNoteSlot, XChangeReportSlot } from './import-surfaces';

type Workspace = ReturnType<typeof useImportBatch>;

const USD_DECIMALS = 2;

/** Πριν το κουμπί: τι θα κοστίσει. Μετά: τι κόστισε, από τη μέτρηση και όχι από την εκτίμηση. */
function PageCost({ pages, remaining }: { readonly pages: ImportBatchPages; readonly remaining: number }) {
  const { t } = useImportText();
  const { usage } = pages;
  const estimate = (costPerPage(pages) * remaining).toFixed(USD_DECIMALS);
  return (
    <p className="m-0 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
      {remaining > 0 ? <span>{t('batch.costEstimate', { cost: estimate })}</span> : null}
      {usage ? <span role="status">{t('batch.costSpent', { requests: usage.requests, tokens: usage.inputTokens + usage.outputTokens, cost: usage.costUsd === null ? '—' : usage.costUsd.toFixed(USD_DECIMALS) })}</span> : null}
    </p>
  );
}

/** Ό,τι δεν έγινε πρόταση μένει ορατό: ο άνθρωπος ξέρει ότι τα εξαρτήματα της σελίδας δεν χάθηκαν. */
function SetAsideTables({ pages }: { readonly pages: ImportBatchPages }) {
  const { t } = useImportText();
  const entries = pages.setAside ?? [];
  if (entries.length === 0) return null;
  return (
    <section className="flex flex-col gap-1 text-xs text-muted-foreground" aria-label={t('batch.setAsideTitle')}>
      <h3 className="m-0 font-medium">{t('batch.setAsideTitle')}</h3>
      <ul className="m-0 list-none p-0">
        {entries.map((entry) => <li key={`${entry.page}:${entry.table}`}>{t(SET_ASIDE_KEYS[entry.role], { page: entry.page, label: entry.label })}</li>)}
      </ul>
    </section>
  );
}

/** Ό,τι εστιάζει ο άνθρωπος: πεδίο πρότασης ή γραμμή χωρίς πεδίο (§5.5.2 Β3). Το PDF δείχνει την περιοχή του. */
type ReviewFocus = { readonly kind: 'field'; readonly field: ImportProposalField } | { readonly kind: 'line'; readonly line: ImportPageUnmappedLine };

interface PdfSpot {
  readonly page: number;
  readonly regions: readonly PageRegion[];
}

function spotOf(focus: ReviewFocus | null): PdfSpot | null {
  if (focus?.kind === 'line') return { page: focus.line.page, regions: focus.line.regions ?? [] };
  const anchor = focus?.field.anchor;
  return anchor?.kind === 'page' ? { page: anchor.page, regions: anchor.regions } : null;
}

/** Ε7 · §5.5.2 Μ9: κάθε γραμμή ανήκει στην πρόταση του **πίνακά** της, όχι σε όποια πρόταση μοιράζεται τη σελίδα. */
const linesOf = (pages: ImportBatchPages | null | undefined, proposal: ImportProposalWire): ImportPageUnmappedLine[] =>
  (pages?.unmappedLines ?? []).filter((line) => proposal.groupKey === pageTableGroupKey(line.page, line.table));

/** §5.5.2 Β4: η γραμμή τιμής που γέννησε μια πρόταση τιμών, και η πρόταση ιδιοτήτων του πίνακα (η ουρά της απόφασης γραμμής). */
function priceSourceOf(view: ImportBatchDetailView, proposal: ImportProposalWire): { readonly override: ImportLineOverride; readonly owner: ImportProposalWire } | null {
  const tableKey = attributesGroupKeyOf(proposal.groupKey);
  if (tableKey === null) return null;
  const override = (view.batch.pages?.lineOverrides ?? []).find((entry) => entry.decision.kind === 'price' && pageTableGroupKey(entry.page, entry.table) === tableKey);
  return override ? { override, owner: view.proposals.find((candidate) => candidate.groupKey === tableKey) ?? proposal } : null;
}

/** §5.5.2 Β5.2: οι υποδείξεις της μνήμης του προμηθευτή, ανά γραμμή (`lineKeyOf`). */
const memoryHintsOf = (view: ImportBatchDetailView): ReadonlyMap<string, ImportMemoryHint> =>
  new Map((view.labelMemory?.hints ?? []).map((hint) => [lineKeyOf(hint), hint]));

/** Ο προμηθευτής και η μνήμη του: μόνο σε ανοιχτή παρτίδα ιδιοτήτων από PDF (εκεί ζει η μνήμη ετικετών γραμμής). */
function SupplierSlot({ workspace, view }: Pick<BatchProposalsProps, 'workspace' | 'view'>) {
  const { batch } = view;
  const { target } = batch;
  const { supplier } = workspace;
  if (batch.sourceKind !== 'pdf' || target.purpose !== 'attributes') return null;
  return (
    <ImportSupplierSlot supplierContactId={target.supplierContactId ?? null} learnLabels={target.learnLabels ?? true}
      hints={view.labelMemory} busy={supplier.savingSupplier || workspace.upgrade !== null || workspace.reading} memoryBusy={supplier.memoryBusy}
      report={supplier.memoryReport} onSupplier={(id) => void supplier.setSupplier(id)} onLearn={(learn) => void supplier.setLearning(learn)}
      onMemory={(action) => void supplier.runMemory(action)} onFailure={supplier.reportFailure} />
  );
}

/** Η παρτίδα έχει τιμοκατάλογο ⇒ μια γραμμή μπορεί να γίνει τιμή (το δικαίωμα κρίνεται και στον διακομιστή). */
const priceTargetOf = (view: ImportBatchDetailView): string | null => (view.batch.target.purpose === 'attributes' ? (view.batch.target.priceListVersionId ?? null) : null);

/** Ε8: σελίδες χωρίς στρώση κειμένου. Ο άνθρωπος ξέρει γιατί οι τιμές τους δεν ελέγχονται — ή γιατί η σελίδα δεν διαβάστηκε. */
function TextlessPages({ pages }: { readonly pages: ImportBatchPages }) {
  const { t } = useImportText();
  const entries = pages.textless ?? [];
  if (entries.length === 0) return null;
  return (
    <section className="flex flex-col gap-1 text-xs text-muted-foreground" aria-label={t('batch.textlessTitle')}>
      <h3 className="m-0 font-medium">{t('batch.textlessTitle')}</h3>
      <ul className="m-0 list-none p-0">
        {entries.map((entry) => (
          <li key={entry.page}>{t(TEXTLESS_KEYS[entry.kind], { page: entry.page, reason: entry.reason ?? '' })}</li>
        ))}
      </ul>
    </section>
  );
}

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
          {workspace.reading ? <Button type="button" variant="outline" disabled={workspace.stopping} onClick={workspace.stopReading}>{workspace.stopping ? t('batch.stopping') : t('batch.stop')}</Button> : null}
        </span>
      </p>
      <PageCost pages={pages} remaining={remaining} />
      <SetAsideTables pages={pages} />
      <TextlessPages pages={pages} />
    </section>
  );
}

/**
 * **Η μία απάντηση στο «υπάρχει πηγή να δειχτεί δίπλα;»** — την ρωτούν και το πάνελ και η διάταξη. Χωριστά θα διαφωνούσαν:
 * μετρημένο 2026-11-08 (xlsx, 1121px) η διάταξη κρατούσε δεύτερη στήλη 1032px για πάνελ που δεν αποδιδόταν, και ο τροχός
 * πάνω στο κενό δεν κυλούσε τίποτα (οι μπάρες κύλισης είναι κρυφές σε όλη την εφαρμογή, άρα ούτε φαινόταν ότι υπάρχει συνέχεια).
 */
function sourceFileIdOf(view: ImportBatchDetailView): string | null {
  const { batch } = view;
  return batch.sourceKind === 'pdf' ? batch.fileId : null;
}

/**
 * §5.5.2 Β3.1: γραμμή χωρίς θέση στη σελίδα **δεν** σβήνει σιωπηλά την επισήμανση — λέει γιατί. Ο λόγος έρχεται από τη σφραγίδα της
 * σελίδας (η αναβάθμιση αρνήθηκε) ή είναι «παλαιότερη έκδοση» (δεν έχει ακόμη αναβαθμιστεί).
 */
function MissingRegion({ pages, focus }: { readonly pages: ImportBatchPages | null | undefined; readonly focus: ReviewFocus | null }) {
  const { t } = useImportText();
  if (focus?.kind !== 'line' || (focus.line.regions?.length ?? 0) > 0 || !pages) return null;
  const { refusal } = pageDerivationOf(pages, focus.line.page);
  const reason = refusal === null ? t('review.lines.regionLegacy') : t(LINE_REFUSAL_KEYS[refusal]);
  return <p className="m-0 text-xs text-muted-foreground" role="status">{t('review.lines.regionMissing', { reason })}</p>;
}

function SourcePane({ view, fileId, focus }: { readonly view: ImportBatchDetailView; readonly fileId: string; readonly focus: ReviewFocus | null }) {
  const { t } = useImportText();
  const { batch, proposals } = view;
  const spot = spotOf(focus);
  const page = spot?.page ?? proposals[0]?.pages[0] ?? batch.pages?.from ?? 1;
  return (
    <aside className="flex min-h-0 flex-col gap-2" aria-label={t('review.source')}>
      <MissingRegion pages={batch.pages} focus={focus} />
      <PdfCanvasViewer url="" fileId={fileId} title={batch.fileName} page={page} highlights={spot?.regions ?? []} className="min-h-0 flex-1" />
    </aside>
  );
}

interface BatchProposalsProps {
  readonly workspace: Workspace;
  readonly view: ImportBatchDetailView;
  readonly focus: ReviewFocus | null;
  readonly onFocus: (focus: ReviewFocus) => void;
}

function PriceSource({ workspace, view, proposal }: Pick<BatchProposalsProps, 'workspace' | 'view'> & { readonly proposal: ImportProposalWire }) {
  const source = priceSourceOf(view, proposal);
  const decision = source?.override.decision;
  if (!source || decision?.kind !== 'price') return null;
  const { override, owner } = source;
  const open = proposal.status === 'pending' && !IMPORT_FINISHED_BATCH_STATUSES.includes(view.batch.status);
  const undo = () => void workspace.decideLine(owner, { page: override.page, table: override.table, line: override.line, decision: null, bind: null });
  return <PriceLineNoteSlot line={override.line} unitCode={decision.unitCode} disabled={!open} onUndo={undo} />;
}

/** Μία πρόταση με τις γραμμές του πίνακά της (§5.5.2 Β3) — ή, για πρόταση τιμών, με τη γραμμή τιμής που τη γέννησε (Β4). */
function ProposalSlot({ workspace, view, focus, onFocus, proposal, canPrice }: BatchProposalsProps & { readonly proposal: ImportProposalWire; readonly canPrice: boolean }) {
  const lines = linesOf(view.batch.pages, proposal);
  const overrides = view.batch.pages?.lineOverrides;
  return (
    <ProposalReview
      proposal={proposal}
      source={proposal.purpose === 'priceLines' ? <PriceSource workspace={workspace} view={view} proposal={proposal} /> : null}
      batchOpen={!IMPORT_FINISHED_BATCH_STATUSES.includes(view.batch.status)}
      focused={focus?.kind === 'field' ? focus.field : null}
      onFocus={(field) => onFocus({ kind: 'field', field })}
      onChange={(target, change) => void workspace.change(target, change)}
      onApply={(target) => void workspace.apply(target)}
      onReject={(target) => void workspace.reject(target)}
      saving={workspace.saving.has(proposal.id)}
      unmapped={pendingUnmappedLines(lines, overrides).length}
      lines={{
        lines,
        overrides,
        activity: workspace.lineActivity,
        activeLine: focus?.kind === 'line' ? lineKeyOf(focus.line) : null,
        onFocusLine: (line) => onFocus({ kind: 'line', line }),
        onDecideLine: (target, request) => void workspace.decideLine(target, request),
        pricesEnabled: canPrice && priceTargetOf(view) !== null,
        memoryHints: memoryHintsOf(view),
      }}
    />
  );
}

function BatchProposals(props: BatchProposalsProps) {
  const { t } = useImportText();
  const { workspace, view } = props;
  const { batch, proposals } = view;
  const { upgrade } = workspace;
  const open = !IMPORT_FINISHED_BATCH_STATUSES.includes(batch.status);
  const canPrice = useCatalogAccess('pricing') === 'granted';
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-auto">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">{batch.fileName}</h2>
        {open ? <Button type="button" variant="outline" onClick={() => void workspace.discard()}>{t('batch.discard')}</Button> : null}
      </header>
      {open ? <ImportPriceTarget batch={batch} disabled={workspace.savingPriceTarget || upgrade !== null} onChange={(id) => void workspace.setPriceTarget(id)} /> : null}
      {open ? <SupplierSlot workspace={workspace} view={view} /> : null}
      <PageProgress workspace={workspace} />
      {batch.xchangeReport ? <XChangeReportSlot report={batch.xchangeReport} /> : null}
      {upgrade ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('batch.upgrading', { current: upgrade.done + 1, total: upgrade.total })}</p> : null}
      {proposals.length === 0 ? <p className="m-0 text-muted-foreground">{t('batch.noProposals')}</p> : null}
      {/* §5.5.2 Β3.1: όσο ξαναχτίζονται σελίδες, καμία απόφαση — αλλιώς θα συγκρουόταν με την πρόταση που μόλις αλλάζει. */}
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={upgrade !== null} aria-busy={upgrade !== null}>
        {proposals.map((proposal) => <ProposalSlot key={proposal.id} {...props} proposal={proposal} canPrice={canPrice} />)}
      </fieldset>
    </div>
  );
}

export function ImportBatchWorkspace({ batchId }: { readonly batchId: string }) {
  const { t } = useImportText();
  const notify = useCatalogFailureNotice();
  const workspace = useImportBatch(batchId);
  const [focus, setFocus] = useState<ReviewFocus | null>(null);
  const { view, failure } = workspace;

  useEffect(() => {
    if (failure) notify(failure);
  }, [failure, notify]);

  if (!view) return <p className="m-0 text-muted-foreground" role="status">{t('batch.loading')}</p>;
  const sourceFileId = sourceFileIdOf(view);
  // Χωρίς πηγή δίπλα η λίστα πιάνει όλο το πλάτος: όλη η επιφάνεια είναι το κυλιόμενο δοχείο, όχι η μισή.
  return (
    <section className={cn('grid min-h-0 flex-1 grid-cols-1 gap-4', sourceFileId !== null && 'xl:grid-cols-2')} aria-label={view.batch.fileName}>
      <BatchProposals workspace={workspace} view={view} focus={focus} onFocus={setFocus} />
      {sourceFileId === null ? null : <SourcePane view={view} fileId={sourceFileId} focus={focus} />}
    </section>
  );
}
