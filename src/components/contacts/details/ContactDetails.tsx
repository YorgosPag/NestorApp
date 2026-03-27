'use client';

import '@/lib/design-system';
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
// 🛡️ ENTERPRISE: Auto-save guard for pending relationship form data
import { PendingRelationshipGuard } from '@/utils/pending-relationship-guard';

// 🏢 ENTERPRISE: Type guard for contacts with multiple photo URLs (used for gallery preview only)
const getMultiplePhotoURLs = (contact: Contact): string[] => {
  if ('multiplePhotoURLs' in contact && Array.isArray((contact as IndividualContact).multiplePhotoURLs)) {
    return (contact as IndividualContact).multiplePhotoURLs || [];
  }
  return [];
};
import { useContactPhotoHandlers } from './useContactPhotoHandlers';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { openGalleryPhotoModal } from '@/core/modals';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { DetailsContainer } from '@/core/containers';
import { ContactsService } from '@/services/contacts.service';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import type { PersonaType } from '@/types/contacts/personas';
import { createDefaultPersonaData } from '@/types/contacts/personas';

const logger = createModuleLogger('ContactDetails');

interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
  onContactUpdated?: () => void;
  onNewContact?: () => void;
}

// 🏢 ENTERPRISE: Tabs where main edit controls (Αποθήκευση/Επεξεργασία) are HIDDEN
// These tabs have their own save mechanisms — showing the contact save button causes confusion
const SUBCOLLECTION_TABS: string[] = ['relationships'];

