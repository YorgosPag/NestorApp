'use client';

/**
 * **Ένα αριθμητικό πεδίο αντιγραμμένο από το πιστοποιητικό** — kWh, CO₂, ωφέλιμη επιφάνεια, τελική ενέργεια ανά πηγή.
 *
 * @related `./EnergyCertificateFields.tsx` · `./FinalEnergyFields.tsx` (οι δύο καταναλωτές) ·
 *   `components/shared/form/useCommittedDraft.ts` (το πρόχειρο που εκπέμπει στο blur)
 *
 * 🔑 Δέχεται και κόμμα («125,4») και εκπέμπει στο blur: το ΠΕΑ τυπώνει ένα δεκαδικό, και το πεδίο δεν «διορθώνει»
 * ό,τι δεν αναγνωρίζει — το σημαίνει άκυρο.
 *
 * Εξήχθη στον **δεύτερο** καταναλωτή (ADR-777 §8.95): ζούσε μέσα στο `EnergyCertificateFields.tsx` (N.18).
 */

import React from 'react';

import { useCommittedDraft, type DraftReading } from '@/components/shared/form/useCommittedDraft';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseLocaleNumber } from '@/lib/number/locale-number';

function figureDraftOf(figure: number | null): string {
  return figure === null ? '' : String(figure);
}

/** Κενό ⇒ «δεν δηλώθηκε»· αριθμός με το πολύ ένα δεκαδικό (τελεία **ή** κόμμα) εντός ορίων· αλλιώς άκυρο. */
export function figureReaderOf(isValid: (raw: unknown) => raw is number): (draft: string) => DraftReading<number> {
  return (draft) => {
    const trimmed = draft.trim();
    if (trimmed === '') return { ok: true, value: null };
    const decimalSeparator = trimmed.includes(',') ? ',' : '.';
    const figure = /^\d+([.,]\d)?$/.test(trimmed) ? parseLocaleNumber(trimmed, { decimalSeparator }) ?? Number.NaN : Number.NaN;
    return isValid(figure) ? { ok: true, value: figure } : { ok: false };
  };
}

export interface CertificateFigureFieldProps {
  readonly inputId: string;
  readonly label: string;
  readonly hint: string;
  readonly invalidText: string;
  readonly figure: number | null;
  /** **Σταθερή** συνάρτηση (επίπεδο module) — δες `useCommittedDraft`. */
  readonly read: (draft: string) => DraftReading<number>;
  readonly onCommit: (figure: number | null) => void;
  readonly disabled: boolean;
}

export function CertificateFigureField(props: CertificateFigureFieldProps) {
  const { inputId, label, hint, invalidText, figure, read, onCommit, disabled } = props;
  const { draft, setDraft, invalid, commit } = useCommittedDraft(figure, figureDraftOf, read, onCommit);
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</Label>
      <Input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        size="sm"
        className="max-w-40 text-right text-xs"
        aria-describedby={hintId}
        aria-invalid={invalid}
        disabled={disabled}
      />
      <p id={hintId} role={invalid ? 'alert' : undefined} className={invalid ? 'm-0 text-xs text-destructive' : 'm-0 text-xs text-muted-foreground'}>
        {invalid ? invalidText : hint}
      </p>
    </div>
  );
}
