import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects"
import { useBorderTokens } from '@/hooks/useBorderTokens'
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'
import type { UseSemanticColorsReturn } from '@/ui-adapters/react/useSemanticColors'

// 🏢 ENTERPRISE: Dynamic button variants using centralized border tokens
const createButtonVariants = (borderTokens: ReturnType<typeof useBorderTokens>, colors?: UseSemanticColorsReturn) => cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50`,
  {
    variants: {
      variant: {
        default: `${borderTokens.quick.button} bg-primary text-primary-foreground ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        destructive:
          `${borderTokens.quick.button} bg-destructive text-destructive-foreground ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        outline:
          `${borderTokens.quick.input} ${colors?.bg.primary || 'bg-background'} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`,
        secondary:
          `${borderTokens.quick.button} bg-secondary text-secondary-foreground ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
        ghost: `border-transparent ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`,
        link: `text-primary underline-offset-4 ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`,
      },
      size: {
        default: "h-10 px-4 py-2 rounded-md",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// 🏢 ENTERPRISE: Button variant type definition
export type ButtonVariantProps = {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  asChild?: boolean
}

// 🏢 ENTERPRISE: Dynamic button variants using CENTRALIZED SYSTEM ONLY
function getButtonVariants() {
  // ✅ ZERO HARDCODED VALUES - Use centralized hook directly
  const borderTokens = useBorderTokens();
  return createButtonVariants(borderTokens);
}

const buttonVariants = getButtonVariants();

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // 🏢 ENTERPRISE: Use centralized border tokens and semantic colors
    const dynamicBorderTokens = useBorderTokens();
    const colors = useSemanticColors();
    const dynamicButtonVariants = createButtonVariants(dynamicBorderTokens, colors);

    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(dynamicButtonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants, createButtonVariants }
