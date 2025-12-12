// Standardized component variants χρησιμοποιώντας class-variance-authority
import { cva, type VariantProps } from 'class-variance-authority';
import { designTokens } from '@/styles/design-tokens';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

// Button variants (enhanced από shadcn/ui)
export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER}`,
        destructive: `bg-destructive text-destructive-foreground ${INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_HOVER}`,
        outline: `border border-input bg-background ${INTERACTIVE_PATTERNS.BUTTON_ACCENT_HOVER}`,
        secondary: `bg-secondary text-secondary-foreground ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER}`,
        ghost: `${INTERACTIVE_PATTERNS.BUTTON_ACCENT_HOVER}`,
        link: `text-primary underline-offset-4 ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`,
        
        // Semantic variants
        success: `bg-[hsl(var(--status-success))] text-white ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
        warning: `bg-[hsl(var(--status-warning))] text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        error: `bg-[hsl(var(--status-error))] text-white ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        info: `bg-[hsl(var(--status-info))] text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
      },
      size: {
        default: 'h-10 px-4 py-2',
        xs: 'h-6 px-2 text-xs',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-12 rounded-md px-10 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Card variants
export const cardVariants = cva(
  'rounded-lg border text-card-foreground shadow-sm transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-card border-border',
        bordered: 'bg-card border-2 border-border',
        elevated: 'bg-card border-0 shadow-lg',
        minimal: 'bg-transparent border-0 shadow-none',
        interactive: `bg-card border-border cursor-pointer ${INTERACTIVE_PATTERNS.CARD_STANDARD}`,
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

// Badge/Status variants
export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: `border-transparent bg-primary text-primary-foreground ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER}`,
        secondary: `border-transparent bg-secondary text-secondary-foreground ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER}`,
        destructive: `border-transparent bg-destructive text-destructive-foreground ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER}`,
        outline: 'text-foreground border border-input',
        
        // Semantic status variants
        success: 'border-transparent bg-[hsl(var(--status-success))] text-white',
        warning: 'border-transparent bg-[hsl(var(--status-warning))] text-white',
        error: 'border-transparent bg-[hsl(var(--status-error))] text-white',
        info: 'border-transparent bg-[hsl(var(--status-info))] text-white',
        purple: 'border-transparent bg-[hsl(var(--status-purple))] text-white',
        
        // Outline semantic variants
        'success-outline': 'border border-[hsl(var(--status-success))] text-[hsl(var(--status-success))] bg-transparent',
        'warning-outline': 'border border-[hsl(var(--status-warning))] text-[hsl(var(--status-warning))] bg-transparent',
        'error-outline': 'border border-[hsl(var(--status-error))] text-[hsl(var(--status-error))] bg-transparent',
        'info-outline': 'border border-[hsl(var(--status-info))] text-[hsl(var(--status-info))] bg-transparent',
        'purple-outline': 'border border-[hsl(var(--status-purple))] text-[hsl(var(--status-purple))] bg-transparent',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Input/Form field variants
export const inputVariants = cva(
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 text-xs',
        default: 'h-10',
        lg: 'h-12 text-base',
      },
      variant: {
        default: 'border-input',
        error: 'border-[hsl(var(--status-error))] focus-visible:ring-[hsl(var(--status-error))]',
        success: 'border-[hsl(var(--status-success))] focus-visible:ring-[hsl(var(--status-success))]',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  }
);

// Text/Typography variants
export const textVariants = cva('', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    leading: {
      tight: 'leading-tight',
      snug: 'leading-snug',
      normal: 'leading-normal',
      relaxed: 'leading-relaxed',
      loose: 'leading-loose',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
    },
    color: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      primary: 'text-primary',
      secondary: 'text-secondary-foreground',
      success: 'text-[hsl(var(--status-success))]',
      warning: 'text-[hsl(var(--status-warning))]',
      error: 'text-[hsl(var(--status-error))]',
      info: 'text-[hsl(var(--status-info))]',
    },
  },
  defaultVariants: {
    size: 'base',
    weight: 'normal',
    leading: 'normal',
    align: 'left',
    color: 'default',
  },
});

// Container/Layout variants
export const containerVariants = cva('mx-auto w-full', {
  variants: {
    size: {
      sm: 'max-w-screen-sm',
      md: 'max-w-screen-md',
      lg: 'max-w-screen-lg',
      xl: 'max-w-screen-xl',
      '2xl': 'max-w-screen-2xl',
      full: 'max-w-none',
    },
    padding: {
      none: 'px-0',
      sm: 'px-4',
      md: 'px-6',
      lg: 'px-8',
    },
  },
  defaultVariants: {
    size: 'lg',
    padding: 'md',
  },
});

// Toolbar variants
export const toolbarVariants = cva(
  'flex items-center bg-background border-b',
  {
    variants: {
      variant: {
        default: 'justify-between p-4',
        compact: 'justify-between p-2',
        expanded: 'flex-col gap-4 p-6',
      },
      position: {
        static: '',
        sticky: 'sticky top-0 z-10 backdrop-blur-sm bg-background/95',
        fixed: 'fixed top-0 left-0 right-0 z-20',
      },
    },
    defaultVariants: {
      variant: 'default',
      position: 'static',
    },
  }
);

// Grid pattern variants
export const gridVariants = cva('grid gap-4', {
  variants: {
    pattern: {
      stats: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      actions: 'grid-cols-1 sm:grid-cols-3',
      cards: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      form: 'grid-cols-1 md:grid-cols-2',
      dense: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    },
    gap: {
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-8',
    },
  },
  defaultVariants: {
    pattern: 'cards',
    gap: 'md',
  },
});

// Export types για TypeScript support
export type ButtonVariants = VariantProps<typeof buttonVariants>;
export type CardVariants = VariantProps<typeof cardVariants>;
export type BadgeVariants = VariantProps<typeof badgeVariants>;
export type InputVariants = VariantProps<typeof inputVariants>;
export type TextVariants = VariantProps<typeof textVariants>;
export type ContainerVariants = VariantProps<typeof containerVariants>;
export type ToolbarVariants = VariantProps<typeof toolbarVariants>;
export type GridVariants = VariantProps<typeof gridVariants>;

// Export all variants
export const variants = {
  button: buttonVariants,
  card: cardVariants,
  badge: badgeVariants,
  input: inputVariants,
  text: textVariants,
  container: containerVariants,
  toolbar: toolbarVariants,
  grid: gridVariants,
} as const;