"use client"

import * as React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/header/theme-toggle"
import { UserMenu } from "@/components/header/user-menu"
import { LanguageSwitcher } from "@/components/header/language-switcher"
import { HelpButton } from "@/components/header/help-button"
import { NotificationBell } from "@/components/NotificationBell.enterprise"
import { useFirestoreNotifications } from "@/hooks/useFirestoreNotifications"
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors"

export function AppHeader() {
  // ✅ FIRESTORE: Real-time notifications με onSnapshot
  // User ID από UserRoleContext (auto-login: user@example.com)
  useFirestoreNotifications({
    userId: 'user@example.com',
    enabled: true
  });

  // 🌉 BRIDGE: Semantic colors
  const colors = useSemanticColors();

  return (
    <header className={`sticky top-0 z-50 w-full max-w-full border-b ${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60 overflow-hidden`}>
      <div className="flex h-16 items-center justify-between px-1 sm:px-4 w-full max-w-full overflow-hidden">
        <SidebarTrigger />

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <LanguageSwitcher />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <NotificationBell />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <ThemeToggle />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <HelpButton />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
