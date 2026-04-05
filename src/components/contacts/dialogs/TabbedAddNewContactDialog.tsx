'use client';

import React, { useState, useMemo, useEffect, useId, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import type { ContactType } from '@/types/contacts';
import { User, Building2, Landmark } from 'lucide-react';
import type { AddNewContactDialogProps } from '@/types/ContactFormTypes';
import { useContactForm } from '@/hooks/useContactForm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getTypeIcon, getTypeLabel } from '@/utils/contactFormUtils';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { CONTACT_TYPES } from '@/constants/contacts';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Auth context for canonical upload pipeline (ADR-031)
import { useAuth } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: ID generation for new contacts (ADR-031)
import { generateContactId } from '@/services/enterprise-id.service';
import type { CanonicalUploadContext } from '@/components/ContactFormSections/utils/PhotoUploadConfiguration';
// 🏢 ENTERPRISE: Utility for class name composition (canonical pattern)
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized dialog sizing tokens (ADR-031)
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';

export function TabbedAddNewContactDialog({ open, onOpenChange, onContactAdded, editContact, onLiveChange, allowedContactTypes, defaultPersonas, presentation = 'dialog' }: AddNewContactDialogProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('contacts');
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ICON SIZES - ENTERPRISE PATTERN
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: Auth context for canonical upload pipeline (ADR-031)
  const { user } = useAuth();

  const {
    formData,
    setFormData,
    loading,
    validationErrors,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleFileChange,
    handleLogoChange,
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotosChange,
    handleMultiplePhotoUploadComplete,
    handleProfilePhotoSelection,
    handleFieldBlur,
    guardDialogs,
  } = useContactForm({ onContactAdded, onOpenChange, editContact, isModalOpen: open, onLiveChange });

  // 🔧 TypeScript safety με fallback
  const contactType = (formData.type || CONTACT_TYPES.INDIVIDUAL) as ContactType;

  const isCompany = contactType === CONTACT_TYPES.COMPANY;
  const isIndividual = contactType === CONTACT_TYPES.INDIVIDUAL;
  const isService = contactType === CONTACT_TYPES.SERVICE;

  // ==========================================================================
  // 🏢 ENTERPRISE: Canonical Upload Context (ADR-031)
  // ==========================================================================
  // Pre-generate contactId for new contacts so uploads use canonical pipeline
  // For edit mode, use existing contact ID
  // ==========================================================================
  const [preGeneratedContactId] = useState<string>(() => {
    // If editing, use existing ID; if new, generate one
    return editContact?.id || generateContactId();
  });

  // ==========================================================================
  // 🏢 ENTERPRISE: Option A - Set formData.id to preGeneratedContactId (ADR-031)
  // ==========================================================================
  // Ensure formData.id is set early for new contacts so uploads + save use same ID
  // ==========================================================================
  useEffect(() => {
    // Only set for new contacts (not editing)
    if (!editContact && !formData.id && preGeneratedContactId) {
      setFormData(prev => ({ ...prev, id: preGeneratedContactId }));
    }
  }, [editContact, formData.id, preGeneratedContactId, setFormData]);

  // ==========================================================================
  // 🎭 ENTERPRISE: Auto-activate default personas (e.g. broker context)
  // ==========================================================================
  useEffect(() => {
    if (!editContact && defaultPersonas && defaultPersonas.length > 0) {
      setFormData(prev => ({
        ...prev,
        activePersonas: Array.from(new Set([...prev.activePersonas, ...defaultPersonas])),
      }));
    }
  }, [editContact, defaultPersonas, setFormData]);

  // ==========================================================================
  // 🏢 ENTERPRISE: Sync contactType with allowedContactTypes filter
  // When the caller restricts the allowed types (e.g. `['company']`) and the
  // current `formData.type` is not in the allowed list, switch to the first
  // allowed type. Prevents the "title says Individual but only Company
  // available in the dropdown" inconsistency.
  // ==========================================================================
  useEffect(() => {
    if (editContact) return;
    if (!allowedContactTypes || allowedContactTypes.length === 0) return;
    setFormData(prev => {
      if (allowedContactTypes.includes(prev.type)) return prev;
      return { ...prev, type: allowedContactTypes[0] };
    });
  }, [editContact, allowedContactTypes, setFormData]);

  // ==========================================================================
  // 🏢 ENTERPRISE: Filter contact types if allowedContactTypes provided
  // ==========================================================================
  const typeOptions = useMemo(() => {
    const allTypes: { value: ContactType; labelKey: string; Icon: typeof User }[] = [
      { value: CONTACT_TYPES.INDIVIDUAL as ContactType, labelKey: 'types.individual', Icon: User },
      { value: CONTACT_TYPES.COMPANY as ContactType, labelKey: 'types.company', Icon: Building2 },
      { value: CONTACT_TYPES.SERVICE as ContactType, labelKey: 'types.service', Icon: Landmark },
    ];
    if (!allowedContactTypes || allowedContactTypes.length === 0) return allTypes;
    return allTypes.filter(opt => allowedContactTypes.includes(opt.value));
  }, [allowedContactTypes]);

  // Build canonical upload context (only if user has required claims)
  const canonicalUploadContext = useMemo<CanonicalUploadContext | undefined>(() => {
    // 🛡️ SECURITY: Only enable canonical pipeline if user has companyId claim
    // Falls back to legacy pipeline (with deprecation warning) if not available
    if (!user?.uid || !user?.companyId) {
      return undefined;
    }

    // Use pre-generated ID for new contacts, existing ID for edits
    const contactId = formData.id || preGeneratedContactId;

    return {
      companyId: user.companyId,
      createdBy: user.uid,
      contactId,
      contactName: isIndividual
        ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim()
        : formData.companyName || formData.serviceName || formData.name,
    };
  }, [user, formData.id, preGeneratedContactId, formData.firstName, formData.lastName, formData.companyName, formData.serviceName, formData.name, isIndividual]);

  // 🏷️ GET CONTACT NAME: Helper function to get contact name based on type
  const getContactName = () => {
    if (isIndividual) {
      return formData.firstName && formData.lastName
        ? `${formData.firstName} ${formData.lastName}`
        : t('form.noName');
    }
    if (isCompany) {
      return formData.companyName || t('form.noCompanyName');
    }
    if (isService) {
      return formData.serviceName || formData.name || t('form.noCompanyName');
    }
    return '';
  };

  // 🏢 ADR: Conditional shell — same form, same logic, swaps Dialog/Sheet
  //  root based on `presentation`. Sheet variant is used when nested under
  //  another slide-over (e.g. creating a Company from the Project sheet).
  const isSheet = presentation === 'sheet';
  const Shell = isSheet ? Sheet : Dialog;
  const ShellContent = isSheet ? SheetContent : DialogContent;
  const ShellHeader = isSheet ? SheetHeader : DialogHeader;
  const ShellTitle = isSheet ? SheetTitle : DialogTitle;
  const ShellDescription = isSheet ? SheetDescription : DialogDescription;
  const ShellFooter = isSheet ? SheetFooter : DialogFooter;
  const shellContentClassName = isSheet
    ? cn('w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col', DIALOG_SCROLL.scrollable)
    : cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable);

  // 🏢 Stable form id lets Sheet header host <SaveButton form="..."> — native
  // HTML form association, no refs / no event forwarding.
  const formId = `contact-form-${useId()}`;

  // 🏢 Ref for programmatic form submission from the EntityDetailsHeader
  // toolbar (actions live outside the <form> in Sheet mode).
  const formRef = useRef<HTMLFormElement>(null);
  const triggerSubmit = useCallback(() => {
    if (loading) return; // guard against double-submission
    formRef.current?.requestSubmit();
  }, [loading]);

  // 🏢 SSoT: canonical entity-header actions (same pattern as ProjectDetailsHeader).
  // Green Save + gray Cancel — enforced via ENTITY_ACTION_PRESETS.
  const { t: tCommon } = useTranslation('common-actions');
  const sheetActions = useMemo(() => [
    createEntityAction(
      'save',
      editContact ? t('form.updateContact') : t('form.saveContact'),
      triggerSubmit,
    ),
    createEntityAction(
      'cancel',
      tCommon('actions.cancel'),
      () => onOpenChange(false),
    ),
  ], [editContact, t, tCommon, triggerSubmit, onOpenChange]);

  return (
    <Shell open={open} onOpenChange={onOpenChange}>
      <ShellContent className={shellContentClassName} {...(isSheet ? { side: 'right' as const } : {})}>
        <ShellHeader className={isSheet ? 'p-4 border-b' : undefined}>
          <ShellTitle className="flex items-center gap-2">
            {getTypeIcon(contactType, iconSizes.sm)}
            {editContact ? t('form.editTitle') : t('form.addTitle')} - {getTypeLabel(contactType)}
            {editContact && getContactName() && ` - ${getContactName()}`}
          </ShellTitle>

          {/* Dialog mode keeps the description for context (classic modal UX).
              Sheet mode matches the minimal Project Sheet header — title only —
              since the canonical EntityDetailsHeader toolbar sits just below. */}
          {!isSheet && (
            <ShellDescription>
              {editContact ? t('form.editDescription') : t('form.addDescription')}
            </ShellDescription>
          )}
        </ShellHeader>

        {/* 🏢 SSoT: In Sheet mode, render the canonical EntityDetailsHeader
            toolbar — SAME component used by ProjectDetailsHeader /
            BuildingDetailsHeader. Enforces identical visual pattern: entity
            icon on left, green Save + gray Cancel on right. */}
        {isSheet && (
          <div className="border-b">
            {/* SSoT: the title already lives in SheetHeader above — the
                EntityDetailsHeader hosts only the icon + actions here, same
                pattern as ProjectDetailsHeader in create mode (where
                project.name is '' for a brand-new project). */}
            <EntityDetailsHeader
              icon={NAVIGATION_ENTITIES.contact.icon}
              title={editContact ? getContactName() : ''}
              actions={sheetActions}
              variant="detailed"
            />
          </div>
        )}

        <form ref={formRef} id={formId} onSubmit={handleSubmit} className={isSheet ? 'flex-1 overflow-y-auto p-4' : undefined}>
          {/* 🏢 In Sheet mode, wrap content in bg-card so the visual hierarchy
              matches the canonical DetailsContainer (used by ProjectDetails /
              BuildingDetails). Dialog mode already ships its own card shell. */}
          <div className={cn('space-y-4', isSheet && 'bg-card border rounded-lg shadow-sm p-4')}>
            {/* Contact Type Selection — hidden when the type is already
                resolved: editing (type locked) OR a single allowed type
                (no choice to make). Shown only when the user needs to pick. */}
            {!editContact && typeOptions.length > 1 && (
              <FormGrid>
                <FormField label={t('form.typeLabel')} htmlFor="type" required>
                  <FormInput>
                    <Select name="type" value={contactType} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map(({ value, labelKey, Icon }) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <Icon className={iconSizes.sm} />
                              <span>{t(labelKey)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>
              </FormGrid>
            )}

            {/* 🏢 UNIFIED CONTACT SECTION - All contact types centralized */}
            {/* 🔧 FIX: Wrap με RelationshipProvider για proper state management */}
            <RelationshipProvider
              contactId={formData.id || preGeneratedContactId}
              contactType={contactType}
            >
              <UnifiedContactTabbedSection
                contactType={contactType}
                formData={formData}
                handleChange={handleChange}
                handleSelectChange={handleSelectChange}
                handleLogoChange={handleLogoChange}
                handleFileChange={handleFileChange}
                handleMultiplePhotosChange={handleMultiplePhotosChange}
                handleMultiplePhotoUploadComplete={handleMultiplePhotoUploadComplete}
                handleProfilePhotoSelection={handleProfilePhotoSelection}
                handleUploadedLogoURL={handleUploadedLogoURL}
                handleUploadedPhotoURL={handleUploadedPhotoURL}
                setFormData={setFormData}
                disabled={loading}
                canonicalUploadContext={canonicalUploadContext}
                validationErrors={validationErrors}
                onFieldBlur={handleFieldBlur}
              />
            </RelationshipProvider>

          </div>

          {/* Dialog mode: keep footer. Sheet mode: actions live in header. */}
          {!isSheet && (
            <ShellFooter className="mt-6">
              <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
              <SaveButton loading={loading}>
                {editContact ? t('form.updateContact') : t('form.saveContact')}
              </SaveButton>
            </ShellFooter>
          )}
        </form>
      </ShellContent>
      {guardDialogs}
    </Shell>
  );
}



