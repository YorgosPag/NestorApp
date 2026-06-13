"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

// ✅ ENTERPRISE FIX: Use relative paths instead of @ aliases
import { cn } from "../../lib/utils"
import '@/lib/design-system';

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  // ✅ ENTERPRISE FIX: Simplified approach without problematic hooks

  return (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      // Orientation-aware (Radix sets data-orientation). Horizontal = original look.
      "relative flex touch-none select-none",
      "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:items-center",
      // items-center is required on the cross axis so the wider thumb (w-5) stays centred
      // over the narrow track (w-2); without it flex-col aligns both to flex-start → off-centre thumb.
      "data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-center data-[orientation=vertical]:justify-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-primary/30 data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2">
      <SliderPrimitive.Range className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
