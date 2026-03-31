'use client';

/**
 * =============================================================================
 * ENTERPRISE: AddUnitDialog Component
 * =============================================================================
 *
 * Enterprise-grade dialog for creating new units.
 * Render-only: all logic delegated to useAddUnitDialogState.
 *
 * @module components/units/dialogs/AddUnitDialog
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
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { Home, ClipboardList } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isValidEntityCodeFormat } from '@/services/entity-code.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { FloorMultiSelectField } from '@/components/shared/FloorMultiSelectField';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import type { AddUnitDialogProps } from './useAddUnitDialogState';
import {
  useAddUnitDialogState,
  UNIT_TYPE_OPTIONS,
  OPERATIONAL_STATUS_OPTIONS,
  CREATION_COMMERCIAL_STATUS_OPTIONS,
} from './useAddUnitDialogState';

// =============================================================================
// COMPONENT
// =============================================================================

export function AddUnitDialog({
  open,
  onOpenChange,
  onUnitAdded,
  buildings,
  buildingsLoading = false,
}: AddUnitDialogProps) {
  const { t } = useTranslation('units');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const {
    formData, loading, errors,
    handleSubmit, handleChange, handleSelectChange, handleNumberChange, handleLevelsChange,
    floorOptions, floorsLoading,
    codeOverridden, setCodeOverridden,
    suggestedCode, codeLoading,
    isMultiLevelType,
    activeTab, setActiveTab,
    handleBuildingChange, handleFloorSelection,
  } = useAddUnitDialogState({ open, onUnitAdded, onOpenChange });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NAVIGATION_ENTITIES.unit.icon className={iconSizes.md} />
            {t('dialog.addUnit.title')}
          </DialogTitle>
          <DialogDescription>{t('dialog.addUnit.description')}</DialogDescription>
        </DialogHeader>

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
                    <Input id="name" name="name" value={formData.name} onChange={handleChange}
                      placeholder={t('dialog.addUnit.placeholders.name')} disabled={loading}
                      className={errors.name ? 'border-destructive' : ''} />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.code')} htmlFor="code">
                  <FormInput>
                    <Input id="code" name="code" value={formData.code}
                      onChange={(e) => {
                        handleChange(e);
                        if (!codeOverridden && e.target.value !== suggestedCode) setCodeOverridden(true);
                        if (!e.target.value) setCodeOverridden(false);
                      }}
                      placeholder={t('dialog.addUnit.placeholders.code')} disabled={loading} />
                    {codeLoading && (
                      <p className={cn("text-xs mt-1", colors.text.muted)}>{t('entityCode.loading')}</p>
                    )}
                    {suggestedCode && codeOverridden && formData.code !== suggestedCode && (
                      <p className={cn("text-xs mt-1", colors.text.muted)}>
                        {t('entityCode.suggested', { code: suggestedCode })}
                      </p>
                    )}
                    {formData.code && !isValidEntityCodeFormat(formData.code) && (
                      <p className="text-xs text-amber-600 mt-1">{t('entityCode.formatWarning')}</p>
                    )}
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.type')} htmlFor="type">
                  <FormInput>
                    <Select value={formData.type} onValueChange={(v) => handleSelectChange('type', v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder={t('dialog.addUnit.placeholders.type')} /></SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPE_OPTIONS.map((unitType) => (
                          <SelectItem key={unitType} value={unitType}>{t(`types.${unitType}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                <FormField label={t('dialog.addUnit.fields.building')} htmlFor="buildingId" required>
                  <FormInput>
                    <Select value={formData.buildingId} onValueChange={handleBuildingChange}
                      disabled={loading || buildingsLoading}>
                      <SelectTrigger className={errors.buildingId ? 'border-destructive' : ''}>
                        <SelectValue placeholder={t('dialog.addUnit.placeholders.building')} />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.buildingId && <p className="text-xs text-destructive mt-1">{errors.buildingId}</p>}
                  </FormInput>
                </FormField>

                <FormField
                  label={isMultiLevelType
                    ? t('multiLevel.floors', { defaultValue: 'Όροφοι' })
                    : t('dialog.addUnit.fields.floor')}
                  htmlFor="floorId"
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
                  </FormInput>
                </FormField>

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
            </TabsContent>

            {/* TAB 2: DETAILS */}
            <TabsContent value="details" className={spacing.margin.top.md}>
              <FormGrid>
                <FormField label={t('dialog.addUnit.fields.area')} htmlFor="area">
                  <FormInput>
                    <Input id="area" name="area" type="number" value={formData.area}
                      onChange={(e) => handleNumberChange('area', e.target.value)}
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
            <SaveButton loading={loading} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddUnitDialog;
