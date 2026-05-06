/**
 * LocationInlineForm — Add/Edit form for project addresses.
 *
 * Exposes AddressEditorHandle via forwardRef so the parent can route
 * map drag events to the confirm dialog (ADR-332 Phase 7, ADR-167).
 *
 * @module components/projects/tabs/locations/LocationInlineForm
 */

import React, { forwardRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { AddressEditor } from '@/components/shared/addresses/editor';
import type { AddressEditorHandle, ResolvedAddressFields } from '@/components/shared/addresses/editor';
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
  /** Called after undo/redo — parent uses it to reset the map drag position. */
  onUndoRedo?: () => void;
  t: (key: string) => string;
  tProjects: (key: string) => string;
  availableTypes?: readonly ProjectAddressType[];
}

// =============================================================================
// HELPERS
// =============================================================================

function hierarchyToResolved(h: Partial<AddressWithHierarchyValue>): ResolvedAddressFields {
  return {
    street: h.street || undefined,
    number: h.number || undefined,
    postalCode: h.postalCode || undefined,
    city: h.settlementName || undefined,
    neighborhood: h.communityName || undefined,
    region: h.regionName || undefined,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export const LocationInlineForm = forwardRef<AddressEditorHandle, LocationInlineFormProps>(
  function LocationInlineForm({
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
    onUndoRedo,
    t,
    tProjects,
    availableTypes,
  }, ref) {
    const iconSizes = useIconSizes();
    const typography = useTypography();
    const spacing = useSpacingTokens();

    const Icon = mode === 'add' ? Plus : Pencil;
    const title = mode === 'add' ? t('locations.addNewAddress') : tProjects('locations.editAddress');

    // Derive ResolvedAddressFields from hierarchy for AddressEditor geocoding engine
    const resolvedValue = useMemo<ResolvedAddressFields>(
      () => hierarchyToResolved(hierarchy),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [hierarchy.street, hierarchy.number, hierarchy.postalCode, hierarchy.settlementName, hierarchy.communityName, hierarchy.regionName],
    );

    // Geocoding correction / undo / suggestion → merge into hierarchy basic fields
    const handleEditorChange = useCallback((resolved: ResolvedAddressFields) => {
      onHierarchyChange({
        ...hierarchy,
        street: resolved.street ?? hierarchy.street ?? '',
        number: resolved.number ?? hierarchy.number ?? '',
        postalCode: resolved.postalCode ?? hierarchy.postalCode ?? '',
        settlementName: resolved.city ?? hierarchy.settlementName ?? '',
      });
    }, [hierarchy, onHierarchyChange]);

    // Drag confirm → clear ELSTAT hierarchy, set basic fields from reverse geocode
    const handleDragApplied = useCallback((resolved: ResolvedAddressFields) => {
      onHierarchyChange({
        ...hierarchy,
        street: resolved.street ?? '',
        number: resolved.number ?? '',
        postalCode: resolved.postalCode ?? '',
        settlementName: resolved.city ?? '',
        settlementId: null,
        communityName: resolved.neighborhood ?? '',
        communityId: null,
        regionName: resolved.region ?? '',
        regionId: null,
        municipalUnitName: '',
        municipalUnitId: null,
        municipalityName: '',
        municipalityId: null,
        regionalUnitName: '',
        regionalUnitId: null,
        decentAdminName: '',
        majorGeoName: '',
      });
    }, [hierarchy, onHierarchyChange]);

    return (
      <div className={cn('border-2 border-primary rounded-lg bg-card', spacing.padding.sm, spacing.spaceBetween.md)}>
        <div className="flex items-center justify-between">
          <h3 className={cn(typography.heading.md, 'flex items-center', spacing.gap.sm)}>
            <Icon className={iconSizes.md} />
            {title}
          </h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className={iconSizes.sm} />
          </Button>
        </div>

        <div className="space-y-2">
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

          {/* AddressEditor provides: activity log, field badges, reconciliation,
              suggestions, drag confirm dialog, undo/redo */}
          <AddressEditor
            ref={ref}
            value={resolvedValue}
            onChange={handleEditorChange}
            onDragApplied={handleDragApplied}
            onUndoRedo={onUndoRedo}
            mode="edit"
            domain="project"
            formOptions={{ hideGrid: true }}
            activityLog={{ collapsed: true }}
          >
            <AddressWithHierarchy
              value={hierarchy}
              onChange={onHierarchyChange}
            />
          </AddressEditor>

          <div className={cn('flex gap-2 justify-end border-t', spacing.padding.top.md)}>
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
  },
);
