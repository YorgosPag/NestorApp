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
}: HintedFieldProps): React.ReactElement {
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        aria-describedby={hintId}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <p id={hintId} className="m-0 text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
