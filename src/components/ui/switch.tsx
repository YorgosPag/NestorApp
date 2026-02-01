"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"
import { useIconSizes } from "@/hooks/useIconSizes"
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors"
// 🏢 ADR-128: Centralized Switch Tokens
import { COLOR_BRIDGE } from "@/design-system/color-bridge"

/**
 * 🏢 ENTERPRISE SWITCH VARIANTS (ADR-128)
 * - default: Primary color when ON, input color when OFF
 * - status: Green when ON, Red when OFF (for visibility toggles)
 * - success: Green when ON, muted when OFF
 * - destructive: Red when ON, muted when OFF
 */
type SwitchVariant = keyof typeof COLOR_BRIDGE.switch;

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  /** 🎨 Switch color variant (default | status | success | destructive) */
  variant?: SwitchVariant;
}

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, variant = 'default', ...props }, ref) => {
  const iconSizes = useIconSizes()
  const colors = useSemanticColors()

  // 🏢 ADR-128: Get variant-specific colors from centralized tokens
  const variantTokens = COLOR_BRIDGE.switch[variant];

  return (
  <SwitchPrimitives.Root
    className={cn(
      `peer inline-flex ${iconSizes.lg} w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50`,
      variantTokens.checked,
      variantTokens.unchecked,
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        `pointer-events-none block ${iconSizes.md} rounded-full ${colors.bg.primary} shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0`
      )}
    />
  </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
export type { SwitchVariant }
