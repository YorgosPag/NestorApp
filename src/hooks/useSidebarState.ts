"use client"

import * as React from "react"
import { usePathname } from "@/lib/workspace/navigation"
import { resolveActiveNavigation } from "@/components/sidebar/active-navigation"
import type { MenuEntry } from "@/types/sidebar"
import type { WorkspaceHref } from "@/lib/workspace/route-worlds"

export interface SidebarState {
  /** Τα `id` των ανοιχτών ομάδων — ταυτότητα, όχι τίτλος (ADR-871 §10.6 Υ20). */
  expandedItems: string[]
  toggleExpanded: (groupId: string) => void
  /** Ο **ένας** ενεργός σύνδεσμος όλου του καταλόγου (ADR-871 §10.5 Υ11). */
  activeHref: WorkspaceHref | null
}

/**
 * Κατάσταση της στήλης: ποιες ομάδες είναι ανοιχτές και ποιος σύνδεσμος είναι η τρέχουσα σελίδα.
 *
 * @param entries **Όλοι** οι κόμβοι της στήλης, από όλες τις ενότητες — το ενεργό λύνεται
 *   μία φορά για τον κατάλογο, όχι ανά ενότητα (αλλιώς δύο ενότητες θα φώτιζαν από ένα).
 */
export function useSidebarState(entries: readonly MenuEntry[]): SidebarState {
  const pathname = usePathname()
  // Φθηνό (λίγες δεκάδες κόμβοι) ⇒ χωρίς memo: οι καταναλωτές δεν χρειάζεται να κρατούν
  // σταθερή αναφορά πίνακα, και η κατάσταση ανοίγματος συγκρίνει ταυτότητες, όχι αναφορές.
  const { activeHref, activeGroupId } = resolveActiveNavigation(entries, pathname)
  const [expandedItems, setExpandedItems] = React.useState<string[]>(
    activeGroupId === null ? [] : [activeGroupId]
  )

  // Η ομάδα του ενεργού ανοίγει **όταν αλλάζει** — όχι σε κάθε απόδοση: αν ο άνθρωπος
  // την κλείσει, μένει κλειστή μέχρι την επόμενη πλοήγηση σε άλλη ομάδα (Primer NavList).
  // «State από αλλαγή τιμής», χωρίς effect ⇒ κανένα καρέ με κλειστή την ομάδα του ενεργού.
  const [openedFor, setOpenedFor] = React.useState(activeGroupId)
  if (openedFor !== activeGroupId) {
    setOpenedFor(activeGroupId)
    if (activeGroupId !== null && !expandedItems.includes(activeGroupId)) {
      setExpandedItems([...expandedItems, activeGroupId])
    }
  }

  const toggleExpanded = React.useCallback((groupId: string) => {
    setExpandedItems((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }, [])

  return { expandedItems, toggleExpanded, activeHref }
}
