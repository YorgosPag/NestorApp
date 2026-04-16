'use client';

/**
 * =============================================================================
 * ENTERPRISE: AddPropertyDialog Component
 * =============================================================================
 *
 * Enterprise-grade dialog for creating new properties.
 * Render-only: all logic delegated to useAddPropertyDialogState.
 *
 * @module components/properties/dialogs/AddPropertyDialog
 * @enterprise ADR-034
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { Home, ClipboardList } from 'lucide-react';
import { ProjectQuickCreateSheet } from '@/components/projects/dialogs/ProjectQuickCreateSheet';
import { AddFloorDialog } from '@/components/building-management/dialogs/AddFloorDialog';
import { LinkBuildingToProjectDialog } from '@/components/building-management/dialogs/LinkBuildingToProjectDialog';
import { PropertyHierarchyEmptyStates } from '@/components/properties/shared/PropertyHierarchyEmptyStates';
import { AskingPriceRequiredAlert } from '@/components/properties/shared/AskingPriceRequiredAlert';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { FloorMultiSelectField } from '@/components/shared/FloorMultiSelectField';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import { parseFloorLevel } from '@/hooks/useEntityCodeSuggestion';
import { ENTITY_TYPES } from '@/config/domain-constants';

import type { AddPropertyDialogProps } from './useAddPropertyDialogState';
import {
  useAddPropertyDialogState,
  PROPERTY_TYPE_OPTIONS,
  OPERATIONAL_STATUS_OPTIONS,
  CREATION_COMMERCIAL_STATUS_OPTIONS,
} from './useAddPropertyDialogState';

// =============================================================================
// COMPONENT
// =============================================================================

export function AddPropertyDialog({
  open,
  onOpenChange,
  onPropertyAdded,
  buildings,
  buildingsLoading = false,
}: AddPropertyDialogProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const router = useRouter();

  const {
    formData, loading, errors, isValid,
    handleSubmit, handleChange, handleSelectChange, handleNumberChange, handleLevelsChange,
    floorOptions, floorsLoading,
    latestSuggestion, setLatestSuggestion,
    isMultiLevelType,
    activeTab, setActiveTab,
    handleBuildingChange, handleFloorSelection, handleAreaChange,
    projects, projectsLoading, reloadProjects, isStandalone, handleTypeChange,
    filteredBuildings, emptyStates,
    showAddProjectDialog, setShowAddProjectDialog,
    showAddFloorDialog, setShowAddFloorDialog,
    showLinkBuildingDialog, setShowLinkBuildingDialog,
    selectedBuilding,
    nameTypeConflict, nameInferredType,
    nameOverridden, setNameOverridden, suggestedName,
  } = useAddPropertyDialogState({ open, onPropertyAdded, onOpenChange, buildings });


  // ADR-284 §3.3 (Phase 3a): No-floors detection (only meaningful when building is selected)
  const noFloors =
    !isStandalone &&
    !!formData.buildingId &&
    !floorsLoading &&
    floorOptions.length === 0 &&
    !isMultiLevelType;

  // Building navigation CTA: close this dialog + go to Buildings page with projectId preselected
  const handleNavigateToCreateBuilding = React.useCallback(() => {
    onOpenChange(false);
    const params = formData.projectId ? `?projectId=${encodeURIComponent(formData.projectId)}` : '';
    router.push(`/buildings${params}`);
  }, [formData.projectId, onOpenChange, router]);

  const selectedProjectName = React.useMemo(
    () => projects.find((p) => p.id === formData.projectId)?.name ?? '',
    [projects, formData.projectId],
  );
  const selectedBuildingName = React.useMemo(
    () => buildings.find((b) => b.id === formData.buildingId)?.name ?? '',
    [buildings, formData.buildingId],
  );

  // ADR-284: Tooltip message differs between families
  const saveTooltipKey = isStandalone
    ? 'dialog.addUnit.tooltips.standaloneRequired'
    : 'dialog.addUnit.tooltips.inBuildingRequired';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NAVIGATION_ENTITIES.property.icon className={iconSizes.md} />
            {t('dialog.addUnit.title')}
          </DialogTitle>
          <DialogDescription>{t('dialog.addUnit.description')}</DialogDescription>
        </DialogHeader>

        {/* 🔐 ADR-284 §3.3: Empty State CTAs — shared component (Batch 7 SSoT) */}
        <PropertyHierarchyEmptyStates
          flags={{
            noProjects: emptyStates.noProjects,
            noBuildings: emptyStates.noBuildings,
            orphanBuilding: emptyStates.orphanBuilding,
            noFloors,
          }}
          selectedProjectName={selectedProjectName}
          selectedBuildingName={selectedBuildingName}
          onCreateProject={() => setShowAddProjectDialog(true)}
          onCreateBuilding={handleNavigateToCreateBuilding}
          onLinkBuildingToProject={() => setShowLinkBuildingDialog(true)}
          onPickAnotherBuilding={() => handleSelectChange('buildingId', '')}
          onCreateFloor={() => setShowAddFloorDialog(true)}
        />

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="flex items-center gap-1">
                <Home className="h-3 w-3" />
                {t('dialog.addUnit.tabs.basic')}
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                {t('dialog.addUnit.tabs.details')}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: BASIC INFO */}
            <TabsContent value="basic" className={spacing.margin.top.md}>
              <FormGrid>
                <FormField label={t('dialog.addUnit.fields.name')} htmlFor="name" required>
                  <FormInput>
                    <Input id="name" name="name" value={formData.name}
                      onChange={(e) => {
                        handleChange(e);
                        if (!nameOverridden && e.target.value !== suggestedName) setNameOverridden(true);
                        if (!e.target.value) setNameOverridden(false);
                      }}
                      placeholder={t('dialog.addUnit.placeholders.name')} disabled={loading}
                      className={errors.name ? 'border-destructive' : ''} />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                    {nameOverridden && suggestedName && formData.name !== suggestedName && (
                      <button
                        type="button"
                        onClick={() => { handleSelectChange('name', suggestedName); setNameOverridden(false); }}
                        className={cn("text-xs mt-1 underline cursor-pointer", colors.text.muted)}
                      >
                        {t('dialog.addUnit.nameSuggestion.suggested', { name: suggestedName })}
                      </button>
                    )}
                    {nameTypeConflict && nameInferredType && (
                      <p className="text-xs text-amber-600 mt-1">
                        {t('dialog.addUnit.nameSuggestion.conflictWarning', {
                          inferredType: t(`types.${nameInferredType}`),
                          selectedType: t(`types.${formData.type}`),
                        })}
                      </p>
                    )}
                  </FormInput>
                </FormField>

                {/* ADR-233: Code field — sealed via EntityCodeField (SSoT) */}
                <EntityCodeField
                  value={formData.code}
                  onChange={(v) => handleSelectChange('code', v)}
                  entityType={ENTITY_TYPES.PROPERTY}
                  buildingId={formData.buildingId}
                  floorLevel={parseFloorLevel(String(formData.floor))}
                  propertyType={formData.type || undefined}
                  onSuggestionChange={setLatestSuggestion}
                  label={t('dialog.addUnit.fields.code')}
                  placeholderFallback="A-DI-1.01"
                  infoContent={
                    <>
                      <h4 className="font-semibold mb-2">{t('entityCode.infoTitle')}</h4>
                      <p className={cn("mb-2", colors.text.muted)}>{t('entityCode.infoFormat')}</p>
                      <p className={cn("mb-3", colors.text.muted)}>{t('entityCode.infoExample')}</p>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1 font-medium">{t('entityCode.infoResidential')}</th>
                            <th className="text-left py-1 font-medium">{t('entityCode.infoCommercial')}</th>
                            <th className="text-left py-1 font-medium">{t('entityCode.infoAuxiliary')}</th>
                          </tr>
                        </thead>
                        <tbody className={colors.text.muted}>
                          <tr><td>DI = {t('types.apartment')}</td><td>KA = {t('types.shop')}</td><td>AP = {t('types.storage')}</td></tr>
                          <tr><td>GK = {t('types.apartment_1br')}</td><td>GR = {t('types.office')}</td><td>PK = Parking</td></tr>
                          <tr><td>ST = {t('types.studio')}</td><td>AI = {t('types.hall')}</td><td>PY = {t('types.outdoor')}</td></tr>
                          <tr><td>ME = {t('types.maisonette')}</td><td colSpan={2} rowSpan={5} /></tr>
                          <tr><td>RE = {t('types.penthouse')}</td></tr>
                          <tr><td>LO = Loft</td></tr>
                          <tr><td>MO = {t('types.detached_house')}</td></tr>
                          <tr><td>BI = {t('types.villa')}</td></tr>
                        </tbody>
                      </table>
                      <p className={cn("mt-2 text-xs", colors.text.muted)}>{t('entityCode.infoFloors')}</p>
                    </>
                  }
                  disabled={loading}
                  variant="dialog"
                />

                <FormField label={t('dialog.addUnit.fields.type')} htmlFor="type" required>
                  <FormInput>
                    <Select value={formData.type} onValueChange={handleTypeChange} disabled={loading}>
                      <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                        <SelectValue placeholder={t('dialog.addUnit.placeholders.type')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                          <SelectItem key={propertyType} value={propertyType}>{t(`types.${propertyType}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.type && <p className="text-xs text-destructive mt-1">{errors.type}</p>}
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.project')} htmlFor="projectId" required>
                  <FormInput>
                    <Select value={formData.projectId} onValueChange={(v) => handleSelectChange('projectId', v)}
                      disabled={loading || projectsLoading}>
                      <SelectTrigger className={errors.projectId ? 'border-destructive' : ''}>
                        <SelectValue placeholder={t('dialog.addUnit.placeholders.project')} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.projectId && <p className="text-xs text-destructive mt-1">{errors.projectId}</p>}
                  </FormInput>
                </FormField>

                {!isStandalone && (
                  <FormField label={t('dialog.addUnit.fields.building')} htmlFor="buildingId" required>
                    <FormInput>
                      <Select value={formData.buildingId} onValueChange={handleBuildingChange}
                        disabled={loading || buildingsLoading}>
                        <SelectTrigger className={errors.buildingId ? 'border-destructive' : ''}>
                          <SelectValue placeholder={t('dialog.addUnit.placeholders.building')} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredBuildings.map((building) => (
                            <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.buildingId && <p className="text-xs text-destructive mt-1">{errors.buildingId}</p>}
                    </FormInput>
                  </FormField>
                )}

                {!isStandalone && (
                <FormField
                  label={isMultiLevelType
                    ? t('multiLevel.floors')
                    : t('dialog.addUnit.fields.floor')}
                  htmlFor="floorId"
                  required
                >
                  <FormInput>
                    {isMultiLevelType ? (
                      <FloorMultiSelectField
                        buildingId={formData.buildingId || null}
                        value={formData.levels}
                        onChange={handleLevelsChange}
                        label=""
                        noBuildingHint={t('dialog.addUnit.placeholders.floor')}
                        disabled={loading}
                      />
                    ) : floorsLoading ? (
                      <section className={cn("flex items-center gap-2 h-10 text-sm", colors.text.muted)}>
                        <Spinner size="small" />
                        <span>{t('dialog.addUnit.loadingFloors')}</span>
                      </section>
                    ) : floorOptions.length > 0 ? (
                      <Select value={formData.floorId} onValueChange={handleFloorSelection}
                        disabled={loading || !formData.buildingId}>
                        <SelectTrigger><SelectValue placeholder={t('dialog.addUnit.placeholders.floor')} /></SelectTrigger>
                        <SelectContent>
                          {floorOptions.map((floor) => (
                            <SelectItem key={floor.id} value={floor.id}>
                              {floor.name} ({t('dialog.addUnit.floorLevel')} {floor.number})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input id="floor" name="floor" type="number" value={formData.floor}
                        onChange={(e) => handleNumberChange('floor', e.target.value)}
                        placeholder={formData.buildingId ? t('dialog.addUnit.noFloors') : t('dialog.addUnit.placeholders.floor')}
                        disabled={loading} />
                    )}
                    {errors.floorId && <p className="text-xs text-destructive mt-1">{errors.floorId}</p>}
                  </FormInput>
                </FormField>
                )}

                <FormField label={t('dialog.addUnit.fields.status')} htmlFor="operationalStatus">
                  <FormInput>
                    <Select value={formData.operationalStatus}
                      onValueChange={(v) => handleSelectChange('operationalStatus', v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder={t('dialog.addUnit.placeholders.status')} /></SelectTrigger>
                      <SelectContent>
                        {OPERATIONAL_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>{t(`dialog.addUnit.statusOptions.${status}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.commercialStatus')} htmlFor="commercialStatus">
                  <FormInput>
                    <Select value={formData.commercialStatus}
                      onValueChange={(v) => handleSelectChange('commercialStatus', v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder={t('dialog.addUnit.placeholders.commercialStatus')} /></SelectTrigger>
                      <SelectContent>
                        {CREATION_COMMERCIAL_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>{t(`dialog.addUnit.commercialStatusOptions.${status}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>
              </FormGrid>

              <AskingPriceRequiredAlert
                commercialStatus={formData.commercialStatus}
                className="mt-4"
              />
            </TabsContent>

            {/* TAB 2: DETAILS */}
            <TabsContent value="details" className={spacing.margin.top.md}>
              <FormGrid>
                <FormField label={t('dialog.addUnit.fields.area')} htmlFor="area">
                  <FormInput>
                    <Input id="area" name="area" type="number" value={formData.area}
                      onChange={(e) => handleAreaChange(e.target.value)}
                      placeholder={t('dialog.addUnit.placeholders.area')} disabled={loading}
                      className={errors.area ? 'border-destructive' : ''} />
                    {errors.area && <p className="text-xs text-destructive mt-1">{errors.area}</p>}
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.bedrooms')} htmlFor="bedrooms">
                  <FormInput>
                    <Input id="bedrooms" name="bedrooms" type="number" value={formData.bedrooms}
                      onChange={(e) => handleNumberChange('bedrooms', e.target.value)}
                      placeholder={t('dialog.addUnit.placeholders.bedrooms')} disabled={loading} min={0} />
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.bathrooms')} htmlFor="bathrooms">
                  <FormInput>
                    <Input id="bathrooms" name="bathrooms" type="number" value={formData.bathrooms}
                      onChange={(e) => handleNumberChange('bathrooms', e.target.value)}
                      placeholder={t('dialog.addUnit.placeholders.bathrooms')} disabled={loading} min={0} />
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.description')} htmlFor="description">
                  <FormInput>
                    <Textarea id="description" name="description" value={formData.description}
                      onChange={handleChange} placeholder={t('dialog.addUnit.placeholders.description')}
                      disabled={loading} rows={3} />
                  </FormInput>
                </FormField>
              </FormGrid>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
            {isValid ? (
              <SaveButton loading={loading} />
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <SaveButton loading={loading} disabled />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t(saveTooltipKey)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DialogFooter>
        </form>
      </DialogContent>

      {/* 🔐 ADR-284 §3.3 Phase 3a: SSoT — reuses the canonical Project editor */}
      <ProjectQuickCreateSheet
        open={showAddProjectDialog}
        onOpenChange={setShowAddProjectDialog}
        onProjectCreated={() => {
          reloadProjects();
        }}
      />
      {formData.buildingId && (
        <AddFloorDialog
          buildingId={formData.buildingId}
          open={showAddFloorDialog}
          onClose={() => setShowAddFloorDialog(false)}
          onSuccess={() => {
            // Floors auto-refresh via onSnapshot subscription on buildingId
            setShowAddFloorDialog(false);
          }}
        />
      )}

      {/* 🔐 ADR-284 §3.3 Phase 3b: Inline fix modal for orphan Buildings */}
      {formData.buildingId && selectedBuilding && (
        <LinkBuildingToProjectDialog
          open={showLinkBuildingDialog}
          onOpenChange={setShowLinkBuildingDialog}
          buildingId={formData.buildingId}
          buildingName={selectedBuilding.name}
          projects={projects}
          projectsLoading={projectsLoading}
          onSuccess={(linkedProjectId) => {
            // Auto-select the newly linked project so the form becomes valid
            handleSelectChange('projectId', linkedProjectId);
            // Building.projectId will refresh via RealtimeService (BUILDING_PROJECT_LINKED)
          }}
        />
      )}
    </Dialog>
  );
}

// Backward compatibility
export { AddPropertyDialog as AddUnitDialog };
export default AddPropertyDialog;
