'use client';

/**
 * @fileoverview Ο πίνακας **«Το έγγραφο λέει / Η επαφή λέει»** στην προεπισκόπηση αρχείου (ADR-950 §4.4 · §8).
 * @module components/contacts/document-evidence/ContactEvidencePanel
 *
 * Έξω από φόρμα επαφής ή χωρίς ανάγνωση ⇒ **τίποτα** (το `FilePreviewPanel` μένει ίδιο για κάθε άλλη οντότητα).
 * Η κρίση λέγεται με **εικονίδιο + κείμενο** (CHECK 3.41). Η τιμή του εγγράφου φαίνεται **πάντα** όπως τυπώνεται —
 * και όταν δεν συγκρίνεται, με τον λόγο («δυσανάγνωστο» · «αβέβαιο» + η δεύτερη ανάγνωση · «δεν επιβεβαιώθηκε στον
 * χάρτη»): ο άνθρωπος βλέπει τι διάβασε η μηχανή, ποτέ μια σιωπή. Η γειωμένη τιμή («Μήπως…» · τηλέφωνο σε τυπική
 * μορφή, με το τυπωμένο από κάτω) έρχεται από το `ContactEvidenceDocumentValue` — την ίδια προβολή με τον διάλογο.
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, CircleHelp, EyeOff, type LucideIcon } from 'lucide-react';

import { ClassifyAgainButton } from '@/components/shared/files/ClassifyAgainButton';
import { useClassifyAgain } from '@/components/shared/files/ClassifyAgainProvider';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { fillableEvidenceRows, fillableEvidenceSeat } from '@/lib/contacts/contact-evidence-acceptance';
import type { EvidenceComparisonState, EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import { useRetiredKind } from '@/lib/firestore/retired-record-context';
import type { FileRecord } from '@/types/file-record';

import { GroundedEvidenceValue } from './ContactEvidenceDocumentValue';
import { ContactEvidenceFillDialog } from './ContactEvidenceFillDialog';
import { ContactEvidenceRowActions } from './ContactEvidenceRowActions';
import { useContactEvidenceHost, useContactEvidenceRows } from './ContactEvidenceContext';
import {
  CONTACT_EVIDENCE_COLUMN_KEYS as COLUMNS,
  CONTACT_EVIDENCE_CORROBORATION_KEYS as CORROBORATION,
  CONTACT_EVIDENCE_FILL_KEYS as FILL,
  CONTACT_EVIDENCE_KEYS as KEYS,
  CONTACT_EVIDENCE_ORGANISATION_NAME_KEY,
  CONTACT_EVIDENCE_REASON_KEYS,
  CONTACT_EVIDENCE_ROW_KEYS,
  CONTACT_EVIDENCE_STATE_KEYS,
  ungroundedLabelKey,
} from './contact-evidence-labels';
import { useContactEvidenceActions, type ContactEvidenceActions } from './use-contact-evidence-actions';

const STATE_ICON: Readonly<Record<EvidenceComparisonState, LucideIcon>> = {
  match: CheckCircle2,
  partial: CircleHelp,
  missing: CircleDashed,
  differs: AlertTriangle,
  'not-comparable': CircleDashed,
};

function rowLabelKey(row: EvidenceRow, isPerson: boolean): string {
  return row.key === 'fullName' && !isPerson ? CONTACT_EVIDENCE_ORGANISATION_NAME_KEY : CONTACT_EVIDENCE_ROW_KEYS[row.key];
}

function DocumentCell({ row }: { readonly row: EvidenceRow }) {
  const { t } = useTranslation('contacts-form');
  // Γειωμένη ⇒ η ΜΙΑ προβολή, κοινή με τη «Συμπλήρωση κενών» (ADR-950 §8.14).
  if (row.ungrounded === null) return <GroundedEvidenceValue row={row} />;
  return (
    <span className="flex flex-col">
      {row.documentPrinted !== null && <span>{row.documentPrinted}</span>}
      <span className="text-xs text-muted-foreground">{t(ungroundedLabelKey(row.key, row.ungrounded))}</span>
      {row.ungrounded === 'disputed' && (
        <span className="text-xs text-muted-foreground">
          {row.documentAlternate === null ? t(CORROBORATION.alternateUnreadable) : t(CORROBORATION.alternate, { value: row.documentAlternate })}
        </span>
      )}
    </span>
  );
}

function StateCell({ row }: { readonly row: EvidenceRow }) {
  const { t } = useTranslation('contacts-form');
  const iconSizes = useIconSizes();
  const Icon = row.decision === 'dismissed' ? EyeOff : STATE_ICON[row.state];
  return (
    <span className="flex flex-col">
      <span className="inline-flex items-center gap-1">
        <Icon className={iconSizes.xs} aria-hidden="true" />
        {t(CONTACT_EVIDENCE_STATE_KEYS[row.state])}
      </span>
      {row.decision === 'dismissed' && row.dismissal !== null && (
        <span className="text-xs text-muted-foreground">
          {t(KEYS.dismissed, { reason: t(CONTACT_EVIDENCE_REASON_KEYS[row.dismissal.reason]) })}
        </span>
      )}
      {row.decision === 'reopened' && <span className="text-xs text-muted-foreground">{t(KEYS.reopened)}</span>}
    </span>
  );
}

/** «Νέα ανάγνωση» + «Συμπλήρωση κενών (N)» — οι δύο πράξεις πάνω σε **όλο** τον πίνακα (ADR-950 §8.6 · §8.7). */
function PanelActions({ file, rows, actions, labelOf }: {
  readonly file: FileRecord;
  readonly rows: readonly EvidenceRow[];
  readonly actions: ContactEvidenceActions;
  readonly labelOf: (row: EvidenceRow) => string;
}) {
  const { t } = useTranslation('contacts-form');
  const host = useContactEvidenceHost();
  // ADR-950 §8.12 — ίδια πράξη με τη λίστα: ξαναδιάβασε ΚΑΙ ανανέωσε (πριν, μόνο το πρώτο ⇒ πίνακας μπαγιάτικος).
  const { classifyAgain, classifyingIds } = useClassifyAgain();
  const parentIsLive = useRetiredKind() === null;
  const [fillOpen, setFillOpen] = useState(false);
  if (host === null) return null;
  const fillRows = fillableEvidenceRows(rows);
  // Η διεύθυνση είναι πρόταση προς τον editor έδρας ⇒ μόνο σε επεξεργασία· από την προβολή καταχωρίζονται τα πεδία.
  const fillSeat = host.canEdit ? fillableEvidenceSeat(rows) : null;
  const fillCount = fillRows.length + (fillSeat === null ? 0 : 1);
  const canFill = host.canEdit || actions.canRegister;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {parentIsLive && (
        <ClassifyAgainButton label={t(KEYS.reread)} busy={classifyingIds.has(file.id)} onClick={() => void classifyAgain(file.id)} showLabel />
      )}
      {fillCount > 0 && canFill && (
        <Button type="button" variant="outline" size="sm" disabled={actions.isRegistering} aria-busy={actions.isRegistering}
          onClick={() => setFillOpen(true)}>
          {t(FILL.button, { count: fillCount })}
        </Button>
      )}
      {fillCount > 0 && !canFill && <span className="text-xs text-muted-foreground">{t(FILL.editToFill)}</span>}
      <ContactEvidenceFillDialog open={fillOpen} onOpenChange={setFillOpen} rows={fillRows} seat={fillSeat} onApply={actions.fillEmpty}
        labelOf={labelOf} immediate={!host.canEdit} />
    </span>
  );
}

