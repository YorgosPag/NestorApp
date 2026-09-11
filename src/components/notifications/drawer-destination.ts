/**
 * @fileoverview **Πού πάει το «Προβολή» του κουδουνιού** — μία κρίση, έξω από το render.
 * @related ADR-849 §6δ Β1 · ADR-848 · ADR-841 §7 Α18
 * @module components/notifications/drawer-destination
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ: ΤΟ ΚΟΥΔΟΥΝΙ ΕΒΑΖΕ ΤΟΝ ΧΩΡΟ ΤΟΥ ΘΕΑΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο drawer έκανε `router.push(url)` με την **ωμή** διαδρομή της ειδοποίησης, και το
 * σύνορο πλοήγησης πρόσθετε το ψευδώνυμο της **τρέχουσας** διεύθυνσης. Ο μεσίτης που
 * κοιτούσε το γραφείο Α και πατούσε ειδοποίηση για ακίνητο του γραφείου Β έφτανε σε
 * `/o/Α/properties/<του Β>` ⇒ «Το ακίνητο δεν βρέθηκε».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΛΥΣΗ: ΤΟ ΚΟΥΔΟΥΝΙ ΠΕΡΝΑ ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΟΡΤΑ ΜΕ ΤΟ EMAIL
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `/n/{id}?via=inapp` — όπως το `app_redirect` του Slack είναι η **μία** πόρτα κάθε
 * πελάτη του. Ο χώρος-στόχος λύνεται **μία** φορά, στον διακομιστή: το ψευδώνυμο το
 * επιτρέπεται να το λύσει **μόνο** αυτός (άγκυρα `Λ2`, ADR-787). Δεύτερη υλοποίηση στον
 * πελάτη θα ήταν δεύτερη απάντηση σε ερώτηση ασφαλείας.
 *
 * ⚠️ Κόστος: **ένα** ταξίδι στον διακομιστή ανά κλικ (ανακατεύθυνση RSC). Όλα τα layouts
 * κρέμονται από **έναν** root (`app/layout.tsx`), άρα η μετάβαση μένει soft — καμία
 * πλήρης επαναφόρτωση.
 */

import { firstActionUrl } from '@/lib/notifications/notification-destination';
import { notificationPermalinkHref } from '@/lib/notifications/notification-permalink-route';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import type { Notification } from '@/types/notification';

/** Τρεις δρόμοι — ονομασμένοι, ώστε ο drawer να ξέρει **ποιος γράφει** το «ανοίχτηκε». */
export type DrawerDestination =
  /** Αποθηκευμένος προορισμός ⇒ ο μόνιμος σύνδεσμος (λύνει χώρο **και** γράφει «ανοίχτηκε»). */
  | { readonly kind: 'permalink'; readonly href: string }
  /** Εξωτερική διεύθυνση ⇒ νέα καρτέλα. */
  | { readonly kind: 'external'; readonly href: string }
  /** Παλιό έγγραφο **χωρίς** `actions` (πριν το ADR-841 Α18) — οι δύο ιστορικές ευρετικές. */
  | { readonly kind: 'legacy'; readonly href: string };

type DrawerNotification = Pick<Notification, 'id' | 'actions' | 'source' | 'title'>;

const EXTERNAL_URL = /^https?:\/\//i;

/**
 * **Πού οδηγεί το «Προβολή»** — ή `null` (δεν αποδίδεται κουμπί).
 *
 * ⛔ **Οι δύο ευρετικές ΔΕΝ επεκτείνονται** (ADR-841 §7 Α18): υπάρχουν για έγγραφα που
 * γράφτηκαν πριν οι παραγωγοί δηλώνουν προορισμό. Μια τρίτη θα έσπαγε με κάθε αλλαγή
 * κειμένου — ο προορισμός ανήκει στον **παραγωγό**.
 */
export function drawerDestination(n: DrawerNotification): DrawerDestination | null {
  const stored = firstActionUrl(n.actions);
  if (typeof stored === 'string' && stored.length > 0) {
    if (stored.startsWith('/') && !stored.startsWith('//')) {
      return { kind: 'permalink', href: notificationPermalinkHref(n.id, 'inapp') };
    }
    return EXTERNAL_URL.test(stored) ? { kind: 'external', href: stored } : null;
  }

  const isLegacyInbox =
    n.source?.feature === 'ai-inbox' || n.title?.toLowerCase().includes('message') === true;
  return isLegacyInbox ? { kind: 'legacy', href: APP_ROUTES.aiInbox } : null;
}
