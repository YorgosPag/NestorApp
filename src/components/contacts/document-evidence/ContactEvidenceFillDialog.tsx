'use client';

/**
 * @fileoverview **«Συμπλήρωση κενών»** — όλα τα κενά πεδία της επαφής από το έγγραφο, με **ένα** παράθυρο ελέγχου
 * (ADR-950 §8.6).
 * @module components/contacts/document-evidence/ContactEvidenceFillDialog
 *
 * Πρότυπο αγοράς: Salesforce «Compare & Update», HubSpot enrichment («fill empty only»), Google Contacts «Suggested
 * updates». Κανόνες:
 * - **μόνο κενά** πεδία, **μόνο** γειωμένες τιμές (καμία «Αβέβαιη», καμία «Μη επιβεβαιωμένη»)·
 * - ένα κουτάκι ανά πεδίο, όλα προεπιλεγμένα — ο άνθρωπος **αφαιρεί**, δεν ψάχνει·
 * - εφαρμογή = **μία** αλλαγή φόρμας (`acceptEvidenceBatch`)· η εγγραφή περνά από την υπάρχουσα «Αποθήκευση» (4 φρουροί +
 *   Ιστορικό) — ποτέ απευθείας γραφή·
 * - η διεύθυνση μένει **πρόταση** προς τον ιδιοκτήτη της έδρας, όπως η «Πρόταση διεύθυνσης».
 */

import React, { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';

import { GroundedEvidenceValue } from './ContactEvidenceDocumentValue';
import { CONTACT_EVIDENCE_FILL_KEYS as FILL } from './contact-evidence-labels';

interface ContactEvidenceFillDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly rows: readonly EvidenceRow[];
  readonly seat: EvidenceRow | null;
  readonly onApply: (rows: readonly EvidenceRow[], seat: EvidenceRow | null) => void;
  /** Η ετικέτα της γραμμής — ίδια με του πίνακα (επωνυμία ⇄ ονοματεπώνυμο). */
  readonly labelOf: (row: EvidenceRow) => string;
  /** Από την προβολή: η εφαρμογή **καταχωρίζει αμέσως** (ADR-950 §9) — το κείμενο το λέει, δεν υπόσχεται «Αποθήκευση». */
  readonly immediate?: boolean;
}

const SEAT_ID = 'address';

function FillItem({ id, label, row, checked, onToggle }: {
  readonly id: string;
  readonly label: string;
  /** Η γραμμή — η τιμή φαίνεται με την **ίδια** προβολή με τον πίνακα (ADR-950 §8.14). */
  readonly row: EvidenceRow;
  readonly checked: boolean;
  readonly onToggle: (id: string) => void;
}) {
  const inputId = `evidence-fill-${id}`;
  return (
    <li className="flex items-start gap-2">
      <Checkbox id={inputId} checked={checked} onCheckedChange={() => onToggle(id)} />
      <label htmlFor={inputId} className="flex flex-col text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground"><GroundedEvidenceValue row={row} /></span>
      </label>
    </li>
  );
}

export function ContactEvidenceFillDialog({ open, onOpenChange, rows, seat, onApply, labelOf, immediate = false }: ContactEvidenceFillDialogProps) {
  const { t } = useTranslation('contacts-form');
  const allIds = [...rows.map((row) => row.key), ...(seat === null ? [] : [SEAT_ID])];
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setUnchecked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const selected = allIds.filter((id) => !unchecked.has(id)).length;
  const apply = () => {
    onApply(rows.filter((row) => !unchecked.has(row.key)), seat !== null && !unchecked.has(SEAT_ID) ? seat : null);
    setUnchecked(new Set());
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(FILL.title)}</DialogTitle>
          <DialogDescription>{t(immediate ? FILL.descriptionImmediate : FILL.description)}</DialogDescription>
        </DialogHeader>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row) => (
            <FillItem key={row.key} id={row.key} label={labelOf(row)} row={row} checked={!unchecked.has(row.key)} onToggle={toggle} />
          ))}
          {seat !== null && (
            <FillItem id={SEAT_ID} label={t(FILL.address)} row={seat} checked={!unchecked.has(SEAT_ID)} onToggle={toggle} />
          )}
        </ul>
        <DialogActionFooter
          cancelLabel={t(FILL.cancel)}
          confirmLabel={t(FILL.apply, { count: selected })}
          busyLabel={t(FILL.apply, { count: selected })}
          onCancel={() => onOpenChange(false)}
          onConfirm={apply}
          isSubmitting={false}
          canSubmit={selected > 0}
        />
      </DialogContent>
    </Dialog>
  );
}
