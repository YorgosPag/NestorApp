'use client';

/**
 * AddressFormSection — Address form using AddressWithHierarchy (ADR-332 Phase 7).
 *
 * Controlled component: callers manage state, pass value + onChange.
 * When wrapped in <AddressEditor formOptions.hideGrid=true>, field badges
 * appear automatically via AddressEditorContext (AddressWithHierarchy is context-aware).
 *
 * @module components/shared/addresses/AddressFormSection
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';
import { AddressWithHierarchy } from './AddressWithHierarchy';
import type { AddressWithHierarchyValue } from './AddressWithHierarchy';
import { ADDRESS_TYPE_KEYS, BLOCK_SIDE_KEYS } from '@/components/projects/tabs/locations/address-constants';
import '@/lib/design-system';

// =============================================================================
// PROPS
// =============================================================================

export interface AddressFormSectionProps {
  /** Controlled address value. */
  value: Partial<AddressWithHierarchyValue>;
  /** Called on every address field change. */
  onChange: (val: Partial<AddressWithHierarchyValue>) => void;
  // Optional project-specific fields — rendered only if at least onTypeChange is provided
  type?: ProjectAddressType;
  blockSide?: BlockSideDirection | typeof SELECT_CLEAR_VALUE;
  label?: string;
  isPrimary?: boolean;
  onTypeChange?: (val: ProjectAddressType) => void;
  onBlockSideChange?: (val: BlockSideDirection | typeof SELECT_CLEAR_VALUE) => void;
  onLabelChange?: (val: string) => void;
  onIsPrimaryChange?: (val: boolean) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressFormSection({
  value,
  onChange,
  type,
  blockSide,
  label,
  isPrimary,
  onTypeChange,
  onBlockSideChange,
  onLabelChange,
  onIsPrimaryChange,
}: AddressFormSectionProps) {
  const { t } = useTranslation('addresses');
  const showProjectFields = Boolean(onTypeChange);

  return (
    <div className="space-y-4">
      {/* Address fields — context-aware when inside <AddressEditor> */}
      <AddressWithHierarchy value={value} onChange={onChange} />

      {showProjectFields && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">{t('form.type')}</Label>
              <Select
                value={type}
                onValueChange={(v) => onTypeChange?.(v as ProjectAddressType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADDRESS_TYPE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>{t(`types.${key}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">{t('form.blockSide')}</Label>
              <Select
                value={blockSide}
                onValueChange={(v) => onBlockSideChange?.(
                  v === SELECT_CLEAR_VALUE ? SELECT_CLEAR_VALUE : v as BlockSideDirection,
                )}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.blockSidePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_CLEAR_VALUE}>{t('form.blockSideNone')}</SelectItem>
                  {BLOCK_SIDE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>{t(`blockSides.${key}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">{t('form.label')}</Label>
            <Input
              value={label ?? ''}
              onChange={(e) => onLabelChange?.(e.target.value)}
              placeholder={t('form.labelPlaceholder')}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="addr-isPrimary"
              checked={isPrimary ?? false}
              onCheckedChange={(c) => onIsPrimaryChange?.(c === true)}
            />
            <Label htmlFor="addr-isPrimary" className="text-sm font-medium cursor-pointer">
              {t('form.isPrimary')}
            </Label>
          </div>
        </>
      )}
    </div>
  );
}
