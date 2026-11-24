'use client';

/**
 * @fileoverview **«Διόρθωση ανάγνωσης»** — ο άνθρωπος γράφει ό,τι λέει το έγγραφο, δίπλα στην εικόνα του (ADR-950 §10).
 * @module components/contacts/document-evidence/ContactEvidenceCorrectionDialog
 *
 * Πρότυπο αγοράς: human-in-the-loop review (Document AI · Textract A2I · Rossum). Κανόνες:
 * - κάθε πεδίο της γραμμής ξεκινά με ό,τι διάβασε η μηχανή — ο άνθρωπος **διορθώνει**, δεν ξαναγράφει·
 * - διαφωνία δύο αναγνώσεων ⇒ και οι δύο ως επιλογές με **ένα** πάτημα· όποια περνά **μόνη της** τον ελεγκτή (π.χ. ψηφίο
 *   ελέγχου ΑΦΜ) είναι ήδη συμπληρωμένη·
 * - ο έλεγχος είναι **ζωντανός** και ίδιος με του διακομιστή (`checkEvidenceCorrection`) — το κουμπί ανάβει μόνο όταν περνά·
 * - η ΔΟΥ διαλέγεται από τον **κατάλογο** (`DoyPicker`), όπως στη φόρμα.
 *
 * 🔑 Αποθηκεύει **ανάγνωση**, όχι επαφή. Η επαφή αλλάζει μετά, με «Καταχώριση» / «Αποδοχή».
 */

import React, { useState } from 'react';

import type { EvidenceFieldKey, EvidenceRowKey } from '@/config/contact-document-evidence';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { DoyPicker } from '@/components/ui/doy-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  checkEvidenceCorrection,
  preferredReading,
  type EvidenceCorrectionField,
  type EvidenceCorrectionValues,
} from '@/lib/contacts/contact-evidence-corrections';

import { CONTACT_EVIDENCE_CORRECTION_KEYS as KEYS, correctionFieldLabelKey } from './contact-evidence-labels';

interface ContactEvidenceCorrectionDialogProps {
  readonly row: EvidenceRowKey;
  /** Η ετικέτα της γραμμής — ίδια με του πίνακα (επωνυμία ⇄ ονοματεπώνυμο). */
  readonly rowLabel: string;
  readonly purpose: string;
  readonly fields: readonly EvidenceCorrectionField[];
  /** Υπάρχει ήδη διόρθωση ⇒ προσφέρεται η αναίρεσή της. */
  readonly corrected: boolean;
  readonly onSave: (values: EvidenceCorrectionValues) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}

type Draft = Readonly<Partial<Record<EvidenceFieldKey, string>>>;

/** Η αρχική εικόνα: η διόρθωση αν υπάρχει· αλλιώς η ανάγνωση που περνά **μόνη της** τον ελεγκτή· αλλιώς της μηχανής. */
function initialDraft(fields: readonly EvidenceCorrectionField[], corrected: boolean): Draft {
  const draft: Partial<Record<EvidenceFieldKey, string>> = {};
  for (const field of fields) draft[field.key] = corrected ? field.initial : preferredReading(field) ?? field.initial;
  return draft;
}

/** Οι δύο αναγνώσεις ως επιλογές — μόνο όταν η δεύτερη διαφώνησε (ADR-950 §8.3). */
function ReadingChoices({ field, onPick }: { readonly field: EvidenceCorrectionField; readonly onPick: (value: string) => void }) {
  const { t } = useTranslation('contacts-form');
  if (field.alternate === null) return null;
  const { machine, alternate } = field;
  return (
    <span className="flex flex-wrap gap-2">
      {machine !== null && (
        <Button type="button" variant="outline" size="sm" onClick={() => onPick(machine)}>
          {t(KEYS.firstReading, { value: machine })}
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => onPick(alternate)}>
        {t(KEYS.secondReading, { value: alternate })}
      </Button>
    </span>
  );
}

function CorrectionField({ field, label, value, invalid, onChange }: {
  readonly field: EvidenceCorrectionField;
  readonly label: string;
  readonly value: string;
  readonly invalid: boolean;
  readonly onChange: (value: string) => void;
}) {
  const { t } = useTranslation('contacts-form');
  const id = `evidence-correction-${field.key}`;
  const errorId = `${id}-error`;
  // Κενό πεδίο δεν είναι «λάθος τιμή» — απλώς δεν έχει γραφτεί ακόμη· το κουμπί αποθήκευσης το λέει μόνο του.
  const showError = invalid && value.trim() !== '';
  return (
    <li className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {field.kind === 'taxOffice' ? (
        <DoyPicker id={id} value={value} onValueChange={onChange} showAddNew={false} />
      ) : (
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)}
          aria-invalid={showError} aria-describedby={showError ? errorId : undefined} autoComplete="off" />
      )}
      <ReadingChoices field={field} onPick={onChange} />
      {showError && <span id={errorId} className="text-xs text-destructive">{t(KEYS.invalid)}</span>}
    </li>
  );
}

export function ContactEvidenceCorrectionDialog({
  row, rowLabel, purpose, fields, corrected, onSave, onClear, onClose,
}: ContactEvidenceCorrectionDialogProps) {
  const { t } = useTranslation('contacts-form');
  const [draft, setDraft] = useState<Draft>(() => initialDraft(fields, corrected));
  const check = checkEvidenceCorrection(purpose, row, draft);
  const labelOf = (field: EvidenceCorrectionField) => (fields.length === 1 ? rowLabel : t(correctionFieldLabelKey(field.key)));
  const save = () => {
    onSave(check.values);
    onClose();
  };
  const clear = () => {
    onClear();
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(KEYS.title, { field: rowLabel })}</DialogTitle>
          <DialogDescription>{t(row === 'address' ? KEYS.descriptionAddress : KEYS.description)}</DialogDescription>
        </DialogHeader>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {fields.map((field) => (
            <CorrectionField key={field.key} field={field} label={labelOf(field)} value={draft[field.key] ?? ''}
              invalid={check.invalid.includes(field.key)}
              onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} />
          ))}
        </ul>
        {corrected && (
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={clear}>{t(KEYS.clear)}</Button>
        )}
        <DialogActionFooter
          cancelLabel={t(KEYS.cancel)}
          confirmLabel={t(KEYS.save)}
          busyLabel={t(KEYS.save)}
          onCancel={onClose}
          onConfirm={save}
          isSubmitting={false}
          canSubmit={check.ok}
        />
      </DialogContent>
    </Dialog>
  );
}
