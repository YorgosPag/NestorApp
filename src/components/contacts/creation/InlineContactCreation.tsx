'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import type { ContactType } from '@/types/contacts';
import { useContactForm } from '@/hooks/useContactForm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getTypeLabel } from '@/utils/contactFormUtils';
import { cn } from '@/lib/design-system';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { CONTACT_TYPES, CONTACT_ICONS, CONTACT_COLORS } from '@/constants/contacts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { generateContactId } from '@/services/enterprise-id.service';
import type { CanonicalUploadContext } from '@/components/ContactFormSections/utils/PhotoUploadConfiguration';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface InlineContactCreationProps {
  contactType: ContactType;
  onContactAdded: () => void;
  onCancel: () => void;
  onBack: () => void;
}

export function InlineContactCreation({ contactType, onContactAdded, onCancel, onBack }: InlineContactCreationProps) {
  const { t } = useTranslation('contacts');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { user } = useAuth();

  // Adapter: inline component uses onCancel instead of Dialog's onOpenChange
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) onCancel();
  }, [onCancel]);

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
  } = useContactForm({
    onContactAdded,
    onOpenChange: handleOpenChange,
    isModalOpen: true, // Always "open" when rendered
  });

  // Set the contact type on mount
  useEffect(() => {
    setFormData(prev => ({ ...prev, type: contactType }));
  }, [contactType, setFormData]);

  const isIndividual = contactType === CONTACT_TYPES.INDIVIDUAL;

  // Pre-generate contactId for canonical upload pipeline (ADR-031)
  const [preGeneratedContactId] = useState<string>(() => generateContactId());

  // Set formData.id for new contacts
  useEffect(() => {
    if (!formData.id && preGeneratedContactId) {
      setFormData(prev => ({ ...prev, id: preGeneratedContactId }));
    }
  }, [formData.id, preGeneratedContactId, setFormData]);

  // Canonical upload context (ADR-031)
  const canonicalUploadContext = useMemo<CanonicalUploadContext | undefined>(() => {
    if (!user?.uid || !user?.companyId) return undefined;

    const contactId = formData.id || preGeneratedContactId;
    // 🏢 SSoT: contactName NOT computed here — resolveContactName() in
    // PhotoUploadConfiguration.ts is the SINGLE SOURCE OF TRUTH for name resolution
    return {
      companyId: user.companyId,
      createdBy: user.uid,
      contactId,
    };
  }, [user, formData.id, preGeneratedContactId]);

  const TypeIcon = CONTACT_ICONS[contactType];
  const typeColors = CONTACT_COLORS[contactType];

  return (
    <section className="flex flex-col h-full min-h-0">
      {/* Sticky header with actions */}
      <form id="inline-contact-form" onSubmit={handleSubmit} className="contents">
        <header className="flex items-center gap-2 px-2 py-2 border-b bg-card shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className={cn("gap-1.5", colors.text.muted)}
          >
            <ArrowLeft className={iconSizes.sm} />
            <span className="hidden sm:inline">{t('creation.inline.back')}</span>
          </Button>
          <span className={`${typeColors.primary} ${typeColors.bg} p-1.5 rounded-full`}>
            <TypeIcon className={iconSizes.sm} />
          </span>
          <h2 className="font-medium text-foreground flex-1">
            {t('form.addTitle')} — {getTypeLabel(contactType)}
          </h2>
          <nav className="flex items-center gap-2">
            <CancelButton onClick={onCancel} disabled={loading} />
            <SaveButton loading={loading}>
              {t('form.saveContact')}
            </SaveButton>
          </nav>
        </header>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
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
      </form>
    </section>
  );
}
