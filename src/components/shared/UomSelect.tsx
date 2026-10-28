'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ επιλογέας μονάδας μέτρησης** (ADR-923 §5.11 «3γ» 4γ) — παραγγελία, BOQ, υλικά BIM, εισαγόμενα πλέγματα.
 * @module components/shared/UomSelect
 * @related hooks/useUomLabel · lib/uom/uom-registry · ADR-001 (`ui/select`)
 *
 * - Λίστα = **«όνομα (σύμβολο)»** («Τετραγωνικό μέτρο (τ.μ.)»): το όνομα για να διαλέξεις, το σύμβολο για να το αναγνωρίσεις στον πίνακα.
 * - `compact` (στενή στήλη πίνακα): κλειστό πεδίο = **σύμβολο**, όνομα στο `aria-label`, λίστα σε πλάτος περιεχομένου.
 * - Ανεκτική ανάγνωση: αποθηκευμένη παλιά γραφή (`'τεμ'`) επιλέγει τον κανονικό κωδικό· τιμή εκτός `units` μένει **ορατή** ως επιλογή,
 *   ποτέ σιωπηλό κενό.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUomLabel } from '@/hooks/useUomLabel';
import { resolveUom, type UomCode } from '@/lib/uom/uom-registry';

interface UomSelectProps {
  readonly value: string;
  /** Πάντα κωδικός της λίστας (ή η αυτούσια τιμή εκτός λίστας) — ποτέ ετικέτα. */
  readonly onValueChange: (code: string) => void;
  readonly units: readonly UomCode[];
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly compact?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly contentClassName?: string;
}

export function UomSelect({
  value, onValueChange, units, disabled, placeholder, compact = false, size, contentClassName,
}: UomSelectProps) {
  const uomLabel = useUomLabel();
  const selected = resolveUom(value) ?? value.trim();
  const offList = selected !== '' && !(units as readonly string[]).includes(selected);
  const itemLabel = (code: string) => {
    const name = uomLabel(code, 'name');
    const symbol = uomLabel(code);
    return name === symbol ? name : `${name} (${symbol})`; // άγνωστη γραφή: ΜΙΑ φορά, όχι «καρότσι (καρότσι)»
  };
  return (
    <Select value={selected} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger size={size} aria-label={compact ? uomLabel(selected, 'name') : undefined}>
        {compact ? <SelectValue placeholder={placeholder}>{uomLabel(selected)}</SelectValue> : <SelectValue placeholder={placeholder} />}
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
