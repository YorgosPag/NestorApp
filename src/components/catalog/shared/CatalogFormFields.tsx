'use client';

/**
 * @fileoverview **Τα μικρά πεδία των φορμών του καταλόγου** — κωδικός με πρόταση, προαιρετικός αριθμός, διακόπτης με
 *   ετικέτα (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/CatalogFormFields
 *
 * 🔑 **Κωδικός**: αμετάβλητος μετά τη δημιουργία (`locked`)· πριν, **ακολουθεί** την ετικέτα (`suggestCatalogCode`)
 *    μέχρι να τον αγγίξει ο άνθρωπος — μετά είναι δικός του (Akeneo).
 * 🔑 **Προαιρετικός αριθμός = διακόπτης + αριθμός**, όχι «0 σημαίνει κενό»: εδώ το `0` είναι **έγκυρο** όριο (ελάχιστη
 *    ισχύς 0 kW). Πρότυπο Revit/Akeneo: «χρήση ορίου» ρητά. Ο αριθμός είναι το SSoT `NumericField`.
 */

import React, { useEffect, useId, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import { Switch } from '@/components/ui/switch';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { useCatalogText } from './catalog-ui-hooks';
import { FieldIssues } from './CatalogIssues';

interface CatalogCodeFieldProps {
  readonly value: string;
  readonly onChange: (code: string) => void;
  /** Υπάρχουσα οντότητα ⇒ ο κωδικός είναι η ταυτότητά της και δεν αλλάζει. */
  readonly locked: boolean;
  /** Η ετικέτα από την οποία προτείνεται ο κωδικός όσο δεν τον έχει αγγίξει ο άνθρωπος. */
  readonly suggestFrom?: string;
  readonly issues?: readonly CatalogIssue[];
  readonly path?: string;
  readonly disabled?: boolean;
}

export function CatalogCodeField({ value, onChange, locked, suggestFrom, issues = [], path = 'code', disabled }: CatalogCodeFieldProps) {
  const { t } = useCatalogText();
  const id = useId();
  const [touched, setTouched] = useState(false);
  // Ακολουθεί την ετικέτα ΜΟΝΟ όσο ο κωδικός είναι κενός ή ίσος με την προηγούμενη πρόταση: ένας υπάρχων κωδικός
  // (π.χ. σχήμα `by_size`) δεν αντικαθίσταται ποτέ σιωπηλά από την ετικέτα του μόλις ανοίξει η φόρμα.
  const lastSuggestion = useRef(suggestFrom === undefined ? '' : suggestCatalogCode(suggestFrom));
  useEffect(() => {
    if (locked || touched || suggestFrom === undefined) return;
    const suggestion = suggestCatalogCode(suggestFrom);
    const following = value === '' || value === lastSuggestion.current;
    lastSuggestion.current = suggestion;
    if (following && suggestion !== value) onChange(suggestion);
  }, [locked, touched, suggestFrom, value, onChange]);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('common.code')}</Label>
      <Input
        id={id}
        value={value}
        readOnly={locked}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        className="font-mono"
        aria-describedby={`${id}-hint`}
        onChange={(event) => { setTouched(true); onChange(event.target.value); }}
      />
      <span id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t(locked ? 'common.codeLocked' : 'common.codeHint')}
      </span>
      <FieldIssues issues={issues} path={path} exact />
    </div>
  );
}

interface OptionalNumberFieldProps {
  readonly label: string;
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  /** Η τιμή που παίρνει όταν ενεργοποιείται το όριο. */
  readonly initial?: number;
  readonly min?: number;
  readonly step?: number;
  readonly disabled?: boolean;
}

export function OptionalNumberField({ label, value, onChange, initial = 0, min, step, disabled }: OptionalNumberFieldProps) {
  const id = useId();
  const enabled = value !== null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2">
        <Switch id={id} checked={enabled} disabled={disabled} onCheckedChange={(on) => onChange(on ? initial : null)} />
        <Label htmlFor={id}>{label}</Label>
      </span>
      {enabled ? (
        <NumericField value={value} min={min} step={step} disabled={disabled} aria-label={label} onValueChange={onChange} />
      ) : null}
    </div>
  );
}

interface CatalogFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly issues?: readonly CatalogIssue[];
  /** Η διαδρομή του πεδίου μέσα στον ορισμό (`config.decimals`) — ακριβής. */
  readonly path?: string;
  /** Ο έλεγχος, με το id που ονομάζει η ετικέτα και το id της περιγραφής. */
  readonly children: (ids: { readonly id: string; readonly describedBy: string }) => React.ReactNode;
}

/** Ετικέτα + έλεγχος + υπόδειξη + ευρήματα, δεμένα με `htmlFor` / `aria-describedby` — ένα μοτίβο για όλες τις φόρμες. */
export function CatalogField({ label, hint, issues = [], path, children }: CatalogFieldProps) {
  const id = useId();
  const describedBy = `${id}-desc`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, describedBy })}
      <div id={describedBy} className="flex flex-col gap-0.5">
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        {path ? <FieldIssues issues={issues} path={path} exact /> : null}
      </div>
    </div>
  );
}

interface SwitchFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

export function SwitchField({ label, hint, checked, onChange, disabled }: SwitchFieldProps) {
  const id = useId();
  return (
    <p className="m-0 flex items-start gap-2">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={hint ? `${id}-hint` : undefined} />
      <span className="flex flex-col">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </p>
  );
}
