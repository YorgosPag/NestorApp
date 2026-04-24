import { useCallback } from 'react';
import type React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PersonaType } from '@/types/contacts/personas';
import { createDefaultPersonaData } from '@/types/contacts/personas';
import type { OptimisticPersonaState } from './contact-details-helpers';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactDetails');

interface UsePersonaToggleParams {
  contact: Contact | null | undefined;
  isEditing: boolean;
  enhancedFormData: ContactFormData;
  editedData: Partial<ContactFormData>;
  setEditedData: React.Dispatch<React.SetStateAction<Partial<ContactFormData>>>;
  setOptimisticPersonas: React.Dispatch<React.SetStateAction<OptimisticPersonaState | null>>;
  runExistingContactPartialFormUpdate: (
    mergedData: ContactFormData,
    dirtyData: Partial<ContactFormData>,
    label: string,
    action?: () => Promise<void>,
  ) => Promise<boolean>;
  onContactUpdated?: () => void;
}

export function usePersonaToggle({
  contact,
  isEditing,
  enhancedFormData,
  editedData,
  setEditedData,
  setOptimisticPersonas,
  runExistingContactPartialFormUpdate,
  onContactUpdated,
}: UsePersonaToggleParams) {
  const handlePersonaToggle = useCallback(async (personaType: PersonaType) => {
    if (!contact?.id) {
      return;
    }

    // ADR-323: editedData = diff, merge for read.
    const currentFormData = isEditing ? { ...enhancedFormData, ...editedData } : enhancedFormData;
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
  }, [contact, editedData, enhancedFormData, isEditing, onContactUpdated, runExistingContactPartialFormUpdate, setEditedData, setOptimisticPersonas]);

  return { handlePersonaToggle };
}
