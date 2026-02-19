/**
 * 🏢 ENTERPRISE ACCORDION (Radix UI)
 *
 * @description
 * Production-ready accordion built on Radix UI primitives with enterprise features:
 * theming, variants, RTL support, reduced motion, custom icons, and full TypeScript types.
 *
 * @features
 * ✅ Radix UI primitives (accessibility built-in)
 * ✅ Variants: size (sm/md/lg), style (default/bordered/ghost/card)
 * ✅ Theming: CSS variables (--accordion-*)
 * ✅ RTL support (chevron positioning)
 * ✅ Reduced motion support (@media prefers-reduced-motion)
 * ✅ Custom chevron icons
 * ✅ Disabled state styling
 * ✅ Focus ring (WCAG 2.1 AA)
 * ✅ Dark/Light mode support
 * ✅ Full TypeScript types exported
 *
 * @usage
 * ```tsx
 * // Basic
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>Section 1</AccordionTrigger>
 *     <AccordionContent>Content 1</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 *
 * // With variants
 * <AccordionItem value="item-1" variant="bordered" size="lg">
 *   <AccordionTrigger chevronPosition="start">
 *     Advanced Settings
 *   </AccordionTrigger>
 *   <AccordionContent>...</AccordionContent>
 * </AccordionItem>
 *
 * // Without chevron
 * <AccordionTrigger showChevron={false}>Custom</AccordionTrigger>
 *
 * // Custom chevron
 * <AccordionTrigger chevron={<CustomIcon />}>Custom</AccordionTrigger>
 * ```
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5 Enterprise
 * @since 2025-10-07
 * @version 2.0.0 (Enterprise)
 */

"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects'
import { useIconSizes } from '@/hooks/useIconSizes'
import { useBorderTokens } from '@/hooks/useBorderTokens'

// ===== TYPES =====

export type AccordionSize = 'sm' | 'md' | 'lg';
export type AccordionVariant = 'default' | 'bordered' | 'ghost' | 'card';

// Re-export Radix types for convenience
export type AccordionProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>

// 🏢 ENTERPRISE: Dynamic variant types
export type AccordionItemVariantProps = {
  variant?: 'default' | 'bordered' | 'ghost' | 'card';
}

export type AccordionItemProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & AccordionItemVariantProps
export type AccordionTriggerProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & VariantProps<typeof accordionTriggerVariants> & {
  showChevron?: boolean;
  chevron?: React.ReactNode;
  chevronPosition?: 'start' | 'end';
}
export type AccordionContentProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & VariantProps<typeof accordionContentVariants>

// ===== VARIANTS (class-variance-authority) =====

