"use client"

import * as React from "react"
import { usePathname } from "@/lib/workspace/navigation"
import { resolveActiveNavigation } from "@/components/sidebar/active-navigation"
import type { MenuItem } from "@/types/sidebar"
import type { WorkspaceHref } from "@/lib/workspace/route-worlds"

export interface SidebarState {
  expandedItems: string[]
  toggleExpanded: (title: string) => void
  /** Το **ένα** ενεργό στοιχείο όλου του καταλόγου (ADR-871 §10.5 Υ11). */
  activeHref: WorkspaceHref | null
}

/**
 * Κατάσταση της στήλης: ποιες ομάδες είναι ανοιχτές και ποιο στοιχείο είναι η τρέχουσα σελίδα.
 *
 * @param items **Όλα** τα στοιχεία της στήλης, από όλες τις ενότητες — το ενεργό λύνεται
 *   μία φορά για τον κατάλογο, όχι ανά ενότητα (αλλιώς δύο ενότητες θα φώτιζαν από ένα).
 */
export function useSidebarState(items: readonly MenuItem[]): SidebarState {
  const pathname = usePathname()
  // Φθηνό (λίγες δεκάδες στοιχεία) ⇒ χωρίς memo: οι καταναλωτές δεν χρειάζεται να κρατούν
  // σταθερή αναφορά πίνακα, και η κατάσταση ανοίγματος συγκρίνει τίτλους, όχι αναφορές.
  const { activeHref, activeParentTitle } = resolveActiveNavigation(items, pathname)
  const [expandedItems, setExpandedItems] = React.useState<string[]>(
    activeParentTitle === null ? [] : [activeParentTitle]
  )

  // Ο γονιός του ενεργού ανοίγει **όταν αλλάζει** — όχι σε κάθε απόδοση: αν ο άνθρωπος
  // τον κλείσει, μένει κλειστός μέχρι την επόμενη πλοήγηση σε άλλη ομάδα (Primer NavList).
  // «State από αλλαγή τιμής», χωρίς effect ⇒ κανένα καρέ με κλειστό τον γονιό του ενεργού.
  const [openedFor, setOpenedFor] = React.useState(activeParentTitle)
  if (openedFor !== activeParentTitle) {
    setOpenedFor(activeParentTitle)
    if (activeParentTitle !== null && !expandedItems.includes(activeParentTitle)) {
      setExpandedItems([...expandedItems, activeParentTitle])
    }
  }

  const toggleExpanded = React.useCallback((title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    )
  }, [])

  return { expandedItems, toggleExpanded, activeHref }
}
