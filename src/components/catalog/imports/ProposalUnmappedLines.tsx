'use client';

/**
 * @fileoverview **Γραμμές της πηγής χωρίς πεδίο, μέσα στην πρόταση του πίνακά τους** (ADR-923 §5.5.2 Β3 Γ8). Ανοιχτές, κάτω από
 *   τα πεδία, με τρεις ενέργειες: αντιστοίχιση σε ιδιότητα · νέα ιδιότητα από τη γραμμή · αγνόηση. Η απόφαση ξαναερμηνεύει τον
 *   πίνακα **χωρίς AI**· όταν ο διακομιστής δεν μπορεί, το λέει με λόγο δίπλα στη γραμμή.
 * @module components/catalog/imports/ProposalUnmappedLines
 *
 * 🔑 Κατάσταση με εικονίδιο **και** λέξη (CHECK 3.41): «ξέρω ποιο είναι ποιο χωρίς χρώμα».
 * 🔑 Η βιβλιοθήκη ιδιοτήτων φορτώνεται **μόνο** όταν ανοίξει ενέργεια (`LineAttributeTools`): το πρώτο καρέ δεν την πληρώνει.
 * ⚠️ Τεμπέλικη **επιφάνεια** (`import-surfaces.tsx`, ADR-744 §27), όχι σκέτο `next/dynamic`: το chunk περιμένει τα κείμενά του. Η
 *    στατική ακμή έφερνε όλο το namespace `catalog` (φόρμα ιδιότητας) στο route slice (μετρημένο 2026-11-08: 21461 bytes, ταβάνι 11528).
 */

import React, { useState } from 'react';
import { CircleDot, Euro, EyeOff, Link2, LoaderCircle, Plus, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { lineDecisionOf, lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportLineDecision, ImportLineOverride, ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportMemoryHint, ImportProposalWire, SetImportLineRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { useCatalogCanManage } from '../shared/catalog-ui-hooks';
import { LINE_REFUSAL_KEYS, LINE_STATE_KEYS, useImportText, type LineState } from './import-text';
import { LineAttributeToolsSlot, PriceLineDialogSlot } from './import-surfaces';
import type { LineToolMode } from './line-tool-props';
import { MemoryHintNote } from './MemoryHintNote';
import type { LineActivity } from './use-line-decisions';

const STATE_LOOK: Readonly<Record<LineState, { readonly variant: 'muted' | 'info' | 'warning' | 'destructive' | 'outline'; readonly icon: LucideIcon }>> = {
  pending: { variant: 'warning', icon: CircleDot },
  ignored: { variant: 'muted', icon: EyeOff },
  mapped: { variant: 'info', icon: Link2 },
  saving: { variant: 'outline', icon: LoaderCircle },
  refused: { variant: 'destructive', icon: TriangleAlert },
};

function lineStateOf(activity: LineActivity | undefined, decision: ReturnType<typeof lineDecisionOf>): LineState {
  if (activity) return activity.kind;
  if (decision?.kind === 'ignore') return 'ignored';
  return decision?.kind === 'attribute' || decision?.kind === 'price' ? 'mapped' : 'pending';
}

/** Ποια εργαλεία ανοίγει μια γραμμή: ιδιότητα (Β3) ή τιμή (Β4). */
type LineTool = LineToolMode | 'price';

export interface UnmappedLinesProps {
  readonly proposal: ImportProposalWire;
  readonly lines: readonly ImportPageUnmappedLine[];
  readonly overrides: readonly ImportLineOverride[] | undefined;
  readonly activity: ReadonlyMap<string, LineActivity>;
  readonly activeLine: string | null;
  readonly onFocusLine: (line: ImportPageUnmappedLine) => void;
  readonly onDecideLine: (proposal: ImportProposalWire, request: SetImportLineRequest) => void;
  /** Η πρόταση εκκρεμεί **και** η παρτίδα της είναι ανοιχτή — η ίδια κρίση με τα πεδία της πρότασης (ADR-934 Ε3). */
  readonly decidable: boolean;
  /** §5.5.2 Β4: η παρτίδα έχει τιμοκατάλογο **και** ο άνθρωπος δικαίωμα τιμολόγησης ⇒ μια γραμμή μπορεί να γίνει τιμή. */
  readonly pricesEnabled?: boolean;
  /** §5.5.2 Β5.2: τι προτείνει η μνήμη του προμηθευτή, ανά γραμμή (`lineKeyOf`). */
  readonly memoryHints?: ReadonlyMap<string, ImportMemoryHint>;
}

interface LineRowProps {
  readonly line: ImportPageUnmappedLine;
  readonly state: LineState;
  readonly refusal: string | null;
  readonly hint: ImportMemoryHint | undefined;
  readonly onAccept: (decision: ImportLineDecision) => void;
  readonly active: boolean;
  readonly readOnly: boolean;
  readonly canManage: boolean;
  readonly pricesEnabled: boolean;
  readonly onFocus: () => void;
  readonly onTool: (mode: LineTool) => void;
  readonly onIgnore: (ignore: boolean) => void;
}

function LineActions({ state, readOnly, canManage, pricesEnabled, onTool, onIgnore }: Pick<LineRowProps, 'state' | 'readOnly' | 'canManage' | 'pricesEnabled' | 'onTool' | 'onIgnore'>) {
  const { t } = useImportText();
  const busy = readOnly || state === 'saving';
  if (state === 'ignored' || state === 'mapped') {
    return <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onIgnore(false)}><Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.undo')}</Button>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onTool('map')}><Link2 className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.map')}</Button>
      {canManage ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onTool('new')}><Plus className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.newAttribute')}</Button> : null}
      {pricesEnabled ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onTool('price')}><Euro className="mr-1 h-3 w-3" aria-hidden />{t('review.priceLine.action')}</Button> : null}
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onIgnore(true)}><EyeOff className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.ignore')}</Button>
    </span>
  );
}