export function ContactEvidencePanel({ file }: { readonly file: FileRecord }) {
  const { t } = useTranslation('contacts-form');
  const translateDisplayName = useFileDisplayName();
  const host = useContactEvidenceHost();
  const rows = useContactEvidenceRows(file);
  const actions = useContactEvidenceActions(file, translateDisplayName(file));
  if (host === null || rows === null || actions === null) return null;
  const titleId = `contact-evidence-${file.id}`;
  const labelOf = (row: EvidenceRow) => t(rowLabelKey(row, host.contactType === 'individual'));
  return (
    <section aria-labelledby={titleId} className="border-b p-3 max-h-[300px] overflow-y-auto">
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <hgroup className="flex flex-col">
          <h3 id={titleId} className="m-0 text-sm font-medium">{t(KEYS.title)}</h3>
          <p className="m-0 text-xs text-muted-foreground">{t(KEYS.subtitle)}</p>
        </hgroup>
        <PanelActions file={file} rows={rows} actions={actions} labelOf={labelOf} />
      </header>
      {rows.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">{t(KEYS.empty)}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t(COLUMNS.field)}</TableHead>
              <TableHead scope="col">{t(COLUMNS.document)}</TableHead>
              <TableHead scope="col">{t(COLUMNS.contact)}</TableHead>
              <TableHead scope="col">{t(COLUMNS.state)}</TableHead>
              <TableHead scope="col" className="text-right">{t(COLUMNS.action)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableHead scope="row">{labelOf(row)}</TableHead>
                <TableCell><DocumentCell row={row} /></TableCell>
                <TableCell>{row.contact ?? '—'}</TableCell>
                <TableCell><StateCell row={row} /></TableCell>
                <TableCell>
                  <ContactEvidenceRowActions row={row} canEdit={host.canEdit} actions={actions} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