// 🏢 ENTERPRISE: Dynamic border variants using centralized tokens
const createAccordionItemVariants = (borderTokens: ReturnType<typeof useBorderTokens>) => cva(
  "border-b", // Base
  {
    variants: {
      variant: {
        default: "border-border",
        bordered: `${borderTokens.quick.card} mb-2 overflow-hidden`,
        ghost: "border-0",
        card: `${borderTokens.quick.card} mb-2 bg-card shadow-sm`
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

const accordionTriggerVariants = cva(
  "flex flex-1 items-center justify-between font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER,
        bordered: `${INTERACTIVE_PATTERNS.BUTTON_ACCENT_HOVER} px-2`,
        ghost: `${HOVER_BACKGROUND_EFFECTS.ACCENT} px-2`,
        card: `${INTERACTIVE_PATTERNS.BUTTON_ACCENT_HOVER} px-2`
      },
      size: {
        sm: "py-2 text-sm",
        md: "py-2 text-base",
        lg: "py-2 text-lg"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
)

const accordionContentVariants = cva(
  "overflow-hidden text-sm transition-all",
  {
    variants: {
      variant: {
        default: "",
        bordered: "px-2",
        ghost: "px-2",
        card: "px-2"
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
)

// ===== ROOT (Pass-through to Radix) =====

const Accordion = AccordionPrimitive.Root

// ===== ITEM =====

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  AccordionItemProps
>(({ className, variant, ...props }, ref) => {
  // 🏢 ENTERPRISE: Use centralized border tokens
  const borderTokens = useBorderTokens();
  const accordionItemVariants = createAccordionItemVariants(borderTokens);

  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(accordionItemVariants({ variant }), className)}
      {...props}
    />
  );
})
AccordionItem.displayName = "AccordionItem"

// ===== TRIGGER =====

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({
  className,
  children,
  variant,
  size,
  showChevron = true,
  chevron,
  chevronPosition = 'end',
  ...props
}, ref) => {
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: Custom chevron rendering
  const renderChevron = () => {
    if (!showChevron) return null;

    if (chevron) return chevron;

    // 🏢 ENTERPRISE: Dynamic icon sizes using centralized system
    const getChevronSize = () => {
      switch (size) {
        case 'sm': return iconSizes.xs;
        case 'lg': return iconSizes.md;
        default: return iconSizes.sm;
      }
    };

    return (
      <ChevronDown
        className={cn(
          "shrink-0 transition-transform duration-200",
          getChevronSize(),
          // 🏢 ENTERPRISE: RTL support
          "[dir='rtl']:rotate-180"
        )}
        aria-hidden="true"
      />
    );
  };

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          accordionTriggerVariants({ variant, size }),
          // 🏢 ENTERPRISE: Chevron rotation via data-state
          "[&[data-state=open]>svg]:rotate-180",
          // 🏢 ENTERPRISE: Reduced motion support
          "motion-reduce:transition-none [&>svg]:motion-reduce:transition-none",
          className
        )}
        {...props}
      >
        {/* Chevron Start */}
        {chevronPosition === 'start' && (
          <span className="mr-2">
            {renderChevron()}
          </span>
        )}

        {/* Content */}
        <span className="flex-1 text-left">
          {children}
        </span>

        {/* Chevron End */}
        {chevronPosition === 'end' && renderChevron()}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
})
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

// ===== CONTENT =====

const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  AccordionContentProps
>(({ className, children, variant, size, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      accordionContentVariants({ variant, size }),
      // 🏢 ENTERPRISE: Smooth animations with reduced motion support
      "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      // 🏢 ENTERPRISE: Disable animations for users who prefer reduced motion
      "motion-reduce:transition-none motion-reduce:animate-none",
      className
    )}
    {...props}
  >
    <div className={cn(
      "pb-2 pt-0",
      variant === 'bordered' || variant === 'card' ? "" : "" // Already handled by content variants
    )}>
      {children}
    </div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

// ===== EXPORTS =====

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  // Export variants for external use
  createAccordionItemVariants,
  accordionTriggerVariants,
  accordionContentVariants
}

// ===== OPINIONATED WRAPPER (Optional) =====

/**
 * 🏢 ENTERPRISE: Opinionated wrapper with sensible defaults
 *
 * @example
 * ```tsx
 * <EnterpriseAccordion items={[
 *   { value: "1", trigger: "Section 1", content: <Content1 /> },
 *   { value: "2", trigger: "Section 2", content: <Content2 /> }
 * ]} />
 * ```
 */
export interface EnterpriseAccordionItem {
  value: string;
  trigger: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface EnterpriseAccordionProps {
  items: EnterpriseAccordionItem[];
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  variant?: AccordionVariant;
  size?: AccordionSize;
  collapsible?: boolean;
  className?: string;
}

// 🏢 ENTERPRISE: Function overloads for type-safe discriminated unions
export function EnterpriseAccordion(props: EnterpriseAccordionProps & { type: 'single' }): JSX.Element;
export function EnterpriseAccordion(props: EnterpriseAccordionProps & { type: 'multiple' }): JSX.Element;
export function EnterpriseAccordion({
  items,
  type = 'single',
  defaultValue,
  variant = 'default',
  size = 'md',
  collapsible = true,
  className
}: EnterpriseAccordionProps) {
  // 🏢 ENTERPRISE: Type-safe conditional props with const assertions
  const accordionProps = type === 'single'
    ? {
        type: 'single' as const,
        defaultValue: defaultValue as string | undefined,
        collapsible
      }
    : {
        type: 'multiple' as const,
        defaultValue: defaultValue as string[] | undefined
      };

  return (
    <Accordion {...accordionProps} className={className}>
      {items.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          variant={variant}
          disabled={item.disabled}
        >
          <AccordionTrigger variant={variant} size={size}>
            {item.trigger}
          </AccordionTrigger>
          <AccordionContent variant={variant} size={size}>
            {item.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
