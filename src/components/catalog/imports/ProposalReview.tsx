'use client';

/**
 * @fileoverview **Έλεγχος μιας πρότασης** (ADR-923 §5.5): γραμμές με διαφορά ανά πεδίο, ευρήματα κανόνων, μαζικές αποφάσεις,
 *   έγκριση. Το PDF το κρατά η γονική όψη· εδώ μόνο δηλώνεται ποιο πεδίο εστιάστηκε.
 *
 * 🔑 §5.5.2 Β8: η επιλογή ζει στον **έναν** κάτοχο (`useReviewSelection`) ως **κλειδί** — εδώ μόνο διαβάζεται (`selectedKey`) και
 *    γράφεται (`onSelect`). Πεδίο που η προβολή κρύβει αλλά επιλέχτηκε στο PDF **φαίνεται**, με σημείωση· το φίλτρο του ανθρώπου
 *    **δεν** αλλάζει (κανένα από τα Rossum · Azure DI · ABBYY δεν τεκμηριώνει πρότυπο — δική μας απόφαση, δηλωμένη στο ADR).
 * @module components/catalog/imports/ProposalReview
 */

import React, { useMemo, useState } from 'react';
import { Undo2, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldAddress } from '@/subapps/catalog/import/human-edits';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField, ImportProposalRow, ImportValueEdit } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { useImportIssueMessage } from './import-issue-messages';
import { PROPOSAL_STATUS_KEYS, ROW_ACTION_KEYS, useImportText } from './import-text';
import { ProposalFieldRow } from './ProposalFieldRow';
import type { ProposalChange } from './proposal-change-queue';
import { fieldVisibleIn, initialProposalView, nextPendingField, summarizeProposal, type ProposalView } from './proposal-summary';
import { ProposalSummaryBar } from './ProposalSummaryBar';
import { ProposalDecidedLines } from './ProposalDecidedLines';
import { ProposalUnmappedLines, type UnmappedLinesProps } from './ProposalUnmappedLines';
import { fieldTargetOf, reviewTargetKey, type ReviewTarget } from './review-overlay-model';

interface ProposalReviewProps {
  readonly proposal: ImportProposalWire;
  /** §5.5.2 Β8: το κλειδί του επιλεγμένου στόχου στον έναν κάτοχο (`reviewTargetKey`) — `null` = τίποτα. */
  readonly selectedKey: string | null;
  /** §5.5.2 Β8: η επιλογή ήρθε από κλικ στο PDF ⇒ η εστίαση πληκτρολογίου περνά στο πεδίο. */
  readonly focusRequested?: boolean;
  readonly onSelect: (target: ReviewTarget) => void;
  readonly onChange: (proposal: ImportProposalWire, change: ProposalChange) => void;
  readonly onApply: (proposal: ImportProposalWire) => void;
  readonly onReject: (proposal: ImportProposalWire) => void;
  /** §5.5.2 Α5: αλλαγές της πρότασης ταξιδεύουν ακόμη προς τον διακομιστή. */
  readonly saving?: boolean;
  /** Ε7: γραμμές της πηγής του πίνακα της πρότασης που περιμένουν απόφαση (§5.5.2 Α6). */
  readonly unmapped?: number;
  /** §5.5.2 Β3 · Β5.2: οι γραμμές του πίνακα της πρότασης — χωρίς πεδίο (με ενέργειες) και αποφασισμένες (με προέλευση και αναίρεση). */
  readonly lines?: Omit<UnmappedLinesProps, 'proposal' | 'decidable'>;
  /** Η παρτίδα δέχεται ακόμη αποφάσεις (όχι `closed` / `discarded`) — ο server το επιβάλλει ξανά (ADR-934 Ε3). */
  readonly batchOpen: boolean;
  /** §5.5.2 Β4: από πού ήρθε η πρόταση τιμών (γραμμή του πίνακα, μονάδα, αναίρεση) · Β7: νέες τιμές άξονα για την πρόταση ιδιοτήτων. */
  readonly source?: React.ReactNode;
}

