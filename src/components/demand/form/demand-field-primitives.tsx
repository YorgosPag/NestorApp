'use client';

/**
 * **Τα πρωτόγονα της φόρμας ζήτησης** — γραμμένα μία φορά, για πέντε άξονες.
 *
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · CLAUDE.md N.18 (jscpd) · N.0.2
 * @module components/demand/form/demand-field-primitives
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ: **ΠΕΝΤΕ ΑΞΟΝΕΣ ΘΑ ΗΤΑΝ ΠΕΝΤΕ ΔΙΔΥΜΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας **N.0.2** το λέει ρητά: *«ποτέ copy-paste ενός σχήματος σε N αρχεία —
 * πρώτα φτιάξε το SSoT»*. Κάθε άξονας χρειάζεται τα **ίδια** τρία πράγματα (ομάδα με
 * λεζάντα και βοήθεια · αριθμητικό πεδίο με «κενό = δεν το έθεσα» · επιλογή από
 * κλειστό σύνολο), και πέντε αντίγραφα θα τα έπιανε το **CHECK 3.28** — αφού πρώτα
 * είχαν αποκλίνει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΑΡΙΘΜΗΤΙΚΟ ΠΕΔΙΟ ΕΙΝΑΙ **ΕΛΕΓΧΟΜΕΝΟ**, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΤΙΜΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `null` σημαίνει *«δεν το έθεσα ως όρο»* — υπαρκτή, **διαφορετική** τιμή από το
 * `0` (το `floorMin: 0` είναι **ισόγειο**). Ένα μη ελεγχόμενο `<input>` με
 * `defaultValue={null}` το μετατρέπει σε κενή συμβολοσειρά μέσω του DOM και το
 * επιστρέφει ως `''` ή `0` ανάλογα με τη διαδρομή — δηλαδή **χάνει τη διάκριση που
 * όλο το μοντέλο υπάρχει για να κρατήσει**.
 *
 * Με `Controller`, η μετάφραση `'' ⇄ null` γίνεται σε **ένα** σημείο, ρητά.
 */

import React from 'react';
import { Controller, useFormContext, type Control, type FieldPath } from 'react-hook-form';

import type { DemandFormValues } from '@/lib/demand/demand-form-values';

/** Το μονοπάτι ενός πεδίου της φόρμας ζήτησης — τυπωμένο, ποτέ `string`. */
export type DemandFieldName = FieldPath<DemandFormValues>;

/** Ο έλεγχος της φόρμας, χωρίς να τον περνά ο καθένας ως prop. */
export function useDemandForm(): Control<DemandFormValues> {
  return useFormContext<DemandFormValues>().control;
}

/**
 * Μια ομάδα πεδίων με λεζάντα — **σημασιολογικό `<fieldset>`**, όχι `<div>` (N.4).
 *
 * ⚠️ Το `<legend>` **δεν** είναι διακοσμητικό: οι αναγνώστες οθόνης το ανακοινώνουν
 * ως πλαίσιο **κάθε** πεδίου μέσα του, οπότε ένα «Από/Έως» μαθαίνει ότι αφορά ποσό ή
 * εμβαδόν χωρίς να επαναληφθεί σε κάθε ετικέτα.
 */
export function DemandFieldset({
  legend,
  help,
  children,
}: {
  legend: string;
  help?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">{legend}</legend>
      {help !== undefined && <p className="text-sm text-muted-foreground">{help}</p>}
      {children}
    </fieldset>
  );
}

/**
 * Αριθμητικό πεδίο με σημασιολογία **«κενό = δεν το έθεσα»**.
 *
 * ⚠️ Το `Number('')` είναι **0** — και το 0 εδώ είναι υπαρκτή τιμή. Γι' αυτό η
 * μετατροπή είναι ρητή και **ελέγχει το κενό ΠΡΙΝ** καλέσει `Number`.
 */
export function DemandNumberField({
  name,
  label,
  min,
}: {
  name: DemandFieldName;
  label: string;
  min?: number;
}): React.ReactElement {
  const control = useDemandForm();
  const inputId = React.useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-foreground">
        {label}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={min}
            value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
            onChange={(event) => {
              const raw = event.target.value;
              field.onChange(raw === '' ? null : Number(raw));
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        )}
      />
    </div>
  );
}

