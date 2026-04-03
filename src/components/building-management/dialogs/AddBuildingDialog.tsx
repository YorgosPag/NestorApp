'use client';

/**
 * =============================================================================
 * ENTERPRISE: AddBuildingDialog Component
 * =============================================================================
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { Building as BuildingIcon, MapPin, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  useBuildingForm,
  type BuildingCategory,
  type BuildingStatus,
} from '../hooks/useBuildingForm';
import {
  BASIC_TAB_ERROR_FIELDS,
  DETAILS_TAB_ERROR_FIELDS,
  FEATURES_TAB_ERROR_FIELDS,
  type AddBuildingDialogProps,
} from './add-building-dialog/add-building-dialog.config';
import { useAddBuildingDialogData } from './add-building-dialog/useAddBuildingDialogData';
import {
  AddBuildingBasicInfoTab,
  AddBuildingDetailsTab,
  AddBuildingFeaturesTab,
} from './add-building-dialog/AddBuildingDialogTabs';

export function AddBuildingDialog({
  open,
  onOpenChange,
  onBuildingAdded,
  companyId,
  companyName,
  editBuilding,
}: AddBuildingDialogProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const isEditMode = !!editBuilding;

  const {
    formData,
    setFormData,
    loading,
    errors,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleCheckboxChange,
    handleNumberChange,
    resetForm,
  } = useBuildingForm({ onBuildingAdded, onOpenChange, companyId, companyName, editBuilding });

  const {
    companies,
    companiesLoading,
    filteredProjects,
    projectsLoading,
    selectedCompanyFilter,
    setSelectedCompanyFilter,
  } = useAddBuildingDialogData({ open });

  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) {
      return;
    }

    const hasBasicError = errorFields.some((field) => BASIC_TAB_ERROR_FIELDS.includes(field as keyof typeof formData));
    const hasDetailsError = errorFields.some((field) => DETAILS_TAB_ERROR_FIELDS.includes(field as keyof typeof formData));
    const hasFeaturesError = errorFields.some((field) => FEATURES_TAB_ERROR_FIELDS.includes(field as keyof typeof formData));

    if (hasBasicError) {
      setActiveTab('basic');
    } else if (hasDetailsError) {
      setActiveTab('details');
    } else if (hasFeaturesError) {
      setActiveTab('features');
    }
  }, [errors, formData]);

  const editFormData = useMemo(() => {
    if (!editBuilding) {
      return null;
    }

    const features = editBuilding.features || [];

    return {
      name: editBuilding.name || '',
      projectId: editBuilding.projectId || '',
      status: (editBuilding.status as BuildingStatus) || 'planning',
      category: (editBuilding.category as BuildingCategory) || '',
      description: editBuilding.description || '',
      address: editBuilding.address || '',
      city: editBuilding.city || '',
      totalArea: editBuilding.totalArea || '',
      builtArea: editBuilding.builtArea || '',
      floors: editBuilding.floors || '',
      units: editBuilding.units || '',
      totalValue: editBuilding.totalValue || '',
      startDate: editBuilding.startDate || '',
      completionDate: editBuilding.completionDate || '',
      hasParking: features.includes('parkingSpaces'),
      hasElevator: features.includes('elevator'),
      hasGarden: false,
      hasPool: false,
      accessibility: false,
      energyClass: editBuilding.energyClass || '',
      type: editBuilding.type || '',
      priority: editBuilding.priority || '',
    };
  }, [editBuilding]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (editBuilding && editFormData) {
      setFormData(editFormData);
      if (editBuilding.companyId) {
        setSelectedCompanyFilter(editBuilding.companyId);
      }
      return;
    }

    resetForm();
  }, [open, editBuilding, editFormData, setFormData, setSelectedCompanyFilter, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BuildingIcon className={iconSizes.md} />
            {isEditMode ? t('dialog.editTitle') : t('dialog.addTitle')}
            {isEditMode && editBuilding?.name ? ` - ${editBuilding.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? t('dialog.editDescription') : t('dialog.addDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center gap-1">
                <BuildingIcon className="h-3 w-3" />
                {t('dialog.tabs.basic')}
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {t('dialog.tabs.details')}
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                {t('dialog.tabs.features')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className={spacing.margin.top.md}>
              <AddBuildingBasicInfoTab
                formData={formData}
                loading={loading}
                errors={errors}
                t={t}
                handleChange={handleChange}
                handleSelectChange={handleSelectChange}
                companies={companies}
                companiesLoading={companiesLoading}
                filteredProjects={filteredProjects}
                projectsLoading={projectsLoading}
                selectedCompanyFilter={selectedCompanyFilter}
                setSelectedCompanyFilter={setSelectedCompanyFilter}
              />
            </TabsContent>

            <TabsContent value="details" className={spacing.margin.top.md}>
              <AddBuildingDetailsTab
                formData={formData}
                loading={loading}
                errors={errors}
                t={t}
                handleChange={handleChange}
                handleNumberChange={handleNumberChange}
              />
            </TabsContent>

            <TabsContent value="features" className={spacing.margin.top.md}>
              <AddBuildingFeaturesTab
                formData={formData}
                loading={loading}
                t={t}
                handleCheckboxChange={handleCheckboxChange}
                handleSelectChange={handleSelectChange}
                errors={errors}
                handleChange={handleChange}
                handleNumberChange={handleNumberChange}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-2">
            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
            <SaveButton loading={loading} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddBuildingDialog;