/** §5.5.2 Β4 Δ5: η πρόταση τιμών περιμένει να εγκριθούν οι ιδιότητες που γεννούν τα SKU της. Ο server αρνείται ξανά. */
const awaitsAttributes = (proposal: ImportProposalWire): boolean =>
  proposal.rows.some((row) => row.issues.some((issue) => issue.code === 'awaitsAttributes'));

function proposalTitle(proposal: ImportProposalWire, t: ReturnType<typeof useImportText>['t']): string {
  return proposal.purpose === 'priceLines' && proposal.modelCode === null ? t('review.pricesTitle') : (proposal.modelCode ?? t('review.noModel'));
}

/** `decidable`: η πρόταση εκκρεμεί **και** η παρτίδα της είναι ανοιχτή — η μία κρίση για κάθε κουμπί απόφασης. */
type RowProps = Pick<ProposalReviewProps, 'proposal' | 'selectedKey' | 'focusRequested' | 'onSelect' | 'onChange'> & {
  readonly row: ImportProposalRow;
  readonly view: ProposalView;
  readonly decidable: boolean;
};

/** §5.5.2 Β6: οι διορθώσεις του ανθρώπου ανά διεύθυνση πεδίου — η ίδια διεύθυνση με τον διακομιστή (`fieldAddress`). */
const editsOf = (proposal: ImportProposalWire): ReadonlyMap<string, ImportValueEdit> =>
  new Map((proposal.edits ?? []).map((edit) => [fieldAddress(edit.rowKey, edit.targetKey), edit]));

/** Το κλειδί αναθεώρησης ενός πεδίου — το ίδιο που κρατά ο κάτοχος και τα πλαίσια του PDF. */
const fieldKeyOf = (proposalId: string, row: ImportProposalRow, field: ImportProposalField): string =>
  reviewTargetKey(fieldTargetOf(proposalId, row, field));

type FieldEntryProps = Omit<RowProps, 'decidable'> & {
  readonly field: ImportProposalField;
  readonly edits: ReadonlyMap<string, ImportValueEdit>;
  readonly readOnly: boolean;
};

/** Ένα πεδίο στον πίνακα — ή τίποτα, όταν η προβολή το κρύβει **και** δεν είναι το επιλεγμένο (§5.5.2 Β8). */
function FieldEntry({ field, row, proposal, edits, selectedKey, focusRequested = false, onSelect, onChange, view, readOnly }: FieldEntryProps) {
  const targetKey = importTargetKey(field.target);
  const reviewKey = fieldKeyOf(proposal.id, row, field);
  const active = reviewKey === selectedKey;
  const inView = fieldVisibleIn(view, field);
  if (!inView && !active) return null;
  const change = (patch: ProposalChange) => onChange(proposal, patch);
  return (
    <ProposalFieldRow
      field={field}
      edit={edits.get(fieldAddress(row.rowKey, targetKey)) ?? null}
      active={active}
      reviewKey={reviewKey}
      focusRequested={active && focusRequested}
      revealedFrom={inView ? null : view}
      readOnly={readOnly}
      onFocus={() => onSelect(fieldTargetOf(proposal.id, row, field))}
      onDecide={(decision) => change({ decisions: [{ rowKey: row.rowKey, targetKey, decision }] })}
      onEdit={(text) => change({ edits: [{ rowKey: row.rowKey, targetKey, text }] })}
      onRevert={() => change({ edits: [{ rowKey: row.rowKey, targetKey, text: '', revert: true }] })}
    />
  );
}

function RowFields(props: RowProps) {
  const { row, proposal, decidable } = props;
  const { t } = useImportText();
  const edits = useMemo(() => editsOf(proposal), [proposal]);
  return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="p-2 font-medium">{t('review.field')}</th>
            <th className="p-2 font-medium">{t('review.live')}</th>
            <th className="p-2 font-medium">{t('review.incoming')}</th>
            <th className="p-2 font-medium">{t('review.status')}</th>
            <th className="p-2 font-medium">{t('review.confidence')}</th>
            <th className="p-2 font-medium">{t('review.decision')}</th>
          </tr>
        </thead>
        <tbody>
          {row.fields.map((field) => <FieldEntry key={importTargetKey(field.target)} {...props} field={field} edits={edits} readOnly={!decidable} />)}
        </tbody>
      </table>
  );
}

