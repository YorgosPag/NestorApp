import { useCallback } from 'react';
import type React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PersonaType } from '@/types/contacts/personas';
import { activatePersonaInForm } from '@/lib/contacts/persona-credential-form';
import { resolveEditingFormData, type OptimisticPersonaState } from './contact-details-helpers';
import { createModuleLogger } from '@/lib/telemetry';
import type { SettledGuardOutcome } from '@/hooks/impact-guard/guard-result';

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
  ) => Promise<SettledGuardOutcome>;
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

    // ADR-323: editedData = diff, merge for read — η ΙΔΙΑ εικόνα με την κεφαλίδα (ADR-121 Ε4).
    const currentFormData = resolveEditingFormData(enhancedFormData, editedData, isEditing);
    const currentActive = currentFormData.activePersonas ?? [];
    const isActive = currentActive.includes(personaType);

    // Η ενεργοποίηση είναι η ΜΙΑ `activatePersonaInForm` — κοινή με την εγγραφή αρ. μητρώου (ADR-950 §9).
    const { activePersonas: updatedActive, personaData: updatedPersonaData } = isActive
      ? {
          activePersonas: currentActive.filter((activePersona) => activePersona !== personaType),
          personaData: currentFormData.personaData ?? {},
        }
      : activatePersonaInForm(currentFormData, personaType);

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

      const updateOutcome = await runExistingContactPartialFormUpdate(
        updatedFormData,
        {
          activePersonas: updatedActive,
          personaData: updatedPersonaData,
        } as Partial<ContactFormData>,
        'PERSONA TOGGLE',
      );

      // ADR-777 §8.69.13 — η αισιόδοξη εικόνα μένει ΜΟΝΟ αν η αποθήκευση ΤΕΛΕΙΩΣΕ.
      if (updateOutcome !== 'completed') {
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