/**
 * Επιλογή **μίας** τιμής από κλειστό σύνολο — `radiogroup`, όχι `<select>`.
 *
 * 🔑 **Τα ραδιοπλήκτρα δείχνουν ΟΛΕΣ τις επιλογές ταυτόχρονα**, και εδώ αυτό είναι το
 * ζητούμενο: οι μορφές του χώρου και του χρόνου είναι **αποφάσεις τομέα** που ο
 * άνθρωπος πρέπει να δει για να καταλάβει τι του προσφέρουμε. Ένα κλειστό `<select>`
 * θα έκρυβε το «όποτε κι αν βγει» — τη μοναδική τιμή που **κανένα portal δεν έχει**.
 *
 * ⚠️ Και αποφεύγει το **CHECK 3.48**: το Radix `Select` δεσμεύει το `''` και ένα
 * `<SelectItem value="">` ρίχνει **ΟΛΗ** την επιφάνεια. Εδώ δεν υπάρχει κενή τιμή.
 */
export function DemandOptionsField<T extends string>({
  name,
  mode,
  options,
  labelOf,
}: {
  name: DemandFieldName;
  /**
   * Πόσες τιμές δέχεται ο άξονας.
   *
   * 🔴 **ΕΝΑ component με παράμετρο πληθικότητας, ΟΧΙ δύο αδέλφια** — και ο λόγος
   * είναι μετρημένος: γραμμένα χωριστά, τα δύο είχαν **ταυτόσημες 16 γραμμές** και το
   * **CHECK 3.28 τα μπλόκαρε μέσα στο ίδιο commit**. Η δεύτερη εξαγωγή (η ετικέτα)
   * δεν αρκούσε· ο κλώνος ήταν η **υπογραφή και το `Controller` boilerplate**.
   *
   * Δεν είναι «δύο συμπεριφορές σε ένα»: είναι **μία** ερώτηση («διάλεξε από αυτό το
   * κλειστό σύνολο») με ρητή πληθικότητα — ακριβώς ό,τι κάνει η ίδια η HTML με το
   * `<select multiple>`.
   */
  mode: 'single' | 'multiple';
  options: readonly T[];
  labelOf: (option: T) => string;
}): React.ReactElement {
  const control = useDemandForm();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selected: readonly string[] = Array.isArray(field.value)
          ? field.value
          : typeof field.value === 'string'
            ? [field.value]
            : [];

        const toggle = (option: T): void =>
          field.onChange(
            mode === 'single'
              ? option
              : selected.includes(option)
                ? selected.filter((value) => value !== option)
                : [...selected, option],
          );

        return (
          <div
            role={mode === 'single' ? 'radiogroup' : undefined}
            className={
              mode === 'single'
                ? 'flex flex-col gap-2'
                : 'flex flex-wrap gap-x-4 gap-y-2'
            }
          >
            {options.map((option) => (
              <ToggleOption
                key={option}
                type={mode === 'single' ? 'radio' : 'checkbox'}
                groupName={mode === 'single' ? field.name : undefined}
                label={labelOf(option)}
                checked={selected.includes(option)}
                onToggle={() => toggle(option)}
              />
            ))}
          </div>
        );
      }}
    />
  );
}

/**
 * Μία επιλογή — **η ετικέτα τυλίγει το κουτί**.
 *
 * 🔴 **Εξήχθη επειδή το CHECK 3.28 το ζήτησε, μέσα στο ίδιο commit.** Οι δύο
 * παραπάνω συναρτήσεις είχαν **ταυτόσημο** σώμα ετικέτας-και-εισόδου (16 γραμμές / 74
 * σύμβολα): ένα δίδυμο που θα απέκλινε στην πρώτη αλλαγή προσβασιμότητας — και η
 * απόκλιση θα ήταν αόρατη, γιατί και οι δύο θα «δούλευαν».
 *
 * ⚠️ Το `<input>` ζει **μέσα** στο `<label>`, ώστε να μη χρειάζεται `htmlFor`/`id`:
 * ένα ζεύγος ταυτοτήτων που παράγεται σε βρόχο είναι ακριβώς το σημείο όπου γεννιούνται
 * διπλά `id` — και ένα διπλό `id` σπάει τον αναγνώστη οθόνης **σιωπηλά**.
 */
function ToggleOption({
  type,
  groupName,
  label,
  checked,
  onToggle,
}: {
  type: 'radio' | 'checkbox';
  /** Μόνο για `radio`: ομαδοποιεί τα κουμπιά ώστε τα βελάκια να κινούνται μεταξύ τους. */
  groupName?: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type={type}
        name={groupName}
        checked={checked}
        onChange={onToggle}
        className="accent-foreground"
      />
      {label}
    </label>
  );
}
