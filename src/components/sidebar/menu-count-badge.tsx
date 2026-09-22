"use client"

/**
 * 🔢 **Ο ΜΕΤΡΗΤΗΣ ΕΝΟΣ ΣΤΟΙΧΕΙΟΥ ΜΕΝΟΥ** — στήλη (ανοιχτή ή συμπτυγμένη) **και** μενού avatar (ADR-871 Π5 ·
 * ADR-867 §4.5 Β10).
 *
 * Ο κατάλογος δηλώνει **πηγή** (`MenuLink.countSource`)· εδώ η πηγή γίνεται αριθμός. Κάθε πηγή είναι **δικό της**
 * component που καλεί **το δικό της** hook — ποτέ hook υπό συνθήκη, και αλλαγή πηγής = άλλο component, άρα σωστό
 * remount. Ο `Record` αρνείται να μεταγλωττιστεί αν μια πηγή του κλειστού συνόλου μείνει χωρίς component.
 *
 * ♿ Ο αριθμός μπαίνει στο **προσβάσιμο όνομα** του συνδέσμου μέσω του `sr-only` του `IconCountBadge` («Τα μηνύματά
 * μου, 3 αδιάβαστες συνομιλίες»), ακέραιος — το «99+» είναι μόνο οπτικό. **Χωρίς** `aria-live`: η καμπάνα ήδη
 * ανακοινώνει το ίδιο γεγονός.
 */

import * as React from "react"
import { IconCountBadge, type IconCountBadgePlacement } from "@/core/badges"
import { useNetworkUnreadCount } from "@/hooks/network-messaging/useNetworkUnreadCount"
import type { MenuCount, MenuCountSource } from "@/types/sidebar"

/**
 * 🔒 Οι θέσεις που **χωρούν** σε στοιχείο μενού. Κάθε στοιχείο (στήλη, μενού avatar) αποδίδεται μέσα σε κουτί που
 * **κόβει** (`SidebarMenuButton` = `overflow-hidden`)· το `top-end`/`top-start` βγαίνει 4px έξω και κόβεται — μετρημένο
 * ζωντανά στη συμπτυγμένη στήλη (ADR-867 2026-09-22). Ο **τύπος** το αποκλείει, όχι μια σύμβαση.
 */
type MenuCountPlacement = Extract<IconCountBadgePlacement, "inline-end" | "top-end-inset">

interface SourceBadgeProps {
  readonly placement: MenuCountPlacement
}

interface AnnounceRef {
  readonly ns: string
  readonly key: string
}

/** Τι ακούει ο αναγνώστης οθόνης — **ακριβής** αριθμός ή **κάτω φράγμα** («τουλάχιστον 100»). */
const ANNOUNCE: Readonly<Record<MenuCountSource, { readonly exact: AnnounceRef; readonly atLeast: AnnounceRef }>> = {
  "network-unread": {
    exact: { ns: "navigation", key: "personal.unread.threads" },
    atLeast: { ns: "navigation", key: "personal.unread.threadsAtLeast" },
  },
}

function CountBadge({ value, source, placement }: SourceBadgeProps & { readonly value: MenuCount; readonly source: MenuCountSource }) {
  return (
    <IconCountBadge
      count={value.count}
      tone="count"
      placement={placement}
      announce={value.atLeast ? ANNOUNCE[source].atLeast : ANNOUNCE[source].exact}
      data-testid={`menu-count-${source}`}
    />
  )
}

function NetworkUnreadBadge({ placement }: SourceBadgeProps) {
  return <CountBadge value={useNetworkUnreadCount()} source="network-unread" placement={placement} />
}

const BADGE_BY_SOURCE: Readonly<Record<MenuCountSource, React.ComponentType<SourceBadgeProps>>> = {
  "network-unread": NetworkUnreadBadge,
}

export function MenuCountBadge({ source, placement }: SourceBadgeProps & { readonly source: MenuCountSource }) {
  const Badge = BADGE_BY_SOURCE[source]
  return <Badge placement={placement} />
}
