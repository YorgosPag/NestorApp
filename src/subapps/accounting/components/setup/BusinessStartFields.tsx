'use client';

/**
 * @fileoverview Company Setup — Έναρξη εργασιών
 * @description Ημερομηνία έναρξης (όπως στο μητρώο TAXISnet) + προέλευση. Από εδώ ο φόρος **υπολογίζει** τη
 *   μειωμένη προκαταβολή — ποτέ χειροκίνητη επιλογή ανά εταίρο (ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α).
 *   Κενή ημερομηνία ⇒ `businessStart: null` ⇒ πλήρης προκαταβολή.
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`, ADR-001 Radix Select, i18n
 */

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { BUSINESS_START_ORIGINS } from '../../types/company';
import type { BusinessStart, BusinessStartOrigin } from '../../types/company';
import type { EntityType } from '../../types/entity';

interface BusinessStartFieldsProps {
  entityType: EntityType;
  value: BusinessStart | null;
  onChange: (businessStart: BusinessStart | null) => void;
}

/** Κλειδιά ανά νομική φύση — η «συνέχεια» σημαίνει άλλο για φυσικό και άλλο για νομικό πρόσωπο. */
const NATURE_KEYS = {
  naturalPerson: {
    help: 'setup.businessStart.helpNaturalPerson',
    continuation: 'setup.businessStart.origins.continuationNaturalPerson',
  },
  legalEntity: {
    help: 'setup.businessStart.helpLegalEntity',
    continuation: 'setup.businessStart.origins.continuationLegalEntity',
  },
} as const;

function originLabelKey(origin: BusinessStartOrigin, nature: keyof typeof NATURE_KEYS): string {
  return origin === 'new' ? 'setup.businessStart.origins.new' : NATURE_KEYS[nature].continuation;
}

export function BusinessStartFields({ entityType, value, onChange }: BusinessStartFieldsProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const nature = entityType === 'sole_proprietor' ? 'naturalPerson' : 'legalEntity';

  const handleDateChange = (date: string) => {
    onChange(date === '' ? null : { date, origin: value?.origin ?? 'new' });
  };

  const handleOriginChange = (origin: string) => {
    const known = BUSINESS_START_ORIGINS.find((o) => o === origin);
    if (value && known) onChange({ ...value, origin: known });
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('setup.businessStart.title')}</legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="businessStartDate">{t('setup.businessStart.date')}</Label>
          <Input
            id="businessStartDate"
            type="date"
            value={value?.date ?? ''}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessStartOrigin">{t('setup.businessStart.origin')}</Label>
          <Select value={value?.origin ?? 'new'} onValueChange={handleOriginChange} disabled={value === null}>
            <SelectTrigger id="businessStartOrigin">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_START_ORIGINS.map((origin) => (
                <SelectItem key={origin} value={origin}>
                  {t(originLabelKey(origin, nature))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className={cn('text-xs', colors.text.muted)}>{t(NATURE_KEYS[nature].help)}</p>
    </fieldset>
  );
}
