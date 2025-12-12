"use client"

import * as React from "react"
import { CommonBadge } from "@/core/badges"
import { cn } from "@/lib/utils"
import { getBadgeVariant } from "@/lib/sidebar-utils"
import { TRANSITION_PRESETS } from '@/components/ui/effects'

interface SidebarBadgeProps {
  badge: string
}

export function SidebarBadge({ badge }: SidebarBadgeProps) {
  return (
    <CommonBadge
      status="company"
      customLabel={badge}
      variant="secondary"
      className={cn(
        "ml-auto",
        TRANSITION_PRESETS.STANDARD_ALL,
        getBadgeVariant(badge)
      )}
    />
  )
}
