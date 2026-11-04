'use client';

/**
 * Τα πεδία της φόρμας κοινόχρηστου (ADR-931) — κατηγορία ομαδοποιημένη από το ΛΕΞΙΛΟΓΙΟ
 * (ποτέ χειρόγραφη λίστα), νομική φύση, και ιδιοκτησίες αποκλειστικής χρήσης όταν χρειάζονται.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import {
  COMMON_SPACE_GROUPS,
  COMMON_SPACE_LEGAL_NATURES,
  commonSpaceCategoriesOf,
  isCommonSpaceCategory,
  isCommonSpaceLegalNature,
  type CommonSpaceCategory,
  type CommonSpaceLegalNature,
} from '@/constants/common-space-categories';

export function CommonSpaceCategorySelect({ id, value, onChange, disabled }: {
  readonly id: string;
  readonly value: CommonSpaceCategory;
  readonly onChange: (value: CommonSpaceCategory) => void;
  readonly disabled?: boolean;
}) {
  const { t } = useTranslation('common-spaces');
  return (
    <Select value={value} onValueChange={(next) => { if (isCommonSpaceCategory(next)) onChange(next); }} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        {COMMON_SPACE_GROUPS.map((group) => (
          <SelectGroup key={group}>
            <SelectLabel>{t(`groups.${group}.title`)}</SelectLabel>
            {commonSpaceCategoriesOf(group).map((category) => (
              <SelectItem key={category} value={category}>{t(`categories.${category}`)}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CommonSpaceLegalNatureSelect({ id, value, onChange, disabled }: {
  readonly id: string;
  readonly value: CommonSpaceLegalNature;
  readonly onChange: (value: CommonSpaceLegalNature) => void;
  readonly disabled?: boolean;
}) {
  const { t } = useTranslation('common-spaces');
  return (
    <Select value={value} onValueChange={(next) => { if (isCommonSpaceLegalNature(next)) onChange(next); }} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        {COMMON_SPACE_LEGAL_NATURES.map((nature) => (
          <SelectItem key={nature} value={nature}>{t(`legalNature.${nature}`)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface ExclusiveUseOption {
  readonly id: string;
  readonly label: string;
}

export function ExclusiveUsePropertyPicker({ options, selected, onChange, disabled }: {
  readonly options: readonly ExclusiveUseOption[];
  readonly selected: readonly string[];
  readonly onChange: (ids: readonly string[]) => void;
  readonly disabled?: boolean;
}) {
  const { t } = useTranslation('common-spaces');
  const colors = useSemanticColors();
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...selected, id] : selected.filter((existing) => existing !== id));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('tab.form.exclusiveUseProperties')}</legend>
      <p className={cn('text-xs', colors.text.muted)}>{t('tab.form.exclusiveUseHint')}</p>
      {options.length === 0 ? (
        <p className={cn('text-sm', colors.text.muted)}>{t('tab.form.noProperties')}</p>
      ) : (
        <ul className="max-h-40 overflow-auto space-y-1">
          {options.map((option) => (
            <li key={option.id} className="flex items-center gap-2">
              <Checkbox
                id={`exclusive-use-${option.id}`}
                checked={selected.includes(option.id)}
                onCheckedChange={(checked) => toggle(option.id, checked === true)}
                disabled={disabled}
              />
              <Label htmlFor={`exclusive-use-${option.id}`} className="font-normal">{option.label}</Label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
