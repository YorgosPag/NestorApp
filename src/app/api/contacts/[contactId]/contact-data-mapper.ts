import 'server-only';

import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';
import type { Contact } from '@/types/contacts';

type FirestoreContactData = Contact & Record<string, unknown> & {
  id: string;
  companyId?: string;
};

export interface MappedContactResponse {
  id: string;
  contactId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  status: string;
  profession: string | null;
  city: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  serviceType: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastContactDate: unknown;
}

function extractPrimaryEmail(contactData: FirestoreContactData): string | null {
  if (contactData.emails && Array.isArray(contactData.emails) && contactData.emails.length > 0) {
    const primaryEmailObj = contactData.emails.find((email: unknown) =>
      typeof email === 'object' && email !== null && (email as { isPrimary?: boolean }).isPrimary
    ) || contactData.emails[0];

    if (primaryEmailObj && typeof primaryEmailObj === 'object' && primaryEmailObj !== null) {
      return (primaryEmailObj as { email?: string }).email || null;
    }
  } else if (contactData.email && typeof contactData.email === 'string') {
    return contactData.email;
  }
  return null;
}

function extractCity(contactData: FirestoreContactData): string | null {
  const serviceAddress = contactData.serviceAddress;
  const serviceAddressCity = typeof serviceAddress === 'object' && serviceAddress !== null && 'city' in serviceAddress
    ? (serviceAddress as { city?: string }).city
    : undefined;
  return (typeof contactData.city === 'string' ? contactData.city : undefined) || serviceAddressCity || null;
}

function extractAvatar(contactData: FirestoreContactData): string | null {
  if (contactData.photoURL) return contactData.photoURL;
  if (typeof contactData.avatarUrl === 'string') return contactData.avatarUrl;
  if (contactData.multiplePhotoURLs && Array.isArray(contactData.multiplePhotoURLs) && contactData.multiplePhotoURLs.length > 0) {
    return contactData.multiplePhotoURLs[0];
  }
  return null;
}

export function mapFirestoreContactToResponse(contactData: FirestoreContactData): MappedContactResponse {
  return {
    id: contactData.id,
    contactId: contactData.id,
    displayName: getContactDisplayName(contactData),
    firstName: contactData.firstName || '',
    lastName: contactData.lastName || '',
    primaryPhone: getPrimaryPhone(contactData) ?? null,
    primaryEmail: extractPrimaryEmail(contactData),
    status: contactData.status || 'active',
    profession: (typeof contactData.profession === 'string' ? contactData.profession : null),
    city: extractCity(contactData),
    avatarUrl: extractAvatar(contactData),
    companyName: (typeof contactData.companyName === 'string' ? contactData.companyName : null),
    serviceType: String(contactData.serviceType || contactData.type || 'individual'),
    createdAt: contactData.createdAt || null,
    updatedAt: contactData.updatedAt || null,
    lastContactDate: contactData.lastContactDate || null,
  };
}
