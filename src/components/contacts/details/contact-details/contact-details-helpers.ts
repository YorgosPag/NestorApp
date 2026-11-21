import type { Contact, IndividualContact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PersonaType } from '@/types/contacts/personas';

/**
 * **Η ΜΙΑ εικόνα της φόρμας επαφής** (ADR-323 · ADR-121 Ε4). Σε επεξεργασία το `editedData` κρατά **μόνο** τη διαφορά,
 * άρα ό,τι δείχνεται (πεδία, κεφαλίδα, διακόπτες ρόλων) διαβάζει τη διαφορά **πάνω** στα αποθηκευμένα.
 * 🔴 Ήταν γραμμένο δύο φορές (`ContactDetails` · `usePersonaToggle`) και η κεφαλίδα διάβαζε το **τρίτο**, μη
 * συγχωνευμένο `enhancedFormData.activePersonas` ⇒ ο διακόπτης ρόλου άλλαζε (και αποθηκευόταν) αλλά δεν φαινόταν.
 */
export function resolveEditingFormData(
  enhancedFormData: ContactFormData,
  editedData: Partial<ContactFormData>,
  isEditing: boolean,
): ContactFormData {
  return isEditing ? ({ ...enhancedFormData, ...editedData } as ContactFormData) : enhancedFormData;
}

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

