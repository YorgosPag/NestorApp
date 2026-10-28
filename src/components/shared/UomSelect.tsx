'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ επιλογέας μονάδας μέτρησης** (ADR-923 §5.11 «3γ» 4γ) — παραγγελία, BOQ, υλικά BIM, εισαγόμενα πλέγματα.
 * @module components/shared/UomSelect
 * @related hooks/useUomLabel · lib/uom/uom-registry · ADR-001 (`ui/select`)
 *
 * - Λίστα = **«όνομα (σύμβολο)»** («Τετραγωνικό μέτρο (τ.μ.)»): το όνομα για να διαλέξεις, το σύμβολο για να το αναγνωρίσεις στον πίνακα.
 *   Μονάδα-λέξη του μητρώου (`spelledOut`: σακί, κουτί, σετ…) ⇒ **μόνο το όνομα** — το «σύμβολο» της είναι το πληθυντικό, όχι συντομογραφία.
 * - `compact` (στενή στήλη πίνακα ή μισή στήλη φόρμας): κλειστό πεδίο = **σύμβολο**, το πλήρες όνομα ως `sr-only` **τιμή**, λίστα σε
 *   πλάτος περιεχομένου. Το **όνομα του πεδίου** δεν είναι ποτέ η τιμή (WAI-ARIA): `<label>` της φόρμας ή `ariaLabel` στο κελί.
 * - Ανεκτική ανάγνωση: αποθηκευμένη παλιά γραφή (`'τεμ'`) επιλέγει τον κανονικό κωδικό· τιμή εκτός `units` μένει **ορατή** ως επιλογή,
 *   ποτέ σιωπηλό κενό.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUomLabel } from '@/hooks/useUomLabel';
import { isSpelledOutUom, resolveUom, type UomCode } from '@/lib/uom/uom-registry';

interface UomSelectProps {
  readonly value: string;
  /** Πάντα κωδικός της λίστας (ή η αυτούσια τιμή εκτός λίστας) — ποτέ ετικέτα. */
  readonly onValueChange: (code: string) => void;
  readonly units: readonly UomCode[];
  /** Για `<Label htmlFor>` της φόρμας. */
  readonly id?: string;
  /** Το **όνομα του πεδίου** («Μονάδα») όπου δεν υπάρχει ορατή ετικέτα (κελί πίνακα) — ποτέ η τιμή. */
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly compact?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly contentClassName?: string;
}

export function UomSelect({
  value, onValueChange, units, id, ariaLabel, disabled, placeholder, compact = false, size, contentClassName,
}: UomSelectProps) {
  const uomLabel = useUomLabel();
  const selected = resolveUom(value) ?? value.trim();
  const offList = selected !== '' && !(units as readonly string[]).includes(selected);
  const itemLabel = (code: string) => {
    const name = uomLabel(code, 'name');
    const symbol = uomLabel(code);
    // άγνωστη γραφή ή μονάδα-λέξη: ΜΙΑ φορά — όχι «καρότσι (καρότσι)», όχι «Σακί (σακιά)»
    return name === symbol || isSpelledOutUom(code) ? name : `${name} (${symbol})`;
  };
  return (
    <Select value={selected} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} size={size} aria-label={ariaLabel}>
        {compact && selected !== '' ? (
          <SelectValue placeholder={placeholder}>
            <span aria-hidden="true">{uomLabel(selected)}</span>
            <span className="sr-only">{uomLabel(selected, 'name')}</span>
          </SelectValue>
        ) : <SelectValue placeholder={placeholder} />}
      </SelectTrigger>
      <SelectContent width={compact ? 'content' : undefined} className={contentClassName}>
        {units.map((code) => (
          <SelectItem key={code} value={code}>{itemLabel(code)}</SelectItem>
        ))}
        {offList && <SelectItem value={selected}>{itemLabel(selected)}</SelectItem>}
      </SelectContent>
    </Select>
  );
}
