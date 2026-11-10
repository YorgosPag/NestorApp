'use client';

/**
 * @fileoverview **Ένα πεδίο της πρότασης** (ADR-923 §5.5): ζωντανή τιμή → εισερχόμενη, κατάσταση, βεβαιότητα, ευρήματα,
 *   απόφαση (`ProposalDecisionCell`, §5.5.2), διόρθωση με προέλευση και επαναφορά (§5.5.2 Β6). Το κλικ στην ετικέτα οδηγεί το PDF
 *   στο σημείο της.
 * @module components/catalog/imports/ProposalFieldRow
 */

import React, { useState } from 'react';
import { Pencil, Undo2, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ImportProposalField, ImportValueEdit } from '@/subapps/catalog/types/catalog-import';
import { useImportIssueMessage } from './import-issue-messages';
import { PROPOSAL_VIEW_KEYS, useImportText } from './import-text';
import { useTargetLabeler } from './import-target-label';
import { FieldStatusBadge, ProposalDecisionCell } from './ProposalDecisionCell';
import { useImportValueText } from './import-value-text';
import type { ProposalView } from './proposal-summary';
import { useReviewHoverHandlers, useReviewHovered } from './review-hover-store';
import { keepValuesOf } from './review-remedy';
import { useActiveReviewItem } from './use-review-selection';

interface ProposalFieldRowProps {
  readonly field: ImportProposalField;
  /** §5.5.2 Β6: η διόρθωση του ανθρώπου σε αυτό το πεδίο, από τον κατάλογο της πρότασης. `null` = καμία. */
  readonly edit: ImportValueEdit | null;
  readonly active: boolean;
  /** §5.5.2 Β8: το σταθερό κλειδί του πεδίου στην αναθεώρηση (`reviewTargetKey`) — ταυτότητα για hover λίστα ↔ PDF. */
  readonly reviewKey: string;
  /** §5.5.2 Β8: η επιλογή ήρθε από κλικ στο PDF ⇒ η εστίαση πληκτρολογίου περνά στο πεδίο (όχι μόνο κύλιση). */
  readonly focusRequested: boolean;
  /** §5.5.2 Β8: η προβολή που **θα** έκρυβε το πεδίο — φαίνεται μόνο επειδή επιλέχτηκε στο PDF. `null` = ορατό κανονικά. */
  readonly revealedFrom: ProposalView | null;
  readonly readOnly: boolean;
  readonly onFocus: () => void;
  readonly onDecide: (decision: 'accept' | 'reject') => void;
  readonly onEdit: (text: string) => void;
  /** §5.5.2 Β6: η διόρθωση φεύγει, ισχύει ξανά η τιμή του PDF. */
  readonly onRevert: () => void;
  /** §5.5.2 Β8 βήμα Β: το popover του PDF ζήτησε διόρθωση αυτού του πεδίου ⇒ ανοίγει η **ίδια** διόρθωση με το κλικ στην τιμή. */
  readonly editRequested?: boolean;
  /** Η διόρθωση που ζητήθηκε έκλεισε — ο κάτοχος της επιλογής σβήνει την πρόθεση. */
  readonly onEditRequestDone?: () => void;
}

type EditProps = Pick<ProposalFieldRowProps, 'field' | 'edit' | 'readOnly' | 'onEdit' | 'onRevert'>;
type EditRequest = Pick<ProposalFieldRowProps, 'editRequested' | 'onEditRequestDone'>;

/**
 * §5.5.2 Β6: η **προέλευση** της διορθωμένης τιμής — τι έγραφε το PDF — και η επιστροφή σε αυτό. Αν το PDF ξαναδιαβάστηκε και λέει
 * άλλο (`editSourceChanged`), η διόρθωση δεν εφαρμόστηκε: ο άνθρωπος διαλέγει. Εικονίδιο **και** λέξη (CHECK 3.41).
 */
function EditNote({ field, edit, readOnly, onEdit, onRevert }: EditProps) {
  const { t } = useImportText();
  if (edit === null) return null;
  const detached = field.issues.some((issue) => issue.code === 'editSourceChanged');
  return (
    <p className="m-0 mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {detached ? null : (
        <span><UserRound className="mr-1 inline h-3 w-3" aria-hidden />
          {edit.sourceText === null ? t('review.editedFromEmpty') : t('review.editedByYou', { source: edit.sourceText })}</span>
      )}
      {detached ? <Button type="button" size="sm" variant="ghost" disabled={readOnly} onClick={() => onEdit(edit.text)}>{t('review.keepEdit')}</Button> : null}
      <Button type="button" size="sm" variant="ghost" disabled={readOnly} onClick={onRevert}><Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.revertEdit')}</Button>
    </p>
  );
}

/**
 * Η εισερχόμενη τιμή: κλικ ⇒ διόρθωση, που γράφεται στον κατάλογο διορθώσεων (§5.5.2 Β6), και ο διακομιστής ξανακρίνει. Η διόρθωση
 * που ζήτησε το popover (§5.5.2 Β8 βήμα Β) **παράγεται** από την πρόθεση, δεν αντιγράφεται με effect: ανοίγει μία φορά, κλείνει μία.
 */
