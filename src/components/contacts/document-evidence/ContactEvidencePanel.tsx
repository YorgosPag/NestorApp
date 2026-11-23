'use client';

/**
 * @fileoverview Ο πίνακας **«Το έγγραφο λέει / Η επαφή λέει»** στην προεπισκόπηση αρχείου (ADR-950 §4.4).
 * @module components/contacts/document-evidence/ContactEvidencePanel
 *
 * Έξω από φόρμα επαφής ή χωρίς ανάγνωση ⇒ **τίποτα** (το `FilePreviewPanel` μένει ίδιο για κάθε άλλη οντότητα).
 * Η κρίση λέγεται με **εικονίδιο + κείμενο** (CHECK 3.41). Η τιμή του εγγράφου φαίνεται **πάντα** όπως τυπώνεται —
 * και όταν δεν συγκρίνεται, με τον λόγο («δυσανάγνωστο»): ο άνθρωπος βλέπει τι διάβασε η μηχανή, ποτέ μια σιωπή.
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, CircleHelp, EyeOff, type LucideIcon } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EvidenceComparisonState, EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import type { FileRecord } from '@/types/file-record';

import { ContactEvidenceRowActions } from './ContactEvidenceRowActions';
import { useContactEvidenceHost, useContactEvidenceRows } from './ContactEvidenceContext';
import {
  CONTACT_EVIDENCE_COLUMN_KEYS as COLUMNS,
  CONTACT_EVIDENCE_KEYS as KEYS,
  CONTACT_EVIDENCE_ORGANISATION_NAME_KEY,
  CONTACT_EVIDENCE_REASON_KEYS,
  CONTACT_EVIDENCE_ROW_KEYS,
  CONTACT_EVIDENCE_STATE_KEYS,
  CONTACT_EVIDENCE_UNGROUNDED_KEYS,
} from './contact-evidence-labels';
import { useContactEvidenceActions } from './use-contact-evidence-actions';

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
  // «Το έγγραφο λέει» = όπως **τυπώνεται** — όχι η μορφή της φόρμας (E.164 · κωδικός ΔΟΥ).
  if (row.ungrounded === null) return <>{row.documentPrinted ?? row.documentDisplay}</>;
  return (
    <span className="flex flex-col">
      {row.documentPrinted !== null && <span>{row.documentPrinted}</span>}
      <span className="text-xs text-muted-foreground">{t(CONTACT_EVIDENCE_UNGROUNDED_KEYS[row.ungrounded])}</span>
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

export function ContactEvidencePanel({ file }: { readonly file: FileRecord }) {
  const { t } = useTranslation('contacts-form');
  const translateDisplayName = useFileDisplayName();
  const host = useContactEvidenceHost();
  const rows = useContactEvidenceRows(file);
  const actions = useContactEvidenceActions(file, translateDisplayName(file));
  if (host === null || rows === null || actions === null) return null;
  const titleId = `contact-evidence-${file.id}`;
  return (
    <section aria-labelledby={titleId} className="border-b p-3 max-h-[300px] overflow-y-auto">
      <header className="mb-2">
        <h3 id={titleId} className="m-0 text-sm font-medium">{t(KEYS.title)}</h3>
        <p className="m-0 text-xs text-muted-foreground">{t(KEYS.subtitle)}</p>
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
                <TableHead scope="row">{t(rowLabelKey(row, host.contactType === 'individual'))}</TableHead>
                <TableCell><DocumentCell row={row} /></TableCell>
                <TableCell>{row.contact ?? '—'}</TableCell>
                <TableCell><StateCell row={row} /></TableCell>
                <TableCell>
                  <ContactEvidenceRowActions row={row} formData={host.formData} canEdit={host.canEdit} actions={actions} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
