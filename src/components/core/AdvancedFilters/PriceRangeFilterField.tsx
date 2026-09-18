'use client';

/**
 * @fileoverview **Το χειριστήριο «Τιμή από/έως» ΜΕ ΜΟΝΑΔΑ** — επιλογέας ρόλου + δύο όρια.
 * @related ADR-777 §8.60.14.14 · lib/properties/price-range.ts · lib/listings/listing-price-keys.ts
 * @module components/core/AdvancedFilters/PriceRangeFilterField
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ.** Το ίδιο πεδίο «Εύρος τιμής» ζούσε σε τέσσερις πίνακες φίλτρων ως δύο
 * σκέτα αριθμητικά κουτιά: «έως 1.000» — **σε τι;** € πώλησης, €/μήνα ή €/νύχτα, κανείς δεν
 * ρωτούσε, και η μηχανή έκρινε την κύρια τιμή **όποιου** ρόλου.
 *
 * 🏆 **Rightmove**: επιλογέας μονάδας **μέσα** στο φίλτρο τιμής. **Revit**: *«the filter field and
 * comparison value are of the same parameter type»*. Εδώ η μονάδα είναι **μέρος της τιμής** του
 * πεδίου (`RolePriceRange`) — αριθμοί χωρίς μονάδα δεν μπορούν καν να γραφτούν στην κατάσταση.
 *
 * 🔑 **Αλλαγή μονάδας ⇒ τα όρια ΚΑΘΑΡΙΖΟΥΝ.** Ένα «έως 200.000» πώλησης δεν γίνεται σιωπηλά
 * «έως 200.000 €/μήνα»: ο αριθμός ανήκε στη μονάδα του. Είναι ο κανόνας της φάσης σε ένα κλικ.
 */

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PRICE_RANGE_ROLE_KEY } from '@/lib/listings/listing-price-keys';
import { EMPTY_PRICE_RANGE, type RolePriceRange } from '@/lib/properties/price-range';
import { PRICE_ROLES, type PriceRole } from '@/lib/properties/price-resolver';

interface PriceRangeFilterFieldProps {
  readonly id: string;
  readonly value: RolePriceRange | undefined;
  /** Πάντα **ολόκληρο** το εύρος — ρόλος **και** όρια, ποτέ μισό. */
  readonly onChange: (range: RolePriceRange) => void;
}

const isPriceRole = (value: string): value is PriceRole =>
  (PRICE_ROLES as readonly string[]).includes(value);

/** «» ⇒ ανοιχτό άκρο· αλλιώς ο αριθμός. */
const boundOf = (raw: string): number | undefined => (raw === '' ? undefined : Number(raw));

export function PriceRangeFilterField({ id, value, onChange }: PriceRangeFilterFieldProps) {
  const { t } = useTranslation(['common', 'filters']);
  const range = value && isPriceRole(value.role) ? value : EMPTY_PRICE_RANGE;
  const unitLabel = t(PRICE_RANGE_ROLE_KEY[range.role]);

  const emit = (next: Partial<RolePriceRange>) =>
    onChange({ role: range.role, min: range.min ?? undefined, max: range.max ?? undefined, ...next });

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <Select
        value={range.role}
        onValueChange={(role) => {
          if (isPriceRole(role)) onChange({ role, min: undefined, max: undefined });
        }}
      >
        <SelectTrigger id={id} className="h-9" aria-label={t('common:priceRangeFilter.unit')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRICE_ROLES.map((role) => (
            <SelectItem key={role} value={role}>{t(PRICE_RANGE_ROLE_KEY[role])}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          aria-label={`${t('filters:minimum')} — ${unitLabel}`}
          placeholder={t('filters:from')}
          className="h-9"
          value={range.min ?? ''}
          onChange={(e) => emit({ min: boundOf(e.target.value) })}
        />
        <Input
          type="number"
          min={0}
          aria-label={`${t('filters:maximum')} — ${unitLabel}`}
          placeholder={t('filters:to')}
          className="h-9"
          value={range.max ?? ''}
          onChange={(e) => emit({ max: boundOf(e.target.value) })}
        />
      </div>
    </fieldset>
  );
}
