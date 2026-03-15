/**
 * 📞 ENTERPRISE CONTACTS CONSTANTS - SINGLE SOURCE OF TRUTH
 *
 * Κεντρικοποιημένες σταθερές για επαφές, τύπους, χρώματα, labels κλπ.
 * Όλα τα δεδομένα προέρχονται από αυτό το αρχείο - ΜΟΝΑΔΙΚΗ ΠΗΓΗ ΑΛΗΘΕΙΑΣ.
 */

import { Users, Factory, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { brandClasses } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { hardcodedColorValues } from '@/design-system/tokens/colors';

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
    // ✅ BRAND CONSISTENCY: Using centralized brand colors
    primary: brandClasses.primary.text,
    hover: brandClasses.primary.hover.text,
    bg: brandClasses.primary.bg,
    border: brandClasses.primary.border,
    ring: brandClasses.primary.ring,
  },
  [CONTACT_TYPES.COMPANY]: {
    primary: 'text-purple-500',
    hover: HOVER_TEXT_EFFECTS.PURPLE,
    bg: 'bg-purple-50',
    border: 'border-blue-300', // ✅ ENTERPRISE: Aligned με semantic info border
    ring: 'ring-purple-100',
  },
  [CONTACT_TYPES.SERVICE]: {
    primary: 'text-green-500',
    hover: HOVER_TEXT_EFFECTS.GREEN,
    bg: 'bg-green-50',
    border: 'border-green-300', // ✅ ENTERPRISE: Aligned με semantic success border
    ring: 'ring-green-100',
  },
} as const;

// 🏷️ CONTACT LABELS - Κεντρικοποιημένα i18n keys για labels
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const CONTACT_LABELS = {
  [CONTACT_TYPES.INDIVIDUAL]: {
    singular: 'contacts.types.individual.singular',
    plural: 'contacts.types.individual.plural',
    short: 'contacts.types.individual.short',
    emoji: '👤',
  },
  [CONTACT_TYPES.COMPANY]: {
    singular: 'contacts.types.company.singular',
    plural: 'contacts.types.company.plural',
    short: 'contacts.types.company.short',
    emoji: '🏢',
    // Alternative labels
    alt: {
      singular: 'contacts.types.company.altSingular',
      plural: 'contacts.types.company.altPlural',
      short: 'contacts.types.company.altShort',
    }
  },
  [CONTACT_TYPES.SERVICE]: {
    singular: 'contacts.types.service.singular',
    plural: 'contacts.types.service.plural',
    short: 'contacts.types.service.short',
    emoji: '🏛️',
  },
} as const;

