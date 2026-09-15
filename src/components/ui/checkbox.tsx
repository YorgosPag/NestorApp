"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIconSizes } from "@/hooks/useIconSizes"
import { useBorderTokens } from "@/hooks/useBorderTokens"
// ☑️ ADR-770 §17: ρόλος χειριστηρίου επιλογής — ΠΟΤΕ `primary` (επιφάνεια, ≡ --card στο σκοτεινό)
import { COLOR_BRIDGE } from "@/design-system/color-bridge"
import '@/lib/design-system';

const control = COLOR_BRIDGE.selectionControl;

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  return (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      `peer ${iconSizes.sm} shrink-0 ${quick.rounded} border ${control.outline} ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${control.checkedOutline} ${control.checkedFill} ${control.checkedInk}`,
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className={iconSizes.sm} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
