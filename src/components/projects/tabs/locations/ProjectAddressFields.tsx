/**
 * =============================================================================
 * ProjectAddressFields — Type, Block Side, Label, Primary selectors
 * =============================================================================
 *
 * @module components/projects/tabs/locations/ProjectAddressFields
 * @enterprise ADR-167
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
import type { ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';
import { ADDRESS_TYPE_KEYS, BLOCK_SIDE_KEYS } from './address-constants';
import { useTypography } from '@/hooks/useTypography';
import '@/lib/design-system';

// =============================================================================
// PROPS
// =============================================================================

interface ProjectAddressFieldsProps {
  type: ProjectAddressType;
  blockSide: BlockSideDirection | typeof SELECT_CLEAR_VALUE;
  label: string;
  isPrimary: boolean;
  onTypeChange: (val: ProjectAddressType) => void;
  onBlockSideChange: (val: BlockSideDirection | typeof SELECT_CLEAR_VALUE) => void;
  onLabelChange: (val: string) => void;
  onIsPrimaryChange: (val: boolean) => void;
  t: (key: string) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectAddressFields({
  type, blockSide, label, isPrimary,
  onTypeChange, onBlockSideChange, onLabelChange, onIsPrimaryChange,
  t,
}: ProjectAddressFieldsProps) {
  const typography = useTypography();
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <Label>{t('form.type')}</Label>
        <Select value={type} onValueChange={(v) => onTypeChange(v as ProjectAddressType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADDRESS_TYPE_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`types.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t('form.blockSide')}</Label>
        <Select
          value={blockSide}
          onValueChange={(v) =>
            onBlockSideChange(v === SELECT_CLEAR_VALUE ? SELECT_CLEAR_VALUE : v as BlockSideDirection)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('form.blockSidePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_CLEAR_VALUE}>{t('form.blockSideNone')}</SelectItem>
            {BLOCK_SIDE_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`blockSides.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t('form.label')}</Label>
        <Input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={t('form.labelPlaceholder')}
        />
      </div>

      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isPrimary}
            onCheckedChange={(checked) => onIsPrimaryChange(checked === true)}
          />
          <span className={typography.body.sm}>{t('form.isPrimary')}</span>
        </label>
      </div>
    </fieldset>
  );
}
