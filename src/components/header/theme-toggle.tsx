"use client"

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import * as React from "react"
import { useHydratedTheme } from '@/lib/appearance/useHydratedTheme'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Monitor } from "lucide-react"
import { TRANSITION_PRESETS } from '@/components/ui/effects'
import { useIconSizes } from '@/hooks/useIconSizes'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import '@/lib/design-system';

export function ThemeToggle() {
  const iconSizes = useIconSizes();
  // 🔴 ADR-815 — ΑΣΦΑΛΗΣ ΑΝΑΓΝΩΣΗ, ΑΚΟΜΑ ΚΑΙ ΟΠΟΥ ΔΕΝ ΦΑΙΝΕΤΑΙ ΝΑ ΧΡΕΙΑΖΕΤΑΙ.
  // Το `DropdownMenuRadioGroup value={theme}` ζει μέσα σε `DropdownMenuContent`,
  // που το Radix **δεν αποδίδει όσο είναι κλειστό** — άρα σήμερα δεν υπάρχει
  // ασυμφωνία. ⚠️ Αυτό όμως είναι **γνώση για τη συμπεριφορά τρίτου**: ένα
  // `forceMount` (ή αλλαγή ανάντη) θα την έκανε ξαφνικά λάθος, σιωπηλά.
  // Περνώντας από τον έναν ιδιοκτήτη, η ορθότητα παύει να εξαρτάται από αυτό.
  const { theme, setTheme } = useHydratedTheme()
  const { t } = useTranslation(COMMON_NAMESPACES);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className={`${iconSizes.sm} rotate-0 scale-100 dark:-rotate-90 dark:scale-0 ${TRANSITION_PRESETS.STANDARD_ALL}`} />
          <Moon className={`absolute ${iconSizes.sm} rotate-90 scale-0 dark:rotate-0 dark:scale-100 ${TRANSITION_PRESETS.STANDARD_ALL}`} />
          <span className="sr-only">{t('theme.toggle')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('theme.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('theme.light')}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('theme.dark')}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('theme.system')}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
