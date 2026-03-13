'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import type { ContactType } from '@/types/contacts';
import { useContactForm } from '@/hooks/useContactForm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getTypeIcon, getTypeLabel } from '@/utils/contactFormUtils';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { CONTACT_TYPES, CONTACT_ICONS, CONTACT_COLORS } from '@/constants/contacts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { generateContactId } from '@/services/enterprise-id.service';
import type { CanonicalUploadContext } from '@/components/ContactFormSections/utils/PhotoUploadConfiguration';

interface InlineContactCreationProps {
  contactType: ContactType;
  onContactAdded: () => void;
  onCancel: () => void;
  onBack: () => void;
}

export function InlineContactCreation({ contactType, onContactAdded, onCancel, onBack }: InlineContactCreationProps) {
  const { t } = useTranslation('contacts');
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
    return {
      companyId: user.companyId,
      createdBy: user.uid,
      contactId,
      contactName: isIndividual
        ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim()
        : formData.companyName || formData.serviceName || formData.name,
    };
  }, [user, formData.id, preGeneratedContactId, formData.firstName, formData.lastName, formData.companyName, formData.serviceName, formData.name, isIndividual]);

  const TypeIcon = CONTACT_ICONS[contactType];
  const typeColors = CONTACT_COLORS[contactType];

  return (
    <section className="flex flex-col h-full min-h-0">
      {/* Sticky header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-muted-foreground"
        >
          <ArrowLeft className={iconSizes.sm} />
          <span className="hidden sm:inline">{t('creation.inline.back')}</span>
        </Button>
        <span className={`${typeColors.primary} ${typeColors.bg} p-1.5 rounded-full`}>
          <TypeIcon className={iconSizes.sm} />
        </span>
        <h2 className="font-medium text-foreground">
          {t('form.addTitle')} — {getTypeLabel(contactType)}
        </h2>
      </header>

      {/* Scrollable form body */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-4">
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
            />
          </RelationshipProvider>
        </div>

        {/* Sticky footer */}
        <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-card shrink-0">
          <CancelButton onClick={onCancel} disabled={loading} />
          <SaveButton loading={loading}>
            {t('form.saveContact')}
          </SaveButton>
        </footer>
      </form>
    </section>
  );
}
