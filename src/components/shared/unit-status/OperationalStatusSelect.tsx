'use client';

/**
 * OperationalStatusSelect — ο πυκνός επιλογέας λειτουργικής κατάστασης (κελί πίνακα)
 *
 * **Ένα** component για τη γρήγορη επεξεργασία θέσεων **και** αποθηκών στις καρτέλες κτιρίου
 * (ADR-777 §8.60.20). Προσφέρει **μόνο** το λεξιλόγιο των ακινήτων (`OPERATIONAL_STATUSES`):
 * «Πωλημένη / Κρατημένη» ανήκουν πλέον στη συναλλαγή, και η διάθεση στον δικό της επεξεργαστή.
 * Αδήλωτη κατάσταση ⇒ placeholder «Δεν έχει δηλωθεί», ποτέ «Έτοιμο» από εικασία.
 *
 * @module components/shared/unit-status/OperationalStatusSelect
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  OPERATIONAL_STATUS_SELECT_OPTIONS,
  parseOperationalDraft,
  type OperationalStatusDraft,
} from '@/lib/spaces/space-operational-draft';

export interface OperationalStatusSelectProps {
  readonly value: OperationalStatusDraft;
  readonly onValueChange: (value: OperationalStatusDraft) => void;
  readonly disabled?: boolean;
}

export function OperationalStatusSelect({ value, onValueChange, disabled }: OperationalStatusSelectProps) {
  const { t } = useTranslation('properties-enums');
  return (
    <Select value={value} onValueChange={(next) => onValueChange(parseOperationalDraft(next))} disabled={disabled}>
      <SelectTrigger className="h-8" aria-label={t('unitStatus.operational')}>
        <SelectValue placeholder={t('unitStatus.undeclared')} />
      </SelectTrigger>
      <SelectContent>
        {OPERATIONAL_STATUS_SELECT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
