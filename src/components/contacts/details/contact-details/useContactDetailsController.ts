import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Contact, IndividualContact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { PersonaType } from '@/types/contacts/personas';
import { createDefaultPersonaData } from '@/types/contacts/personas';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  validateCompanyContact,
  validateContactField,
  validateIndividualContact,
  validateServiceContact,
} from '@/utils/contactForm/contact-validation';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { ContactsService } from '@/services/contacts.service';
import { PendingRelationshipGuard } from '@/utils/pending-relationship-guard';
import { openGalleryPhotoModal } from '@/core/modals';
import { createModuleLogger } from '@/lib/telemetry';
import { useGuardedContactMutation } from '@/hooks/useGuardedContactMutation';
import { useContactPhotoHandlers } from '../useContactPhotoHandlers';
import type { ContactDetailsProps } from './contact-details-types';
import {
  getFilledPhotoSlotCount,
  getMultiplePhotoURLs,
  optimisticPersonasMatchContact,
  OptimisticPersonaState,
  SUBCOLLECTION_TABS,
} from './contact-details-helpers';

const logger = createModuleLogger('ContactDetails');

interface ValidationResult {
  isValid: boolean;
  fieldErrors: Record<string, string>;
  firstErrorField?: string;
}

interface UseContactDetailsControllerResult {
  activeTab: string;
  contactGuardDialogs: React.ReactNode;
  enhancedFormData: ContactFormData;
  handleCancelEdit: () => void;
  handleFieldBlur: (fieldName: string) => void;
  handleFieldChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleLogoChange: (file: File | null) => void;
  handleMultiplePhotosChange: (photos: PhotoSlot[]) => void;
  handlePersonaToggle: (personaType: PersonaType) => Promise<void>;
  handlePhotoClick: (index: number) => void;
  handleSaveEdit: () => Promise<void>;
  handleSelectChange: (name: string, value: string) => void;
  handleStartEdit: () => void;
  handleUnitAdded: () => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleUploadedPhotoURL: (photoURL: string) => void;
  handleFileChange: (file: File | null) => void;
  isEditing: boolean;
  isSubcollectionTab: boolean;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  setEditedData: React.Dispatch<React.SetStateAction<Partial<ContactFormData>>>;
  validationErrors: Record<string, string>;
  editedData: Partial<ContactFormData>;
}

