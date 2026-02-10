'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: AddProjectDialog Component (ADR-087)
 * =============================================================================
 *
 * Enterprise-grade dialog for creating new projects.
 * Follows TabbedAddNewContactDialog pattern for consistency.
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Trash2, Star } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized dialog sizing tokens (ADR-031)
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';
// 🏢 ENTERPRISE: Centralized hooks
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Form state management hook
import { useProjectForm } from '@/hooks/useProjectForm';
// 🏢 ENTERPRISE: Companies service for dropdown
import { getAllActiveCompanies } from '@/services/companies.service';
import type { CompanyContact } from '@/types/contacts';
import type {
  Project,
  ProjectStatus,
  ProjectType,
  ProjectPriority,
  ProjectRiskLevel,
  ProjectComplexity,
} from '@/types/project';
// 🏢 ENTERPRISE: Address system (ADR-167)
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressFormSection, AddressCard } from '@/components/shared/addresses';
import { migrateLegacyAddress } from '@/types/project/address-helpers';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AddProjectDialog');

// =============================================================================
// TYPES
// =============================================================================

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectAdded?: () => void;
  /** 🏢 ENTERPRISE: Project to edit (null for new project) - ADR-087 */
  editProject?: Project | null;
}

// =============================================================================
// CONSTANTS - Type-safe dropdown options
// =============================================================================

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  'planning',
  'in_progress',
  'completed',
  'on_hold',
  'cancelled',
];

const PROJECT_TYPE_OPTIONS: ProjectType[] = [
  'residential',
  'commercial',
  'industrial',
  'mixed',
  'infrastructure',
  'renovation',
];

const PRIORITY_OPTIONS: ProjectPriority[] = ['low', 'medium', 'high', 'critical'];

const RISK_LEVEL_OPTIONS: ProjectRiskLevel[] = ['low', 'medium', 'high', 'critical'];

const COMPLEXITY_OPTIONS: ProjectComplexity[] = [
  'simple',
  'moderate',
  'complex',
  'highly_complex',
];

// =============================================================================
// COMPONENT
// =============================================================================

