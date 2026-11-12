'use client';

/**
 * @fileoverview **Οι αποφασισμένες γραμμές του πίνακα μιας πρότασης** (ADR-923 §5.5.2 Β5.2): κάθε απόφαση γραμμής —ιδιότητα, τιμή,
 *   αγνόηση— με την **προέλευσή** της («από εσάς» ή «από μνήμη · Ν εγκρίσεις») και αναίρεση.
 * @module components/catalog/imports/ProposalDecidedLines
 *
 * 🔑 Κλείνει κενό του Β3: γραμμή που έγινε πεδίο έφευγε από τις «γραμμές χωρίς πεδίο» και η απόφαση **δεν φαινόταν ούτε αναιρούνταν**.
 *    Πηγή αλήθειας οι αποφάσεις της παρτίδας (`decidedLinesOf`), όχι η ανάγνωση. Πρακτική Akeneo SDM / Flatfile: κάθε αντιστοίχιση
 *    που ήρθε από προηγούμενη δουλειά φαίνεται και αλλάζει.
 * 🔑 Προέλευση και κατάσταση με εικονίδιο **και** λέξη (CHECK 3.41). Η αναίρεση είναι η ίδια απόφαση `null` με τις γραμμές χωρίς πεδίο.
 * 🔑 §5.5.2 Β3 Γ13: αντιστοιχισμένη γραμμή γεμίζει **και** άλλη ιδιότητα («Και σε άλλη ιδιότητα») — ίδιο εργαλείο γραμμής, η απόφαση
 *    στέλνεται πλήρης (`withAlsoAttribute`).
 * 🔑 §5.5.2 Β8: γραμμή που έχει ακόμη θέση στη σελίδα (αγνοημένη ⇒ «απορρίφθηκε» στο PDF) επιλέγεται και από εδώ και από το
 *    πλαίσιό της· ίδια ταυτότητα (`lineTargetOf`), ίδιο hover.
 */

import React, { useState } from 'react';
import { BrainCircuit, EyeOff, Link2, LoaderCircle, Plus, Sparkles, TriangleAlert, Undo2, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { canAddLineTarget, decidedLinesOf, decidedToolLineOf, type DecidedLine } from '@/subapps/catalog/import/decided-lines';
import { pageTableAddressOf } from '@/subapps/catalog/import/import-keys';
import { lineKeyOf, withAlsoAttribute } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportLineOverride, ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire, SetImportLineRequest } from '@/subapps/catalog/types/catalog-import-requests';
// Ο ουδέτερος αναγνώστης, όχι το `useCatalogCanManage` του `catalog-ui-hooks`: εκείνο φέρνει το namespace `catalog` στο slice (CHECK 3.34).
import { useCatalogAccess } from '../shared/catalog-neutral-hooks';
import { LineAttributeToolsSlot } from './import-surfaces';
import { LINE_REFUSAL_KEYS, LINE_STATE_KEYS, useImportText } from './import-text';
import { useLineDecisionText } from './line-decision-text';
import type { LineToolMode } from './line-tool-props';
import type { LineActivity } from './use-line-decisions';
import { useReviewLineItem } from './use-review-line-item';

interface DecidedLinesProps {
  readonly proposal: ImportProposalWire;
  readonly lines: readonly ImportPageUnmappedLine[];
  readonly overrides: readonly ImportLineOverride[] | undefined;
  readonly activity: ReadonlyMap<string, LineActivity>;
  readonly onDecideLine: (proposal: ImportProposalWire, request: SetImportLineRequest) => void;
  /** Η πρόταση εκκρεμεί **και** η παρτίδα της είναι ανοιχτή (ADR-934 Ε3). */
  readonly decidable: boolean;
  /** Τιμοκατάλογος + δικαίωμα τιμολόγησης: χωρίς αυτά η γραμμή τιμής φαίνεται, αλλά δεν αναιρείται από εδώ (ο server θα αρνιόταν). */
  readonly pricesEnabled?: boolean;
  /** §5.5.2 Β8: η επιλεγμένη γραμμή (`lineKeyOf`) στον έναν κάτοχο, και η εγγραφή σε αυτόν. */
  readonly activeLine?: string | null;
  readonly onFocusLine?: (line: ImportPageUnmappedLine) => void;
  readonly focusRequested?: boolean;
}

function OriginBadge({ entry }: { readonly entry: DecidedLine }) {
  const { t } = useImportText();
  if (entry.origin === null) {
    return <Badge variant="outline" className="gap-1"><UserRound className="h-3 w-3" aria-hidden />{t('review.decided.byHuman')}</Badge>;
  }
  return <Badge variant="info" className="gap-1"><BrainCircuit className="h-3 w-3" aria-hidden />{t('review.decided.byMemory', { count: entry.origin.count })}</Badge>;
}

