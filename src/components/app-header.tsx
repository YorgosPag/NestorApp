"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/header/theme-toggle"
import { UserMenu } from "@/components/header/user-menu"
import { LanguageSwitcher } from "@/components/header/language-switcher"
import { HelpButton } from "@/components/header/help-button"
import { VoiceAssistantButton } from "@/components/header/voice-assistant-button"
import { NotificationBell } from "@/components/NotificationBell.enterprise"
import { useFirestoreNotifications } from "@/hooks/useFirestoreNotifications"
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors"
import { useAuth } from "@/auth/contexts/AuthContext"
import { useTranslation } from "@/i18n/hooks/useTranslation"
import { cn } from "@/lib/utils"
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS } from "@/components/ui/effects"

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
  // 🔐 Get authenticated user
  const { user } = useAuth();
  const { t } = useTranslation('common');

  // 🔍 Global Search Dialog state
  const [searchOpen, setSearchOpen] = React.useState(false);

  // ✅ FIRESTORE: Real-time notifications με onSnapshot
  // 🏢 ENTERPRISE: Uses authenticated user ID, disabled when not logged in
  useFirestoreNotifications({
    userId: user?.uid ?? '',
    enabled: Boolean(user?.uid)
  });

  // 🌉 BRIDGE: Semantic colors
  const colors = useSemanticColors();

  return (
    <header className={`sticky top-0 z-50 w-full max-w-full border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60 overflow-hidden`}>
      <div className="flex h-16 items-center justify-between px-1 sm:px-4 w-full max-w-full overflow-hidden">
        <SidebarTrigger />

        {/* 🔍 Global Search Button */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md",
            "text-sm text-muted-foreground",
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
            "sm:hidden p-2 rounded-md text-muted-foreground",
            TRANSITION_PRESETS.STANDARD_COLORS,
            "hover:text-foreground hover:bg-muted"
          )}
          aria-label={t('search.globalSearch', 'Global Search')}
          suppressHydrationWarning
        >
          <Search className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <LanguageSwitcher />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <NotificationBell />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <VoiceAssistantButton />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <ThemeToggle />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <HelpButton />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <UserMenu />
        </div>
      </div>

      {/* 🔍 Global Search Dialog - Controlled mode */}
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
