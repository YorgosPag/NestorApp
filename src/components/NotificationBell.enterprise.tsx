// components/NotificationBell.enterprise.tsx
'use client';

/**
 * @fileoverview **ΤΟ ΚΑΜΠΑΝΑΚΙ** — η **τέταρτη** καθολική δυνατότητα του κελύφους.
 * @related ADR-834 §2.5(α) · §6 Φάση Α · ADR-809 / CHECK 3.72 · ADR-807/813
 * @module components/NotificationBell.enterprise
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ — ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ **ΓΡΑΜΜΕΝΗ ΑΠΟΦΑΣΗ**, ΟΧΙ ΠΑΡΑΛΕΙΨΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `app-header.tsx` δήλωνε ρητά: *«ο `NotificationBell` … είναι **χαρακτηριστικά
 * ΤΗΣ ΕΦΑΡΜΟΓΗΣ**, όχι υποσχέσεις του κελύφους»*. Η δήλωση **μετρήθηκε ψευδής**
 * (ADR-834 §2.5α), και το χειρότερο ήταν ακριβώς ότι **υπήρχε γραμμένη** — το
 * μάθημα του CHECK 3.72 για τον `PrivateSpaceShell`: *«όχι παράλειψη, **λάθος
 * απόφαση γραμμένη**, που ο επόμενος θα σεβόταν»*.
 *
 * **Η μέτρηση που την ανέτρεψε** — ο αγωγός είναι **ολόκληρος** χτισμένος για
 * άνθρωπο **χωρίς εταιρεία**, σε **πέντε** κρίκους:
 *
 * | # | Κρίκος | Τι λέει |
 * |---|---|---|
 * | 1 | `firestore.rules:1430` | `resource.data.userId == request.auth.uid` — **όχι** `companyId` |
 * | 2 | `services/firestore/tenant-config.ts:40` | `NOTIFICATIONS: { mode: 'userId' }` |
 * | 3 | `services/notificationService.ts:163` | μοναδικό φίλτρο `where('userId','==',userId)` |
 * | 4 | `hooks/useFirestoreNotifications.ts:36-46` | *«"ΔΕΝ ΕΧΕΙΣ ΕΤΑΙΡΕΙΑ" ΔΕΝ ΕΙΝΑΙ ΒΛΑΒΗ»* |
 * | 5 | `mandate-request-notifier.service.ts:121` | `tenantId: recipientUserId` — ο **ίδιος ο άνθρωπος** |
 *
 * ⇒ Ο ιδιώτης έπαιρνε ειδοποίηση *«το γραφείο απάντησε»* γραμμένη **σωστά** στη
 * βάση, και **καμία οθόνη που μπορεί να φτάσει δεν την αποδίδει**: το `(me)` φοράει
 * `PrivateSpaceShell → PublicSiteHeader → ShellUtilities`, όπου καμπανάκι **δεν
 * υπήρχε**. Λάθος ήταν **μόνο το σημείο ανάρτησης** — γι' αυτό η θεραπεία είναι
 * **μετακίνηση**, όχι κατασκευή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΚΑΜΠΑΝΑΚΙ ΚΑΤΕΧΕΙ ΤΗ **ΣΥΝΔΡΟΜΗ** — ΚΑΙ ΕΙΝΑΙ Ο ΠΥΡΗΝΑΣ ΤΗΣ ΔΙΟΡΘΩΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-08-30 η συνδρομή ζούσε στο `app-header.tsx` και το καμπανάκι εδώ —
 * **δύο** αρχεία για **ένα** γεγονός. Έτσι έγινε δυνατή η βλάβη: το καμπανάκι
 * μπορούσε να λείπει **ενώ** η συνδρομή έτρεχε, και **αντίστροφα**.
 *
 * Τώρα *«υπάρχει καμπανάκι»* ⟺ *«τρέχει συνδρομή»*, **δομικά**. Καμία οθόνη δεν
 * μπορεί να δείξει μετρητή που δεν τροφοδοτείται, και καμία συνδρομή δεν τρέχει
 * χωρίς να τη βλέπει άνθρωπος.
 *
 * ⚠️ **ΕΝΑΣ καταναλωτής, γι' αυτό ΕΝΑ `useEffect`**: ο ιδιοκτήτης
 * ({@link ShellUtilities}) αποδίδεται **μία φορά ανά σελίδα** (CHECK 3.72 Κ1+Κ3),
 * άρα δεν γεννιούνται διπλές συνδρομές. **ΜΗΝ** αποδώσεις δεύτερο καμπανάκι.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΥΤΟΚΡΥΒΕΤΑΙ — ΤΟ **ΙΔΙΟ** ΙΔΙΩΜΑ ΜΕ ΤΟ `UserMenu`, ΚΑΙ ΟΧΙ ΤΥΧΑΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `.shell-utilities.json` απαγορεύει ρητά `useAuth()` **μέσα στο
 * `ShellUtilities`** — θα ήταν **δεύτερη απάντηση** στο «υπάρχει άνθρωπος;». Η
 * απάντηση ζει στα **φύλλα**: το `UserMenu` ήδη κάνει `if (!user) return null`,
 * και **γι' αυτό** το `(auth)` είναι σωστό **δομικά, χωρίς καμία δήλωση**.
 *
 * Το καμπανάκι ακολουθεί **τον ίδιο** δρόμο. Ένας φρουρός γραμμένος στον
 * συναρμολογητή θα ήταν ακριβώς το λάθος που το ADR-809 έσβησε.
 *
 * ⚠️ **`enabled` ΔΕΝ χρειάζεται δεύτερο κριτήριο**: η πρόωρη επιστροφή παρακάτω
 * σημαίνει ότι ο κώδικας της συνδρομής **δεν εκτελείται καν** χωρίς ταυτότητα —
 * αλλά η σημαία μένει ρητή, γιατί οι κανόνες των hooks απαιτούν η κλήση να είναι
 * **άνευ όρων**. Δύο πράγματα, μία αλήθεια: το `user?.uid`.
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationDrawer } from '@/stores/notificationDrawer';
import { useNotificationCenter } from '@/stores/notificationCenter';
import { useFirestoreNotifications } from '@/hooks/useFirestoreNotifications';
import { useAuth } from '@/auth';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function NotificationBell() {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { user } = useAuth();
  const open = useNotificationDrawer(s => s.open);
  const isOpen = useNotificationDrawer(s => s.isOpen);
  const unread = useNotificationCenter(s => s.unread);

  // 🔑 Η ΣΥΝΔΡΟΜΗ ΖΕΙ ΕΔΩ — δες την κεφαλίδα. Κλήση **άνευ όρων** (κανόνες hooks)·
  //    το κριτήριο είναι το `user?.uid`, **ένα** και το ίδιο με την ορατότητα.
  useFirestoreNotifications({
    userId: user?.uid ?? '',
    enabled: Boolean(user?.uid),
  });

  // ⚠️ **ΜΕΤΑ** τα hooks, ποτέ πριν. Ίδιο ιδίωμα με το `UserMenu`.
  if (!user) return null;

  const label = t('notifications.title');

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={open}
      aria-label={label}
      aria-expanded={isOpen}
      aria-controls="notification-drawer"
      className="relative"
    >
      <Bell className={iconSizes.sm} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute top-0 -right-0.5 bg-destructive text-destructive-foreground text-xs px-1.5 rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Button>
  );
}
