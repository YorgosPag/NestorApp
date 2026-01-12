import { Contact, IndividualContact, CompanyContact, ServiceContact, AddressInfo, isIndividualContact, isCompanyContact, isServiceContact } from './contracts';

// 🏢 ENTERPRISE: Type-safe interface for legacy service contact fields
// These fields may exist in older service contacts but are not in the standard schema
interface LegacyServiceContactFields {
  email?: string;
  contactEmail?: string;
  officialEmail?: string;
  phone?: string;
  telephone?: string;
  centralPhone?: string;
}

// 🏢 ENTERPRISE: Type guard for legacy service contact fields
function hasLegacyServiceFields(contact: Contact): contact is ServiceContact & LegacyServiceContactFields {
  return isServiceContact(contact);
}

// Validation schemas (για χρήση με zod αργότερα)
export const contactValidationRules = {
  individual: {
    firstName: { required: true, minLength: 2, maxLength: 50 },
    lastName: { required: true, minLength: 2, maxLength: 50 },
    email: { required: false, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    phone: { required: false, pattern: /^\+?[0-9\s-()]+$/ },
    taxNumber: { required: false, length: 9, pattern: /^[0-9]{9}$/ }
  },
  company: {
    companyName: { required: true, minLength: 2, maxLength: 100 },
    vatNumber: { required: true, length: 9, pattern: /^[0-9]{9}$/ },
    legalForm: { required: true }
  },
  service: {
    serviceName: { required: true, minLength: 2, maxLength: 100 },
    serviceType: { required: true }
  }
};

// Helper functions
export function getContactDisplayName(contact: Contact): string {
  if (isIndividualContact(contact)) {
    return `${contact.firstName} ${contact.lastName}`;
  } else if (isCompanyContact(contact)) {
    return contact.companyName;
  } else {
    return contact.serviceName;
  }
}

export function getContactInitials(contact: Contact): string {
  const name = getContactDisplayName(contact);
  return (name || '')
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getPrimaryEmail(contact: Contact): string | undefined {
  // Try standard structure first (Individual, Company with emails array)
  const emails = contact.emails || [];
  const primaryEmail = emails.find(e => e.isPrimary);
  const standardEmail = primaryEmail?.email || emails[0]?.email;

  if (standardEmail) {
    return standardEmail;
  }

  // 🏛️ SERVICE CONTACT: Try service-specific legacy fields with type safety
  if (hasLegacyServiceFields(contact)) {
    return contact.email ||
           contact.contactEmail ||
           contact.officialEmail ||
           undefined;
  }

  return undefined;
}

export function getPrimaryPhone(contact: Contact): string | undefined {
  // Try standard structure first (Individual, Company with phones array)
  const phones = contact.phones || [];
  const primaryPhone = phones.find(p => p.isPrimary);
  const standardPhone = primaryPhone?.number || phones[0]?.number;

  if (standardPhone) {
    return standardPhone;
  }

  // 🏛️ SERVICE CONTACT: Try service-specific legacy fields with type safety
  if (hasLegacyServiceFields(contact)) {
    return contact.phone ||
           contact.telephone ||
           contact.centralPhone ||
           undefined;
  }

  return undefined;
}

export function getPrimaryAddress(contact: Contact): AddressInfo | undefined {
  const addresses = contact.addresses || [];
  const primaryAddress = addresses.find(a => a.isPrimary);
  return primaryAddress || addresses[0];
}

// Re-export type guards to be available from the barrel file
export { isIndividualContact, isCompanyContact, isServiceContact };
