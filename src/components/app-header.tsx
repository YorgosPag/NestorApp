"use client"

import * as React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/header/theme-toggle"
import { UserMenu } from "@/components/header/user-menu"
import { LanguageSwitcher } from "@/components/header/language-switcher"
import { NotificationBell } from "@/components/NotificationBell.enterprise"
import { NotificationDrawer } from "@/components/NotificationDrawer.enterprise"
import { useFirestoreNotifications } from "@/hooks/useFirestoreNotifications"

export function AppHeader() {
  // ✅ FIRESTORE: Real-time notifications με onSnapshot
  // User ID από UserRoleContext (auto-login: user@example.com)
  useFirestoreNotifications({
    userId: 'user@example.com',
    enabled: true
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-16 items-center px-4 gap-4">
        <SidebarTrigger className="-ml-2" />
        
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Separator orientation="vertical" className="h-6" />
          <NotificationBell />
          <Separator orientation="vertical" className="h-6" />
          <ThemeToggle />
          <Separator orientation="vertical" className="h-6" />
          <UserMenu />
        </div>
      </div>

      {/* Notification Drawer */}
      <NotificationDrawer />
    </header>
  )
}
