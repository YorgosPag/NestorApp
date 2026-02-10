"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"
import { getDynamicTransformClass } from '@/components/ui/utils/dynamic-styles';

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  // Enterprise Progress Transform - Single Source of Truth
  const progressValue = value || 0;
  const clampedValue = Math.max(0, Math.min(100, progressValue));
  const translateValue = 100 - clampedValue;
  const progressTransformClass = getDynamicTransformClass(`translateX(-${translateValue}%)`);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full w-full flex-1 transition-all rounded-full bg-primary", progressTransformClass)}
      />
    </ProgressPrimitive.Root>
  );
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }






