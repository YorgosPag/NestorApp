'use client';

/**
 * @fileoverview **ΕΝΑ πεδίο με ετικέτα και υπόδειξη** — το SSoT των δύο διδύμων.
 * @related ADR-824 §12.14 · ADR-827 §9.10 · N.18 (CHECK 3.28)
 * @module components/ui/hinted-field
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Η ΠΥΛΗ ΤΟ ΜΕΤΡΗΣΕ, ΔΕΝ ΤΟ ΜΑΝΤΕΨΕ ΚΑΝΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `AgencyShowcaseContent` και το `BrokerageCapabilityContent` έγραψαν **το ίδιο**
 * τοπικό `Field` — 11 γραμμές / 56 tokens, πιασμένο από τη **CHECK 3.28** μέσα στο ίδιο
 * commit. Δεν είναι σύμπτωση: είναι **δύο οθόνες ρυθμίσεων του ίδιου οργανισμού**, και
 * το σχήμα *«ετικέτα → πεδίο → υπόδειξη δεμένη με `aria-describedby`»* είναι το
 * **προσβάσιμο** σχήμα, όχι στιλ. Όποιος γράψει τρίτη τέτοια οθόνη θα το ξαναέγραφε.
 *
 * ⚠️ **Δέχεται ΚΕΙΜΕΝΟ, όχι κλειδιά — απόφαση, όχι στιλ.** Αν έπαιρνε `labelKey`, η
 * κλήση `t()` θα ζούσε **εδώ** με δυναμικό όρισμα: **αόρατη** στη CHECK 3.8 και
 * **ανεπίλυτη** για τον τεμαχιστή του ADR-744. Με έτοιμο κείμενο, κάθε `t()` μένει στον
 * γονέα με **κυριολεκτικό** κλειδί. Το μάθημα είναι πληρωμένο: τρία ανεπίλυτα `t()`
 * μπλόκαραν τον γεννήτορα στην πρώτη γραφή του `AgencyShowcaseContent`.
 *
 * 🔑 **`readOnly` και `disabled` ΔΕΝ είναι το ίδιο, γι' αυτό είναι δύο props**:
 * το `readOnly` μένει **εστιάσιμο και αναγνώσιμο** από αναγνώστη οθόνης (η βιτρίνα που
 * δείχνει ό,τι δημοσιεύτηκε), το `disabled` **φεύγει** από τη σειρά εστίασης (η φόρμα
 * όσο ταξιδεύει η δήλωση). Η ένωσή τους σε ένα `locked` θα έκρυβε κείμενο.
 */

import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface HintedFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly readOnly?: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (value: string) => void;
  /**
   * **Το μήνυμα σφάλματος αυτού του πεδίου** — έτοιμο κείμενο, όπως και το `hint`.
   *
   * 🔴 **ΠΡΟΣΤΕΘΗΚΕ ΑΝΤΙ ΓΙΑ ΤΕΤΑΡΤΟ ΔΙΔΥΜΟ** (ADR-843 §10.13, κανόνας N.0.2): η
   * φόρμα της πρώτης επαφής χρειαζόταν *«ετικέτα → πεδίο → υπόδειξη → **σφάλμα**»* και
   * θα το ξανάγραφε τοπικά — δηλαδή **ακριβώς** το περιστατικό που γέννησε αυτό το
   * αρχείο, τρίτη φορά. Η επέκταση είναι **προαιρετική σε όλα**: οι τρεις υπάρχοντες
   * καλούντες δεν αλλάζουν γραμμή.
   *
   * ⚠️ **`undefined` σημαίνει «δεν κρίθηκε», όχι «σωστό»** — γι' αυτό δεν είναι
   * `boolean`: ένα `error={false}` δεν θα είχε τι να ανακοινώσει στον αναγνώστη οθόνης.
   */
  readonly error?: string;
  /**
   * ⚠️ **`type` ΜΟΝΟ για πληκτρολόγιο και autofill, ΠΟΤΕ για επικύρωση**: το
   * `type="email"` ενεργοποιεί τον **εγγενή** έλεγχο του φυλλομετρητή, που μιλά
   * **στη γλώσσα του φυλλομετρητή** — δηλαδή αγγλικά πάνω σε ελληνική οθόνη. Η φόρμα
   * που το χρησιμοποιεί οφείλει να φέρει `noValidate` και να κρίνει **η ίδια**.
   */
  readonly type?: 'text' | 'email' | 'tel';
  readonly autoComplete?: string;
  /** Για επικύρωση **μετά** το πεδίο, ποτέ ενώ πληκτρολογεί (Baymard). */
  readonly onBlur?: () => void;
  /** Μικρό επίθεμα δίπλα στην ετικέτα — *«(προαιρετικό)»* / *«(απαιτείται)»*. */
  readonly labelSuffix?: string;
}

export function HintedField({
  id,
  label,
  hint,
  placeholder,
  value,
  readOnly,
  disabled,
  onChange,
  error,
  type = 'text',
  autoComplete,
  onBlur,
  labelSuffix,
}: HintedFieldProps): React.ReactElement {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // 🔑 **Και τα ΔΥΟ στο `aria-describedby`, με το σφάλμα ΠΡΩΤΟ**: ο αναγνώστης οθόνης
  //    διαβάζει με τη σειρά, και ο άνθρωπος χρειάζεται πρώτα *τι φταίει*, μετά *τι
  //    ζητάμε*. ⚠️ Δεν χρησιμοποιείται μόνο `aria-errormessage`: η υποστήριξή του είναι
  //    ακόμη μερική, ενώ το `describedby` διαβάζεται παντού.
  // ⚠️ **Κενή υπόδειξη ΔΕΝ αποδίδεται και ΔΕΝ αναφέρεται**: ένα `aria-describedby` που
  //    δείχνει σε άδειο στοιχείο κάνει τον αναγνώστη οθόνης να ανακοινώσει **σιωπή** ως
  //    περιγραφή. Πεδίο χωρίς τι να πει, δεν λέει τίποτα.
  const hasHint = hint.trim() !== '';
  const describedBy = [error === undefined ? null : errorId, hasHint ? hintId : null]
    .filter((id): id is string => id !== null)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {labelSuffix !== undefined && (
          <span className="ml-1 font-normal text-muted-foreground">{labelSuffix}</span>
        )}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        aria-invalid={error !== undefined}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => onChange?.(event.target.value)}
        className={error === undefined ? undefined : 'border-destructive'}
      />
      {error !== undefined && (
        // ⚠️ **Χωρίς `role="alert"`**: τα πεδία κρίνονται ομαδικά στην υποβολή, και
        //    τέσσερις ταυτόχρονες αναγγελίες θα σκέπαζαν η μία την άλλη. Ο ρόλος ζει
        //    **μία φορά**, στη σύνοψη σφαλμάτων (πρότυπο GOV.UK).
        <p id={errorId} className="m-0 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {hasHint && (
        <p id={hintId} className="m-0 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