export function useContactDetailsController({
  contact,
  onContactUpdated,
}: Pick<ContactDetailsProps, 'contact' | 'onContactUpdated'>): UseContactDetailsControllerResult {
  const notifications = useNotifications();
  const photoModal = useGlobalPhotoPreview();
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ContactFormData>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [optimisticPersonas, setOptimisticPersonas] = useState<OptimisticPersonaState | null>(null);
  const [savedPhotoURLs, setSavedPhotoURLs] = useState<{ logoURL?: string; photoURL?: string }>({});
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && contact?.id) {
      return sessionStorage.getItem(`contact-tab-${contact.id}`) || 'basicInfo';
    }

    return 'basicInfo';
  });

  useEffect(() => {
    if (contact?.id && activeTab) {
      sessionStorage.setItem(`contact-tab-${contact.id}`, activeTab);
    }
  }, [activeTab, contact?.id]);

  useEffect(() => {
    setIsEditing(false);
    setEditedData({});
    setValidationErrors({});
    setSavedPhotoURLs({});
    setOptimisticPersonas(null);
  }, [contact?.id]);

  useEffect(() => {
    if (!contact || (!savedPhotoURLs.logoURL && !savedPhotoURLs.photoURL)) {
      return;
    }

    const contactRecord = contact as unknown as Record<string, unknown>;
    const hasLogo = !savedPhotoURLs.logoURL || contactRecord.logoURL === savedPhotoURLs.logoURL;
    const hasPhoto = !savedPhotoURLs.photoURL || contactRecord.photoURL === savedPhotoURLs.photoURL;

    if (hasLogo && hasPhoto) {
      setSavedPhotoURLs({});
    }
  }, [contact, savedPhotoURLs]);

  useEffect(() => {
    if (!optimisticPersonas || !contact) {
      return;
    }

    if (optimisticPersonasMatchContact(optimisticPersonas, contact)) {
      setOptimisticPersonas(null);
    }
  }, [contact, optimisticPersonas]);

  useEffect(() => {
    const multiplePhotos = (editedData as ContactFormData).multiplePhotos;
    const filledCount = getFilledPhotoSlotCount(multiplePhotos);
    if (filledCount > 0) {
      console.log('🔴 PHOTO DEBUG [ContactDetails] editedData.multiplePhotos UPDATED', {
        length: multiplePhotos?.length ?? 0,
        filled: filledCount,
        slots: (multiplePhotos ?? []).map((photo, index) => ({
          i: index,
          f: !!photo.file,
          u: !!photo.uploadUrl,
          p: !!photo.preview,
        })),
      });
    }
  }, [(editedData as ContactFormData).multiplePhotos]);

  const enhancedFormData = useMemo(() => {
    if (!contact) {
      return {} as ContactFormData;
    }

    const mappingResult = mapContactToFormData(contact);
    logger.info('Using mapper for contact type', {
      contactType: contact.type,
      contactId: contact.id,
      mappingWarnings: mappingResult.warnings,
      email: mappingResult.formData.email,
      phone: mappingResult.formData.phone,
      website: mappingResult.formData.website,
    });

    let formData = mappingResult.formData;

    if (savedPhotoURLs.logoURL && !formData.logoURL) {
      formData = { ...formData, logoURL: savedPhotoURLs.logoURL, logoPreview: savedPhotoURLs.logoURL };
    }
    if (savedPhotoURLs.photoURL && !formData.photoURL) {
      formData = { ...formData, photoURL: savedPhotoURLs.photoURL, photoPreview: savedPhotoURLs.photoURL };
    }

    if (optimisticPersonas) {
      formData = {
        ...formData,
        activePersonas: optimisticPersonas.activePersonas,
        personaData: optimisticPersonas.personaData,
      };
    }

    return formData;
  }, [contact, optimisticPersonas, savedPhotoURLs]);

  const getEditedFormData = useCallback((): ContactFormData | null => {
    if (!contact) {
      return null;
    }

    return {
      ...enhancedFormData,
      ...editedData,
    };
  }, [contact, editedData, enhancedFormData]);

  const {
    runExistingContactFormUpdate,
    runExistingContactPartialFormUpdate,
    guardDialogs: contactGuardDialogs,
  } = useGuardedContactMutation({
    editContact: contact,
    notifications,
  });

  const getValidationResult = useCallback((formData: ContactFormData): ValidationResult | null => {
    switch (formData.type) {
      case 'individual':
        return validateIndividualContact(formData);
      case 'company':
        return validateCompanyContact(formData);
      case 'service':
        return validateServiceContact(formData);
      default:
        return null;
    }
  }, []);

  const focusField = useCallback((fieldName?: string) => {
    if (!fieldName || typeof document === 'undefined') {
      return;
    }

    window.setTimeout(() => {
      const selector = `[name="${fieldName}"], #${fieldName}`;
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        return;
      }
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }, []);

  const handleStartEdit = useCallback(() => {
    if (!contact) {
      return;
    }

    const mappingResult = mapContactToFormData(contact);
    setEditedData(mappingResult.formData);
    setValidationErrors({});
    setIsEditing(true);
  }, [contact]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedData({});
    setValidationErrors({});
  }, []);

  const handleFieldBlur = useCallback((fieldName: string) => {
    const formData = getEditedFormData();
    if (!formData) {
      return;
    }

    const errorKey = validateContactField(formData, fieldName);
    setValidationErrors((previous) => {
      const next = { ...previous };
      if (errorKey) {
        next[fieldName] = errorKey;
      } else {
        delete next[fieldName];
      }
      return next;
    });
  }, [getEditedFormData]);

  const handleSaveEdit = useCallback(async () => {
    if (!contact?.id) {
      return;
    }

    const contactId = contact.id;
    const mergedFormData = getEditedFormData();
    if (!mergedFormData) {
      return;
    }

    const validationResult = getValidationResult(mergedFormData);
    if (!validationResult) {
      notifications.error('contacts-form.validation.unknownType');
      return;
    }

    setValidationErrors(validationResult.fieldErrors);
    if (!validationResult.isValid) {
      notifications.error('contacts-form.validation.individual.reviewHighlightedFields');
      focusField(validationResult.firstErrorField);
      return;
    }

    try {
      if (PendingRelationshipGuard.hasPendingData) {
        logger.info('Auto-submitting pending relationship before contact save');
        await PendingRelationshipGuard.submitPending();
      }

      const editedFormData = editedData as Partial<ContactFormData>;
      const afterUpdate = async () => {
        const newSavedPhotos: { logoURL?: string; photoURL?: string } = {};
        if (editedFormData.logoURL) {
          newSavedPhotos.logoURL = editedFormData.logoURL;
        }
        if (editedFormData.photoURL) {
          newSavedPhotos.photoURL = editedFormData.photoURL;
        }
        if (newSavedPhotos.logoURL || newSavedPhotos.photoURL) {
          setSavedPhotoURLs(newSavedPhotos);
        }

        const savedPersonas = editedFormData.activePersonas;
        if (savedPersonas && savedPersonas.length > 0) {
          setOptimisticPersonas({
            activePersonas: savedPersonas,
            personaData: (editedFormData.personaData ?? {}) as Record<string, Record<string, string | number | null>>,
          });
        }

        setValidationErrors({});
        setIsEditing(false);
        setEditedData({});
        logger.info('Contact updated successfully with enterprise structure');
        onContactUpdated?.();
      };

      const updateCompleted = await runExistingContactFormUpdate(
        mergedFormData,
        'DETAILS SAVE',
        async () => {
          await ContactsService.updateExistingContactFromForm(contact, mergedFormData);
          await afterUpdate();
        },
      );
      if (!updateCompleted) {
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update contact', error instanceof Error ? error : { error });
      if (message.startsWith('VALIDATION_ERROR:')) {
        notifications.error('contacts-form.validation.individual.reviewHighlightedFields');
      } else {
        notifications.error('contacts-form.submission.updateError');
      }
    }
  }, [contact, editedData, focusField, getEditedFormData, getValidationResult, notifications, onContactUpdated, runExistingContactFormUpdate]);

  const clearFieldError = useCallback((fieldName: string) => {
    setValidationErrors((previous) => {
      if (!previous[fieldName]) {
        return previous;
      }

      const next = { ...previous };
      delete next[fieldName];
      return next;
    });
  }, []);

  const handleFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setEditedData((previous) => ({ ...previous, [name]: value }));
    clearFieldError(name);
  }, [clearFieldError]);

  const handleSelectChange = useCallback((name: string, value: string) => {
    setEditedData((previous) => ({ ...previous, [name]: value }));
    clearFieldError(name);
  }, [clearFieldError]);

  const {
    handleUploadedLogoURL,
    handleUploadedPhotoURL,
    handleFileChange,
    handleMultiplePhotosChange,
    handleLogoChange,
  } = useContactPhotoHandlers(setEditedData);

  const handlePersonaToggle = useCallback(async (personaType: PersonaType) => {
    if (!contact?.id) {
      return;
    }
    const contactId = contact.id;

    const currentFormData = isEditing ? editedData : enhancedFormData;
    const currentActive = currentFormData.activePersonas ?? [];
    const isActive = currentActive.includes(personaType);

    let updatedActive: PersonaType[];
    let updatedPersonaData = currentFormData.personaData ?? {};

    if (isActive) {
      updatedActive = currentActive.filter((activePersona) => activePersona !== personaType);
    } else {
      updatedActive = [...currentActive, personaType];
      if (!updatedPersonaData[personaType]) {
        const defaultData = createDefaultPersonaData(personaType);
        const {
          personaType: _personaType,
          status: _status,
          activatedAt: _activatedAt,
          deactivatedAt: _deactivatedAt,
          notes: _notes,
          ...defaultFields
        } = defaultData;
        updatedPersonaData = {
          ...updatedPersonaData,
          [personaType]: defaultFields as Record<string, string | number | null>,
        };
      }
    }

    if (isEditing) {
      setEditedData((previous) => ({
        ...previous,
        activePersonas: updatedActive,
        personaData: updatedPersonaData,
      }));
      return;
    }

    setOptimisticPersonas({
      activePersonas: updatedActive,
      personaData: updatedPersonaData as Record<string, Record<string, string | number | null>>,
    });

    try {
      const updatedFormData = {
        ...enhancedFormData,
        activePersonas: updatedActive,
        personaData: updatedPersonaData,
      } as ContactFormData;

      const updateCompleted = await runExistingContactPartialFormUpdate(
        updatedFormData,
        {
          activePersonas: updatedActive,
          personaData: updatedPersonaData,
        } as Partial<ContactFormData>,
        'PERSONA TOGGLE',
      );

      if (!updateCompleted) {
        setOptimisticPersonas(null);
        return;
      }

      logger.info('Persona toggled and saved', { personaType, isActive: !isActive });
      onContactUpdated?.();
    } catch (error) {
      logger.error('Failed to toggle persona', { error, personaType });
      setOptimisticPersonas(null);
    }
  }, [contact, editedData, enhancedFormData, isEditing, onContactUpdated, runExistingContactPartialFormUpdate]);

  const handlePhotoClick = useCallback((index: number) => {
    logger.info('Photo click triggered', {
      index,
      contactExists: !!contact,
      photoModalExists: !!photoModal,
      openModalExists: !!photoModal?.openModal,
      multiplePhotoURLs: contact ? getMultiplePhotoURLs(contact).length : 0,
    });

    if (contact) {
      openGalleryPhotoModal(photoModal, contact, index);
    }
  }, [contact, photoModal]);

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);

  return {
    activeTab,
    contactGuardDialogs,
    enhancedFormData,
    handleCancelEdit,
    handleFieldBlur,
    handleFieldChange,
    handleFileChange,
    handleLogoChange,
    handleMultiplePhotosChange,
    handlePersonaToggle,
    handlePhotoClick,
    handleSaveEdit,
    handleSelectChange,
    handleStartEdit,
    handleUnitAdded,
    handleUploadedLogoURL,
    handleUploadedPhotoURL,
    isEditing,
    isSubcollectionTab: SUBCOLLECTION_TABS.includes(activeTab),
    setActiveTab,
    setEditedData,
    validationErrors,
    editedData,
  };
}

