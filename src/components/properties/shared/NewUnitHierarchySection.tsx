'use client';

/**
 * =============================================================================
 * ENTERPRISE: NewUnitHierarchySection — Hierarchy UI for inline new-unit flow
 * =============================================================================
 *
 * UI section που προστίθεται στο `PropertyFieldsBlock` **μόνο** όταν
 * `isCreatingNewUnit=true`. Παρέχει τα discriminated hierarchy selectors
 * (Type / Project / Building / Floor) + empty state CTAs + orphan fix modal
 * per ADR-284 Batch 7.
 *
 * Self-contained: φορτώνει projects/buildings/floors μέσω
 * `useNewUnitHierarchy` hook, εμφανίζει τα empty states μέσω του shared
 * `PropertyHierarchyEmptyStates` component, και triggers το
 * `LinkBuildingToProjectDialog` για orphan fix.
 *
 * @module components/properties/shared/NewUnitHierarchySection
 * @enterprise ADR-284 §9.3, Batch 7 — Path #2 Integration (inline __new__ template)
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClearableSelect } from '@/components/ui/clearable-select';
import { FormField, FormGrid, FormInput } from '@/components/ui/form/FormComponents';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRealtimeBuildings } from '@/services/realtime/hooks/useRealtimeBuildings';
import { isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
// ADR-145: Import από centralized SSoT (leaf module — δεν δημιουργεί circular dep).
// ADR-287 Batch 20: Uses CREATABLE_PROPERTY_TYPES (excludes 'storage').
import { CREATABLE_PROPERTY_TYPES as PROPERTY_TYPE_OPTIONS } from '@/constants/property-types';
import { ProjectQuickCreateSheet } from '@/components/projects/dialogs/ProjectQuickCreateSheet';
import { BuildingQuickCreateSheet } from '@/components/building-management/dialogs/BuildingQuickCreateSheet';
import { FloorInlineCreateForm } from '@/components/building-management/tabs/FloorInlineCreateForm';
import { LinkBuildingToProjectDialog } from '@/components/building-management/dialogs/LinkBuildingToProjectDialog';
import { PropertyHierarchyEmptyStates } from './PropertyHierarchyEmptyStates';
import { useNewUnitHierarchy, type NewUnitHierarchySelection } from './useNewUnitHierarchy';
import type { PropertyType } from '@/types/property';
import { formatBuildingLabel } from '@/lib/entity-formatters';

// =============================================================================
// TYPES
// =============================================================================

export interface NewUnitHierarchySectionProps {
  /** Current hierarchy selection (controlled). */
  selection: NewUnitHierarchySelection;
  /** Handler when any hierarchy field changes. */
  onChange: (patch: Partial<NewUnitHierarchySelection>) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function NewUnitHierarchySection({
  selection,
  onChange,
}: NewUnitHierarchySectionProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

  // Buildings via real-time hook (SSoT)
  const { allBuildings: buildings, refetch: refetchBuildings } = useRealtimeBuildings();

  const {
    projects,
    projectsLoading,
    reloadProjects,
    filteredBuildings,
    selectedBuilding,
    floorOptions,
    floorsLoading,
    emptyStates,
  } = useNewUnitHierarchy({
    buildings,
    enabled: true,
    selection,
  });

  // Nested dialog state
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showAddBuildingSheet, setShowAddBuildingSheet] = useState(false);
  const [showInlineFloorForm, setShowInlineFloorForm] = useState(false);
  const [showLinkBuildingDialog, setShowLinkBuildingDialog] = useState(false);

  // Names for empty-state messaging
  const selectedProjectName = projects.find((p) => p.id === selection.projectId)?.name ?? '';
  const selectedBuildingName = selectedBuilding?.name ?? '';

  const isStandalone = isStandaloneUnitType(selection.type);

  // ── Handlers ──
  const handleTypeChange = useCallback((value: string) => {
    const newType = value as PropertyType | '';
    if (isStandaloneUnitType(newType)) {
      // Family B: clear building/floor
      onChange({ type: newType, buildingId: '', floorId: '', floor: 0 });
    } else {
      onChange({ type: newType });
    }
  }, [onChange]);

  const handleProjectChange = useCallback((value: string) => {
    // Reset building/floor if building no longer belongs to new project
    const currentBuilding = buildings.find((b) => b.id === selection.buildingId);
    if (currentBuilding && currentBuilding.projectId !== value) {
      onChange({ projectId: value, buildingId: '', floorId: '', floor: 0 });
    } else {
      onChange({ projectId: value });
    }
  }, [buildings, selection.buildingId, onChange]);

  const handleBuildingChange = useCallback((value: string) => {
    // ADR-284 revision (Γιώργος 2026-04-05): Family A Units δεν δείχνουν στο Project στο UI —
    // το projectId derives αυτόματα από Building.projectId (server policy needs it).
    const picked = buildings.find((b) => b.id === value);
    const derivedProjectId = picked?.projectId || '';
    onChange({
      buildingId: value,
      floorId: '',
      floor: 0,
      projectId: derivedProjectId,
    });
  }, [buildings, onChange]);

  const handleFloorChange = useCallback((value: string) => {
    if (value === '') {
      onChange({ floorId: '', floor: 0 });
      return;
    }
    const f = floorOptions.find((opt) => opt.id === value);
    onChange({ floorId: value, floor: f?.number ?? 0 });
  }, [floorOptions, onChange]);

  // SSoT: Open BuildingQuickCreateSheet (same pattern as ProjectQuickCreateSheet)
  const handleOpenCreateBuilding = useCallback(() => {
    setShowAddBuildingSheet(true);
  }, []);

  // Auto-refresh floors via onSnapshot — no manual reload needed.
  // Auto-select project after linking orphan building (hook flag flips).
  useEffect(() => {
    if (emptyStates.orphanBuilding && selectedBuilding?.projectId) {
      // Building was just linked — auto-select its project
      onChange({ projectId: selectedBuilding.projectId });
    }
  }, [emptyStates.orphanBuilding, selectedBuilding?.projectId, onChange]);

  return (
    <section className="flex flex-col gap-3 mb-4 rounded-md border p-3 shrink-0" style={{minHeight: '280px'}}>
      <PropertyHierarchyEmptyStates
        flags={emptyStates}
        selectedProjectName={selectedProjectName}
        selectedBuildingName={selectedBuildingName}
        onCreateProject={() => setShowAddProjectDialog(true)}
        onCreateBuilding={handleOpenCreateBuilding}
        onLinkBuildingToProject={() => setShowLinkBuildingDialog(true)}
        onPickAnotherBuilding={() => onChange({ buildingId: '', floorId: '', floor: 0 })}
        onCreateFloor={() => setShowInlineFloorForm(true)}
      />
      {showInlineFloorForm && selection.buildingId && selectedBuilding && (
        <FloorInlineCreateForm
          buildingId={selection.buildingId}
          projectId={selectedBuilding.projectId ?? undefined}
          onCreated={() => setShowInlineFloorForm(false)}
          onCancel={() => setShowInlineFloorForm(false)}
        />
      )}
      <FormGrid>
        <FormField label={t('dialog.addUnit.fields.type')} htmlFor="new-unit-type" required>
          <FormInput>
            <Select value={selection.type} onValueChange={handleTypeChange}>
              <SelectTrigger size="sm" id="new-unit-type">
                <SelectValue placeholder={t('dialog.addUnit.placeholders.type')} />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPE_OPTIONS.map((pt) => (
                  <SelectItem key={pt} value={pt}>{t(`types.${pt}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormInput>
        </FormField>

        {isStandalone && (
          <FormField label={t('dialog.addUnit.fields.project')} htmlFor="new-unit-project" required>
            <FormInput>
              <Select
                value={selection.projectId}
                onValueChange={handleProjectChange}
                disabled={projectsLoading}
              >
                <SelectTrigger size="sm" id="new-unit-project">
                  <SelectValue placeholder={t('dialog.addUnit.placeholders.project')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormInput>
          </FormField>
        )}

        {!isStandalone && (
          <FormField label={t('dialog.addUnit.fields.building')} htmlFor="new-unit-building" required>
            <FormInput>
              <Select value={selection.buildingId} onValueChange={handleBuildingChange}>
                <SelectTrigger size="sm" id="new-unit-building">
                  <SelectValue placeholder={t('dialog.addUnit.placeholders.building')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredBuildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {formatBuildingLabel((b as { code?: string }).code, b.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormInput>
          </FormField>
        )}

        {!isStandalone && (
          <FormField label={t('dialog.addUnit.fields.floor')} htmlFor="new-unit-floor" required>
            <FormInput>
              {emptyStates.noFloors ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInlineFloorForm(true)}
                  className="w-full justify-between border-dashed"
                >
                  <span>{t('dialog.addUnit.emptyState.noFloors.inlineCta')}</span>
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <ClearableSelect
                  value={selection.floorId}
                  onValueChange={handleFloorChange}
                  disabled={!selection.buildingId || floorsLoading}
                  id="new-unit-floor"
                  placeholder={t('dialog.addUnit.placeholders.floor')}
                  clearLabel={t('fields.clearSelection.floor')}
                >
                  {floorOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({t('dialog.addUnit.floorLevel')} {f.number})
                    </SelectItem>
                  ))}
                </ClearableSelect>
              )}
            </FormInput>
          </FormField>
        )}
      </FormGrid>

      {/* Nested dialogs — SSoT: reuses the canonical editors */}
      <ProjectQuickCreateSheet
        open={showAddProjectDialog}
        onOpenChange={setShowAddProjectDialog}
        onProjectCreated={() => reloadProjects()}
      />
      <BuildingQuickCreateSheet
        open={showAddBuildingSheet}
        onOpenChange={setShowAddBuildingSheet}
        onBuildingCreated={() => refetchBuildings()}
      />
      {selection.buildingId && selectedBuilding && (
        <LinkBuildingToProjectDialog
          open={showLinkBuildingDialog}
          onOpenChange={setShowLinkBuildingDialog}
          buildingId={selection.buildingId}
          buildingName={selectedBuilding.name}
          projects={projects}
          projectsLoading={projectsLoading}
          onSuccess={(linkedProjectId) => {
            onChange({ projectId: linkedProjectId });
          }}
        />
      )}
    </section>
  );
}
