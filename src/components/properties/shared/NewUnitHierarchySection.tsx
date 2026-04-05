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
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField, FormGrid, FormInput } from '@/components/ui/form/FormComponents';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRealtimeBuildings } from '@/services/realtime/hooks/useRealtimeBuildings';
import { isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
// ADR-284 Batch 7: Inlined (avoid circular dep risk με useAddPropertyDialogState)
const PROPERTY_TYPE_OPTIONS = [
  'studio', 'apartment_1br', 'apartment', 'apartment_2br', 'apartment_3br',
  'maisonette', 'penthouse', 'loft', 'detached_house', 'villa',
  'shop', 'office', 'hall', 'storage',
] as const;
import { AddProjectDialog } from '@/components/projects/dialogs/AddProjectDialog';
import { FloorInlineCreateForm } from '@/components/building-management/tabs/FloorInlineCreateForm';
import { LinkBuildingToProjectDialog } from '@/components/building-management/dialogs/LinkBuildingToProjectDialog';
import { PropertyHierarchyEmptyStates } from './PropertyHierarchyEmptyStates';
import { useNewUnitHierarchy, type NewUnitHierarchySelection } from './useNewUnitHierarchy';
import type { PropertyType } from '@/types/property';

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
  const { t } = useTranslation('properties');
  const router = useRouter();

  // Buildings via real-time hook (SSoT)
  const { allBuildings: buildings } = useRealtimeBuildings();

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
    const f = floorOptions.find((opt) => opt.id === value);
    onChange({ floorId: value, floor: f?.number ?? 0 });
  }, [floorOptions, onChange]);

  // Navigate to /buildings page with project preselected
  const handleNavigateToCreateBuilding = useCallback(() => {
    const params = selection.projectId ? `?projectId=${encodeURIComponent(selection.projectId)}` : '';
    router.push(`/buildings${params}`);
  }, [router, selection.projectId]);

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
        onCreateBuilding={handleNavigateToCreateBuilding}
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
        <FormField label={t('dialog.addUnit.fields.type', { defaultValue: 'Τύπος Μονάδας' })} htmlFor="new-unit-type" required>
          <FormInput>
            <Select value={selection.type} onValueChange={handleTypeChange}>
              <SelectTrigger id="new-unit-type">
                <SelectValue placeholder={t('dialog.addUnit.placeholders.type', { defaultValue: 'Επιλέξτε τύπο...' })} />
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
          <FormField label={t('dialog.addUnit.fields.project', { defaultValue: 'Έργο' })} htmlFor="new-unit-project" required>
            <FormInput>
              <Select
                value={selection.projectId}
                onValueChange={handleProjectChange}
                disabled={projectsLoading}
              >
                <SelectTrigger id="new-unit-project">
                  <SelectValue placeholder={t('dialog.addUnit.placeholders.project', { defaultValue: 'Επιλέξτε Έργο...' })} />
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
          <FormField label={t('dialog.addUnit.fields.building', { defaultValue: 'Κτίριο' })} htmlFor="new-unit-building" required>
            <FormInput>
              <Select value={selection.buildingId} onValueChange={handleBuildingChange}>
                <SelectTrigger id="new-unit-building">
                  <SelectValue placeholder={t('dialog.addUnit.placeholders.building', { defaultValue: 'Επιλέξτε Κτίριο...' })} />
                </SelectTrigger>
                <SelectContent>
                  {filteredBuildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormInput>
          </FormField>
        )}

        {!isStandalone && (
          <FormField label={t('dialog.addUnit.fields.floor', { defaultValue: 'Όροφος' })} htmlFor="new-unit-floor" required>
            <FormInput>
              {emptyStates.noFloors ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInlineFloorForm(true)}
                  className="w-full justify-between border-dashed"
                >
                  <span>{t('dialog.addUnit.emptyState.noFloors.inlineCta', { defaultValue: 'Δεν υπάρχουν όροφοι — Πρόσθεσε Όροφο' })}</span>
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <Select
                  value={selection.floorId}
                  onValueChange={handleFloorChange}
                  disabled={!selection.buildingId || floorsLoading}
                >
                  <SelectTrigger id="new-unit-floor">
                    <SelectValue placeholder={t('dialog.addUnit.placeholders.floor', { defaultValue: 'Επιλέξτε Όροφο...' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {floorOptions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} ({t('dialog.addUnit.floorLevel')} {f.number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormInput>
          </FormField>
        )}
      </FormGrid>

      {/* Nested dialogs */}
      <AddProjectDialog
        open={showAddProjectDialog}
        onOpenChange={setShowAddProjectDialog}
        onProjectAdded={() => reloadProjects()}
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
