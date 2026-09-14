'use client';

/**
 * @fileoverview **Το πεδίο του αριθμού ΓΕΜΗ** — ένα, για κάθε νομική μορφή (ADR-841 §7 Α23).
 * @module subapps/accounting/components/setup/GemiNumberField
 *
 * 🔴 **ΕΞΑΓΩΓΗ, ΟΧΙ ΤΕΤΑΡΤΟ ΑΝΤΙΓΡΑΦΟ (N.0.2)**: το ίδιο «ετικέτα → πεδίο → σημείωση» ζούσε
 * τρεις φορές (ΟΕ · ΕΠΕ · ΑΕ), και η ατομική θα το έγραφε τέταρτη. Ο αριθμός ΓΕΜΗ είναι πλέον
 * η **μία** αλήθεια που διαβάζουν βιτρίνα και μεσιτεία — ο έλεγχος μορφής και η ανακοίνωση
 * σφάλματος δεν επιτρέπεται να διαφέρουν ανάμεσα σε τέσσερα αντίγραφα.
 *
 * ⚠️ `inputMode="numeric"`, **όχι** `type="number"`: ο αριθμός έχει αρχικά μηδενικά και ο
 * άνθρωπος γράφει κενά για να τον διαβάζει — το `number` θα τα έτρωγε και θα πρόσθετε βελάκια.
 */

import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface GemiNumberFieldProps {
  readonly id: string;
  readonly value: string;
  readonly required: boolean;
  /** Έτοιμο κείμενο κάτω από το πεδίο (π.χ. «υποχρεωτικό για ΕΠΕ»). */
  readonly note?: string;
  /** Έτοιμο κείμενο σφάλματος — `undefined` σημαίνει «δεν κρίθηκε», όχι «σωστό». */
  readonly error?: string;
  readonly onChange: (value: string) => void;
}

export function GemiNumberField({ id, value, required, note, error, onChange }: GemiNumberFieldProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup']);
  const colors = useSemanticColors();
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const describedBy = [note ? noteId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset className="max-w-sm space-y-1">
      <Label htmlFor={id}>{required ? `${t('setup.gemiNumber')} *` : t('setup.gemiNumber')}</Label>
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={t('setup.gemiNumberPlaceholder')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      {note && (
        <p id={noteId} className={cn('text-xs', colors.text.muted)}>
          {note}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
