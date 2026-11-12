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
import { CircleDot, EyeOff, Link2, LoaderCircle, Sparkles, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { lineDecisionOf, lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportLineDecision, ImportLineOverride, ImportLineSibling, ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportMemoryHint, ImportProposalWire, SetImportLineRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { useCatalogCanManage } from '../shared/catalog-ui-hooks';
import { LINE_STATE_KEYS, useImportText, type LineState } from './import-text';
import { LineAttributeToolsSlot, PriceLineDialogSlot } from './import-surfaces';
import { lineRequestOf, lineStateOf } from './line-state';
import type { LineAttributeToolsProps } from './line-tool-props';
import { useReviewLineItem } from './use-review-line-item';
import { MemoryHintNote } from './MemoryHintNote';
import { remedyActionLook, useRemedyActionLabel, useReviewReasonFormatter } from './review-reason-text';
import { lineActionsOf, type LineTool, type RemedyAction } from './review-remedy';
import type { LineActivity } from './use-line-decisions';

const STATE_LOOK: Readonly<Record<LineState, { readonly variant: 'muted' | 'info' | 'warning' | 'destructive' | 'outline'; readonly icon: LucideIcon }>> = {
  pending: { variant: 'warning', icon: CircleDot },
  ignored: { variant: 'muted', icon: EyeOff },
  mapped: { variant: 'info', icon: Link2 },
  saving: { variant: 'outline', icon: LoaderCircle },
  refused: { variant: 'destructive', icon: TriangleAlert },
};

export interface UnmappedLinesProps {
  readonly proposal: ImportProposalWire;
  readonly lines: readonly ImportPageUnmappedLine[];
  readonly overrides: readonly ImportLineOverride[] | undefined;
  readonly activity: ReadonlyMap<string, LineActivity>;
  readonly activeLine: string | null;
  readonly onFocusLine: (line: ImportPageUnmappedLine) => void;
  /** §5.5.2 Β8: η επιλογή ήρθε από κλικ στο PDF ⇒ η εστίαση πληκτρολογίου περνά στη γραμμή. */
  readonly focusRequested?: boolean;
  /** Επιστρέφει την απάντηση όταν ο κάτοχος την έχει: η μαζική «νέα ιδιότητα» (§5.5.2 Β3 Γ11) περιμένει κάθε γραμμή πριν την επόμενη. */
  readonly onDecideLine: (proposal: ImportProposalWire, request: SetImportLineRequest) => void | Promise<unknown>;
  /** Η πρόταση εκκρεμεί **και** η παρτίδα της είναι ανοιχτή — η ίδια κρίση με τα πεδία της πρότασης (ADR-934 Ε3). */
  readonly decidable: boolean;
  /** §5.5.2 Β4: η παρτίδα έχει τιμοκατάλογο **και** ο άνθρωπος δικαίωμα τιμολόγησης ⇒ μια γραμμή μπορεί να γίνει τιμή. */
  readonly pricesEnabled?: boolean;
  /**
   * §5.5.2 Β8 βήμα Γ: δικαίωμα τιμολόγησης **χωρίς** τιμοκατάλογο ⇒ «Τιμή — διάλεξε πρώτα τιμοκατάλογο» στη θέση της «Τιμής». Το πάτημα
   * περνά στον κάτοχο της επιλογής (εστίαση στον τιμοκατάλογο, και μετά ο διάλογος τιμής της ίδιας γραμμής). Απόν ⇒ καμία τέτοια θέση.
   */
  readonly onPickPriceTarget?: (line: ImportPageUnmappedLine) => void;
  /** §5.5.2 Β5.2: τι προτείνει η μνήμη του προμηθευτή, ανά γραμμή (`lineKeyOf`). */
  readonly memoryHints?: ReadonlyMap<string, ImportMemoryHint>;
  /** §5.5.2 Β8 βήμα Β: κουμπί λύσης στο popover του PDF ζήτησε το εργαλείο μιας γραμμής — ανοίγει το **ίδιο** με το κουμπί της λίστας. */
  readonly toolRequest?: { readonly lineKey: string; readonly mode: LineTool } | null;
  /** Το εργαλείο που ζητήθηκε έκλεισε — ο κάτοχος της επιλογής σβήνει την πρόθεση. */
  readonly onToolRequestDone?: () => void;
}

interface LineRowProps {
  readonly line: ImportPageUnmappedLine;
  readonly state: LineState;
  readonly refusal: string | null;
  readonly hint: ImportMemoryHint | undefined;
  readonly onAccept: (decision: ImportLineDecision) => void;
  readonly active: boolean;
  readonly focusRequested: boolean;
  readonly readOnly: boolean;
  readonly canManage: boolean;
  readonly pricesEnabled: boolean;
  /** Απόν ⇒ καμία θέση «διάλεξε πρώτα τιμοκατάλογο» (χωρίς δικαίωμα τιμολόγησης). */
  readonly onPickPriceTarget: (() => void) | undefined;
  readonly onFocus: () => void;
  readonly onTool: (mode: LineTool) => void;
  readonly onIgnore: (ignore: boolean) => void;
}

const actionKey = (action: RemedyAction): string => (action.kind === 'lineTool' ? `${action.kind}:${action.mode}` : action.kind);

type LineActionsProps = Pick<LineRowProps, 'state' | 'readOnly' | 'canManage' | 'pricesEnabled' | 'onPickPriceTarget' | 'onTool' | 'onIgnore'>;

/** Η ενέργεια ενός κουμπιού της γραμμής — εργαλείο · «διάλεξε πρώτα τιμοκατάλογο» · αγνόηση. */
function runLineAction(action: RemedyAction, { onTool, onIgnore, onPickPriceTarget }: Pick<LineActionsProps, 'onTool' | 'onIgnore' | 'onPickPriceTarget'>) {
  if (action.kind === 'lineTool') return onTool(action.mode);
  if (action.kind === 'pickPriceTarget') return onPickPriceTarget?.();
  onIgnore(true);
}

/**
 * Οι ενέργειες της γραμμής — από τον **ίδιο** κανόνα με το popover του PDF (`lineActionsOf`, §5.5.2 Β8 βήμα Β). Βήμα Γ: η θέση
 * «Τιμή» υπάρχει για όποιον τιμολογεί, και χωρίς τιμοκατάλογο γίνεται «διάλεξε πρώτα».
 */
function LineActions({ state, readOnly, canManage, pricesEnabled, onPickPriceTarget, onTool, onIgnore }: LineActionsProps) {
  const { t } = useImportText();
  const labelOf = useRemedyActionLabel();
  const busy = readOnly || state === 'saving';
  if (state === 'ignored' || state === 'mapped') {
    return <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onIgnore(false)}><Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.undo')}</Button>;
  }
  const run = (action: RemedyAction) => runLineAction(action, { onTool, onIgnore, onPickPriceTarget });
  const rights = { canManage, canPrice: pricesEnabled || onPickPriceTarget !== undefined, hasPriceTarget: pricesEnabled };
  return (
    <span className="flex flex-wrap gap-1">
      {lineActionsOf(rights).map((action) => {
        const { icon: Icon, variant } = remedyActionLook(action);
        return (
          <Button key={actionKey(action)} type="button" size="sm" variant={variant} disabled={busy} onClick={() => run(action)}>
            {Icon ? <Icon className="mr-1 h-3 w-3" aria-hidden /> : null}{labelOf(action, '')}
          </Button>
        );
      })}
    </span>
  );
}

/**
 * §5.5.2 Β3 Γ11: «αυτή η γραμμή δεν είναι ιδιότητα — θέλεις να την προσθέσω;». Το κουμπί ανοίγει τη **σύνοψη** (τίποτα δεν γράφεται
 * εδώ)· η βιβλιοθήκη φορτώνεται μόνο τότε, γι' αυτό η πρόταση εδώ λέει μόνο τη λέξη που αλλάζει.
 */
function SiblingNote({ sibling, disabled, onPropose }: { readonly sibling: ImportLineSibling; readonly disabled: boolean; readonly onPropose: () => void }) {
  const { t } = useImportText();
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs" role="note">
      <Sparkles className="h-3 w-3 text-muted-foreground" aria-hidden />
      <span>{t('review.lines.siblingNote', { from: sibling.from, to: sibling.to })}</span>
      <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={onPropose}>{t('review.lines.siblingPropose')}</Button>
    </span>
  );
}

