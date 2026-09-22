"use client"

/**
 * ADR-871 §10.6 — ό,τι μοιράζονται ο **σύνδεσμος** και η **ομάδα** της στήλης.
 *
 * Το `sidebar-menu-item.tsx` ήταν ένα component με τέσσερις κλάδους (ομάδα/σύνδεσμος ×
 * ανοιχτή/συμπτυγμένη στήλη)· με το ένα συμβόλαιο (`MenuLink | MenuGroup`) χωρίστηκε κατά
 * **είδος**, και ό,τι επαναλαμβανόταν ζει εδώ **μία** φορά (N.18 — ένα σώμα, όχι δίδυμα).
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"
import { SidebarBadge } from "@/components/sidebar/sidebar-badge"
import { MenuCountBadge } from "@/components/sidebar/menu-count-badge"
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { preloadOnHover, getPreloadableRouteFromHref } from '@/utils/preloadRoutes'
import type { JobRevealView } from "@/hooks/useJobFilteredNavigation"
import type { MenuEntry, MenuLink } from "@/types/sidebar"

/**
 * ADR-748 **Α-2 — υποβάθμιση πριν από εξαφάνιση** *(πρότυπο: το half-tone του
 * Revit)*. Κατά την «Αποκάλυψη» το κρυμμένο στοιχείο ξαναμπαίνει **στη θέση
 * του**, οπτικά υποχωρημένο αλλά **πλήρως λειτουργικό**: η δουλειά είναι
 * ετικέτα ορατότητας, **ποτέ** πύλη (§14.5) — άρα απενεργοποίησή του θα
 * προσποιούνταν περιορισμό που δεν υπάρχει (Ε14.ζ).
 */
const DEMOTED_CLASS = "opacity-50 saturate-50"

/** @param key κλειδί κόμβου (`navNodeKey`): href συνδέσμου ή id ομάδας. */
export function demotedClass(reveal: JobRevealView | undefined, key: string): string | false {
  return reveal?.isRevealing === true && reveal.hiddenKeys.has(key) && DEMOTED_CLASS
}

/** Πόσα παιδιά λείπουν από **αυτή** την ομάδα (Επίπεδο 2). */
export function hiddenHereCount(reveal: JobRevealView | undefined, groupId: string): number {
  // Στην «Αποκάλυψη» τα στοιχεία είναι ήδη ορατά — ο δείκτης θα ήταν αντιφατικός.
  if (reveal === undefined || reveal.isRevealing) return 0
  return reveal.hiddenSubItemCountByParent.get(groupId) ?? 0
}

/**
 * Η συμπεριφορά που μοιράζονται **όλοι** οι σύνδεσμοι της στήλης: μετάφραση τίτλου,
 * κλείσιμο του συρταριού στο κινητό, προφόρτωση στο hover.
 *
 * ⚠️ **ΜΗΝ ΒΑΛΕΙΣ ΦΡΟΥΡΟ ΕΤΟΙΜΟΤΗΤΑΣ** (`if (isLoading) return key`): ήταν εδώ, και επειδή
 * το `useEffect` δεν τρέχει ποτέ σε SSR, ο server έστελνε **ωμά κλειδιά** σε κάθε διαδρομή
 * (μετρημένο 2026-08-09). Ο `useTranslation` αρχικοποιεί σύγχρονα — σωστός σε SSR.
 * Ο τίτλος είναι πλέον **πάντα** δηλωμένο κλειδί (ADR-871 §10.6 Υ16) ⇒ σκέτο `t(navLabelKey)`.
 */
export function useSidebarLinkBehavior() {
  const { isMobile, setOpenMobile } = useSidebar()
  const { t } = useTranslation('navigation')
  const onNavigate = React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])
  return { t, onNavigate }
}

/** Προφόρτωση του κώδικα της διαδρομής στο hover — κενό όταν η διαδρομή δεν προφορτώνεται. */
export function prefetchHandlersFor(href: string) {
  const preloadableRoute = getPreloadableRouteFromHref(href)
  return preloadableRoute ? preloadOnHover(preloadableRoute) : {}
}

/** Η κίτρινη κουκκίδα προσοχής — μόνο οπτική (`aria-hidden`). */
export function WarningDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--text-warning))]", className)}
      aria-hidden
    />
  )
}

/**
 * Το κοινό σώμα ενός κόμβου πρώτου επιπέδου: **εικονίδιο · τίτλος · σήμα**.
 *
 * ⚠️ Εξήχθη επειδή το CHECK 3.28 (jscpd) το έπιασε ως structural clone: το ίδιο σώμα
 * αποδιδόταν στο κουμπί της ομάδας και στον απλό σύνδεσμο. Ένα σώμα, όχι δίδυμα.
 */
export function SidebarItemLabel({
  item,
  title,
}: {
  item: MenuEntry
  title: string
}) {
  const Icon = item.icon
  return (
    <>
      <Icon className={TRANSITION_PRESETS.STANDARD_ALL} />
      <span className="font-medium">{title}</span>
      {item.badge && <SidebarBadge badge={item.badge} />}
      {item.kind === "link" && item.countSource !== undefined && (
        <MenuCountBadge source={item.countSource} placement="inline-end" />
      )}
    </>
  )
}

/** Το σώμα ενός συνδέσμου **μέσα** σε ομάδα (λίστα ή popover): εικονίδιο · τίτλος · κουκκίδα. */
export function SubLinkBody({ link, title, iconClassName }: {
  link: MenuLink
  title: string
  iconClassName: string
}) {
  const Icon = link.icon
  return (
    <>
      <Icon className={iconClassName} />
      <span>{title}</span>
      {link.warningDot && <WarningDot className="ml-auto" />}
    </>
  )
}
