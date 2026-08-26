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

import { ShellSurface } from '@/core/containers/ShellSurface';
import { AuthToolbar } from '@/auth/components/AuthScreenChrome';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export default function AuthGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const layout = useLayoutClasses();
  const colors = useSemanticColors();

  return (
    <TooltipProvider delayDuration={300}>
      {/*
        ✅ **Η ΜΠΑΡΑ ΡΥΘΜΙΣΕΩΝ ΗΡΘΕ ΕΔΩ (2026-08-26, ADR-809 / CHECK 3.72).**

        🔴 **Μετρημένο κενό**: ζουσε σε **τρία** σημεία μέσα στο δέντρο της
        **σελίδας** (`AuthScreen` · `AuthActionContent`) — άρα οι δύο σελίδες που
        **δεν** περνούν από αυτά (`/oauth/consent` και `/mandate/[token]`) δεν είχαν
        **καμία** γλώσσα και **κανένα** θέμα. Το είδε η μέτρηση **ανά σελίδα**·
        μια μέτρηση ανά **γειτονιά** θα έλεγε «το (auth) έχει γλώσσα» — **αληθές
        και άσχετο**, γιατί η οθόνη που δεν την έχει εξακολουθεί να μην την έχει.

        🔑 **Μηδενική οπτική αλλαγή, και είναι δομικό**: το `authToolbar` είναι
        `fixed top-4 right-4` — η θέση του δεν εξαρτάται από το πού ζει στο δέντρο.

        ⚠️ **ΕΞΩ από το `ShellSurface`, επίτηδες**: εκείνο είναι `<main>` και
        κεντράρει το κύριο περιεχόμενο· μια μπάρα ρυθμίσεων **δεν** είναι
        κύριο περιεχόμενο, και μέσα στο `<main>` θα έμπαινε στη ροή ανάγνωσής
        του — και στον διάδρομο του ADR-797, που δεν την αφορά (είναι `fixed`).
      */}
      <AuthToolbar />
      {/*
        🏛️ Ο ΔΙΑΔΡΟΜΟΣ (ADR-797 ΦΑΣΗ Β). Το ίδιο `data-shell-surface`, οι ίδιοι
        πόλοι, μηδέν νέο CSS.

        ⚠️ **ΠΑΝΩ στο ΥΠΑΡΧΟΝ `<main>`, όχι σε νέο wrapper.** Το `shellAuthStandalone`
        είναι `min-h-screen … items-center justify-center` και το preflight του
        Tailwind ορίζει `box-sizing: border-box` παντού ⇒ ο διάδρομος ζει **ΜΕΣΑ**
        στο 100vh και **δεν** γεννά κάθετη κύλιση. Μετρημένο ζωντανά 2026-08-25:
        με τη σελίδα να **ξαναδηλώνει** `min-h-screen` προέκυπταν **48px** κύλιση
        (= 2×24 του κάθετου διαδρόμου)· χωρίς την επανάληψη, **0px**.

        ⚠️ **ΚΑΝΕΝΑ `measure`.** Εδώ δεν υπάρχει «γραμμή κειμένου» να περιοριστεί —
        υπάρχει **κάρτα** που κεντράρεται, και το πλάτος της το κατέχει η κάρτα.
      */}
      <ShellSurface as="main" className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}>
        {children}
      </ShellSurface>
    </TooltipProvider>
  );
}
