"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import LogoPagonis from "@/components/property-viewer/Logo_Pagonis"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import '@/lib/design-system';

export function SidebarLogo() {
  const { state } = useSidebar()
  const [isMounted, setIsMounted] = useState(false)
  const { t } = useTranslation('navigation')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isExpanded = state === "expanded"

  return (
    <div className={cn(
      "flex items-center py-2",
      isExpanded ? "gap-3 px-3" : "justify-center px-0"
    )}>
      <div className="flex items-center justify-center">
        <LogoPagonis className={cn(
          "text-current transition-all duration-300",
          isExpanded ? "h-10 w-10" : "h-6 w-6"
        )} />
      </div>
      <div
        className={cn(
          "flex flex-col overflow-hidden",
          TRANSITION_PRESETS.STANDARD_OPACITY,
          isExpanded ? "opacity-100 max-w-xs" : "opacity-0 max-w-0"
        )}
      >
        {isMounted && (
          <span className="text-base font-bold text-foreground whitespace-nowrap">
            {t('user.name')}
          </span>
        )}
      </div>
    </div>
  )
}