function StateBadge({ entry, activity }: { readonly entry: DecidedLine; readonly activity: LineActivity | undefined }) {
  const { t } = useImportText();
  if (activity?.kind === 'saving') return <Badge variant="outline" className="gap-1"><LoaderCircle className="h-3 w-3" aria-hidden />{t(LINE_STATE_KEYS.saving)}</Badge>;
  if (activity?.kind === 'refused') return <Badge variant="destructive" className="gap-1"><TriangleAlert className="h-3 w-3" aria-hidden />{t(LINE_STATE_KEYS.refused)}</Badge>;
  const ignored = entry.decision.kind === 'ignore';
  const Icon = ignored ? EyeOff : Link2;
  return <Badge variant={ignored ? 'muted' : 'info'} className="gap-1"><Icon className="h-3 w-3" aria-hidden />{t(ignored ? LINE_STATE_KEYS.ignored : LINE_STATE_KEYS.mapped)}</Badge>;
}

interface DecidedRowProps {
  readonly entry: DecidedLine;
  /** Το κείμενο της απόφασης (`useLineDecisionText`, μία φορά για όλη τη λίστα). */
  readonly decision: string;
  readonly activity: LineActivity | undefined;
  readonly readOnly: boolean;
  readonly onUndo: () => void;
  /** §5.5.2 Β8: η γραμμή της σελίδας, όταν υπάρχει ακόμη (αγνοημένη) — μόνο τότε έχει πλαίσιο να επιλεγεί. */
  readonly source: ImportPageUnmappedLine | undefined;
  readonly active: boolean;
  readonly focusRequested: boolean;
  readonly onFocus: (line: ImportPageUnmappedLine) => void;
  /** §5.5.2 Β3 Γ13: «και σε άλλη ιδιότητα» — `null` όταν η γραμμή δεν δέχεται άλλον στόχο ή ο άνθρωπος δεν μπορεί να τον δώσει. */
  readonly onAddTarget: ((mode: LineToolMode) => void) | null;
  readonly canManage: boolean;
}

/** §5.5.2 Β3 Γ13: η ίδια γραμμή γεμίζει και άλλη ιδιότητα — υπάρχουσα, ή νέα όταν ο άνθρωπος αλλάζει δομή. */
function AddTargetActions({ onAddTarget, canManage, disabled }: { readonly onAddTarget: (mode: LineToolMode) => void; readonly canManage: boolean; readonly disabled: boolean }) {
  const { t } = useImportText();
  return (
    <>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onAddTarget('map')}>
        <Plus className="mr-1 h-3 w-3" aria-hidden />{t('review.decided.addTarget')}
      </Button>
      {canManage ? (
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onAddTarget('new')}>
          <Sparkles className="mr-1 h-3 w-3" aria-hidden />{t('review.decided.addTargetNew')}
        </Button>
      ) : null}
    </>
  );
}

/** Η ετικέτα της απόφασης· κουμπί επιλογής όταν η γραμμή έχει θέση στη σελίδα (§5.5.2 Β8). */
function DecidedTitle({ entry, decision, source, active, onFocus, buttonRef, hover }: Pick<DecidedRowProps, 'entry' | 'decision' | 'source' | 'active' | 'onFocus'> & {
  readonly buttonRef: React.RefObject<HTMLButtonElement>;
  readonly hover: ReturnType<typeof useReviewLineItem>['hover'];
}) {
  const { t } = useImportText();
  const text = `${entry.label ?? t('review.decided.lineN', { line: entry.line + 1 })} → ${decision}`;
  if (!source) return <span className="text-sm font-medium">{text}</span>;
  return (
    <button ref={buttonRef} type="button" className="text-left text-sm font-medium underline-offset-2 hover:underline" aria-current={active ? 'true' : undefined}
      onClick={() => onFocus(source)} onFocus={hover.onFocus} onBlur={hover.onBlur}>{text}</button>
  );
}

function DecidedRow({ entry, decision, activity, readOnly, onUndo, source, active, focusRequested, onFocus, onAddTarget, canManage }: DecidedRowProps) {
  const { t } = useImportText();
  const { itemProps, buttonRef, hover } = useReviewLineItem(entry, active, focusRequested);
  const busy = readOnly || activity?.kind === 'saving';
  return (
    <li {...itemProps}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <DecidedTitle entry={entry} decision={decision} source={source} active={active} onFocus={onFocus} buttonRef={buttonRef} hover={hover} />
        <span className="flex flex-wrap gap-1"><OriginBadge entry={entry} /><StateBadge entry={entry} activity={activity} /></span>
      </span>
      {entry.values.length > 0 ? <span className="text-xs text-muted-foreground">{entry.values.join(' · ')}</span> : null}
      {entry.origin ? <span className="text-xs text-muted-foreground">{t('review.decided.sourceBatch', { batch: entry.origin.sourceBatchId })}</span> : null}
      {activity?.kind === 'refused' ? <span className="text-xs text-destructive" role="status">{t(LINE_REFUSAL_KEYS[activity.reason])}</span> : null}
      <span className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onUndo}>
          <Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.undo')}
        </Button>
        {onAddTarget ? <AddTargetActions onAddTarget={onAddTarget} canManage={canManage} disabled={busy} /> : null}
      </span>
    </li>
  );
}

