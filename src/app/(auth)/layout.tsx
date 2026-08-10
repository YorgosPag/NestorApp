'use client';

/**
 * 🔐 ΟΘΟΝΕΣ ΤΑΥΤΟΠΟΙΗΣΗΣ — route group `(auth)`   (ADR-777 §8.12)
 *
 * Το σώμα είναι **αυτούσιο** το `AuthLayout` του `ConditionalAppShell` (γρ. 124-133).
 * Αυτό που άλλαξε δεν είναι η όψη — είναι **ποιος αποφασίζει ποιος τη φοράει**.
 *
 * 🔴 **ΤΟ ΜΕΤΡΗΜΕΝΟ ΣΦΑΛΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΙ Η ΜΕΤΑΚΟΜΙΣΗ.** Η λίστα `AUTH_ROUTES`
 * είχε αποκλίνει από τον φάκελο **και προς τις δύο κατευθύνσεις**:
 *
 *  · **ονόμαζε τρεις ανύπαρκτες** διαδρομές — `/register`, `/forgot-password`,
 *    `/reset-password` (καμία δεν έχει `page.tsx`, μετρημένο 2026-08-10)·
 *  · **δεν ονόμαζε** το `/oauth/consent`, που ζει σε **αυτό ακριβώς** το group και
 *    του οποίου το docblock γράφει «*η οθόνη δεν χρειάζεται τίποτα από το app
 *    shell*» (ADR-738). Η φωτογραφία «ΠΡΙΝ» το μέτρησε να σερβίρει **65×**
 *    `data-sidebar` — δηλαδή **ολόκληρο** το κέλυφος, ενώ ο συγγραφέας του είχε
 *    γράψει το αντίθετο.
 *
 * Δύο αλήθειες με **όνομα** η καθεμία, που διαφωνούσαν σιωπηλά (σχήμα ADR-749).
 * Πλέον υπάρχει **μία**: ο φάκελος.
 *
 * ⚠️ Ο `TooltipProvider` **διατηρείται**. Μετρήθηκε ότι καμία οθόνη `(auth)` δεν
 * αποδίδει Tooltip σήμερα, αλλά η κλειστότητά τους δεν αποδείχθηκε εξαντλητικά και
 * ένα `<Tooltip>` **χωρίς** provider **πετάει**. Σε μηχανική μετακόμιση, ο
 * συντηρητικός δρόμος είναι η διατήρηση: μηδέν DOM, μηδέν κόστος, μηδέν ρίσκο.
 *
 * @module app/(auth)/layout
 */

import { TooltipProvider } from '@/components/ui/tooltip';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export default function AuthGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const layout = useLayoutClasses();
  const colors = useSemanticColors();

  return (
    <TooltipProvider delayDuration={300}>
      <main className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}>
        {children}
      </main>
    </TooltipProvider>
  );
}
