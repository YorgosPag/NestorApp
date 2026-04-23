'use client';

/**
 * AddressTypeSelector — ADR-319 UI control
 *
 * Renders a Select (filtered by contact type via `getAddressTypesForContact`)
 * plus an inline text input when the chosen type is `other`.
 *
 * Callers hold `{ type, customLabel }` and pass an `onChange` that receives
 * both whenever either changes. Labels come from `addresses.types.<key>`;
 * there is no hardcoded Greek/English text here.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  type ContactAddressType,
  getAddressTypesForContact,
} from '@/types/contacts/address-types';
import type { ContactType } from '@/types/contacts';

interface AddressTypeSelectorProps {
  contactType: ContactType | undefined;
  value: ContactAddressType;
  customLabel?: string;
  disabled?: boolean;
  onChange: (next: { type: ContactAddressType; customLabel?: string }) => void;
  /** Additional CSS for the SelectTrigger. */
  triggerClassName?: string;
}

export function AddressTypeSelector({
  contactType,
  value,
  customLabel,
  disabled,
  onChange,
  triggerClassName,
}: AddressTypeSelectorProps) {
  const { t: tAddr } = useTranslation('addresses');
  const allowed = React.useMemo(() => getAddressTypesForContact(contactType), [contactType]);

  const handleTypeChange = (next: string) => {
    const nextType = next as ContactAddressType;
    onChange({
      type: nextType,
      customLabel: nextType === 'other' ? (customLabel ?? '') : undefined,
    });
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ type: 'other', customLabel: e.target.value });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handleTypeChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName ?? 'w-44 h-8 text-sm font-semibold'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowed.map(key => (
            <SelectItem key={key} value={key}>
              {tAddr(`types.${key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === 'other' && (
        <Input
          value={customLabel ?? ''}
          onChange={handleCustomChange}
          disabled={disabled}
          placeholder={tAddr('types.other')}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}

export default AddressTypeSelector;
