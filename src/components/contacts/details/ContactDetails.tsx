'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { Users, Edit, Check, X } from 'lucide-react';
import { useActionMessages } from '@/hooks/useEnterpriseMessages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { Button } from '@/components/ui/button';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Contact, IndividualContact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes'; // 🏢 ENTERPRISE: Type-safe form data
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

// 🏢 ENTERPRISE: Type guard for contacts with multiple photo URLs
const getMultiplePhotoURLs = (contact: Contact): string[] => {
  if ('multiplePhotoURLs' in contact && Array.isArray((contact as IndividualContact).multiplePhotoURLs)) {
    return (contact as IndividualContact).multiplePhotoURLs || [];
  }
  return [];
};
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { openGalleryPhotoModal } from '@/core/modals';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { DetailsContainer } from '@/core/containers';
import { ContactsService } from '@/services/contacts.service';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';

const logger = createModuleLogger('ContactDetails');

interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
  onContactUpdated?: () => void;
}

// 🏢 ENTERPRISE: Subcollection tabs that save independently (Salesforce/SAP/Dynamics pattern)
// Note: 'relationships' removed - it uses the main edit mode for contact relationships
const SUBCOLLECTION_TABS = ['banking', 'files'];

export function ContactDetails({ contact, onEditContact, onDeleteContact, onContactUpdated }: ContactDetailsProps) {
  const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ContactFormData>>({});
  const [activeTab, setActiveTab] = useState<string>('basicInfo'); // 🏢 ENTERPRISE: Track active tab
  // 🖼️ OPTIMISTIC PHOTO STATE: Preserve photo URLs between save and contact refresh
  const [savedPhotoURLs, setSavedPhotoURLs] = useState<{ logoURL?: string; photoURL?: string }>({});
  const photoModal = useGlobalPhotoPreview();

  // 🏢 ENTERPRISE: Check if current tab is a subcollection tab
  const isSubcollectionTab = SUBCOLLECTION_TABS.includes(activeTab);

  // 🖼️ OPTIMISTIC: Clear saved photo URLs once the contact prop catches up
  useEffect(() => {
    if (!contact || (!savedPhotoURLs.logoURL && !savedPhotoURLs.photoURL)) return;

    const contactRecord = contact as unknown as Record<string, unknown>;
    const hasLogo = !savedPhotoURLs.logoURL || contactRecord.logoURL === savedPhotoURLs.logoURL;
    const hasPhoto = !savedPhotoURLs.photoURL || contactRecord.photoURL === savedPhotoURLs.photoURL;

    if (hasLogo && hasPhoto) {
      setSavedPhotoURLs({});
    }
  }, [contact, savedPhotoURLs]);

  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

  // 🗨️ ENTERPRISE: Centralized systems
  const actionMessages = useActionMessages();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);


  // 🔧 FIX: Use proper mapper to convert Contact to ContactFormData
  const enhancedFormData = React.useMemo(() => {
    if (!contact) return {};

    // Use the enterprise mapper system instead of manual conversion
    const mappingResult = mapContactToFormData(contact);
    logger.info('Using mapper for contact type', {
      contactType: contact.type,
      contactId: contact.id,
      mappingWarnings: mappingResult.warnings,
      email: mappingResult.formData.email,
      phone: mappingResult.formData.phone,
      website: mappingResult.formData.website
    });

    let formData = mappingResult.formData;

    // 🖼️ OPTIMISTIC: Merge saved photo URLs if the contact hasn't refreshed yet
    // This prevents the photo from disappearing between save and async contact refresh
    if (savedPhotoURLs.logoURL && !formData.logoURL) {
      formData = { ...formData, logoURL: savedPhotoURLs.logoURL, logoPreview: savedPhotoURLs.logoURL };
    }
    if (savedPhotoURLs.photoURL && !formData.photoURL) {
      formData = { ...formData, photoURL: savedPhotoURLs.photoURL, photoPreview: savedPhotoURLs.photoURL };
    }

    // Additional multiplePhotoURLs conversion for backward compatibility
    const multiplePhotoURLs = getMultiplePhotoURLs(contact);
    if (multiplePhotoURLs.length > 0) {
      const multiplePhotos = multiplePhotoURLs.map((url: string) => ({
        file: null,
        preview: undefined,
        uploadUrl: url,
        fileName: undefined,
        isUploading: false,
        uploadProgress: 0,
        error: undefined
      }));

      return {
        ...formData,
        multiplePhotos: [...(formData.multiplePhotos || []), ...multiplePhotos]
      };
    }

    return formData;
  }, [contact, savedPhotoURLs]);

  // 🎯 EDIT MODE HANDLERS
  const handleStartEdit = useCallback(() => {
    if (contact) {
      // Use mapper for consistent data structure in edit mode
      const mappingResult = mapContactToFormData(contact);
      setEditedData(mappingResult.formData);
      setIsEditing(true);
    }
  }, [contact]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedData({});
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!contact?.id) return;

    try {
      // 🏢 ENTERPRISE: Use new form-to-arrays conversion method
      await ContactsService.updateContactFromForm(contact.id, editedData);

      // 🖼️ OPTIMISTIC: Preserve photo URLs so they remain visible while async refresh loads
      const editedFormData = editedData as Partial<ContactFormData>;
      const newSavedPhotos: { logoURL?: string; photoURL?: string } = {};
      if (editedFormData.logoURL) newSavedPhotos.logoURL = editedFormData.logoURL;
      if (editedFormData.photoURL) newSavedPhotos.photoURL = editedFormData.photoURL;
      if (newSavedPhotos.logoURL || newSavedPhotos.photoURL) {
        setSavedPhotoURLs(newSavedPhotos);
      }

      setIsEditing(false);
      setEditedData({});

      // 🔄 TRIGGER REFRESH: Notify parent component to refresh data
      logger.info('Contact updated successfully with enterprise structure');
      if (onContactUpdated) {
        logger.info('Triggering parent refresh after save');
        onContactUpdated();
      }
    } catch (error) {
      logger.error('Failed to update contact', { error });
      // TODO: Show error toast
    }
  }, [contact?.id, editedData, onContactUpdated]);

  const handleFieldChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSelectChange = useCallback((name: string, value: string) => {
    setEditedData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // 🖼️ PHOTO HANDLERS: Persist uploaded URLs into editedData so they survive tab switches
  const handleUploadedLogoURL = useCallback((logoURL: string) => {
    setEditedData(prev => ({
      ...prev,
      logoURL,
      logoPreview: logoURL,
      logoFile: null
    }));
  }, []);

  const handleUploadedPhotoURL = useCallback((photoURL: string) => {
    setEditedData(prev => ({
      ...prev,
      photoURL,
      photoPreview: photoURL,
      photoFile: null
    }));
  }, []);

  const handleFileChange = useCallback((file: File | null) => {
    if (file) {
      const preview = URL.createObjectURL(file);
      setEditedData(prev => ({ ...prev, photoFile: file, photoPreview: preview }));
    }
  }, []);

  // 🔧 FIX: Explicit multiplePhotos handler with functional updater to avoid stale closures.
  // The fallback handler in createUnifiedPhotosChangeHandler closes over `formData`,
  // which can be stale when async uploads complete. This handler uses `prev =>` pattern
  // so it always operates on the latest state.
  const handleMultiplePhotosChange = useCallback((photos: PhotoSlot[]) => {
    setEditedData(prev => ({
      ...prev,
      multiplePhotos: photos
    }));
  }, []);

  const handleLogoChange = useCallback((file: File | null) => {
    if (file) {
      const preview = URL.createObjectURL(file);
      setEditedData(prev => ({ ...prev, logoFile: file, logoPreview: preview }));
    }
  }, []);

  // 🖼️ Photo click handler για gallery preview
  const handlePhotoClick = React.useCallback((index: number) => {
    logger.info('Photo click triggered', {
      index,
      contactExists: !!contact,
      photoModalExists: !!photoModal,
      openModalExists: !!photoModal?.openModal,
      multiplePhotoURLs: contact ? getMultiplePhotoURLs(contact).length : 0
    });

    if (contact) {
      logger.info('Opening photo gallery', { index });
      openGalleryPhotoModal(photoModal, contact, index);
    }
  }, [contact, photoModal]);

  return (
    <>
      <DetailsContainer
        selectedItem={contact ?? null}
        header={
          <ContactDetailsHeader
            contact={contact!}
            onDeleteContact={onDeleteContact}
            isEditing={isEditing}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            hideEditControls={isSubcollectionTab} // 🏢 ENTERPRISE: Hide save/cancel on subcollection tabs
          />
        }
        emptyStateProps={{
          icon: Users,
          title: t('emptyState.title'),
          description: t('emptyState.description')
        }}
      >
        {/* 🎯 EDIT MODE TOOLBAR - Μόνο για Mobile (Desktop κουμπιά στην επικεφαλίδα) */}
        <div className="md:hidden">
          {!isEditing ? (
            <div className="flex justify-end mb-4">
              <Button
                onClick={handleStartEdit}
                className={layout.flexCenterGap2}
                variant="outline"
              >
                <Edit className={iconSizes.sm} />
                {actionMessages.edit}
              </Button>
            </div>
          ) : (
            <div className={`${layout.flexGap2} justify-end mb-4`}>
              <Button
                onClick={handleSaveEdit}
                className={layout.flexCenterGap2}
                variant="default"
              >
                <Check className={iconSizes.sm} />
                {actionMessages.save}
              </Button>
              <Button
                onClick={handleCancelEdit}
                className={layout.flexCenterGap2}
                variant="outline"
              >
                <X className={iconSizes.sm} />
                {actionMessages.cancel}
              </Button>
            </div>
          )}
        </div>

        <UnifiedContactTabbedSection
          contactType={contact?.type || 'individual'}
          formData={(isEditing ? editedData : enhancedFormData) as ContactFormData} // 🎯 Use edited data when editing
          handleChange={handleFieldChange} // 🎯 Enable changes when editing
          handleSelectChange={handleSelectChange} // 🎯 Enable select changes when editing
          setFormData={isEditing ? setEditedData : undefined} // 🔧 FIX: Pass setFormData when in edit mode
          handleMultiplePhotosChange={isEditing ? handleMultiplePhotosChange : undefined} // 🔧 FIX: Functional updater — no stale closures
          disabled={!isEditing} // 🎯 Enable editing when in edit mode
          relationshipsMode={isEditing ? "full" : "summary"} // 🎯 KEY: Full mode when editing, summary when viewing
          onPhotoClick={handlePhotoClick} // 🖼️ Photo click handler για gallery preview
          onActiveTabChange={setActiveTab} // 🏢 ENTERPRISE: Track active tab for hiding header controls
          handleUploadedLogoURL={isEditing ? handleUploadedLogoURL : undefined}
          handleUploadedPhotoURL={isEditing ? handleUploadedPhotoURL : undefined}
          handleFileChange={isEditing ? handleFileChange : undefined}
          handleLogoChange={isEditing ? handleLogoChange : undefined}
        />
      </DetailsContainer>

      {contact?.id && (
        <AddUnitToContactDialog
            open={isAddUnitDialogOpen}
            onOpenChange={setIsAddUnitDialogOpen}
            contactId={contact.id}
            onUnitAdded={handleUnitAdded}
        />
      )}

      {/* ✅ PhotoPreviewModal τώρα global - δεν χρειάζεται εδώ */}
    </>
  );
}