function RowSection(props: RowProps) {
  const { row, proposal, onChange, decidable } = props;
  const { t } = useImportText();
  const message = useImportIssueMessage(row.issues.length > 0);
  const acceptAll = () => onChange(proposal, {
    decisions: row.fields.filter((field) => field.incoming !== null).map((field) => ({ rowKey: row.rowKey, targetKey: importTargetKey(field.target), decision: 'accept' as const })),
  });
  return (
    <section className="flex flex-col gap-1" aria-label={row.label}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="m-0 text-sm font-semibold">{row.label} · {t(ROW_ACTION_KEYS[row.action])}</h4>
        <Button type="button" size="sm" variant="outline" disabled={!decidable} onClick={acceptAll}>{t('review.acceptRow')}</Button>
      </header>
      {row.issues.length > 0 ? (
        <ul className="m-0 list-none p-0 text-xs text-destructive" role="alert">
          {row.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{message(issue)}</li>)}
        </ul>
      ) : null}
      <RowFields {...props} />
    </section>
  );
}

/** Η πρόταση κωδικού από ό,τι μοιράζονται οι παραλλαγές: γεμίζει το πεδίο, αλλά τον ορίζει ο άνθρωπος. */
function suggestedModelCode(proposal: ImportProposalWire): string {
  const issue = proposal.rows.flatMap((row) => row.issues).find(({ code }) => code === 'modelCodeMissing');
  return String(issue?.params?.suggestion ?? '');
}

/**
 * Ο κωδικός μοντέλου του ανθρώπου (§5.5.2 Β6): ζει στον κατάλογο διορθώσεων, άρα επιβιώνει κάθε ξαναχτίσιμο του πίνακα. Μένει
 * επεξεργάσιμος και αφαιρείται (κενό ⇒ ο διακομιστής σβήνει τη διόρθωση).
 */
function ModelCodeField({ proposal, onChange }: Pick<ProposalReviewProps, 'proposal' | 'onChange'>) {
  const { t } = useImportText();
  const ours = proposal.modelCodeEdit?.modelCode ?? null;
  const [code, setCode] = useState(() => ours ?? suggestedModelCode(proposal));
  return (
    <section className="flex flex-col gap-1" aria-label={t('review.modelCode')}>
      <p className="m-0 flex flex-wrap items-end gap-2">
        <span className="flex flex-col gap-1">
          <Label htmlFor={`model-${proposal.id}`}>{t('review.modelCode')}</Label>
          <Input id={`model-${proposal.id}`} value={code} onChange={(event) => setCode(event.target.value)} />
        </span>
        <Button type="button" size="sm" disabled={code.trim() === '' || code.trim() === ours} onClick={() => onChange(proposal, { modelCode: code.trim() })}>{t('review.setModelCode')}</Button>
        {ours !== null ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange(proposal, { modelCode: '' })}><Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.removeModelCode')}</Button> : null}
      </p>
      {ours !== null ? <p className="m-0 text-xs text-muted-foreground"><UserRound className="mr-1 inline h-3 w-3" aria-hidden />{t('review.modelCodeByYou')}</p> : null}
    </section>
  );
}

/** Το πεδίο κωδικού φαίνεται όταν η πηγή δεν έδωσε κωδικό **ή** όταν τον έδωσε ο άνθρωπος (για αλλαγή/αφαίρεση). */
const showsModelCodeField = (proposal: ImportProposalWire): boolean =>
  proposal.purpose === 'attributes' && proposal.variantSchemeCode !== null && (proposal.modelCode === null || proposal.modelCodeEdit !== undefined);

