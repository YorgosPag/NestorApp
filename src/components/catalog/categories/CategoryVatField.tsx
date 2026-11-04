'use client';

/**
 * @fileoverview **Ο συντελεστής ΦΠΑ μιας κατηγορίας** (ADR-923 §5.13 Ε3 · Σ6): επιλογή από τον ΕΝΑ πίνακα συντελεστών της
 * λογιστικής (`GREEK_VAT_RATES`) ή ρητό «κληρονομείται», και η ένδειξη του συντελεστή που **ισχύει** τελικά, με την πηγή του.
 * @module components/catalog/categories/CategoryVatField
 *
 * 🔑 Radix Select (ADR-001). Το «κληρονομείται» είναι δική του τιμή (`inherit`), ποτέ κενό `''` (CHECK 3.48).
 * 🔑 Η ένδειξη βγαίνει από το `categoryVatSource`, τον ίδιο κανόνα κληρονομιάς με τη βιτρίνα: ό,τι δείχνει η φόρμα είναι ό,τι θα
 *    κρίνει ο διακομιστής για το SKU της κατηγορίας. Χωρίς κανέναν συντελεστή, ο ανώνυμος βλέπει «Κατόπιν προσφοράς», και η φόρμα
 *    το λέει.
 * 🔑 Χ4: ο συντελεστής είναι φορολογική ρύθμιση· αλλάζει μόνο με δικαίωμα τιμολόγησης. Χωρίς αυτό το πεδίο δείχνεται κλειδωμένο
 *    (η ένδειξη «ισχύει» μένει), και ο γραφέας το ξανακρίνει.
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GREEK_VAT_RATE_PERCENTS, type GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { categoryVatSource, type CategoryVatSource } from '@/subapps/catalog/schema/category-vat';
import type { CategoryRecord } from '@/services/catalog/catalog-api.client';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogField } from '../shared/CatalogFormFields';

/** Η τιμή του Select για «κληρονομείται». Δεν συγκρούεται με αριθμό συντελεστή. */
export const VAT_INHERIT = 'inherit';

/** Τιμή του Select → συντελεστής ή `null` (κληρονομείται). Άγνωστη τιμή ⇒ `null`, ποτέ μαντεμένος συντελεστής. */
export function vatRateOfSelectValue(value: string): GreekVatRatePercent | null {
  // Ακριβής αντιστοίχιση κειμένου, όχι `Number(value)`: το `Number('')` είναι 0, δηλαδή ψευδής «απαλλαγή 0%».
  return GREEK_VAT_RATE_PERCENTS.find((rate) => String(rate) === value) ?? null;
}

interface CategoryVatFieldProps {
  readonly value: GreekVatRatePercent | null;
  /** Ρίζα → γονέας της κατηγορίας (ή της νέας, κάτω από τον γονέα της). */
  readonly ancestorIds: readonly string[];
  readonly categories: readonly CategoryRecord[];
  readonly disabled: boolean;
  readonly onChange: (rate: GreekVatRatePercent | null) => void;
}

function useEffectiveText(source: CategoryVatSource, categories: readonly CategoryRecord[]): string {
  const { t, text } = useCatalogText();
  switch (source.kind) {
    case 'own':
      return t('categories.vatEffectiveOwn', { rate: source.rate });
    case 'inherited': {
      const from = categories.find((category) => category.id === source.fromCategoryId);
      return t('categories.vatEffectiveInherited', { rate: source.rate, category: (from && text(from.labels)) || from?.code || source.fromCategoryId });
    }
    case 'none':
      return t('categories.vatEffectiveNone');
  }
}

export function CategoryVatField({ value, ancestorIds, categories, disabled, onChange }: CategoryVatFieldProps): React.JSX.Element {
  const { t } = useCatalogText();
  const canSetVat = useCatalogAccess('pricing') === 'granted';
  const byId = new Map(categories.map((category) => [category.id, category]));
  const effective = useEffectiveText(categoryVatSource(value, ancestorIds, byId), categories);
  return (
    <CatalogField label={t('categories.vatRate')} hint={t(canSetVat ? 'categories.vatRateHint' : 'categories.vatRateNeedsPricing')}>
      {({ id, describedBy }) => (
        <>
          <Select value={value === null ? VAT_INHERIT : String(value)} disabled={disabled || !canSetVat} onValueChange={(next) => onChange(vatRateOfSelectValue(next))}>
            <SelectTrigger id={id} aria-describedby={`${describedBy} ${id}-effective`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={VAT_INHERIT}>{t('categories.vatInherit')}</SelectItem>
              {GREEK_VAT_RATE_PERCENTS.map((rate) => <SelectItem key={rate} value={String(rate)}>{t('categories.vatRateOption', { rate })}</SelectItem>)}
            </SelectContent>
          </Select>
          <output id={`${id}-effective`} className="text-xs text-foreground">{effective}</output>
        </>
      )}
    </CatalogField>
  );
}
