"use client"

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import * as React from "react"
import dynamic from "next/dynamic"
import { Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ShellUtilities } from "@/core/containers/ShellUtilities"
import { HelpButton } from "@/components/header/help-button"
import { VoiceAssistantButton } from "@/components/header/voice-assistant-button"
import { CompanySwitcher } from "@/components/header/CompanySwitcher"
import { JobSwitch } from "@/components/header/JobSwitch"
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors"
import { useTranslation } from "@/i18n/hooks/useTranslation"
import { cn } from "@/lib/utils"
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS } from "@/components/ui/effects"
import '@/lib/design-system';

// ⚡ ENTERPRISE PERFORMANCE (2026-01-27): Dynamic import for GlobalSearchDialog
// Pattern: Google, Vercel, Microsoft - Heavy dialogs loaded only when opened
// Impact: 532 lines (25KB) deferred until user clicks search button
// NOTE: Using `loading: () => null` instead of `ssr: false` to avoid
// double TypeScript compilation overhead (server + client separate passes)
const GlobalSearchDialog = dynamic(
  () => import("@/components/search").then(mod => ({ default: mod.GlobalSearchDialog })),
  { loading: () => null }
)

export function AppHeader() {
  const { t } = useTranslation(COMMON_NAMESPACES);

  // 🔍 Global Search Dialog state
  const [searchOpen, setSearchOpen] = React.useState(false);


  // 🌉 BRIDGE: Semantic colors
  const colors = useSemanticColors();

  return (
    <header className={`sticky top-0 z-50 w-full max-w-full border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60 overflow-hidden`}>
      <div className="flex items-center justify-between px-1 sm:px-4 py-1 w-full max-w-full overflow-hidden">
        <SidebarTrigger />

        {/* 🔍 Global Search Button */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md",
            "text-sm", colors.text.muted,
            "bg-muted/50 border border-border/50",
            TRANSITION_PRESETS.SMOOTH_ALL,
            HOVER_BACKGROUND_EFFECTS.MUTED,
            "hover:text-foreground hover:border-border"
          )}
        >
          <Search className="h-4 w-4" />
          {/* 🏢 ENTERPRISE (2026-01-27): suppressHydrationWarning for i18n content
              Server renders with default locale (en), client renders with user locale (el)
              This is expected behavior for i18n - suppress the hydration warning */}
          <span className="hidden md:inline" suppressHydrationWarning>
            {t('search.placeholder', 'Search...')}
          </span>
          <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-background rounded border">
            ⌘K
          </kbd>
        </button>

        {/* 🔍 Mobile Search Icon */}
        {/* 🏢 ENTERPRISE (2026-01-27): suppressHydrationWarning for i18n aria-label */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(
            "sm:hidden p-2 rounded-md", colors.text.muted,
            TRANSITION_PRESETS.STANDARD_COLORS,
            "hover:text-foreground hover:bg-muted"
          )}
          aria-label={t('search.globalSearch', 'Global Search')}
          suppressHydrationWarning
        >
          <Search className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 px-2 flex-shrink-0">
          {/* ADR-748 Ε6.β — η ΔΟΥΛΕΙΑ έχει δικό της, μόνιμα ορατό χειριστήριο,
              ΕΞΩ από το μονοπάτι *οργανισμός › έργο* (πρότυπο: Figma Dev Mode).
              Το μονοπάτι της Φάσης 4 θα χτιστεί ΑΡΙΣΤΕΡΑ — δεν αντικαθιστά
              αυτό εδώ. ⚠️ Το `CompanySwitcher` δίπλα είναι ο ΟΡΓΑΝΙΣΜΟΣ. */}
          <JobSwitch />
          <CompanySwitcher />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <VoiceAssistantButton />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <HelpButton />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          {/*
            ✅ ADR-809 / CHECK 3.72 — οι ΚΑΘΟΛΙΚΕΣ δυνατότητες (γλώσσα · θέμα ·
            λογαριασμός) έρχονται πλέον από ΕΝΑΝ ιδιοκτήτη. Εδώ ήταν γραμμένες
            χωριστά, και δίπλα τους ζούσε ΔΕΥΤΕΡΟΣ συναρμολογητής
            (`AuthScreenChrome`) — δύο αλήθειες που είχαν ήδη αποκλίνει: εκείνος
            έδινε δύο από τις τρεις, και ΚΑΝΕΙΣ δεν τις έδινε στο (light)/(me).

            ⚠️ Ό,τι ΜΕΝΕΙ εδώ πάνω είναι σκόπιμα ΜΗ καθολικό: το `JobSwitch` και
            ο `CompanySwitcher` προϋποθέτουν οργανισμό· ο `VoiceAssistantButton`
            και το `HelpButton` είναι χαρακτηριστικά ΤΗΣ ΕΦΑΡΜΟΓΗΣ, όχι
            υποσχέσεις του κελύφους.

            🔴 Ο `NotificationBell` ΕΦΥΓΕ ΑΠΟ ΕΔΩ (ADR-834 §2.5α, 2026-08-30).
            Αυτή η ίδια παράγραφος τον απαριθμούσε ως «χαρακτηριστικό ΤΗΣ
            ΕΦΑΡΜΟΓΗΣ» — και ήταν ΓΡΑΜΜΕΝΗ ΑΠΟΦΑΣΗ, δηλαδή χειρότερη από
            παράλειψη: ο επόμενος θα τη σεβόταν. Μετρήθηκε ψευδής σε ΠΕΝΤΕ
            κρίκους, όλους ΤΑΥΤΟΤΗΤΑΣ και όχι χώρου — ο κανόνας Firestore ρωτά
            `userId == auth.uid` (γρ. 1430), το `tenant-config.ts:40` δηλώνει
            `mode: userId`, και το `useFirestoreNotifications` χειρίζεται ΡΗΤΑ
            την απουσία εταιρείας. Ο ιδιώτης έπαιρνε «το γραφείο απάντησε» και
            ΚΑΜΙΑ οθόνη του δεν το απέδιδε.

            ⚠️ Και η ΣΥΝΔΡΟΜΗ έφυγε μαζί του. Ζούσε εδώ ενώ το καμπανάκι ζούσε
            αλλού — ΔΥΟ αρχεία για ΕΝΑ γεγονός, και ακριβώς αυτό έκανε τη βλάβη
            δυνατή. Πλέον «υπάρχει καμπανάκι» ⟺ «τρέχει συνδρομή», δομικά.

            ⚠️ ΚΑΜΙΑ αλλαγή στη σειρά γλώσσα → θέμα → λογαριασμός: το WCAG 2.2
            SC 3.2.3 (AA) απαιτεί «the same relative order each time». Η σειρά
            ήταν ήδη σωστή — αυτό που έλειπε ήταν η ΠΑΡΟΥΣΙΑ αλλού.

            ⚠️ ΧΩΡΙΣ `signedOutAction`: στο (app) δεν υπάρχει ποτέ ανώνυμος.
          */}
          <ShellUtilities />
        </div>
      </div>

      {/* 🔍 Global Search Dialog - Controlled mode */}
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
