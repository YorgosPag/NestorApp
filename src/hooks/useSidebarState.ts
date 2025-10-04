"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

export function useSidebarState() {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = React.useState<string[]>([])

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    )
  }

  const isItemActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/")
  }

  // Automatically expand parent menu if a sub-item is active
  React.useEffect(() => {
    // This logic needs access to the menu items to find the parent
    // of the active item. For simplicity, this is omitted for now,
    // but in a real app you would pass the menu items to the hook
    // and find the parent of the active `pathname`.
  }, [pathname])

  return { expandedItems, toggleExpanded, isItemActive }
}
