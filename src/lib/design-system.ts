// Design system utilities για consistent styling
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { designTokens } from '@/styles/design-tokens';
import { borders } from '@/styles/design-tokens';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

// Enhanced cn function με design system support
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Status color utilities
export const getStatusColor = (status: string, variant: 'bg' | 'text' | 'border' = 'text') => {
  const statusColorMap: Record<string, string> = {
    // Property statuses
    'for-sale': 'status-success',
    'available': 'status-success',
    'active': 'status-success',
    
    'for-rent': 'status-info',
    'planned': 'status-info',
    'pending': 'status-info',
    
    'reserved': 'status-warning',
    'construction': 'status-warning',
    'in_progress': 'status-warning',
    
    'sold': 'status-error',
    'cancelled': 'status-error',
    'error': 'status-error',
    
    'landowner': 'status-purple',
    'completed': 'status-purple',
    'owner': 'status-purple',
  };

  const colorVar = statusColorMap[status] || 'status-info';
  
  switch (variant) {
    case 'bg':
      return `bg-[hsl(var(--${colorVar}))]`;
    case 'border':
      return `border-[hsl(var(--${colorVar}))]`;
    case 'text':
    default:
      return `text-[hsl(var(--${colorVar}))]`;
  }
};

// Typography utilities
export const getTypographyClass = (
  size: keyof typeof designTokens.typography.fontSize,
  weight: keyof typeof designTokens.typography.fontWeight = 'normal',
  leading: keyof typeof designTokens.typography.lineHeight = 'normal'
) => {
  const sizeMap = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
  };

  const weightMap = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  const leadingMap = {
    tight: 'leading-tight',
    snug: 'leading-snug',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
    loose: 'leading-loose',
  };

  return cn(sizeMap[size], weightMap[weight], leadingMap[leading]);
};

// Spacing utilities
export const getSpacingClass = (
  type: 'p' | 'm' | 'gap',
  size: keyof typeof designTokens.spacing,
  direction?: 'x' | 'y' | 't' | 'r' | 'b' | 'l'
) => {
  const sizeMap = {
    xs: '2',
    sm: '3',
    md: '4',
    lg: '6',
    xl: '8',
    '2xl': '12',   // ✅ ENTERPRISE FIX: Added missing 2xl mapping
    '3xl': '16',   // ✅ ENTERPRISE FIX: Added missing 3xl mapping
    component: '4' // ✅ ENTERPRISE FIX: Added missing component mapping (fallback to md)
  } as Record<string, string>;

  const base = direction ? `${type}${direction}` : type;
  return `${base}-${sizeMap[size as keyof typeof sizeMap] || '4'}`; // ✅ ENTERPRISE FIX: Type safety with fallback
};

// Component size utilities
export const getComponentSizeClass = (
  component: keyof typeof designTokens.componentSizes,
  size: string
) => {
  const componentSizes = designTokens.componentSizes[component];
  return componentSizes[size as keyof typeof componentSizes] || componentSizes.md;
};

// Interactive state utilities
export const getInteractiveStateClass = (
  type: keyof typeof designTokens.interactiveStates
) => {
  return designTokens.interactiveStates[type].full;
};

// Grid pattern utilities
export const getGridClass = (
  pattern: keyof typeof designTokens.gridPatterns
) => {
  const gridPattern = designTokens.gridPatterns[pattern];

  // ✅ ENTERPRISE: Handle different grid pattern structures
  if ('full' in gridPattern) {
    return gridPattern.full;
  }

  // Handle form patterns with specific full variants
  if (pattern === 'form') {
    return gridPattern.fullDouble; // Default form layout
  }

  // Fallback: construct basic grid class
  const mobile = 'mobile' in gridPattern ? gridPattern.mobile : 'grid-cols-1';
  const gap = 'gap' in gridPattern ? gridPattern.gap : 'gap-4';
  return `grid ${gap} ${mobile}`;
};

// Shadow utilities
export const getShadowClass = (size: keyof typeof designTokens.shadows) => {
  const shadowMap: Record<string, string> = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    default: 'shadow',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',
    inner: 'shadow-inner',
    focus: 'ring-2 ring-ring ring-offset-2', // ✅ ENTERPRISE FIX: Focus shadow
  };

  return shadowMap[size] || shadowMap.default;
};

// Border radius utilities
export const getBorderRadiusClass = (size: keyof typeof designTokens.borderRadius) => {
  const radiusMap: Record<string, string> = {
    none: 'rounded-none',
    xs: 'rounded-sm', // ✅ ENTERPRISE FIX: xs radius
    sm: 'rounded-sm',
    default: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl', // ✅ ENTERPRISE FIX: 3xl radius
    full: 'rounded-full',
  };

  return radiusMap[size] || radiusMap.default;
};

