'use client';

/**
 * =============================================================================
 * ENTERPRISE: AddBuildingDialog Component
 * =============================================================================
 *
 * Enterprise-grade dialog for creating new buildings.
 * Follows TabbedAddNewContactDialog/AddProjectDialog patterns for consistency.
 *
 * Features:
 * - 3-tab layout (Basic, Details, Features)
 * - Full i18n support
 * - Radix Select for dropdowns (ADR-001)
 * - Centralized design tokens
 * - Type-safe form handling
 *
 * @enterprise Fortune 500-grade dialog implementation
 * @created 2026-02-01
 */

import React, { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { Building, MapPin, Settings } from 'lucide-react';
// ENTERPRISE: Centralized dialog sizing tokens (ADR-031)
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';
// ENTERPRISE: Centralized hooks
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// ENTERPRISE: Form state management hook
import { useBuildingForm, type BuildingStatus, type BuildingCategory } from '../hooks/useBuildingForm';
// ENTERPRISE: Projects service for dropdown (with company info)
import { getProjectsList, type ProjectListItem } from '../building-services';
// ENTERPRISE: Companies service for dropdown (same pattern as AddProjectDialog)
import { getAllActiveCompanies } from '@/services/companies.service';
import type { CompanyContact } from '@/types/contacts';
import type { BuildingType, BuildingPriority, EnergyClass } from '@/types/building/contracts';

// =============================================================================
// TYPES
// =============================================================================

interface AddBuildingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuildingAdded?: () => void;
  companyId: string;
  companyName?: string;
}

// =============================================================================
// CONSTANTS - Type-safe dropdown options
// =============================================================================

const BUILDING_STATUS_OPTIONS: BuildingStatus[] = [
  'planning',
  'construction',
  'completed',
  'active',
];

const BUILDING_CATEGORY_OPTIONS: BuildingCategory[] = [
  'residential',
  'commercial',
  'industrial',
  'mixed',
];

const BUILDING_TYPE_OPTIONS: BuildingType[] = [
  'residential',
  'commercial',
  'industrial',
  'mixed',
  'office',
  'warehouse',
];

const PRIORITY_OPTIONS: BuildingPriority[] = ['low', 'medium', 'high', 'critical'];

