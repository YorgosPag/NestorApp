'use client';

/**
 * =============================================================================
 * CommercialPriceInput — ΕΝΑ πεδίο ποσού, με τη μονάδα του ρόλου στην ετικέτα
 * =============================================================================
 *
 * Βγήκε από τη φόρμα ακινήτου (ήταν το τοπικό `PriceInputField`) όταν απέκτησε δεύτερο και
 * τρίτο καταναλωτή: την κάρτα «Εμπορικά» των χώρων και τη γρήγορη επεξεργασία της καρτέλας
 * κτιρίου (ADR-777 §8.60.18). **Μία** σημασιολογία πληκτρολόγησης για κάθε ποσό του έργου.
 *
 * Μορφή κατά την έξοδο (ADR-706 numeric-field SSoT): όσο έχει εστίαση δείχνει το **ωμό**
 * κείμενο με το δεκαδικό σύμβολο της γλώσσας· μετά την έξοδο, ομαδοποιημένο («125.500,50»).
 * Ωμό, ποτέ ξαναμορφοποιημένο αριθμό: ένα μισογραμμένο «12,» πρέπει να επιζήσει, αλλιώς το
 * δεκαδικό σύμβολο καταπίνεται (το ελάττωμα του `type="number"`). Κενό μένει κενό: πεδίο
 * τιμής πρέπει να μπορεί να κρατήσει «καμία τιμή».
 *
 * 🔑 **Η ετικέτα φέρει τη ΜΟΝΑΔΑ** — «Τιμή πώλησης (€)» · «Ενοίκιο (€/μήνα)» — από το ΙΔΙΟ
 * κλειδί με το φίλτρο εύρους τιμής (`PRICE_RANGE_ROLE_KEY`, §8.60.14.14). Ο άνθρωπος δεν
 * μαντεύει αν τα «60» είναι ανά μήνα.
 *
 * @module components/shared/commercial/CommercialPriceInput
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { normalizeDecimalString } from '@/lib/number/locale-number';
import { formatForDisplay, resolveDecimalSeparator } from '@/components/ui/numeric-field';
import { getCurrentLocale } from '@/lib/intl-utils';
import { PRICE_RANGE_ROLE_KEY } from '@/lib/listings/listing-price-keys';
import type { PriceRole } from '@/lib/properties/price-resolver';

/** Κανονικό κείμενο μηχανής: ψηφία με προαιρετικό **ένα** `.` δεκαδικό. */
const MACHINE_NUMBER_RE = /^\d+\.?\d*$/;

export interface CommercialPriceInputProps {
  readonly id: string;
  /** Ο ρόλος του ποσού — ορίζει τη μονάδα της ετικέτας. */
  readonly role: PriceRole;
  /** Κείμενο μηχανής (`.` δεκαδικό, χωρίς ομαδοποίηση), π.χ. «125500.5». */
  readonly value: string;
  readonly onValueChange: (raw: string) => void;
  readonly disabled: boolean;
  /** `true` σε πυκνό πίνακα: η ετικέτα μένει μόνο για τους αναγνώστες οθόνης. */
  readonly compact?: boolean;
}

/** Η τιμή που **φαίνεται** στο πεδίο — ωμή με εστίαση, ομαδοποιημένη χωρίς. */
function displayValueOf(value: string, isFocused: boolean): string {
  if (value === '') return '';
  if (isFocused) return value.replace('.', resolveDecimalSeparator(getCurrentLocale()));
  return formatForDisplay(Number(value));
}

export function CommercialPriceInput({
  id,
  role,
  value,
  onValueChange,
  disabled,
  compact = false,
}: CommercialPriceInputProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const [isFocused, setIsFocused] = useState(false);
  const label = t(PRICE_RANGE_ROLE_KEY[role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeDecimalString(e.target.value);
    if (raw === '' || MACHINE_NUMBER_RE.test(raw)) onValueChange(raw);
  };

  return (
    <>
      <Label htmlFor={id} className={cn('text-xs', colors.text.muted, compact && 'sr-only')}>
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValueOf(value, isFocused)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={handleChange}
        size="sm"
        className="text-xs text-right"
        placeholder={compact ? label : undefined}
        disabled={disabled}
      />
    </>
  );
}
