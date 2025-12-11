/**
 * 📞 ENTERPRISE CONTACTS CONSTANTS - SINGLE SOURCE OF TRUTH
 *
 * Κεντρικοποιημένες σταθερές για επαφές, τύπους, χρώματα, labels κλπ.
 * Όλα τα δεδομένα προέρχονται από αυτό το αρχείο - ΜΟΝΑΔΙΚΗ ΠΗΓΗ ΑΛΗΘΕΙΑΣ.
 */

import { Users, Building2, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 📋 CONTACT TYPES - Μοναδική πηγή αλήθειας για τύπους επαφών
export const CONTACT_TYPES = {
  INDIVIDUAL: 'individual' as const,
  COMPANY: 'company' as const,
  SERVICE: 'service' as const,
} as const;

export type ContactType = typeof CONTACT_TYPES[keyof typeof CONTACT_TYPES];

// 🎨 CONTACT COLORS - Κεντρικοποιημένα χρώματα για κάθε τύπο επαφής
export const CONTACT_COLORS = {
  [CONTACT_TYPES.INDIVIDUAL]: {
    primary: 'text-blue-500',
    hover: 'hover:text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    ring: 'ring-blue-100',
  },
  [CONTACT_TYPES.COMPANY]: {
    primary: 'text-purple-500',
    hover: 'hover:text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    ring: 'ring-purple-100',
  },
  [CONTACT_TYPES.SERVICE]: {
    primary: 'text-green-500',
    hover: 'hover:text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    ring: 'ring-green-100',
  },
} as const;

// 🏷️ CONTACT LABELS - Κεντρικοποιημένα labels στα ελληνικά
export const CONTACT_LABELS = {
  [CONTACT_TYPES.INDIVIDUAL]: {
    singular: 'Φυσικό Πρόσωπο',
    plural: 'Φυσικά Πρόσωπα',
    short: 'Φυσικό',
    emoji: '👤',
  },
  [CONTACT_TYPES.COMPANY]: {
    singular: 'Εταιρεία',
    plural: 'Εταιρείες',
    short: 'Εταιρεία',
    emoji: '🏢',
    // Alternative labels
    alt: {
      singular: 'Νομικό Πρόσωπο',
      plural: 'Νομικά Πρόσωπα',
      short: 'Νομικό',
    }
  },
  [CONTACT_TYPES.SERVICE]: {
    singular: 'Δημόσια Υπηρεσία',
    plural: 'Δημόσιες Υπηρεσίες',
    short: 'Υπηρεσία',
    emoji: '🏛️',
  },
} as const;

// 🎯 CONTACT ICONS - Κεντρικοποιημένα icons για κάθε τύπο επαφής
export const CONTACT_ICONS = {
  [CONTACT_TYPES.INDIVIDUAL]: Users,
  [CONTACT_TYPES.COMPANY]: Building2,
  [CONTACT_TYPES.SERVICE]: Landmark,
} as const;

// 🔧 UTILITY FUNCTIONS - Βοηθητικές functions για επαφές

/**
 * 🎨 Get color class για συγκεκριμένο contact type
 */
export const getContactColor = (type: ContactType, variant: keyof typeof CONTACT_COLORS[ContactType] = 'primary') => {
  return CONTACT_COLORS[type]?.[variant] || CONTACT_COLORS[CONTACT_TYPES.INDIVIDUAL].primary;
};

/**
 * 🏷️ Get label για συγκεκριμένο contact type
 */
export const getContactLabel = (type: ContactType, variant: keyof typeof CONTACT_LABELS[ContactType] = 'singular') => {
  return CONTACT_LABELS[type]?.[variant] || CONTACT_LABELS[CONTACT_TYPES.INDIVIDUAL].singular;
};

/**
 * 🎯 Get icon για συγκεκριμένο contact type
 */
export const getContactIcon = (type: ContactType): LucideIcon => {
  return CONTACT_ICONS[type] || CONTACT_ICONS[CONTACT_TYPES.INDIVIDUAL];
};

/**
 * ✅ Check if contact type is valid
 */
export const isValidContactType = (type: string): type is ContactType => {
  return Object.values(CONTACT_TYPES).includes(type as ContactType);
};

/**
 * 📋 Get all contact types as array
 */
export const getAllContactTypes = (): ContactType[] => {
  return Object.values(CONTACT_TYPES);
};

/**
 * 🔍 Get contact type από string (με fallback)
 */
export const parseContactType = (type: string | undefined | null, fallback: ContactType = CONTACT_TYPES.INDIVIDUAL): ContactType => {
  if (!type || !isValidContactType(type)) {
    return fallback;
  }
  return type;
};

// 🎭 CONTACT TYPE CONFIG - Πλήρης configuration για κάθε τύπο επαφής
export const CONTACT_TYPE_CONFIG = {
  [CONTACT_TYPES.INDIVIDUAL]: {
    type: CONTACT_TYPES.INDIVIDUAL,
    label: CONTACT_LABELS[CONTACT_TYPES.INDIVIDUAL],
    colors: CONTACT_COLORS[CONTACT_TYPES.INDIVIDUAL],
    icon: CONTACT_ICONS[CONTACT_TYPES.INDIVIDUAL],
    allowedRelationships: ['family', 'friend', 'employee', 'client'],
    defaultFields: ['firstName', 'lastName', 'email', 'phone'],
  },
  [CONTACT_TYPES.COMPANY]: {
    type: CONTACT_TYPES.COMPANY,
    label: CONTACT_LABELS[CONTACT_TYPES.COMPANY],
    colors: CONTACT_COLORS[CONTACT_TYPES.COMPANY],
    icon: CONTACT_ICONS[CONTACT_TYPES.COMPANY],
    allowedRelationships: ['employer', 'contractor', 'vendor', 'client', 'partner'],
    defaultFields: ['companyName', 'email', 'phone', 'website'],
  },
  [CONTACT_TYPES.SERVICE]: {
    type: CONTACT_TYPES.SERVICE,
    label: CONTACT_LABELS[CONTACT_TYPES.SERVICE],
    colors: CONTACT_COLORS[CONTACT_TYPES.SERVICE],
    icon: CONTACT_ICONS[CONTACT_TYPES.SERVICE],
    allowedRelationships: ['service_provider', 'government_agency', 'regulator'],
    defaultFields: ['serviceName', 'email', 'phone', 'address'],
  },
} as const;

/**
 * 🎭 Get full config για συγκεκριμένο contact type
 */
export const getContactTypeConfig = (type: ContactType) => {
  return CONTACT_TYPE_CONFIG[type] || CONTACT_TYPE_CONFIG[CONTACT_TYPES.INDIVIDUAL];
};

// 🚀 DEFAULT VALUES - Προεπιλεγμένες τιμές
export const DEFAULT_CONTACT_TYPE = CONTACT_TYPES.INDIVIDUAL;
export const ALL_CONTACT_TYPES = [CONTACT_TYPES.INDIVIDUAL, CONTACT_TYPES.COMPANY, CONTACT_TYPES.SERVICE] as const;

// 🔄 BACKWARD COMPATIBILITY - Για existing code που χρησιμοποιεί παλιές σταθερές
export const ContactTypeEnum = CONTACT_TYPES; // Alias