import type { Contact, IndividualContact } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

export const SUBCOLLECTION_TABS: string[] = ['relationships'];

export interface OptimisticPersonaState {
  activePersonas: PersonaType[];
  personaData: Record<string, Record<string, string | number | null>>;
}

export function getMultiplePhotoURLs(contact: Contact): string[] {
  if ('multiplePhotoURLs' in contact && Array.isArray((contact as IndividualContact).multiplePhotoURLs)) {
    return (contact as IndividualContact).multiplePhotoURLs ?? [];
  }

  return [];
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

export function getFilledPhotoSlotCount(multiplePhotos?: PhotoSlot[]): number {
  if (!multiplePhotos || !Array.isArray(multiplePhotos)) {
    return 0;
  }

  return multiplePhotos.filter((photo) => photo.file || photo.uploadUrl || photo.preview).length;
}
