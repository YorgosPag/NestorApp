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
  /**
   * 🔢 **Τι μετρά αυτό το στοιχείο** (ADR-867 §4.5 Β10 · ADR-871 Π5) — η **πηγή**, όχι ο αριθμός. Ο κατάλογος
   * μένει στατικά δεδομένα· η τιμή λύνεται ζωντανά σε **ένα** hook (`useMenuCounts`) και αποδίδεται από το
   * `IconCountBadge` (ADR-854 — «99+», πραγματικός αριθμός στον αναγνώστη οθόνης).
   */
  readonly countSource?: MenuCountSource
}

/**
 * Οι πηγές μετρητή — **κλειστό** σύνολο. Νέα πηγή = νέα τιμή εδώ **και** ένα hook στο `useMenuCounts`
 * (ο `Record` εκεί αρνείται να μεταγλωττιστεί αν λείπει).
 */
export type MenuCountSource = 'network-unread'

/**
 * Η τιμή μιας πηγής. `atLeast` ⇒ ο αριθμός είναι **κάτω φράγμα** (η πηγή σταμάτησε να μετρά στην οροφή)·
 * ο αναγνώστης οθόνης ακούει «τουλάχιστον N», ποτέ έναν αριθμό που δεν ξέρουμε.
 */
export interface MenuCount {
  readonly count: number
  readonly atLeast: boolean
}

/** Ομάδα: κουμπί που ανοίγει — **χωρίς** διεύθυνση. Δύο επίπεδα το πολύ, από τον τύπο. */
export interface MenuGroup extends NavGroupNode<MenuLink> {
  readonly navLabelKey: string
  readonly icon: LucideIcon
  readonly badge?: string | null
}

export type MenuEntry = MenuLink | MenuGroup
