'use client';

/**
 * Πεδίο «Πελάτης» της ευκαιρίας: όνομα στην οθόνη, `contactId` μόνο στα δεδομένα.
 *
 * Το αναγνωριστικό δεν δείχνεται ποτέ στον άνθρωπο. Το όνομα και το `contactId`
 * αλλάζουν πάντα μαζί· πληκτρολόγηση πάνω σε συνδεδεμένο όνομα αποσυνδέει, ώστε να
 * μην μένει εγγραφή που ονομάζει έναν και δείχνει άλλον (ADR-745 §8, ADR-601).
 */

import { User } from 'lucide-react';
import { LinkedSinglePickerView } from '@/components/shared/pickers';
import {
  useContactPickerSearch,
  type ContactPickerOption,
} from '@/components/shared/pickers/use-contact-picker-search';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Ό,τι γράφεται στη φόρμα όταν αλλάζει ο πελάτης. */
export interface OpportunityContactValue {
  readonly fullName: string;
  readonly contactId: string;
  readonly email?: string;
  readonly phone?: string;
}

interface OpportunityContactFieldProps {
  readonly fullName: string;
  readonly contactId?: string;
  readonly disabled?: boolean;
  readonly onChange: (value: OpportunityContactValue) => void;
}

export function OpportunityContactField({
  fullName,
  contactId,
  disabled = false,
  onChange,
}: OpportunityContactFieldProps) {
  const { t } = useTranslation('crm');
  const search = useContactPickerSearch();

  return (
    <div className="space-y-2">
      <Label>{t('opportunities.editModal.labels.customer')}</Label>
      <LinkedSinglePickerView<ContactPickerOption, OpportunityContactValue>
        value={fullName}
        linkedId={contactId || undefined}
        search={search}
        getResultLabel={(result) => result.label}
        buildSelected={(result, label) => ({
          fullName: label,
          contactId: result.id,
          email: result.email,
          phone: result.phone,
        })}
        buildFreeText={(text) => ({ fullName: text, contactId: '' })}
        onChange={onChange}
        disabled={disabled}
        placeholder={t('opportunities.editModal.labels.customerPlaceholder')}
        clearLabel={t('opportunities.editModal.labels.customerClear')}
        selectedInputPadding="pr-24"
        leftIcon={
          <User
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground"
            aria-hidden
          />
        }
        badge={
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {t('opportunities.editModal.labels.customerLinked')}
          </span>
        }
        getKey={(result) => result.id}
        renderItemContent={(result) => <span className="text-sm font-medium">{result.label}</span>}
        labels={{
          searchResults: t('opportunities.editModal.labels.customerResults'),
          noResults: t('opportunities.editModal.labels.customerNoResults'),
          useFreeText: t('opportunities.editModal.labels.customerFreeText'),
        }}
      />
      {contactId ? null : (
        <p className="text-xs text-muted-foreground">
          {t('opportunities.editModal.labels.customerNotLinked')}
        </p>
      )}
    </div>
  );
}
