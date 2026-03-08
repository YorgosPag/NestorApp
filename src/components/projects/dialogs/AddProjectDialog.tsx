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
// Note: useEffect still used for resetForm on open
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
import type { ProjectStatus } from '@/types/project';
// 🏢 ENTERPRISE: Address system (ADR-167)
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressFormSection, AddressCard } from '@/components/shared/addresses';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AddProjectDialog');

// =============================================================================
// TYPES
// =============================================================================

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectAdded?: () => void;
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

// =============================================================================
// COMPONENT
// =============================================================================

export function AddProjectDialog({
  open,
  onOpenChange,
  onProjectAdded,
}: AddProjectDialogProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ HOOKS - ENTERPRISE PATTERN
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: Form state management (CREATE-ONLY — edit happens inline in GeneralProjectTab)
  const {
    formData,
    setFormData,
    loading,
    errors,
    handleSubmit,
    handleChange,
    handleSelectChange,
    resetForm,
    // 🏢 ENTERPRISE: Address handlers (ADR-167)
    handleAddAddress,
    handleSetPrimary,
    handleRemoveAddress,
  } = useProjectForm({ onProjectAdded, onOpenChange });

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

  // 🏢 ENTERPRISE: Reset form when opening dialog (CREATE-ONLY)
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

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
            {t('dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.addDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">{t('dialog.tabs.basic')}</TabsTrigger>
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
