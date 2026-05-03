/**
 * =============================================================================
 * LocationInlineForm — Unified Add/Edit form for project addresses
 * =============================================================================
 *
 * Single component for both add and edit modes (DRY: was duplicated before).
 * Includes AddressWithHierarchy + project-specific fields.
 *
 * @module components/projects/tabs/locations/LocationInlineForm
 * @enterprise ADR-167
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { AddressWithHierarchy, type AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';

import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { Plus, Pencil, X } from 'lucide-react';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import type { ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';
import { ProjectAddressFields } from './ProjectAddressFields';
import '@/lib/design-system';

// =============================================================================
// PROPS
// =============================================================================

interface LocationInlineFormProps {
  mode: 'add' | 'edit';
  hierarchy: Partial<AddressWithHierarchyValue>;
  onHierarchyChange: (val: Partial<AddressWithHierarchyValue>) => void;
  type: ProjectAddressType;
  blockSide: BlockSideDirection | typeof SELECT_CLEAR_VALUE;
  label: string;
  isPrimary: boolean;
  onTypeChange: (val: ProjectAddressType) => void;
  onBlockSideChange: (val: BlockSideDirection | typeof SELECT_CLEAR_VALUE) => void;
  onLabelChange: (val: string) => void;
  onIsPrimaryChange: (val: boolean) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  t: (key: string) => string;
  tProjects: (key: string) => string;
  /** Subset of address types rendered in the type dropdown. */
  availableTypes?: readonly ProjectAddressType[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LocationInlineForm({
  mode,
  hierarchy,
  onHierarchyChange,
  type,
  blockSide,
  label,
  isPrimary,
  onTypeChange,
  onBlockSideChange,
  onLabelChange,
  onIsPrimaryChange,
  isSaving,
  onSave,
  onCancel,
  t,
  tProjects,
  availableTypes,
}: LocationInlineFormProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const Icon = mode === 'add' ? Plus : Pencil;
  const title = mode === 'add'
    ? t('locations.addNewAddress')
    : tProjects('locations.editAddress');


  return (
    <div className={cn("border-2 border-primary rounded-lg bg-card", spacing.padding.sm, spacing.spaceBetween.md)}>
      <div className="flex items-center justify-between">
        <h3 className={cn(typography.heading.md, "flex items-center", spacing.gap.sm)}>
          <Icon className={iconSizes.md} />
          {title}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className={iconSizes.sm} />
        </Button>
      </div>

      <div className="space-y-2">
          <AddressWithHierarchy
            value={hierarchy}
            onChange={onHierarchyChange}
          />
          <ProjectAddressFields
            type={type}
            blockSide={blockSide}
            label={label}
            isPrimary={isPrimary}
            onTypeChange={onTypeChange}
            onBlockSideChange={onBlockSideChange}
            onLabelChange={onLabelChange}
            onIsPrimaryChange={onIsPrimaryChange}
            t={t}
            availableTypes={availableTypes}
          />
          <div className={cn("flex gap-2 justify-end border-t", spacing.padding.top.md)}>
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              {tProjects('projectHeader.cancel')}
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? tProjects('projectHeader.saving') : tProjects('projectHeader.save')}
            </Button>
          </div>
        </div>
    </div>
  );
}
