"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getBadgeVariant } from "@/lib/sidebar-utils"

interface SidebarBadgeProps {
  badge: string
}

export function SidebarBadge({ badge }: SidebarBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "ml-auto transition-all duration-200",
        getBadgeVariant(badge)
      )}
    >
      {badge}
    </Badge>
  )
}
