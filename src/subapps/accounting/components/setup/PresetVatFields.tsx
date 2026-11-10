'use client';

/**
 * @fileoverview **ΦΠΑ μιας υπηρεσίας (preset): συντελεστής + αιτία εξαίρεσης** (ADR-ACC-003 §22.3 · ADR-ACC-011).
 * @module subapps/accounting/components/setup/PresetVatFields
 *
 * 🔑 Πρότυπο NetSuite tax code / Xero default tax: η αιτία απαλλαγής **δηλώνεται μία φορά στην υπηρεσία** και η
 * γραμμή τιμολογίου την κληρονομεί — δεν επιλέγεται ξανά σε κάθε τιμολόγιο.
 * 🔑 Ένα συστατικό για τη φόρμα **προσθήκης** και την **επεξεργασία**· η μετάβαση συντελεστή ⇄ αιτία είναι η ίδια
 * με τη γραμμή τιμολογίου (`withVatRate` / `withVatExemption`): εκτός 0% η αιτία καθαρίζει.
 * 🔑 Η παραπομπή που φαίνεται είναι του νόμου που ισχύει **σήμερα** (`accountingToday`) — στο τιμολόγιο θα τυπωθεί
 * εκείνη της ημερομηνίας έκδοσης, από την ίδια `vatExemptionCitation`.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Label } from '@/components/ui/label';
import { VATRateSelector } from '../shared/VATRateSelector';
import { VatExemptionReasonField } from '../shared/VatExemptionReasonField';
import { withVatExemption, withVatRate, type VatBearing } from '../shared/vat-rate-transition';
import { requiresVatExemption } from '../../services/mydata/mydata-codes';
import { accountingToday } from '../../utils/accounting-day';

interface PresetVatFieldsProps<T extends VatBearing> {
  /** Πρόθεμα για μοναδικά `id` (προσθήκη / επεξεργασία μπορεί να συνυπάρχουν). */
  readonly idPrefix: string;
  readonly value: T;
  readonly onChange: (next: T) => void;
}

export function PresetVatFields<T extends VatBearing>({ idPrefix, value, onChange }: PresetVatFieldsProps<T>) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);

  return (
    <>
      <fieldset>
        <Label>{t('setup.vatLabel')}</Label>
        <VATRateSelector value={value.vatRate} onValueChange={(rate) => onChange(withVatRate(value, rate))} />
      </fieldset>
      {requiresVatExemption(value.vatRate) && (
        <VatExemptionReasonField
          id={`${idPrefix}-vat-exemption`}
          value={value.vatExemptionCategory}
          issueDate={accountingToday()}
          onValueChange={(code) => onChange(withVatExemption(value, code))}
        />
      )}
    </>
  );
}