// 🎯 CONTACT ICONS - Κεντρικοποιημένα icons για κάθε τύπο επαφής
export const CONTACT_ICONS = {
  [CONTACT_TYPES.INDIVIDUAL]: Users,
  [CONTACT_TYPES.COMPANY]: Factory,
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
    allowedRelationships: (process.env.NEXT_PUBLIC_INDIVIDUAL_RELATIONSHIPS || 'family,friend,employee,client').split(',').map(r => r.trim()),
    defaultFields: ['firstName', 'lastName', 'email', 'phone'],
  },
  [CONTACT_TYPES.COMPANY]: {
    type: CONTACT_TYPES.COMPANY,
    label: CONTACT_LABELS[CONTACT_TYPES.COMPANY],
    colors: CONTACT_COLORS[CONTACT_TYPES.COMPANY],
    icon: CONTACT_ICONS[CONTACT_TYPES.COMPANY],
    allowedRelationships: (process.env.NEXT_PUBLIC_COMPANY_RELATIONSHIPS || 'employer,contractor,vendor,client,partner').split(',').map(r => r.trim()),
    defaultFields: ['companyName', 'email', 'phone', 'website'],
  },
  [CONTACT_TYPES.SERVICE]: {
    type: CONTACT_TYPES.SERVICE,
    label: CONTACT_LABELS[CONTACT_TYPES.SERVICE],
    colors: CONTACT_COLORS[CONTACT_TYPES.SERVICE],
    icon: CONTACT_ICONS[CONTACT_TYPES.SERVICE],
    allowedRelationships: (process.env.NEXT_PUBLIC_SERVICE_RELATIONSHIPS || 'service_provider,government_agency,regulator').split(',').map(r => r.trim()),
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

// ============================================================================
// 🎨 ENTERPRISE CONTACT STYLING CONSTANTS - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * 🏢 CONTACT COMPONENT STYLING - Enterprise-class centralized styling
 *
 * Αντικαθιστά όλα τα inline styles με κεντρικοποιημένα constants
 * για consistent, maintainable, και type-safe styling across contact components.
 *
 * ARCHITECTURE: Single Source of Truth για όλα τα contact component styles
 * BENEFITS: Maintainability, consistency, performance, type safety
 * USAGE: Import και χρήση στα contact components αντί για inline styles
 */
export const CONTACT_STYLES = {

  // 📋 LIST ITEM STYLING
  listItem: {
    container: 'flex items-center gap-3 w-max', // Replaces style={{ width: 'max-content' }}
    nameSection: 'flex items-center gap-2 shrink-0',
    mobileLayout: 'grid-cols-1 gap-4',
    desktopLayout: 'grid-cols-[1fr_200px_120px_auto] items-center',
    mobileScrollContainer: 'overflow-x-auto scrollbar-hide w-[calc(100vw-120px)] [scroll-behavior:smooth]', // Mobile viewport calculation
  },

  // 👥 EMPLOYEE SELECTOR STYLING
  employeeSelector: {
    cardContent: 'p-0 bg-transparent', // Replaces style={{ backgroundColor: 'transparent' }}
    searchContainer: 'relative w-full',
    resultsContainer: 'max-h-60 overflow-auto',
    loadingState: 'flex items-center justify-center p-4',
  },

  // 🎯 BADGE & STATUS STYLING - Enterprise function
  getBadges: (colors?: ReturnType<typeof useSemanticColors>) => {
    if (!colors) {
      // Enterprise fallback
      return {
        primary: 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full',
        secondary: `${hardcodedColorValues.background.gray[100]} text-slate-800 text-xs px-2 py-1 rounded-full`,
        success: 'bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full',
        warning: 'bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full',
        danger: 'bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full',
      };
    }

    return {
      primary: `${colors.bg.infoSubtle} ${colors.text.info} text-xs px-2 py-1 rounded-full`,
      secondary: `${colors.bg.muted} ${colors.text.muted} text-xs px-2 py-1 rounded-full`,
      success: `${colors.bg.successSubtle} ${colors.text.success} text-xs px-2 py-1 rounded-full`,
      warning: `${colors.bg.warningSubtle} ${colors.text.warning} text-xs px-2 py-1 rounded-full`,
      danger: `${colors.bg.errorSubtle} ${colors.text.error} text-xs px-2 py-1 rounded-full`,
    };
  },

  // Legacy export for backward compatibility
  badges: {
    primary: 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full',
    secondary: 'bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-full',
    success: 'bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full',
    warning: 'bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full',
    danger: 'bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full',
  },

  // 📱 RESPONSIVE LAYOUTS
  responsive: {
    mobile: 'block md:hidden',
    desktop: 'hidden md:block',
    tablet: 'hidden sm:block md:hidden',
    all: 'block',
  },

  // 🔗 INTERACTION STATES
  interactions: {
    hover: `${HOVER_BACKGROUND_EFFECTS.ACCENT} transition-colors duration-200`,
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20',
    active: 'active:bg-accent/70',
    disabled: 'opacity-50 cursor-not-allowed',
  }

} as const;

/**
 * 🎨 Get Contact List Item Style
 *
 * Enterprise function για consistent contact list item styling
 */
export const getContactListItemStyle = () => {
  return CONTACT_STYLES.listItem.container;
};

/**
 * 📱 Get Contact List Mobile Scroll Container Style
 *
 * Enterprise function για consistent mobile scroll container styling
 */
export const getContactListMobileScrollStyle = () => {
  return CONTACT_STYLES.listItem.mobileScrollContainer;
};

/**
 * 🏢 Get Employee Selector Card Style
 *
 * Enterprise function για consistent employee selector styling
 */
export const getEmployeeSelectorCardStyle = () => {
  return CONTACT_STYLES.employeeSelector.cardContent;
};

/**
 * 🎯 Get Contact Badge Style
 *
 * Enterprise function για consistent badge styling
 */
export const getContactBadgeStyle = (variant: keyof typeof CONTACT_STYLES.badges = 'primary') => {
  return CONTACT_STYLES.badges[variant];
};

/**
 * 🔄 Combine Contact Styles
 *
 * Utility για clean combination of contact style classes
 */
export const combineContactStyles = (...styles: (string | undefined | null | false)[]): string => {
  return styles
    .filter(Boolean)
    .join(' ');
};