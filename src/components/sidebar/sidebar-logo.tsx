"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import LogoPagonis from "@/components/property-viewer/Logo_Pagonis"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { TRANSITION_PRESETS } from '@/components/ui/effects'

export function SidebarLogo() {
  const { state } = useSidebar()
  const [isMounted, setIsMounted] = useState(false)
  const { t } = useTranslation('navigation')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex items-center justify-center">
        <LogoPagonis />
      </div>
      <div
        className={cn(
          "flex flex-col",
          TRANSITION_PRESETS.STANDARD_OPACITY,
          state === "expanded" ? "opacity-100" : "opacity-0"
        )}
      >
        {isMounted && (
          <span className="text-base font-bold text-foreground">
            {t('user.name')}
          </span>
        )}
      </div>
    </div>
  )
}