function LineRow(props: LineRowProps) {
  const { t } = useImportText();
  const { line, state, refusal, active, onFocus } = props;
  const { variant, icon: Icon } = STATE_LOOK[state];
  return (
    <li className={`flex flex-col gap-1 rounded-md border p-2 ${active ? 'border-ring' : 'border-border'}`}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="text-left text-sm font-medium underline-offset-2 hover:underline" aria-label={`${t('review.lines.show')}: ${line.label}`} onClick={onFocus}>
          {line.label}
        </button>
        <Badge variant={variant} className="gap-1"><Icon className="h-3 w-3" aria-hidden />{t(LINE_STATE_KEYS[state])}</Badge>
      </span>
      <span className="text-xs text-muted-foreground">{line.values.join(' · ')}</span>
      {refusal ? <span className="text-xs text-destructive" role="status">{refusal}</span> : null}
      {props.hint ? <MemoryHintNote hint={props.hint} disabled={props.readOnly || state === 'saving'} onAccept={props.onAccept} /> : null}
      <LineActions {...props} />
    </li>
  );
}

export function ProposalUnmappedLines(props: UnmappedLinesProps) {
  const { proposal, overrides, activity, activeLine, onFocusLine, onDecideLine, decidable, pricesEnabled = false, memoryHints } = props;
  const { t } = useImportText();
  const canManage = useCatalogCanManage();
  const [tool, setTool] = useState<{ readonly line: ImportPageUnmappedLine; readonly mode: LineTool } | null>(null);
  // §5.5.2 Β5.2: μόνο όσες περιμένουν απόφαση· οι αποφασισμένες (και οι αγνοημένες) ζουν στο `ProposalDecidedLines`, με την προέλευσή τους.
  const lines = props.lines.filter((line) => lineDecisionOf(overrides, line) === null);
  if (lines.length === 0) return null;
  const readOnly = !decidable;
  const send = (line: ImportPageUnmappedLine, decision: SetImportLineRequest['decision'], bind: SetImportLineRequest['bind'] = null) =>
    onDecideLine(proposal, { page: line.page, table: line.table, line: line.line, decision, bind });
  return (
    <section className="flex flex-col gap-2" aria-label={t('review.lines.title')}>
      <h4 className="m-0 text-sm font-semibold">{t('review.lines.title')}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t('review.lines.hint')}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((line) => {
          const key = lineKeyOf(line);
          const current = activity.get(key);
          return (
            <LineRow key={key} line={line} state={lineStateOf(current, lineDecisionOf(overrides, line))}
              refusal={current?.kind === 'refused' ? t(LINE_REFUSAL_KEYS[current.reason]) : null}
              hint={memoryHints?.get(key)} onAccept={(decision) => send(line, decision)}
              active={key === activeLine} readOnly={readOnly} canManage={canManage} pricesEnabled={pricesEnabled}
              onFocus={() => onFocusLine(line)} onTool={(mode) => setTool({ line, mode })}
              onIgnore={(ignore) => send(line, ignore ? { kind: 'ignore' } : null)} />
          );
        })}
      </ul>
      {tool?.mode === 'price' ? (
        <PriceLineDialogSlot line={tool.line} onClose={() => setTool(null)} onDecide={(unitCode) => send(tool.line, { kind: 'price', unitCode })} />
      ) : null}
      {tool && tool.mode !== 'price' ? (
        <LineAttributeToolsSlot proposal={proposal} line={tool.line} mode={tool.mode} onClose={() => setTool(null)}
          onDecide={(attributeId, bind) => send(tool.line, { kind: 'attribute', attributeId }, bind)} />
      ) : null}
    </section>
  );
}