const noFocus = () => undefined;

/**
 * Γραμμή χωρίς αδελφή ⇒ το εργαλείο δεν φτάνει ποτέ στη ροή `create` (Γ11): η νέα ιδιότητα γεννιέται στον διάλογο και έρχεται από το
 * `onDecide`, όπως στις γραμμές χωρίς πεδίο. Η αντιστοιχισμένη γραμμή δεν έχει αδελφή (`decidedToolLineOf`).
 */
const noSiblingCreate = async (): Promise<void> => undefined;

interface AddTargetTool {
  readonly entry: DecidedLine;
  readonly line: ImportPageUnmappedLine;
  readonly mode: LineToolMode;
}

/** §5.5.2 Β3 Γ13: «και σε άλλη ιδιότητα» — η πλήρης απόφαση (κύρια + όσες υπάρχουν + η νέα): κατάσταση με κλειδί, ιδεμπότητη. */
function addTargetRequest(entry: DecidedLine, attributeId: string, bind: SetImportLineRequest['bind']): SetImportLineRequest | null {
  const decision = withAlsoAttribute(entry.decision, attributeId);
  return decision === null ? null : { page: entry.page, table: entry.table, line: entry.line, decision, bind };
}

/** §5.5.2 Β3 Γ13: το ανοιχτό εργαλείο «και σε άλλη ιδιότητα» — ποια γραμμή, σε ποια μορφή — και ο διάλογός του. */
function useAddTargetTool(proposal: ImportProposalWire, decidable: boolean, onDecideLine: DecidedLinesProps['onDecideLine']) {
  const [tool, setTool] = useState<AddTargetTool | null>(null);
  const addTargetOf = (entry: DecidedLine): ((mode: LineToolMode) => void) | null => {
    const line = decidable && canAddLineTarget(entry.decision) ? decidedToolLineOf(entry, proposal.rows) : null;
    return line === null ? null : (mode) => setTool({ entry, line, mode });
  };
  const addTarget = (attributeId: string, bind: SetImportLineRequest['bind']) => {
    const request = tool === null ? null : addTargetRequest(tool.entry, attributeId, bind);
    if (request !== null) onDecideLine(proposal, request);
  };
  const dialog = tool ? (
    <LineAttributeToolsSlot proposal={proposal} line={tool.line} mode={tool.mode} onClose={() => setTool(null)} onDecide={addTarget} onCreate={noSiblingCreate} />
  ) : null;
  return { addTargetOf, dialog };
}

export function ProposalDecidedLines(props: DecidedLinesProps) {
  const { proposal, lines, overrides, activity, onDecideLine, decidable, pricesEnabled = false, activeLine = null, onFocusLine = noFocus, focusRequested = false } = props;
  const { t } = useImportText();
  const decisionText = useLineDecisionText();
  const canManage = useCatalogAccess('schema') === 'granted';
  const { addTargetOf, dialog } = useAddTargetTool(proposal, decidable, onDecideLine);
  const address = pageTableAddressOf(proposal.groupKey);
  if (address === null) return null;
  const decided = decidedLinesOf(overrides, lines, address.page, address.table);
  if (decided.length === 0) return null;
  const sources = new Map(lines.map((line) => [lineKeyOf(line), line]));
  const undo = (entry: DecidedLine) => onDecideLine(proposal, { page: entry.page, table: entry.table, line: entry.line, decision: null, bind: null });
  return (
    <section className="flex flex-col gap-2" aria-label={t('review.decided.title')}>
      <h4 className="m-0 text-sm font-semibold">{t('review.decided.title')}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t('review.decided.hint')}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {decided.map((entry) => (
          <DecidedRow key={lineKeyOf(entry)} entry={entry} decision={decisionText.of(entry.decision)} activity={activity.get(lineKeyOf(entry))}
            readOnly={!decidable || (entry.decision.kind === 'price' && !pricesEnabled)} onUndo={() => undo(entry)}
            source={sources.get(lineKeyOf(entry))} active={lineKeyOf(entry) === activeLine} focusRequested={focusRequested} onFocus={onFocusLine}
            onAddTarget={addTargetOf(entry)} canManage={canManage} />
        ))}
      </ul>
      {dialog}
    </section>
  );
}
