"use client"

/**
 * Το κουμπί ☰ της στήλης — **σε δικό του module**.
 *
 * ADR-871 §10.3 Υ2: η κεφαλίδα του δημόσιου ιστότοπου (`PublicSiteHeader`) το αποδίδει
 * όταν υπάρχει στήλη. Αν ζούσε μόνο στο `ui/sidebar.tsx`, κάθε δημόσια σελίδα του
 * `(light)` θα κουβαλούσε `Sheet`/`Input`/`Separator` για ένα κουμπί που εκεί **δεν**
 * αποδίδεται ποτέ. Το `ui/sidebar.tsx` το ξαναεξάγει — κανένας καταναλωτής δεν αλλάζει.
 */

import * as React from "react"
import { PanelLeft } from "lucide-react"

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles'
import { useIconSizes } from "@/hooks/useIconSizes"
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar-context"

const SidebarTrigger = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()
  const iconSizes = useIconSizes()
  const { t } = useTranslation(COMMON_NAMESPACES)

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn(iconSizes.lg, className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">{t('buttons.toggleSidebar')}</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

export { SidebarTrigger }
