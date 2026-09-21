import type { LucideIcon } from "lucide-react"
import type { WorkspaceHref } from "@/lib/workspace/route-worlds"
import type { NavGroupNode, NavLinkNode } from "@/config/navigation-node"

/**
 * **ΤΟ ΕΝΑ συμβόλαιο «στοιχείου μενού»** (ADR-871 §10.6 Υ13). Ήταν πέντε δηλώσεις — εδώ
 * ζουν πλέον **όλες** οι στήλες (γραφείο **και** προσωπική) και το μενού του avatar.
 *
 * `navLabelKey` = κλειδί στο namespace `navigation`, **δηλωμένο** δίπλα στον προορισμό — ποτέ
 * συμπέρασμα από τη διεύθυνση (Υ16).
 */
export interface MenuLink extends NavLinkNode {
  readonly href: WorkspaceHref
  readonly navLabelKey: string
  readonly icon: LucideIcon
  readonly badge?: string | null
  /** Ένδειξη προσοχής (π.χ. κτίρια χωρίς μονάδες) — μόνο οπτική, `aria-hidden`. */
  readonly warningDot?: boolean
}

/** Ομάδα: κουμπί που ανοίγει — **χωρίς** διεύθυνση. Δύο επίπεδα το πολύ, από τον τύπο. */
export interface MenuGroup extends NavGroupNode<MenuLink> {
  readonly navLabelKey: string
  readonly icon: LucideIcon
  readonly badge?: string | null
}

export type MenuEntry = MenuLink | MenuGroup