const ENERGY_CLASS_OPTIONS: EnergyClass[] = ['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'F', 'G'];

// =============================================================================
// COMPONENT
// =============================================================================

export function AddBuildingDialog({
  open,
  onOpenChange,
  onBuildingAdded,
  companyId,
  companyName,
}: AddBuildingDialogProps) {
  // ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  // ENTERPRISE: Centralized design hooks
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  // ENTERPRISE: Form state management
  const {
    formData,
    loading,
    errors,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleCheckboxChange,
    handleNumberChange,
  } = useBuildingForm({ onBuildingAdded, onOpenChange, companyId, companyName });

  // ENTERPRISE: Projects for dropdown (with company info for filtering)
  const [allProjects, setAllProjects] = useState<ProjectListItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // ENTERPRISE: Companies for dropdown filter (same pattern as AddProjectDialog)
  const [companies, setCompanies] = useState<CompanyContact[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('');

  // ENTERPRISE: Active tab state
  const [activeTab, setActiveTab] = useState('basic');

  // ENTERPRISE: Auto-navigate to tab with validation errors
  // Prevents "silent failure" when required field is in a hidden tab
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const detailsFields: Array<keyof typeof formData> = [
      'address', 'city', 'totalArea', 'builtArea', 'floors', 'units',
      'totalValue', 'startDate', 'completionDate',
    ];
    const featuresFields: Array<keyof typeof formData> = [
      'type', 'priority', 'energyClass',
    ];

    // Navigate to first tab that has errors
    const hasBasicError = errorFields.some(f => !detailsFields.includes(f as keyof typeof formData) && !featuresFields.includes(f as keyof typeof formData));
    const hasDetailsError = errorFields.some(f => detailsFields.includes(f as keyof typeof formData));
    const hasFeaturesError = errorFields.some(f => featuresFields.includes(f as keyof typeof formData));

    if (hasBasicError) {
      setActiveTab('basic');
    } else if (hasDetailsError) {
      setActiveTab('details');
    } else if (hasFeaturesError) {
      setActiveTab('features');
    }
  }, [errors, formData]);

  // Load projects + companies on mount
  useEffect(() => {
    if (open) {
      setProjectsLoading(true);
      setCompaniesLoading(true);
      setSelectedCompanyFilter('');

      getProjectsList()
        .then(setAllProjects)
        .catch(console.error)
        .finally(() => setProjectsLoading(false));

      getAllActiveCompanies()
        .then(setCompanies)
        .catch(console.error)
        .finally(() => setCompaniesLoading(false));
    }
  }, [open]);

  // ENTERPRISE: Filter projects by selected company
  const filteredProjects = selectedCompanyFilter
    ? allProjects.filter(p => p.companyId === selectedCompanyFilter)
    : allProjects;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className={iconSizes.md} />
            {t('dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('dialog.addDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center gap-1">
                <Building className="h-3 w-3" />
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

            {/* ================================================================
                TAB 1: BASIC INFO
            ================================================================ */}
            <TabsContent value="basic" className={spacing.margin.top.md}>
              <FormGrid>
                {/* Building Name (required) */}
                <FormField
                  label={t('dialog.fields.name')}
                  htmlFor="name"
                  required
                >
                  <FormInput>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.namePlaceholder')}
                      disabled={loading}
                      className={errors.name ? 'border-destructive' : ''}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive mt-1">{errors.name}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Company Filter (filters projects dropdown) */}
                <FormField label={t('dialog.fields.companyFilter')} htmlFor="companyFilter">
                  <FormInput>
                    <Select
                      value={selectedCompanyFilter}
                      onValueChange={(value) => {
                        setSelectedCompanyFilter(value === '__all__' ? '' : value);
                        // Clear project selection when company changes
                        handleSelectChange('projectId', '');
                      }}
                      disabled={loading || companiesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.companyFilterPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">
                          {t('dialog.fields.companyFilterPlaceholder')}
                        </SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id!}>
                            {company.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Project (filtered by selected company) */}
                <FormField label={t('dialog.fields.project')} htmlFor="projectId">
                  <FormInput>
                    <Select
                      value={formData.projectId}
                      onValueChange={(value) => handleSelectChange('projectId', value)}
                      disabled={loading || projectsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.projectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Status */}
                <FormField label={t('dialog.fields.status')} htmlFor="status">
                  <FormInput>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleSelectChange('status', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BUILDING_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Category */}
                <FormField label={t('dialog.fields.category')} htmlFor="category">
                  <FormInput>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => handleSelectChange('category', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.categoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BUILDING_CATEGORY_OPTIONS.map((category) => (
                          <SelectItem key={category} value={category}>
                            {t(`categories.${category}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Description */}
                <FormField label={t('dialog.fields.description')} htmlFor="description">
                  <FormInput>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.descriptionPlaceholder')}
                      disabled={loading}
                      rows={3}
                    />
                  </FormInput>
                </FormField>
              </FormGrid>
            </TabsContent>

            {/* ================================================================
                TAB 2: DETAILS
            ================================================================ */}
            <TabsContent value="details" className={spacing.margin.top.md}>
              <FormGrid>
                {/* Address (required) */}
                <FormField
                  label={t('dialog.fields.address')}
                  htmlFor="address"
                  required
                >
                  <FormInput>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.addressPlaceholder')}
                      disabled={loading}
                      className={errors.address ? 'border-destructive' : ''}
                    />
                    {errors.address && (
                      <p className="text-xs text-destructive mt-1">{errors.address}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* City */}
                <FormField label={t('dialog.fields.city')} htmlFor="city">
                  <FormInput>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.cityPlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Total Area */}
                <FormField label={t('dialog.fields.totalArea')} htmlFor="totalArea">
                  <FormInput>
                    <Input
                      id="totalArea"
                      name="totalArea"
                      type="number"
                      value={formData.totalArea}
                      onChange={(e) => handleNumberChange('totalArea', e.target.value)}
                      placeholder={t('dialog.fields.totalAreaPlaceholder')}
                      disabled={loading}
                      className={errors.totalArea ? 'border-destructive' : ''}
                    />
                    {errors.totalArea && (
                      <p className="text-xs text-destructive mt-1">{errors.totalArea}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Built Area */}
                <FormField label={t('dialog.fields.builtArea')} htmlFor="builtArea">
                  <FormInput>
                    <Input
                      id="builtArea"
                      name="builtArea"
                      type="number"
                      value={formData.builtArea}
                      onChange={(e) => handleNumberChange('builtArea', e.target.value)}
                      placeholder={t('dialog.fields.builtAreaPlaceholder')}
                      disabled={loading}
                      className={errors.builtArea ? 'border-destructive' : ''}
                    />
                    {errors.builtArea && (
                      <p className="text-xs text-destructive mt-1">{errors.builtArea}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Floors */}
                <FormField label={t('dialog.fields.floors')} htmlFor="floors">
                  <FormInput>
                    <Input
                      id="floors"
                      name="floors"
                      type="number"
                      value={formData.floors}
                      onChange={(e) => handleNumberChange('floors', e.target.value)}
                      placeholder={t('dialog.fields.floorsPlaceholder')}
                      disabled={loading}
                      className={errors.floors ? 'border-destructive' : ''}
                    />
                    {errors.floors && (
                      <p className="text-xs text-destructive mt-1">{errors.floors}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Units */}
                <FormField label={t('dialog.fields.units')} htmlFor="units">
                  <FormInput>
                    <Input
                      id="units"
                      name="units"
                      type="number"
                      value={formData.units}
                      onChange={(e) => handleNumberChange('units', e.target.value)}
                      placeholder={t('dialog.fields.unitsPlaceholder')}
                      disabled={loading}
                      className={errors.units ? 'border-destructive' : ''}
                    />
                    {errors.units && (
                      <p className="text-xs text-destructive mt-1">{errors.units}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Total Value */}
                <FormField label={t('dialog.fields.totalValue')} htmlFor="totalValue">
                  <FormInput>
                    <Input
                      id="totalValue"
                      name="totalValue"
                      type="number"
                      value={formData.totalValue}
                      onChange={(e) => handleNumberChange('totalValue', e.target.value)}
                      placeholder={t('dialog.fields.totalValuePlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Start Date */}
                <FormField label={t('dialog.fields.startDate')} htmlFor="startDate">
                  <FormInput>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Completion Date */}
                <FormField
                  label={t('dialog.fields.completionDate')}
                  htmlFor="completionDate"
                >
                  <FormInput>
                    <Input
                      id="completionDate"
                      name="completionDate"
                      type="date"
                      value={formData.completionDate}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>
              </FormGrid>
            </TabsContent>

            {/* ================================================================
                TAB 3: FEATURES (Checkboxes + Selects)
            ================================================================ */}
            <TabsContent value="features" className={spacing.margin.top.md}>
              {/* Checkbox Features */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Has Parking */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasParking"
                    checked={formData.hasParking}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasParking', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasParking" className="text-sm font-medium">
                    {t('filters.checkboxes.hasParking')}
                  </Label>
                </div>

                {/* Has Elevator */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasElevator"
                    checked={formData.hasElevator}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasElevator', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasElevator" className="text-sm font-medium">
                    {t('filters.checkboxes.hasElevator')}
                  </Label>
                </div>

                {/* Has Garden */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasGarden"
                    checked={formData.hasGarden}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasGarden', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasGarden" className="text-sm font-medium">
                    {t('filters.checkboxes.hasGarden')}
                  </Label>
                </div>

                {/* Has Pool */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasPool"
                    checked={formData.hasPool}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasPool', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasPool" className="text-sm font-medium">
                    {t('filters.checkboxes.hasPool')}
                  </Label>
                </div>

                {/* Accessibility */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="accessibility"
                    checked={formData.accessibility}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('accessibility', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="accessibility" className="text-sm font-medium">
                    {t('filters.checkboxes.accessibility')}
                  </Label>
                </div>
              </section>

              {/* Select Fields */}
              <FormGrid>
                {/* Building Type */}
                <FormField label={t('dialog.fields.type')} htmlFor="type">
                  <FormInput>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleSelectChange('type', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.typePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BUILDING_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`filters.types.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Priority */}
                <FormField label={t('dialog.fields.priority')} htmlFor="priority">
                  <FormInput>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => handleSelectChange('priority', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.priorityPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {t(`filters.priority.${priority}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Energy Class */}
                <FormField label={t('dialog.fields.energyClass')} htmlFor="energyClass">
                  <FormInput>
                    <Select
                      value={formData.energyClass}
                      onValueChange={(value) => handleSelectChange('energyClass', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.energyClassPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ENERGY_CLASS_OPTIONS.map((energyClass) => (
                          <SelectItem key={energyClass} value={energyClass}>
                            {energyClass}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

export default AddBuildingDialog;
