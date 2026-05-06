import type { LucideIcon } from "lucide-react"

export interface MenuItem {
  title: string
  icon: LucideIcon
  href: string
  badge?: string | null
  subItems?: SubMenuItem[]
}

export interface SubMenuItem {
  title: string
  href: string
  icon: LucideIcon
  warningDot?: boolean
}

export interface MenuSection {
  label: string
  items: MenuItem[]
}
