import type { Contact, IndividualContact } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

// ADR-317: Tabs that own subcollections with their own CRUD lifecycle.
// On these tabs the global contact Save button is hidden — instead the adaptive
// ContactEditFocus header takes over when an inline form is active.
export const SUBCOLLECTION_TABS: string[] = ['banking', 'files'];

export interface OptimisticPersonaState {
  activePersonas: PersonaType[];
  personaData: Record<string, Record<string, string | number | null>>;
}


export function getActiveIndividualPersonaTypes(contact: Contact): PersonaType[] {
  if (!('personas' in contact) || !Array.isArray((contact as IndividualContact).personas)) {
    return [];
  }

  return ((contact as IndividualContact).personas ?? [])
    .filter((persona) => persona.status === 'active')
    .map((persona) => persona.personaType);
}

export function optimisticPersonasMatchContact(
  optimisticPersonas: OptimisticPersonaState,
  contact: Contact
): boolean {
  const optimisticSet = new Set(optimisticPersonas.activePersonas);
  const firestoreSet = new Set(getActiveIndividualPersonaTypes(contact));

  return optimisticSet.size === firestoreSet.size
    && [...optimisticSet].every((personaType) => firestoreSet.has(personaType));
}