// Responsive utilities
export const getResponsiveClass = (
  breakpoint: keyof typeof designTokens.breakpoints,
  className: string
) => {
  if (breakpoint === 'sm') return `sm:${className}`;
  if (breakpoint === 'md') return `md:${className}`;
  if (breakpoint === 'lg') return `lg:${className}`;
  if (breakpoint === 'xl') return `xl:${className}`;
  if (breakpoint === '2xl') return `2xl:${className}`;
  return className;
};

// Color scheme utilities για theming
export const colorScheme = {
  light: {
    background: COLOR_BRIDGE.bg.primary,
    foreground: 'text-foreground',
    card: 'bg-card text-card-foreground',
    muted: 'bg-muted text-muted-foreground',
    accent: 'bg-accent text-accent-foreground',
  },
  dark: {
    background: `dark:${COLOR_BRIDGE.bg.primary}`,
    foreground: 'dark:text-foreground',
    card: 'dark:bg-card dark:text-card-foreground',
    muted: 'dark:bg-muted dark:text-muted-foreground',
    accent: 'dark:bg-accent dark:text-accent-foreground',
  },
  responsive: {
    background: `${COLOR_BRIDGE.bg.primary} dark:${COLOR_BRIDGE.bg.primary}`,
    foreground: 'text-foreground dark:text-foreground',
    card: 'bg-card text-card-foreground dark:bg-card dark:text-card-foreground',
    muted: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
    accent: 'bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground',
  }
};

// Preset class combinations για common patterns
export const presets = {
  // Card presets
  card: {
    default: cn(
      'rounded-lg bg-card text-card-foreground shadow-sm',
      borders.variants.card.className,
      getInteractiveStateClass('card')
    ),
    interactive: cn(
      'rounded-lg bg-card text-card-foreground shadow-sm cursor-pointer',
      borders.variants.card.className,
      getInteractiveStateClass('card')
    ),
    elevated: cn(
      'rounded-lg bg-card text-card-foreground shadow-lg',
      borders.variants.modal.className,
      getInteractiveStateClass('card')
    ),
  },

  // Button presets
  button: {
    primary: cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'bg-primary text-primary-foreground',
      getComponentSizeClass('button', 'md'),
      getInteractiveStateClass('button')
    ),
    secondary: cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'bg-secondary text-secondary-foreground',
      getComponentSizeClass('button', 'md'),
      getInteractiveStateClass('button')
    ),
    outline: cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      COLOR_BRIDGE.bg.primary,
      borders.variants.button.default.className,
      getComponentSizeClass('button', 'md'),
      getInteractiveStateClass('button')
    ),
  },

  // Layout presets
  layout: {
    container: 'container mx-auto px-4',
    section: 'py-8 px-4',
    grid: getGridClass('cards'),
    toolbar: cn(`flex items-center justify-between p-4 ${COLOR_BRIDGE.bg.primary}`, borders.variants.separator.horizontal.className),
  },

  // Text presets
  text: {
    title: getTypographyClass('2xl', 'semibold', 'tight'),
    subtitle: getTypographyClass('lg', 'medium', 'normal'),
    body: getTypographyClass('base', 'normal', 'normal'),
    caption: getTypographyClass('sm', 'normal', 'normal'),
    muted: cn(getTypographyClass('sm', 'normal', 'normal'), 'text-muted-foreground'),
  }
};

// Status badge utilities
export const getStatusBadgeClass = (status: string, variant: 'default' | 'outline' = 'default') => {
  const baseClass = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  const statusColor = getStatusColor(status, 'bg');
  const textColor = 'text-white';
  
  if (variant === 'outline') {
    return cn(
      baseClass,
      borders.variants.status[status as keyof typeof borders.variants.status]?.className || borders.variants.card.className,
      getStatusColor(status, 'border'),
      getStatusColor(status, 'text'),
      'bg-transparent'
    );
  }
  
  return cn(baseClass, statusColor, textColor);
};

// Form field utilities
export const getFormFieldClass = (hasError: boolean = false, disabled: boolean = false) => {
  return cn(
    `flex h-10 w-full rounded-md ${COLOR_BRIDGE.bg.primary} px-3 py-2 text-sm`,
    borders.variants.input.default.className,
    'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    {
      [borders.variants.status.error.className]: hasError,
      'focus-visible:ring-red-500': hasError,
      'cursor-not-allowed opacity-50': disabled,
    }
  );
};

// Export all utilities
export const designSystem = {
  cn,
  getStatusColor,
  getTypographyClass,
  getSpacingClass,
  getComponentSizeClass,
  getInteractiveStateClass,
  getGridClass,
  getShadowClass,
  getBorderRadiusClass,
  getResponsiveClass,
  getStatusBadgeClass,
  getFormFieldClass,
  colorScheme,
  presets,
} as const;