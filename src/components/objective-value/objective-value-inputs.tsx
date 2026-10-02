'use client';

/**
 * **Τα χειριστήρια του υπολογιστή που μιλούν σε `null`** (ADR-898 Φ2) — επιλογή, αριθμός, ναι/όχι — και το κοινό
 * σχήμα ενός βήματος (`CalculatorStep`).
 *
 * 🔑 **`null` = «δεν απαντήθηκε»**, όπως στη μηχανή. Τα κοινά χειριστήρια του έργου δεν το έχουν: το `EnumSelect`
 * θέλει πάντα τιμή, το `NumericField` αριθμό (το κενό είναι εκεί **κατάσταση προβολής**, `blankValue`). Εδώ το κενό
 * είναι **δεδομένο** — η μηχανή το ζητά στο `missing` — γι' αυτό η μετατροπή γίνεται σε **ένα** σημείο.
 */

import React, { useId } from 'react';

import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ChoiceSelectProps<T extends string> {
  readonly id: string;
  readonly value: T | null;
  readonly values: readonly T[];
  readonly getLabel: (value: T) => string;
  readonly placeholder: string;
  readonly onChange: (value: T) => void;
}

/** Radix Select με placeholder όσο δεν έχει επιλεγεί τίποτα — ⚠️ κανένα `<SelectItem value="">` (CHECK 3.48). */
export function ChoiceSelect<T extends string>({ id, value, values, getLabel, placeholder, onChange }: ChoiceSelectProps<T>) {
  return (
    <Select
      value={value ?? ''}
      onValueChange={(next) => {
        const match = values.find((candidate) => candidate === next);
        if (match !== undefined) onChange(match);
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {getLabel(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface OptionalNumberProps {
  readonly id: string;
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly step?: number;
  readonly describedBy?: string;
}

/**
 * Αριθμός που μπορεί να λείπει. Το `0` ως κενό είναι ασφαλές εδώ: **καμία** είσοδος του υπολογιστή δεν δέχεται 0
 * (επιφάνεια, τιμή ζώνης, ΣΕ ≥ 1, ΣΑΟ, ποσοστό, δαπάνη — η τελευταία με 0 σημαίνει ακριβώς «καμία»).
 */
export function OptionalNumber({ id, value, onChange, step = 1, describedBy }: OptionalNumberProps) {
  return (
    <NumericField
      id={id}
      value={value ?? 0}
      blankValue={0}
      min={0}
      step={step}
      aria-describedby={describedBy}
      onValueChange={(next) => onChange(next > 0 ? next : null)}
    />
  );
}

const YES_NO_OPTIONS = ['yes', 'no', 'unset'] as const;
type YesNoOption = (typeof YES_NO_OPTIONS)[number];

const OPTION_OF = (value: boolean | null): YesNoOption => (value === null ? 'unset' : value ? 'yes' : 'no');
const VALUE_OF: Readonly<Record<YesNoOption, boolean | null>> = { yes: true, no: false, unset: null };

interface YesNoProps {
  readonly name: string;
  readonly value: boolean | null;
  readonly onChange: (value: boolean | null) => void;
  /** `unset` = η ετικέτα του `null` — ο καλών τη διαλέγει, γιατί η ίδια κατάσταση λέγεται αλλιώς ανά πλαίσιο. */
  readonly labels: { readonly yes: string; readonly no: string; readonly unset: string };
  readonly labelledBy: string;
}

/**
 * **Ναι / Όχι / «δεν απαντήθηκε» — τρεις ΡΗΤΕΣ επιλογές** (ADR-898 §18.1). Το `null` είναι επιλογή της ομάδας, όχι
 * κενό: η ομάδα έχει **πάντα** επιλεγμένο στοιχείο (Tab/βελάκια, «3 από 3, επιλεγμένο» στον αναγνώστη οθόνης), και η
 * απάντηση **αναιρείται από το ίδιο χειριστήριο** — όπως η ακαθόριστη παράμετρος Yes/No της Revit και η ρητή τρίτη
 * επιλογή του GOV.UK. Κανένα εξωτερικό κουμπί «καθαρισμός» γι' αυτό (δες `questionClearsItself`).
 */
export function YesNo({ name, value, onChange, labels, labelledBy }: YesNoProps) {
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={OPTION_OF(value)}
      onValueChange={(next) => {
        const option = YES_NO_OPTIONS.find((candidate) => candidate === next);
        if (option !== undefined) onChange(VALUE_OF[option]);
      }}
      className="flex flex-wrap gap-4"
    >
      {YES_NO_OPTIONS.map((option) => (
        <Label key={option} htmlFor={`${name}-${option}`} className="flex items-center gap-2 font-normal">
          <RadioGroupItem id={`${name}-${option}`} value={option} />
          {labels[option]}
        </Label>
      ))}
    </RadioGroup>
  );
}

interface LabelledNumberProps {
  readonly label: string;
  readonly help?: string;
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly step?: number;
}

/**
 * Πώς λέγεται το `null` ενός Ναι/Όχι: `unknown` = ο ιδιώτης του υπολογιστή «δεν το γνωρίζει» · `undeclared` = σε
 * καταχωρισμένο στοιχείο (αγγελία, κτίριο) «δεν δηλώθηκε». Ίδια τιμή, άλλη πρόταση — ένας τύπος για όλους.
 */
export type YesNoUnsetVoice = 'unknown' | 'undeclared';

/** Ετικέτα + αριθμός + (προαιρετική) βοήθεια, δεμένα με `htmlFor` / `aria-describedby` — το ίδιο μοτίβο σε όλα τα βήματα. */
export function LabelledNumber({ label, help, value, onChange, step }: LabelledNumberProps) {
  const id = useId();
  const helpId = useId();
  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      <OptionalNumber id={id} value={value} step={step} onChange={onChange} describedBy={help === undefined ? undefined : helpId} />
      {help !== undefined && <span id={helpId} className="text-xs text-muted-foreground">{help}</span>}
    </>
  );
}

interface StepProps {
  readonly title: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** Ένα βήμα του υπολογιστή: `<section>` με τη δική του επικεφαλίδα `h2` (μία δομή για όλα τα βήματα). */
export function CalculatorStep({ title, className, children }: StepProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-3', className)}>
      <h2 id={headingId} className="m-0 text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