export function ContactDetails({ contact, onEditContact: _onEditContact, onDeleteContact, onContactUpdated, onNewContact }: ContactDetailsProps) {
  const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ContactFormData>>({});
  // Optimistic persona state for instant UI response in view mode
  const [optimisticPersonas, setOptimisticPersonas] = useState<{
    activePersonas: PersonaType[];
    personaData: Record<string, Record<string, string | number | null>>;
  } | null>(null);
  // 🏢 ENTERPRISE: Track active tab — persisted in sessionStorage to survive remounts
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && contact?.id) {
      return sessionStorage.getItem(`contact-tab-${contact.id}`) || 'basicInfo';
    }
    return 'basicInfo';
  });

  // Persist tab changes to sessionStorage
  useEffect(() => {
    if (contact?.id && activeTab) {
      sessionStorage.setItem(`contact-tab-${contact.id}`, activeTab);
    }
  }, [contact?.id, activeTab]);
  // 🖼️ OPTIMISTIC PHOTO STATE: Preserve photo URLs between save and contact refresh
  const [savedPhotoURLs, setSavedPhotoURLs] = useState<{ logoURL?: string; photoURL?: string }>({});
  const photoModal = useGlobalPhotoPreview();

  // 🏢 ENTERPRISE: Check if current tab is a subcollection tab
  const isSubcollectionTab = SUBCOLLECTION_TABS.includes(activeTab);

  // 🏢 FIX (2026-02-16): Reset edit mode when switching contacts to prevent
  // cross-contact photo leakage. Without this, editedData from Contact A persists
  // when navigating to Contact B, causing photos to appear on the wrong contact.
  useEffect(() => {
    setIsEditing(false);
    setEditedData({});
    setSavedPhotoURLs({});
    setOptimisticPersonas(null);
  }, [contact?.id]);

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

  // Clear optimistic personas once the contact prop reflects the change
  useEffect(() => {
    if (!optimisticPersonas || !contact) return;

    const contactPersonas = ('personas' in contact && Array.isArray((contact as IndividualContact).personas))
      ? ((contact as IndividualContact).personas ?? [])
        .filter(p => p.status === 'active')
        .map(p => p.personaType)
      : [];

    // Clear optimistic state only when Firestore data matches our optimistic update
    const optimisticSet = new Set(optimisticPersonas.activePersonas);
    const firestoreSet = new Set(contactPersonas);
    const matches = optimisticSet.size === firestoreSet.size &&
      [...optimisticSet].every(p => firestoreSet.has(p));

    console.log('🎭 OPTIMISTIC CLEANUP DEBUG', {
      optimisticPersonas: [...optimisticSet],
      firestorePersonas: [...firestoreSet],
      matches,
      willClear: matches,
      contactHasPersonasField: 'personas' in contact,
    });

    if (matches) {
      setOptimisticPersonas(null);
    }
  }, [contact, optimisticPersonas]);

  // 🔴 BROWSER DEBUG: Track editedData.multiplePhotos changes
  useEffect(() => {
    const mp = (editedData as ContactFormData).multiplePhotos;
    if (mp && Array.isArray(mp)) {
      const filled = mp.filter((p: PhotoSlot) => p.file || p.uploadUrl || p.preview).length;
      if (filled > 0) {
        console.log('🔴 PHOTO DEBUG [ContactDetails] editedData.multiplePhotos UPDATED', {
          length: mp.length, filled,
          slots: mp.map((p: PhotoSlot, i: number) => ({
            i, f: !!p.file, u: !!p.uploadUrl, p: !!p.preview
          }))
        });
      }
    }
  }, [(editedData as ContactFormData).multiplePhotos]);

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

    // 🔧 FIX: multiplePhotoURLs → multiplePhotos conversion is now handled
    // exclusively by individualMapper.ts (ADR-054). The previous code here
    // concatenated the SAME photos again, causing duplicates in the UI.
    // See: src/utils/contactForm/fieldMappers/individualMapper.ts (lines 43-81)

    // Optimistic persona merge — instant UI update before Firestore refresh
    if (optimisticPersonas) {
      formData = {
        ...formData,
        activePersonas: optimisticPersonas.activePersonas,
        personaData: optimisticPersonas.personaData,
      };
    }

    return formData;
  }, [contact, savedPhotoURLs, optimisticPersonas]);

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
      // 🛡️ ENTERPRISE: Auto-submit pending relationship form before saving contact
      if (PendingRelationshipGuard.hasPendingData) {
        logger.info('Auto-submitting pending relationship before contact save');
        await PendingRelationshipGuard.submitPending();
      }

      // 🏢 ENTERPRISE: Use new form-to-arrays conversion method
      const editedFormData = editedData as Partial<ContactFormData>;

      // 🔍 DIAGNOSTIC: Log persona data before save
      console.log('🎭 PERSONA SAVE DEBUG', {
        activePersonas: editedFormData.activePersonas,
        personaDataKeys: editedFormData.personaData ? Object.keys(editedFormData.personaData) : [],
        editedDataKeys: Object.keys(editedData),
      });

      await ContactsService.updateContactFromForm(contact.id, editedData);

      // 🖼️ OPTIMISTIC: Preserve photo URLs so they remain visible while async refresh loads
      const newSavedPhotos: { logoURL?: string; photoURL?: string } = {};
      if (editedFormData.logoURL) newSavedPhotos.logoURL = editedFormData.logoURL;
      if (editedFormData.photoURL) newSavedPhotos.photoURL = editedFormData.photoURL;
      if (newSavedPhotos.logoURL || newSavedPhotos.photoURL) {
        setSavedPhotoURLs(newSavedPhotos);
      }

      // Preserve persona state across edit→view transition (same pattern as photo URLs)
      const savedPersonas = editedFormData.activePersonas;
      console.log('🎭 PERSONA OPTIMISTIC DEBUG', {
        savedPersonas,
        willSetOptimistic: !!(savedPersonas && savedPersonas.length > 0),
      });

      if (savedPersonas && savedPersonas.length > 0) {
        setOptimisticPersonas({
          activePersonas: savedPersonas,
          personaData: (editedFormData.personaData ?? {}) as Record<string, Record<string, string | number | null>>,
        });
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

  // 🖼️ PHOTO HANDLERS: Extracted to useContactPhotoHandlers (SRP — ADR-233)
  const {
    handleUploadedLogoURL,
    handleUploadedPhotoURL,
    handleFileChange,
    handleMultiplePhotosChange,
    handleLogoChange,
  } = useContactPhotoHandlers(setEditedData);

  // 🎭 ENTERPRISE: Persona toggle — works in BOTH view and edit mode (ADR-121)
  // View mode: saves directly to Firestore (same pattern as banking subcollection)
  // Edit mode: updates editedData (saved with the rest of the form on Save click)
  const handlePersonaToggle = useCallback(async (personaType: PersonaType) => {
    if (!contact?.id) return;

    // Determine current source of truth
    const currentFormData = isEditing ? editedData : enhancedFormData;
    const currentActive = (currentFormData as ContactFormData).activePersonas ?? [];
    const isActive = currentActive.includes(personaType);

    let updatedActive: PersonaType[];
    let updatedPersonaData = (currentFormData as ContactFormData).personaData ?? {};

    if (isActive) {
      updatedActive = currentActive.filter(p => p !== personaType);
    } else {
      updatedActive = [...currentActive, personaType];
      if (!updatedPersonaData[personaType]) {
        const defaultData = createDefaultPersonaData(personaType);
        const { personaType: _pt, status: _s, activatedAt: _a, deactivatedAt: _d, notes: _n, ...defaultFields } = defaultData;
        updatedPersonaData = {
          ...updatedPersonaData,
          [personaType]: defaultFields as Record<string, string | number | null>,
        };
      }
    }

    if (isEditing) {
      // Edit mode: update local state (will be saved on explicit Save click)
      setEditedData(prev => ({
        ...prev,
        activePersonas: updatedActive,
        personaData: updatedPersonaData,
      }));
    } else {
      // View mode: optimistic UI update + save to Firestore
      setOptimisticPersonas({
        activePersonas: updatedActive,
        personaData: updatedPersonaData as Record<string, Record<string, string | number | null>>,
      });

      try {
        await ContactsService.updateContactFromForm(contact.id, {
          activePersonas: updatedActive,
          personaData: updatedPersonaData,
        } as Partial<ContactFormData>);

        logger.info('Persona toggled and saved', { personaType, isActive: !isActive });
        onContactUpdated?.();
      } catch (error) {
        logger.error('Failed to toggle persona', { error, personaType });
        // Rollback optimistic update on failure
        setOptimisticPersonas(null);
      }
    }
  }, [contact?.id, isEditing, editedData, enhancedFormData, onContactUpdated]);

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
            onNewContact={onNewContact}
            isEditing={isEditing}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            hideEditControls={isSubcollectionTab} // 🏢 ENTERPRISE: Hide save/cancel on subcollection tabs
          />
        }
        onCreateAction={onNewContact}
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
          initialTab={activeTab} // 🏢 ENTERPRISE: Preserved tab (survives remounts via sessionStorage)
          onActiveTabChange={setActiveTab} // 🏢 ENTERPRISE: Track active tab for hiding header controls
          handleUploadedLogoURL={isEditing ? handleUploadedLogoURL : undefined}
          handleUploadedPhotoURL={isEditing ? handleUploadedPhotoURL : undefined}
          handleFileChange={isEditing ? handleFileChange : undefined}
          handleLogoChange={isEditing ? handleLogoChange : undefined}
          onPersonaToggle={handlePersonaToggle}
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