function IncomingCell({ label, editRequested = false, onEditRequestDone, ...props }: EditProps & EditRequest & { readonly label: string }) {
  const { field, readOnly, onEdit } = props;
  const { t } = useImportText();
  const message = useImportIssueMessage(field.issues.length > 0);
  const describe = useImportValueText();
  const [typed, setDraft] = useState<string | null>(null);
  const draft = typed ?? (editRequested && !readOnly ? field.sourceText : null);
  const finish = (value: string) => {
    if (value !== field.sourceText) onEdit(value);
    setDraft(null);
    if (editRequested) onEditRequestDone?.();
  };
  return (
    <td className="p-2">
      {draft === null ? (
        <button type="button" className="inline-flex items-center gap-1 text-left" disabled={readOnly} aria-label={t('review.editValue', { field: label })} onClick={() => setDraft(field.sourceText)}>
          <span>{describe(field.incoming) || field.sourceText}</span>
          {readOnly ? null : <Pencil className="h-3 w-3 text-muted-foreground" aria-hidden />}
        </button>
      ) : (
        <Input
          aria-label={label}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finish(draft)}
        />
      )}
      {field.issues.length > 0 ? (
        <ul className="m-0 mt-1 list-none p-0 text-xs text-destructive" role="alert">
          {field.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{message(issue)}</li>)}
        </ul>
      ) : null}
      <KeepValueChoices field={field} label={label} readOnly={readOnly} onEdit={onEdit} />
      <EditNote {...props} />
      <Corroboration field={field} />
    </td>
  );
}

/**
 * §5.5.2 Β8: η πηγή έδωσε **περισσότερες** τιμές για το ίδιο πεδίο (`attributeRepeated`) ⇒ ένα κουμπί ανά τιμή. Το πάτημα είναι η
 * **υπάρχουσα** διόρθωση (§5.5.2 Β6): ο κατάλογος διορθώσεων ενώνει τα κελιά της διεύθυνσης σε ένα και ο διακομιστής ξανακρίνει.
 */
function KeepValueChoices({ field, label, readOnly, onEdit }: Pick<EditProps, 'field' | 'readOnly' | 'onEdit'> & { readonly label: string }) {
  const { t } = useImportText();
  // Η ΙΔΙΑ λίστα τιμών με το popover του PDF (§5.5.2 Β8 βήμα Β).
  const values = keepValuesOf(field);
  if (values.length === 0) return null;
  return (
    <p className="m-0 mt-1 flex flex-wrap items-center gap-1" role="group" aria-label={t('review.keepValueGroup', { field: label })}>
      {values.map((value) => (
        <Button key={value} type="button" size="sm" variant="outline" disabled={readOnly} onClick={() => onEdit(value)}>
          {t('review.keepValue', { value })}
        </Button>
      ))}
    </p>
  );
}

/** Ε7: η ίδια ποσότητα σε άλλη μονάδα συμφώνησε. Πληροφορία, όχι εύρημα: δεν ζητά απόφαση. */
function Corroboration({ field }: { readonly field: ImportProposalField }) {
  const { t } = useImportText();
  const others = field.corroboratedBy ?? [];
  if (others.length === 0) return null;
  return <p className="m-0 mt-1 text-xs text-muted-foreground">{t('review.corroboratedBy', { values: others.join(' · ') })}</p>;
}

/** §5.5.2 Β8: πεδίο που η προβολή κρύβει, ορατό μόνο επειδή επιλέχτηκε στο PDF — το λέει, ποτέ σιωπηλά. */
function RevealNote({ view }: { readonly view: ProposalView | null }) {
  const { t } = useImportText();
  if (view === null) return null;
  return <p className="m-0 mt-1 text-xs text-muted-foreground" role="status">{t('review.overlay.revealed', { view: t(PROPOSAL_VIEW_KEYS[view]) })}</p>;
}

function rowClassOf(active: boolean, hovered: boolean): string {
  if (active) return 'bg-accent';
  return hovered ? 'border-b border-border bg-muted' : 'border-b border-border';
}

export function ProposalFieldRow({ field, edit, active, reviewKey, focusRequested, revealedFrom, readOnly, onFocus, onDecide, onEdit, onRevert, editRequested, onEditRequestDone }: ProposalFieldRowProps) {
  const { t } = useImportText();
  const label = useTargetLabeler()(field);
  const describe = useImportValueText();
  const percent = Math.round(field.confidence * 100);
  const verified = field.anchor?.kind === 'page' ? field.anchor.verified : true;
  /** Ε8: `null` = η σελίδα δεν είχε κείμενο να ελεγχθεί η τιμή · `false` = είχε, και δεν την επιβεβαίωσε. */
  const unverifiedNote = verified === null ? t('review.uncheckable') : verified === false ? t('review.unverified') : null;
  const { itemRef: rowRef, buttonRef } = useActiveReviewItem<HTMLTableRowElement>(active, focusRequested);
  const hovered = useReviewHovered([reviewKey]);
  const hover = useReviewHoverHandlers([reviewKey]);
  return (
    <tr ref={rowRef} className={rowClassOf(active, hovered)} onMouseEnter={hover.onMouseEnter} onMouseLeave={hover.onMouseLeave}>
      <th scope="row" className="p-2 text-left font-normal">
        <button ref={buttonRef} type="button" className="text-left underline-offset-2 hover:underline" aria-current={active ? 'true' : undefined}
          onClick={onFocus} onFocus={hover.onFocus} onBlur={hover.onBlur}>{label}</button>
        <RevealNote view={revealedFrom} />
      </th>
      <td className="p-2 text-muted-foreground">{describe(field.live)}</td>
      <IncomingCell field={field} edit={edit} label={label} readOnly={readOnly} onEdit={onEdit} onRevert={onRevert}
        editRequested={editRequested} onEditRequestDone={onEditRequestDone} />
      <td className="p-2"><FieldStatusBadge status={field.status} /></td>
      <td className="p-2 text-xs text-muted-foreground">
        {percent}%{unverifiedNote ? ` · ${unverifiedNote}` : ''}
      </td>
      <ProposalDecisionCell field={field} label={label} readOnly={readOnly} onDecide={onDecide} />
    </tr>
  );
}
