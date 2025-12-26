"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIconSizes } from "@/hooks/useIconSizes"
import { useBorderTokens } from "@/hooks/useBorderTokens"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  const iconSizes = useIconSizes();
  const { quick, getElementBorder } = useBorderTokens();

  return (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      `peer ${iconSizes.sm} shrink-0 ${quick.rounded} ${getElementBorder('input')} ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground`,
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
