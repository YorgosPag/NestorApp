'use client';

/**
 * @fileoverview **ΤΑ ΠΡΩΤΟΓΟΝΑ ΤΩΝ ΦΟΡΜΩΝ** — γραμμένα μία φορά, για κάθε λεξιλόγιο.
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · CLAUDE.md N.18 (jscpd) · N.0.2 · N.4
 * @module components/shared/forms/form-field-primitives
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗΣΑΝ: **Η ΔΕΥΤΕΡΗ ΦΟΡΜΑ ΤΟ ΖΗΤΗΣΕ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Γεννήθηκαν για τη φόρμα **ζήτησης** (Α9) και ήταν ήδη SSoT — για **πέντε άξονες**
 * μιας φόρμας. Η φόρμα **προσφοράς** (Α14) χρειάζεται τα **ίδια τρία** πράγματα
 * (ομάδα με λεζάντα · αριθμητικό πεδίο με «κενό = δεν το έθεσα» · επιλογή από κλειστό
 * σύνολο) για **άλλο λεξιλόγιο**. Αντιγραμμένα, θα ήταν κλώνος που μπλοκάρει το
 * **CHECK 3.28** — και ο **N.0.2** ζητά το SSoT **πριν** το αντίγραφο.
 *
 * 🔑 **Η γενίκευση είναι στον ΤΥΠΟ ΤΩΝ ΤΙΜΩΝ, όχι στη συμπεριφορά**: `TValues`
 * συνάγεται από το `control`, οπότε το `name` μένει **τυπωμένο μονοπάτι** και όχι
 * `string`. Χωρίς αυτό, η κοινή χρήση θα κόστιζε ακριβώς την ασφάλεια που κάνει τη
 * φόρμα αξιόπιστη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΑΡΙΘΜΗΤΙΚΟ ΠΕΔΙΟ ΕΙΝΑΙ **ΕΛΕΓΧΟΜΕΝΟ**, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΤΙΜΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `null` σημαίνει *«δεν το έθεσα ως όρο»* — υπαρκτή, **διαφορετική** τιμή από το
 * `0`. Και έχει **δύο** μάρτυρες: `floorMin: 0` είναι **ισόγειο**, `bedrooms: 0`
 * είναι **γκαρσονιέρα**. Ένα μη ελεγχόμενο `<input>` με `defaultValue={null}` το
 * μετατρέπει σε κενή συμβολοσειρά μέσω του DOM και το επιστρέφει ως `''` ή `0`
 * ανάλογα με τη διαδρομή — δηλαδή **χάνει τη διάκριση που όλο το μοντέλο υπάρχει για
 * να κρατήσει**. Με `Controller`, η μετάφραση `'' ⇄ null` γίνεται σε **ένα** σημείο.
 */

import React from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

/**
 * Μια ομάδα πεδίων με λεζάντα — **σημασιολογικό `<fieldset>`**, όχι `<div>` (N.4).
 *
 * ⚠️ Το `<legend>` **δεν** είναι διακοσμητικό: οι αναγνώστες οθόνης το ανακοινώνουν
 * ως πλαίσιο **κάθε** πεδίου μέσα του, οπότε ένα «Από/Έως» μαθαίνει ότι αφορά ποσό ή
 * εμβαδόν χωρίς να επαναληφθεί σε κάθε ετικέτα.
 *
 * 🔑 **Χωρίς γενικά**: δεν αγγίζει τιμές φόρμας, οπότε μια παράμετρος τύπου εδώ θα
 * ήταν φρουρός που δεν μπορεί να πυροδοτήσει.
 */