function LineRow(props: LineRowProps) {
  const { t } = useImportText();
  const { line, state, refusal, active, focusRequested, onFocus } = props;
  const { variant, icon: Icon } = STATE_LOOK[state];
  // §5.5.2 Β8: η ίδια ταυτότητα με το πλαίσιο της γραμμής στο PDF — hover και επιλογή και στις δύο κατευθύνσεις.
  const { itemProps, buttonRef, hover } = useReviewLineItem(line, active, focusRequested);
  return (
    <li {...itemProps}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <button ref={buttonRef} type="button" className="text-left text-sm font-medium underline-offset-2 hover:underline" aria-label={`${t('review.lines.show')}: ${line.label}`}
          aria-current={active ? 'true' : undefined} onClick={onFocus} onFocus={hover.onFocus} onBlur={hover.onBlur}>
          {line.label}
        </button>
        <Badge variant={variant} className="gap-1"><Icon className="h-3 w-3" aria-hidden />{t(LINE_STATE_KEYS[state])}</Badge>
      </span>
      <span className="text-xs text-muted-foreground">{line.values.join(' · ')}</span>
      {line.sibling && state === 'pending' && props.canManage ? (
        <SiblingNote sibling={line.sibling} disabled={props.readOnly} onPropose={() => props.onTool('new')} />
      ) : null}
      {refusal ?<span className="text-xs text-destructive" role="status">{refusal}</span> : null}
      {props.hint ? <MemoryHintNote hint={props.hint} disabled={props.readOnly || state === 'saving'} onAccept={props.onAccept} /> : null}
      <LineActions {...props} />
    </li>
  );
}

/** `siblings`: η μαζική πρόταση (§5.5.2 Β3 Γ11) — όλες οι γραμμές με αδελφή, σε μία σύνοψη. */
type OpenTool = { readonly line: ImportPageUnmappedLine; readonly mode: LineTool; readonly siblings?: readonly ImportPageUnmappedLine[] };

