import { Users, Factory, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { brandClasses } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { hardcodedColorValues } from '@/design-system/tokens/colors';

export const CONTACT_TYPES = {
  INDIVIDUAL: 'individual' as const,
  COMPANY: 'company' as const,
  SERVICE: 'service' as const,
} as const;

export type ContactType = typeof CONTACT_TYPES[keyof typeof CONTACT_TYPES];

export const CONTACT_COLORS = {
  [CONTACT_TYPES.INDIVIDUAL]: {
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
    border: 'border-blue-300',
    ring: 'ring-purple-100',
  },
  [CONTACT_TYPES.SERVICE]: {
    primary: 'text-green-500',
    hover: HOVER_TEXT_EFFECTS.GREEN,
    bg: 'bg-green-50',
    border: 'border-green-300',
    ring: 'ring-green-100',
  },
} as const;

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

export const CONTACT_ICONS = {
  [CONTACT_TYPES.INDIVIDUAL]: Users,
  [CONTACT_TYPES.COMPANY]: Factory,
  [CONTACT_TYPES.SERVICE]: Landmark,
} as const;

export const getContactIcon = (type: ContactType): LucideIcon => {
  return CONTACT_ICONS[type] || CONTACT_ICONS[CONTACT_TYPES.INDIVIDUAL];
};

export const isValidContactType = (type: string): type is ContactType => {
  return Object.values(CONTACT_TYPES).includes(type as ContactType);
};

export const ALL_CONTACT_TYPES = [CONTACT_TYPES.INDIVIDUAL, CONTACT_TYPES.COMPANY, CONTACT_TYPES.SERVICE] as const;

export const CONTACT_STYLES = {
  listItem: {
    container: 'flex items-center gap-3 w-max',
    nameSection: 'flex items-center gap-2 shrink-0',
    mobileLayout: 'grid-cols-1 gap-4',
    desktopLayout: 'grid-cols-[1fr_200px_120px_auto] items-center',
    mobileScrollContainer: 'overflow-x-auto scrollbar-hide w-[calc(100vw-120px)] [scroll-behavior:smooth]',
  },
  employeeSelector: {
    cardContent: 'p-0 bg-transparent',
    searchContainer: 'relative w-full',
    resultsContainer: 'max-h-60 overflow-auto',
    loadingState: 'flex items-center justify-center p-4',
  },
  getBadges: (colors?: ReturnType<typeof useSemanticColors>) => {
    if (!colors) {
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
  badges: {
    primary: 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full',
    secondary: 'bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-full',
    success: 'bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full',
    warning: 'bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full',
    danger: 'bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full',
  },
  responsive: {
    mobile: 'block md:hidden',
    desktop: 'hidden md:block',
    tablet: 'hidden sm:block md:hidden',
    all: 'block',
  },
  interactions: {
    hover: `${HOVER_BACKGROUND_EFFECTS.ACCENT} transition-colors duration-200`,
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20',
    active: 'active:bg-accent/70',
    disabled: 'opacity-50 cursor-not-allowed',
  }
} as const;

export const getEmployeeSelectorCardStyle = () => {
  return CONTACT_STYLES.employeeSelector.cardContent;
};
