import * as React from "react"

import { cn } from "@/lib/utils"
import { useBorderTokens } from "@/hooks/useBorderTokens"
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors"

// =============================================================================
// 🏢 ENTERPRISE INPUT COMPONENT
// =============================================================================
// Pattern: Microsoft Fluent UI / Google Material Design / Ant Design
// Proper icon support via props instead of CSS override hacks
// =============================================================================

interface InputProps extends React.ComponentProps<"input"> {
  /** Has icon on the left side - applies correct padding */
  hasLeftIcon?: boolean;
  /** Has icon on the right side - applies correct padding */
  hasRightIcon?: boolean;
}

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
  ({ className, type, hasLeftIcon, hasRightIcon, ...props }, ref) => {
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
      "disabled:cursor-not-allowed disabled:opacity-50",
    ].join(" ");

    return (
      <input
        type={type}
        className={cn(
          baseStyles,
          "h-12 md:h-9 py-3 md:py-2", // Default height - can be overridden by className
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
