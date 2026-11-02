'use client';

/**
 * Τα πεδία της συμφωνίας στη φόρμα ευκαιρίας: τίτλος, αξία, πιθανότητα, επόμενη ενέργεια.
 */

import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Opportunity } from '@/types/crm';

type DealTextField = 'title' | 'nextAction';
type DealNumberField = 'estimatedValue' | 'probability';

interface OpportunityDealFieldsProps {
  readonly values: Partial<Opportunity>;
  readonly disabled: boolean;
  readonly onTextChange: (field: DealTextField, value: string) => void;
  readonly onNumberChange: (field: DealNumberField, value: number) => void;
}

export function OpportunityDealFields({
  values,
  disabled,
  onTextChange,
  onNumberChange,
}: OpportunityDealFieldsProps) {
  const { t } = useTranslation('crm');

  const handleNumber = (field: DealNumberField) => (event: ChangeEvent<HTMLInputElement>) => {
    onNumberChange(field, event.target.valueAsNumber || 0);
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="opportunity-title">{t('opportunities.editModal.labels.title')}</Label>
        <Input
          id="opportunity-title"
          value={values.title ?? ''}
          onChange={(event) => onTextChange('title', event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="opportunity-value">{t('opportunities.editModal.labels.estimatedValue')}</Label>
          <Input
            id="opportunity-value"
            type="number"
            min={0}
            step={1000}
            value={values.estimatedValue ?? ''}
            onChange={handleNumber('estimatedValue')}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="opportunity-probability">{t('opportunities.editModal.labels.probability')}</Label>
          <Input
            id="opportunity-probability"
            type="number"
            min={0}
            max={100}
            step={5}
            value={values.probability ?? ''}
            onChange={handleNumber('probability')}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="opportunity-next-action">{t('opportunities.editModal.labels.nextAction')}</Label>
        <Input
          id="opportunity-next-action"
          value={values.nextAction ?? ''}
          onChange={(event) => onTextChange('nextAction', event.target.value)}
          disabled={disabled}
        />
      </div>
    </>
  );
}
