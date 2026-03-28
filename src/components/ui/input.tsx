import * as React from "react"

import { cn } from "@/lib/utils"
import { useBorderTokens } from "@/hooks/useBorderTokens"
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors"
import '@/lib/design-system';

// =============================================================================
// 🏢 ENTERPRISE INPUT COMPONENT
// =============================================================================
// Pattern: Microsoft Fluent UI / Google Material Design / Ant Design
// Proper icon support via props instead of CSS override hacks
// =============================================================================

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends React.ComponentProps<"input"> {
  /** Has icon on the left side - applies correct padding */
  hasLeftIcon?: boolean;
  /** Has icon on the right side - applies correct padding */
  hasRightIcon?: boolean;
  /** Controls the height of the input. Defaults to 'lg' (current behavior). */
  size?: InputSize;
}

// 🏢 ENTERPRISE: Size tokens — SSoT for input height (ADR audit 2026-03-28)
const INPUT_SIZE: Record<InputSize, string> = {
  sm: "h-8 py-1 md:py-1",              // 32px — compact tables, dense inline forms
  md: "h-10 md:h-9 py-2 md:py-2",      // 40/36px — standard forms, dialogs
  lg: "h-12 md:h-9 py-3 md:py-2",      // 48/36px — default (mobile-first touch targets)
} as const;

// 🏢 ENTERPRISE: Padding tokens for icon inputs (centralized)
// Icon at left-3 (12px) + icon width (16px) + gap (8px) = 36px minimum
// Using pl-10 (40px) for proper spacing - standard Tailwind class
const INPUT_PADDING = {
  default: "px-4 md:px-3",
  leftIcon: "pl-10 pr-4 md:pl-10 md:pr-3",
  rightIcon: "pl-4 pr-10 md:pl-3 md:pr-10",
  bothIcons: "pl-10 pr-10",
} as const;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasLeftIcon, hasRightIcon, size = 'lg', ...props }, ref) => {
    const { quick } = useBorderTokens();
    const colors = useSemanticColors();

    // 🏢 ENTERPRISE: Base styles WITHOUT hardcoded height - allows className override
    // Pattern: Autodesk/Adobe - height should be customizable via className
    const baseStyles = [
      "flex w-full",
      "text-base md:text-sm",
      quick.input,
      colors.bg.primary,
      "ring-offset-background",
      "file:border-0 file:bg-transparent file:text-base md:file:text-sm file:font-medium",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:bg-muted/50",
    ].join(" ");

    return (
      <input
        type={type}
        className={cn(
          baseStyles,
          INPUT_SIZE[size], // SSoT height — use size prop instead of className overrides
          // 🏢 ENTERPRISE: Explicit padding based on icon configuration
          hasLeftIcon && hasRightIcon && INPUT_PADDING.bothIcons,
          hasLeftIcon && !hasRightIcon && INPUT_PADDING.leftIcon,
          !hasLeftIcon && hasRightIcon && INPUT_PADDING.rightIcon,
          !hasLeftIcon && !hasRightIcon && INPUT_PADDING.default,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
export type { InputProps }