export function FormFieldset({
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
 * Πώς διαβάζεται και πώς γράφεται η τιμή ενός πεδίου εισόδου.
 *
 * 🔴 **ΕΝΑ πεδίο με παράμετρο ΕΙΔΟΥΣ, ΟΧΙ δύο αδέλφια** — και ο λόγος είναι
 * **μετρημένος, μέσα στο ίδιο commit**: γραμμένα χωριστά, το αριθμητικό και το
 * κειμενικό πεδίο είχαν **ταυτόσημες 16 γραμμές / 78 σύμβολα** (ετικέτα · `useId` ·
 * `Controller` · `<input>`) και το **CHECK 3.28 τα μπλόκαρε**. Είναι **ακριβώς** το
 * ίδιο μάθημα με το `mode` του {@link FormOptionsField} — και με το `ToggleOption`
 * της Α9, που εξήχθη για τον ίδιο λόγο.
 *
 * Δεν είναι «δύο συμπεριφορές σε ένα»: είναι **μία** ερώτηση («δώσε μια τιμή σε αυτό
 * το πεδίο») όπου το **είδος** αποφασίζει τη μετάφραση DOM ⇄ μοντέλο — ακριβώς ό,τι
 * κάνει η ίδια η HTML με το `type` του `<input>`.
 */
type InputFieldKind = 'number' | 'text';

/** Η μετάφραση **μοντέλο → DOM** και **DOM → μοντέλο**, ανά είδος. Κλειστό σύνολο. */
const INPUT_ADAPTERS: Readonly<
  Record<
    InputFieldKind,
    {
      readonly type: string;
      readonly inputMode?: 'numeric';
      readonly toInput: (value: unknown) => string | number;
      readonly fromInput: (raw: string) => string | number | null;
    }
  >
> = {
  /**
   * ⚠️ Το `Number('')` είναι **0** — και το 0 εδώ είναι **υπαρκτή** τιμή (ισόγειο ·
   * γκαρσονιέρα). Γι' αυτό η μετατροπή ελέγχει το κενό **ΠΡΙΝ** καλέσει `Number`.
   */
  number: {
    type: 'number',
    inputMode: 'numeric',
    toInput: (value) =>
      typeof value === 'number' || typeof value === 'string' ? value : '',
    fromInput: (raw) => (raw === '' ? null : Number(raw)),
  },
  /**
   * ⚠️ Το κενό κείμενο μένει **κενό κείμενο**, ποτέ `null`: ο τίτλος είναι
   * υποχρεωτικός και το invariant `title-missing` κρίνει `trim() === ''`. Ένα `null`
   * εδώ θα έκανε το πεδίο **μη ελεγχόμενο** στο επόμενο καρέ (React warning) και θα
   * έσβηνε ό,τι έγραψε ο άνθρωπος.
   */
  text: {
    type: 'text',
    toInput: (value) => (typeof value === 'string' ? value : ''),
    fromInput: (raw) => raw,
  },
};

/**
 * **Ένα πεδίο εισόδου** — αριθμητικό ή κειμενικό, με ρητό είδος.
 *
 * ⚠️ Το `min` αφορά **μόνο** το αριθμητικό, και **δεν** επιβάλλεται στον τύπο: ένα
 * `min` σε κειμενικό πεδίο είναι αγνοούμενο από τον περιηγητή, ενώ μια διακριτή ένωση
 * props θα διπλασίαζε την υπογραφή — δηλαδή θα ξαναγεννούσε τον κλώνο στον **τύπο**.
 */
export function FormInputField<TValues extends FieldValues>({
  control,
  name,
  label,
  kind,
  min,
  placeholder,
}: {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  kind: InputFieldKind;
  min?: number;
  placeholder?: string;
}): React.ReactElement {
  const inputId = React.useId();
  const adapter = INPUT_ADAPTERS[kind];

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
            type={adapter.type}
            inputMode={adapter.inputMode}
            min={min}
            placeholder={placeholder}
            value={adapter.toInput(field.value)}
            onChange={(event) => field.onChange(adapter.fromInput(event.target.value))}
            className="rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
          />
        )}
      />
    </div>
  );
}

/**
 * Επιλογή από **κλειστό σύνολο** — `radiogroup`/checkboxes, ποτέ `<select>`.
 *
 * 🔑 **Τα ραδιοπλήκτρα δείχνουν ΟΛΕΣ τις επιλογές ταυτόχρονα**, και εδώ αυτό είναι το
 * ζητούμενο: οι μορφές του χώρου, του χρόνου και της **διάθεσης** είναι **αποφάσεις
 * τομέα** που ο άνθρωπος πρέπει να δει για να καταλάβει τι του προσφέρουμε. Ένα
 * κλειστό `<select>` θα έκρυβε το «όποτε κι αν βγει» και την **αντιπαροχή** — τις δύο
 * τιμές που **κανένα portal δεν έχει**.
 *
 * ⚠️ Και αποφεύγει το **CHECK 3.48**: το Radix `Select` δεσμεύει το `''` και ένα
 * `<SelectItem value="">` ρίχνει **ΟΛΗ** την επιφάνεια. Εδώ δεν υπάρχει κενή τιμή.
 */
export function FormOptionsField<TValues extends FieldValues, TOption extends string>({
  control,
  name,
  mode,
  options,
  labelOf,
}: {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  /**
   * Πόσες τιμές δέχεται ο άξονας.
   *
   * 🔴 **ΕΝΑ component με παράμετρο πληθικότητας, ΟΧΙ δύο αδέλφια** — και ο λόγος
   * είναι μετρημένος: γραμμένα χωριστά, τα δύο είχαν **ταυτόσημες 16 γραμμές** και το
   * **CHECK 3.28 τα μπλόκαρε μέσα στο ίδιο commit** (Α9). Η δεύτερη εξαγωγή (η
   * ετικέτα) δεν αρκούσε· ο κλώνος ήταν η **υπογραφή και το `Controller` boilerplate**.
   *
   * Δεν είναι «δύο συμπεριφορές σε ένα»: είναι **μία** ερώτηση («διάλεξε από αυτό το
   * κλειστό σύνολο») με ρητή πληθικότητα — ακριβώς ό,τι κάνει η HTML με το
   * `<select multiple>`.
   */
  mode: 'single' | 'multiple';
  options: readonly TOption[];
  labelOf: (option: TOption) => string;
}): React.ReactElement {
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

        const toggle = (option: TOption): void =>
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
 * 🔴 **Εξήχθη επειδή το CHECK 3.28 το ζήτησε, μέσα στο ίδιο commit (Α9).** Οι δύο
 * τότε συναρτήσεις είχαν **ταυτόσημο** σώμα ετικέτας-και-εισόδου (16 γραμμές / 74
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
