"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"
import { useIconSizes } from "@/hooks/useIconSizes"
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const iconSizes = useIconSizes()
  return (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      `inline-flex ${iconSizes.xl2} items-center justify-center rounded-md bg-muted p-1 text-muted-foreground`,
      className
    )}
    {...props}
  />
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const colors = useSemanticColors();

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background ${TRANSITION_PRESETS.STANDARD_ALL} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:${colors.bg.primary} data-[state=active]:text-foreground data-[state=active]:shadow-sm`,
        className
      )}
      {...props}
    />
  );
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "data-[state=inactive]:hidden",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

/**
 * 🏢 ENTERPRISE: TabsContent Design Principles
 *
 * 1. ZERO DEFAULT SPACING
 *    - No default margin-top
 *    - Use useSpacingTokens() hook for explicit spacing
 *
 * 2. HIDDEN STATE MANAGEMENT
 *    - Inactive tabs are hidden via data-[state=inactive]:hidden
 *    - Follows Radix UI data-state pattern (consistent με dialog/sheet/accordion)
 *    - Prevents layout overlap and scroll issues
 *
 * @example
 * ```tsx
 * const spacing = useSpacingTokens();
 * <TabsContent value="tab1" className={spacing.margin.top.sm}>
 *   Content 1
 * </TabsContent>
 * ```
 */

export { Tabs, TabsList, TabsTrigger, TabsContent }