/**
 * Γραμμή χωρίς ορατό πεδίο στην προβολή κρύβεται· γραμμή με εύρημα μένει, γιατί το εύρημα κλειδώνει την έγκριση· γραμμή με το
 * **επιλεγμένο** πεδίο μένει (§5.5.2 Β8), αλλιώς το κλικ στο PDF θα κατέληγε σε τίποτα.
 */
const rowVisibleIn = (view: ProposalView, row: ImportProposalRow, proposalId: string, selectedKey: string | null): boolean =>
  row.issues.length > 0 || row.fields.some((field) => fieldVisibleIn(view, field) || fieldKeyOf(proposalId, row, field) === selectedKey);

/** Α6: το επόμενο που θέλει απόφαση **μετά το επιλεγμένο** — ως στόχος για τον κάτοχο. */
function nextPendingTarget(proposal: ImportProposalWire, selectedKey: string | null): ReviewTarget | null {
  const located = proposal.rows.flatMap((row) => row.fields.map((field) => ({ row, field })));
  const current = located.find(({ row, field }) => fieldKeyOf(proposal.id, row, field) === selectedKey)?.field ?? null;
  const next = nextPendingField(proposal.rows, current);
  const owner = next ? located.find(({ field }) => field === next) : undefined;
  return owner ? fieldTargetOf(proposal.id, owner.row, owner.field) : null;
}

export function ProposalReview({ proposal, selectedKey, focusRequested = false, onSelect, onChange, onApply, onReject, saving = false, unmapped = 0, lines, batchOpen, source }: ProposalReviewProps) {
  const { t } = useImportText();
  const summary = useMemo(() => summarizeProposal(proposal.rows), [proposal.rows]);
  const [view, setView] = useState<ProposalView>(() => initialProposalView(summary));
  const { pending } = summary;
  const open = batchOpen && proposal.status === 'pending';
  const awaiting = awaitsAttributes(proposal);
  const rows = proposal.rows.filter((row) => rowVisibleIn(view, row, proposal.id, selectedKey));
  const focusNextPending = () => {
    const next = nextPendingTarget(proposal, selectedKey);
    if (next) onSelect(next);
  };
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{proposalTitle(proposal, t)} · {t(PROPOSAL_STATUS_KEYS[proposal.status])}</h3>
        {open ? (
          <span className="flex items-center gap-2">
            {saving ? <span className="text-sm text-muted-foreground" role="status">{t('review.saving')}</span> : null}
            {pending > 0 ? <span className="text-sm text-muted-foreground" role="status">{t('review.pending', { count: pending })}</span> : null}
            <Button type="button" variant="outline" onClick={() => onReject(proposal)}>{t('review.rejectAll')}</Button>
            <Button type="button" disabled={pending > 0 || awaiting} onClick={() => onApply(proposal)}>{t('review.apply')}</Button>
          </span>
        ) : null}
      </header>
      {source}
      {open && awaiting ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('review.awaitsAttributes')}</p> : null}
      {open && showsModelCodeField(proposal) ? <ModelCodeField proposal={proposal} onChange={onChange} /> : null}
      {proposal.violations.length > 0 ? <p className="m-0 text-sm text-destructive" role="status">{t('review.violations', { count: proposal.violations.length })}</p> : null}
      <ProposalSummaryBar summary={summary} unmapped={unmapped} view={view} onView={setView} onNextPending={focusNextPending} />
      {rows.length === 0 ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('review.viewEmpty')}</p> : null}
      {rows.map((row) => <RowSection key={row.rowKey} row={row} view={view} proposal={proposal} selectedKey={selectedKey} focusRequested={focusRequested} onSelect={onSelect} onChange={onChange} decidable={open} />)}
      {lines ? <ProposalUnmappedLines proposal={proposal} {...lines} decidable={open} /> : null}
      {lines ? (
        <ProposalDecidedLines proposal={proposal} lines={lines.lines} overrides={lines.overrides} activity={lines.activity}
          onDecideLine={lines.onDecideLine} pricesEnabled={lines.pricesEnabled} decidable={open}
          activeLine={lines.activeLine} onFocusLine={lines.onFocusLine} focusRequested={lines.focusRequested} />
      ) : null}
    </article>
  );
}
