"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"
import { getDynamicTransformClass } from '@/components/ui/utils/dynamic-styles';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import '@/lib/design-system';

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  /** Optional className applied to the inner fill (Radix Indicator). Use to
   * override the default control accent (ADR-770 §17 — was `bg-primary`, 1,18:1 on
   * the dark track) with semantic colors (success/warning/
   * error) without fighting Tailwind specificity via child-selectors. */
  indicatorClassName?: string;
};

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, indicatorClassName, value, ...props }, ref) => {
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
        className={cn(
          `h-full w-full flex-1 transition-all rounded-full ${COLOR_BRIDGE.selectionControl.fill}`,
          progressTransformClass,
          indicatorClassName,
        )}
      />
    </ProgressPrimitive.Root>
  );
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }






