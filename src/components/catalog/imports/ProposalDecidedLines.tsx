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
 */

import React from 'react';
import { BrainCircuit, EyeOff, Link2, LoaderCircle, TriangleAlert, Undo2, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { decidedLinesOf, type DecidedLine } from '@/subapps/catalog/import/decided-lines';
import { pageTableAddressOf } from '@/subapps/catalog/import/import-keys';
import { lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportLineOverride, ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire, SetImportLineRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { LINE_REFUSAL_KEYS, LINE_STATE_KEYS, useImportText } from './import-text';
import { useLineDecisionText } from './line-decision-text';
import type { LineActivity } from './use-line-decisions';

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
}

function DecidedRow({ entry, decision, activity, readOnly, onUndo }: DecidedRowProps) {
  const { t } = useImportText();
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-2">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{entry.label ?? t('review.decided.lineN', { line: entry.line + 1 })} → {decision}</span>
        <span className="flex flex-wrap gap-1"><OriginBadge entry={entry} /><StateBadge entry={entry} activity={activity} /></span>
      </span>
      {entry.values.length > 0 ? <span className="text-xs text-muted-foreground">{entry.values.join(' · ')}</span> : null}
      {entry.origin ? <span className="text-xs text-muted-foreground">{t('review.decided.sourceBatch', { batch: entry.origin.sourceBatchId })}</span> : null}
      {activity?.kind === 'refused' ? <span className="text-xs text-destructive" role="status">{t(LINE_REFUSAL_KEYS[activity.reason])}</span> : null}
      <span>
        <Button type="button" size="sm" variant="ghost" disabled={readOnly || activity?.kind === 'saving'} onClick={onUndo}>
          <Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.undo')}
        </Button>
      </span>
    </li>
  );
}

export function ProposalDecidedLines({ proposal, lines, overrides, activity, onDecideLine, decidable, pricesEnabled = false }: DecidedLinesProps) {
  const { t } = useImportText();
  const decisionText = useLineDecisionText();
  const address = pageTableAddressOf(proposal.groupKey);
  if (address === null) return null;
  const decided = decidedLinesOf(overrides, lines, address.page, address.table);
  if (decided.length === 0) return null;
  const undo = (entry: DecidedLine) => onDecideLine(proposal, { page: entry.page, table: entry.table, line: entry.line, decision: null, bind: null });
  return (
    <section className="flex flex-col gap-2" aria-label={t('review.decided.title')}>
      <h4 className="m-0 text-sm font-semibold">{t('review.decided.title')}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t('review.decided.hint')}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {decided.map((entry) => (
          <DecidedRow key={lineKeyOf(entry)} entry={entry} decision={decisionText.of(entry.decision)} activity={activity.get(lineKeyOf(entry))}
            readOnly={!decidable || (entry.decision.kind === 'price' && !pricesEnabled)} onUndo={() => undo(entry)} />
        ))}
      </ul>
    </section>
  );
}