/**
 * Το εργαλείο που φαίνεται: του κουμπιού της λίστας, αλλιώς αυτό που ζήτησε το popover του PDF (§5.5.2 Β8 βήμα Β). **Παράγεται**,
 * δεν αντιγράφεται σε κατάσταση με effect: μια πρόθεση δεν ανοίγει ποτέ δύο φορές ούτε μένει ζωντανή μετά το κλείσιμο.
 */
function useShownTool(lines: readonly ImportPageUnmappedLine[], request: UnmappedLinesProps['toolRequest'], onRequestDone: (() => void) | undefined) {
  const [tool, setTool] = useState<OpenTool | null>(null);
  const requested = request ? lines.find((line) => lineKeyOf(line) === request.lineKey) : undefined;
  const shown: OpenTool | null = tool ?? (requested && request ? { line: requested, mode: request.mode } : null);
  const close = () => {
    setTool(null);
    if (requested) onRequestDone?.();
  };
  return { shown, open: setTool, close };
}

/** §5.5.2 Β3 Γ11: δύο ή περισσότερες γραμμές με αδελφή (M + L) ⇒ μία σύνοψη για όλες. Μία μόνο ⇒ αρκεί η πρόταση της γραμμής. */
function SiblingBulkAction({ lines, disabled, onOpen }: { readonly lines: readonly ImportPageUnmappedLine[]; readonly disabled: boolean; readonly onOpen: (tool: OpenTool) => void }) {
  const { t } = useImportText();
  const withSibling = lines.filter((line) => line.sibling !== undefined);
  if (withSibling.length < 2) return null;
  return (
    <Button type="button" size="sm" variant="secondary" className="self-start" disabled={disabled}
      onClick={() => onOpen({ line: withSibling[0], mode: 'new', siblings: withSibling })}>
      <Sparkles className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.siblingBulk', { count: withSibling.length })}
    </Button>
  );
}

export function ProposalUnmappedLines(props: UnmappedLinesProps) {
  const { proposal, overrides, activity, activeLine, onFocusLine, onDecideLine, decidable, pricesEnabled = false, memoryHints, focusRequested = false, onPickPriceTarget } = props;
  const { t } = useImportText();
  const reasonText = useReviewReasonFormatter(false);
  const canManage = useCatalogCanManage();
  // §5.5.2 Β5.2: μόνο όσες περιμένουν απόφαση· οι αποφασισμένες (και οι αγνοημένες) ζουν στο `ProposalDecidedLines`, με την προέλευσή τους.
  const lines = props.lines.filter((line) => lineDecisionOf(overrides, line) === null);
  const { shown: tool, open: setTool, close: closeTool } = useShownTool(lines, props.toolRequest, props.onToolRequestDone);
  if (lines.length === 0) return null;
  const readOnly = !decidable;
  const send = (line: ImportPageUnmappedLine, decision: SetImportLineRequest['decision'], bind: SetImportLineRequest['bind'] = null) =>
    onDecideLine(proposal, lineRequestOf(line, decision, bind));
  const create: LineAttributeToolsProps['onCreate'] = async (line, attribute, bind) =>
    onDecideLine(proposal, { ...lineRequestOf(line, null, bind), create: attribute });
  return (
    <section className="flex flex-col gap-2" aria-label={t('review.lines.title')}>
      <h4 className="m-0 text-sm font-semibold">{t('review.lines.title')}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t('review.lines.hint')}</p>
      {canManage ? <SiblingBulkAction lines={lines} disabled={readOnly} onOpen={setTool} /> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((line) => {
          const key = lineKeyOf(line);
          const current = activity.get(key);
          return (
            <LineRow key={key} line={line} state={lineStateOf(current, lineDecisionOf(overrides, line))}
              refusal={current?.kind === 'refused' ? reasonText({ kind: 'refused', refusal: current.reason }) : null}
              hint={memoryHints?.get(key)} onAccept={(decision) => send(line, decision)}
              active={key === activeLine} focusRequested={focusRequested} readOnly={readOnly} canManage={canManage} pricesEnabled={pricesEnabled}
              onFocus={() => onFocusLine(line)} onTool={(mode) => setTool({ line, mode })} onPickPriceTarget={onPickPriceTarget && (() => onPickPriceTarget(line))}
              onIgnore={(ignore) => send(line, ignore ? { kind: 'ignore' } : null)} />
          );
        })}
      </ul>
      {tool?.mode === 'price' ? (
        <PriceLineDialogSlot line={tool.line} onClose={closeTool} onDecide={(unitCode) => send(tool.line, { kind: 'price', unitCode })} />
      ) : null}
      {tool && tool.mode !== 'price' ? (
        <LineAttributeToolsSlot proposal={proposal} line={tool.line} mode={tool.mode} onClose={closeTool} siblings={tool.siblings}
          onDecide={(attributeId, bind) => send(tool.line, { kind: 'attribute', attributeId }, bind)} onCreate={create} />
      ) : null}
    </section>
  );
}
