"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import LogoPagonis from "@/components/property-viewer/Logo_Pagonis"
import { useEffect, useState } from "react"
import { PRODUCT_NAME } from '@/constants/product-identity'
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import '@/lib/design-system';

export function SidebarLogo() {
  const { state } = useSidebar()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isExpanded = state === "expanded"

  return (
    <div className={cn(
      "flex items-center",
      isExpanded ? "gap-2 px-2" : "justify-center px-0"
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
          {/*
            🔴 **ΗΤΑΝ `t('navigation:user.name')` — ΚΑΙ ΤΟ ΚΛΕΙΔΙ ΖΟΥΣΕ ΣΕ ΛΑΘΟΣ ΣΠΙΤΙ**
            (ADR-857 Φ4): κάτω από `user:`, δίπλα στα `user.title` και
            `user@example.com`, δηλαδή έμοιαζε με **στοιχεία του συνδεδεμένου χρήστη**
            ενώ η τιμή του ήταν σταθερά «Nestor App» σε **δύο** γλώσσες. Είναι το
            σήμα του **προϊόντος** και έρχεται από τη ρίζα — άκλιτο, μη μεταφράσιμο.
          */}
          <span className="text-base font-bold text-foreground whitespace-nowrap">
            {PRODUCT_NAME}
          </span>
        )}
      </div>
    </div>
  )
}
