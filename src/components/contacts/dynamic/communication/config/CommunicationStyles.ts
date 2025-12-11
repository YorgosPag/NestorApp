// ============================================================================
// 🎨 ENTERPRISE COMMUNICATION STYLES - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ STYLING
// ============================================================================
//
// 📍 EXTRACTED FROM: UniversalCommunicationManager.tsx
// 🎯 PURPOSE: Centralized styling configuration για consistent UI across communication components
// 🔗 USED BY: Communication components, renderers, layout systems
//
// ============================================================================

// ============================================================================
// STYLE CONFIGURATION OBJECTS
// ============================================================================

/**
 * 🎨 COMMUNICATION STYLES CONFIGURATION
 *
 * Centralized styling classes που χρησιμοποιούνται σε όλο το communication system
 * για consistent look & feel across all components.
 *
 * Includes:
 * - Container styling
 * - Row layout και hover effects
 * - Input field styling με focus states
 * - Empty state presentation
 * - Header styling για grouped layouts
 */
export const COMMUNICATION_STYLES = {
  groupedTable: {
    header: 'bg-muted border-b font-medium text-sm text-muted-foreground',
    container: 'border rounded-lg bg-card p-4 w-full max-w-none',
    row: 'grid gap-3 p-4 border-b last:border-b-0 bg-card hover:bg-accent/50 transition-colors',
    emptyState: 'text-center text-muted-foreground py-8 border rounded-lg bg-muted/30',
    input: 'bg-background border-input focus:bg-background focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
  }
} as const;

// ============================================================================
// STYLE UTILITIES & HELPERS
// ============================================================================

/**
 * 🎛️ Style Configuration Type
 *
 * Type definition για το COMMUNICATION_STYLES object
 */
export type CommunicationStylesType = typeof COMMUNICATION_STYLES;

/**
 * 📱 Responsive Grid Classes
 *
 * Grid layout classes για responsive communication forms
 */
export const RESPONSIVE_GRID_CLASSES = {
  // Desktop layouts (>=768px)
  desktop: {
    phoneRow: 'grid-cols-[1fr_200px_120px_auto] items-center',
    emailRow: 'grid-cols-[1fr_180px_auto] items-center',
    websiteRow: 'grid-cols-[1fr_180px_auto] items-center',
    socialRow: 'grid-cols-[200px_150px_1fr_180px_auto] items-center',
    identityRow: 'grid-cols-[1fr_200px_120px_auto] items-center',
    professionalRow: 'grid-cols-[1fr_200px_120px_auto] items-center',
    addressRow: 'grid-cols-[1fr_180px_auto] items-center'
  },

  // Mobile layouts (<768px)
  mobile: {
    phoneRow: 'grid-cols-1 gap-4',
    emailRow: 'grid-cols-1 gap-4',
    websiteRow: 'grid-cols-1 gap-4',
    socialRow: 'grid-cols-1 gap-4',
    identityRow: 'grid-cols-1 gap-4',
    professionalRow: 'grid-cols-1 gap-4',
    addressRow: 'grid-cols-1 gap-4'
  }
} as const;

/**
 * 🔘 Button Style Variants
 *
 * Consistent button styling για communication actions
 */
export const COMMUNICATION_BUTTON_STYLES = {
  add: 'w-full bg-background border-input focus:bg-background focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20',
  delete: 'text-red-600 hover:text-red-700',
  primary: 'cursor-pointer hover:opacity-80'
} as const;

/**
 * 🏷️ Badge & Label Styles
 *
 * Styling για badges, labels και indicators
 */
export const COMMUNICATION_BADGE_STYLES = {
  primary: 'bg-blue-100 text-blue-800 text-xs',
  type: 'text-xs opacity-70',
  label: 'text-sm font-medium'
} as const;

// ============================================================================
// STYLE HELPER FUNCTIONS
// ============================================================================

/**
 * 🎨 Get Row Grid Class
 *
 * Returns appropriate grid class για συγκεκριμένο communication type και screen size
 */
export function getRowGridClass(
  communicationType: string,
  isDesktop: boolean = true
): string {
  const gridClasses = isDesktop
    ? RESPONSIVE_GRID_CLASSES.desktop
    : RESPONSIVE_GRID_CLASSES.mobile;

  switch (communicationType) {
    case 'phone':
      return gridClasses.phoneRow;
    case 'email':
      return gridClasses.emailRow;
    case 'website':
      return gridClasses.websiteRow;
    case 'social':
      return gridClasses.socialRow;
    case 'identity':
      return gridClasses.identityRow;
    case 'professional':
      return gridClasses.professionalRow;
    case 'address':
      return gridClasses.addressRow;
    default:
      return gridClasses.phoneRow; // fallback
  }
}

/**
 * 📱 Check if Desktop Layout
 *
 * Helper function για responsive layout decisions
 */
export function isDesktopLayout(width: number = window.innerWidth): boolean {
  return width >= 768;
}

/**
 * 🎯 Combine Style Classes
 *
 * Utility για clean combination of style classes
 */
export function combineStyles(...classes: (string | undefined | null | false)[]): string {
  return classes
    .filter(Boolean)
    .join(' ');
}