export function AddProjectDialog({
  open,
  onOpenChange,
  onProjectAdded,
  editProject,
}: AddProjectDialogProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ HOOKS - ENTERPRISE PATTERN
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: Edit mode detection (ADR-087)
  const isEditMode = !!editProject;

  // 🏢 ENTERPRISE: Form state management
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
    // 🏢 ENTERPRISE: Address handlers (ADR-167)
    handleAddAddress,
    handleSetPrimary,
    handleRemoveAddress,
  } = useProjectForm({ onProjectAdded, onOpenChange, editProject });

  // 🏢 ENTERPRISE: Companies for dropdown
  const [companies, setCompanies] = useState<CompanyContact[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  // 🏢 ENTERPRISE: Active tab state
  const [activeTab, setActiveTab] = useState('basic');

  // 🏢 ENTERPRISE: Temp address for form (ADR-167)
  const [tempAddress, setTempAddress] = useState<Partial<ProjectAddress> | null>(null);

  // Load companies on mount
  useEffect(() => {
    if (open) {
      setCompaniesLoading(true);
      getAllActiveCompanies()
        .then(setCompanies)
        .catch((error: unknown) => logger.error('Failed to load companies', { error }))
        .finally(() => setCompaniesLoading(false));
    }
  }, [open]);

  // 🏢 ENTERPRISE: Populate form when editing (ADR-087)
  useEffect(() => {
    if (open && editProject) {
      setFormData({
        name: editProject.name || '',
        title: editProject.title || '',
        status: editProject.status || 'planning',
        companyId: editProject.companyId || '',
        company: editProject.company || '',
        address: editProject.address || '',
        city: editProject.city || '',
        description: editProject.description || '',
        // 🏢 ENTERPRISE: Lazy migration for addresses (ADR-167)
        addresses: editProject.addresses ||
          (editProject.address && editProject.city
            ? migrateLegacyAddress(editProject.address, editProject.city)
            : []),
        location: editProject.location || '',
        client: editProject.client || '',
        type: editProject.type || '',
        priority: editProject.priority || '',
        riskLevel: editProject.riskLevel || '',
        complexity: editProject.complexity || '',
        budget: editProject.budget || '',
        totalValue: editProject.totalValue || '',
        totalArea: editProject.totalArea || '',
        duration: editProject.duration || '',
        startDate: editProject.startDate || '',
        completionDate: editProject.completionDate || '',
        hasPermits: editProject.hasPermits || false,
        hasFinancing: editProject.hasFinancing || false,
        isEcological: editProject.isEcological || false,
        hasSubcontractors: editProject.hasSubcontractors || false,
        isActive: editProject.isActive ?? true,
        hasIssues: editProject.hasIssues || false,
      });
    } else if (open && !editProject) {
      // Reset form when opening for new project
      resetForm();
    }
  }, [open, editProject, setFormData, resetForm]);

  // Handle company selection with name sync
  const handleCompanySelect = (companyId: string) => {
    const selectedCompany = companies.find((c) => c.id === companyId);
    if (selectedCompany) {
      setFormData((prev) => ({
        ...prev,
        companyId: companyId,
        company: selectedCompany.companyName,
      }));
    }
    // Clear error
    if (errors.companyId) {
      handleSelectChange('companyId', companyId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className={iconSizes.md} />
            {isEditMode ? t('dialog.editTitle') : t('dialog.addTitle')}
            {isEditMode && editProject?.name && ` - ${editProject.name}`}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? t('dialog.editDescription') : t('dialog.addDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">{t('dialog.tabs.basic')}</TabsTrigger>
              <TabsTrigger value="details">{t('dialog.tabs.details')}</TabsTrigger>
              <TabsTrigger value="features">{t('dialog.tabs.features')}</TabsTrigger>
              <TabsTrigger value="addresses">Διευθύνσεις</TabsTrigger>
            </TabsList>

            {/* ================================================================
                TAB 1: ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ
            ================================================================ */}
            <TabsContent value="basic" className={spacing.margin.top.md}>
              <FormGrid>
                {/* Όνομα Έργου (required) */}
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

                {/* Τίτλος */}
                <FormField label={t('dialog.fields.title')} htmlFor="title">
                  <FormInput>
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.titlePlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Εταιρεία (required) */}
                <FormField
                  label={t('dialog.fields.company')}
                  htmlFor="companyId"
                  required
                >
                  <FormInput>
                    <Select
                      value={formData.companyId}
                      onValueChange={handleCompanySelect}
                      disabled={loading || companiesLoading}
                    >
                      <SelectTrigger
                        className={errors.companyId ? 'border-destructive' : ''}
                      >
                        <SelectValue placeholder={t('dialog.fields.companyPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id!}>
                            {company.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.companyId && (
                      <p className="text-xs text-destructive mt-1">{errors.companyId}</p>
                    )}
                  </FormInput>
                </FormField>

                {/* Κατάσταση */}
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
                        {PROJECT_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`status.${status === 'in_progress' ? 'inProgress' : status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Διεύθυνση */}
                <FormField label={t('dialog.fields.address')} htmlFor="address">
                  <FormInput>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.addressPlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Πόλη */}
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

                {/* Τοποθεσία */}
                <FormField label={t('dialog.fields.location')} htmlFor="location">
                  <FormInput>
                    <Input
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.locationPlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Περιγραφή */}
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
                TAB 2: ΛΕΠΤΟΜΕΡΕΙΕΣ
            ================================================================ */}
            <TabsContent value="details" className={spacing.margin.top.md}>
              <FormGrid>
                {/* Πελάτης */}
                <FormField label={t('dialog.fields.client')} htmlFor="client">
                  <FormInput>
                    <Input
                      id="client"
                      name="client"
                      value={formData.client}
                      onChange={handleChange}
                      placeholder={t('dialog.fields.clientPlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Τύπος Έργου */}
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
                        {PROJECT_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`projectType.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Προτεραιότητα */}
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
                            {t(`priority.${priority}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Επίπεδο Κινδύνου */}
                <FormField label={t('dialog.fields.riskLevel')} htmlFor="riskLevel">
                  <FormInput>
                    <Select
                      value={formData.riskLevel}
                      onValueChange={(value) => handleSelectChange('riskLevel', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.riskLevelPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_LEVEL_OPTIONS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {t(`riskLevel.${level}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Πολυπλοκότητα */}
                <FormField label={t('dialog.fields.complexity')} htmlFor="complexity">
                  <FormInput>
                    <Select
                      value={formData.complexity}
                      onValueChange={(value) => handleSelectChange('complexity', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.fields.complexityPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPLEXITY_OPTIONS.map((complexity) => (
                          <SelectItem key={complexity} value={complexity}>
                            {t(`complexity.${complexity}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                {/* Προϋπολογισμός */}
                <FormField label={t('dialog.fields.budget')} htmlFor="budget">
                  <FormInput>
                    <Input
                      id="budget"
                      name="budget"
                      type="number"
                      value={formData.budget}
                      onChange={(e) => handleNumberChange('budget', e.target.value)}
                      placeholder={t('dialog.fields.budgetPlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Συνολική Αξία */}
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

                {/* Συνολικό Εμβαδόν */}
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
                    />
                  </FormInput>
                </FormField>

                {/* Διάρκεια */}
                <FormField label={t('dialog.fields.duration')} htmlFor="duration">
                  <FormInput>
                    <Input
                      id="duration"
                      name="duration"
                      type="number"
                      value={formData.duration}
                      onChange={(e) => handleNumberChange('duration', e.target.value)}
                      placeholder={t('dialog.fields.durationPlaceholder')}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Ημερομηνία Έναρξης */}
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

                {/* Ημερομηνία Ολοκλήρωσης */}
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
                TAB 3: ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ (Checkboxes)
            ================================================================ */}
            <TabsContent value="features" className={spacing.margin.top.md}>
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Έχει Άδειες */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasPermits"
                    checked={formData.hasPermits}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasPermits', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasPermits" className="text-sm font-medium">
                    {t('dialog.fields.hasPermits')}
                  </Label>
                </div>

                {/* Έχει Χρηματοδότηση */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasFinancing"
                    checked={formData.hasFinancing}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasFinancing', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasFinancing" className="text-sm font-medium">
                    {t('dialog.fields.hasFinancing')}
                  </Label>
                </div>

                {/* Οικολογικό Έργο */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="isEcological"
                    checked={formData.isEcological}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('isEcological', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="isEcological" className="text-sm font-medium">
                    {t('dialog.fields.isEcological')}
                  </Label>
                </div>

                {/* Χρησιμοποιεί Υπεργολάβους */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasSubcontractors"
                    checked={formData.hasSubcontractors}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasSubcontractors', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasSubcontractors" className="text-sm font-medium">
                    {t('dialog.fields.hasSubcontractors')}
                  </Label>
                </div>

                {/* Ενεργό */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('isActive', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="isActive" className="text-sm font-medium">
                    {t('dialog.fields.isActive')}
                  </Label>
                </div>

                {/* Έχει Προβλήματα */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasIssues"
                    checked={formData.hasIssues}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('hasIssues', checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="hasIssues" className="text-sm font-medium">
                    {t('dialog.fields.hasIssues')}
                  </Label>
                </div>
              </section>
            </TabsContent>

            {/* ================================================================
                TAB 4: ΔΙΕΥΘΥΝΣΕΙΣ (ADR-167)
            ================================================================ */}
            <TabsContent value="addresses" className={spacing.margin.top.md}>
              <div className="space-y-4">
                {/* Existing Addresses List */}
                {formData.addresses.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Υπάρχουσες Διευθύνσεις ({formData.addresses.length})
                    </h3>
                    {formData.addresses.map((address, index) => (
                      <div key={address.id} className="relative border rounded-lg p-4">
                        <AddressCard address={address} />
                        <div className="absolute top-2 right-2 flex gap-2">
                          {!address.isPrimary && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetPrimary(index)}
                              disabled={loading}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          {address.isPrimary && (
                            <Badge variant="default">Κύρια</Badge>
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveAddress(index)}
                            disabled={loading || formData.addresses.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Address Form */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Προσθήκη Νέας Διεύθυνσης
                  </h3>
                  <AddressFormSection onChange={setTempAddress} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (tempAddress && tempAddress.street && tempAddress.city) {
                        handleAddAddress(tempAddress);
                        setTempAddress(null);
                      }
                    }}
                    disabled={loading || !tempAddress?.street || !tempAddress?.city}
                    className="mt-3"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Προσθήκη Διεύθυνσης
                  </Button>
                </div>
              </div>
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

export default AddProjectDialog;
