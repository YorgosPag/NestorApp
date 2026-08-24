import type { LucideIcon } from "lucide-react"
import type { WorkspaceHref } from "@/lib/workspace/route-worlds"

export interface MenuItem {
  title: string
  icon: LucideIcon
  href: WorkspaceHref
  badge?: string | null
  subItems?: SubMenuItem[]
}

export interface SubMenuItem {
  title: string
  href: WorkspaceHref
  icon: LucideIcon
  warningDot?: boolean
}

export interface MenuSection {
  label: string
  items: MenuItem[]
}
