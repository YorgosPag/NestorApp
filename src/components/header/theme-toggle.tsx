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
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control'
import '@/lib/design-system';

/**
 * 🔑 **ΟΙ ΕΠΙΛΟΓΕΣ ΘΕΜΑΤΟΣ — ΜΙΑ ΛΙΣΤΑ, ΔΥΟ ΠΑΡΟΥΣΙΑΣΕΙΣ** (ADR-809 §9).
 * Το αναπτυσσόμενο της μπάρας και η σειρά κουμπιών του μενού κινητού διαβάζουν την
 * **ίδια** λίστα — δεύτερη χειρόγραφη λίστα θα απέκλινε στην πρώτη νέα επιλογή.
 */
const THEME_OPTIONS = [
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
] as const;

type ThemeChoice = (typeof THEME_OPTIONS)[number]['value'];

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
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon className={`mr-2 ${iconSizes.sm}`} />
              <span>{t(option.labelKey)}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * **Το θέμα ως ορατή σειρά επιλογών** — για επιφάνειες όπου ένα αναπτυσσόμενο μέσα σε
 * συρτάρι θα ήταν δεύτερο επίπεδο κρυψίματος (μενού κινητού, ADR-809 §9).
 * Ίδιος ιδιοκτήτης κατάστασης (`useHydratedTheme`, ADR-815), ίδια λίστα επιλογών.
 */
export function ThemeOptions({ labelledBy }: Readonly<{ labelledBy: string }>) {
  const iconSizes = useIconSizes();
  const { theme, setTheme } = useHydratedTheme()
  const { t } = useTranslation(COMMON_NAMESPACES);
  // Πριν την ενυδάτωση το `theme` είναι `undefined` (ADR-815) ⇒ «Σύστημα», η προεπιλογή του next-themes.
  const current: ThemeChoice = THEME_OPTIONS.find((option) => option.value === theme)?.value ?? 'system';

  return (
    // 📱 ΚΑΘΕΤΗ ΛΙΣΤΑ, όπως η γλώσσα (ADR-809 §9.5): σε 3 στήλες το «Σύστημα» κοβόταν 8 px στα 320 και το
    //    «Σκοτεινό» 4 px στα 390 (CHECK 3.94 · μετρημένο 2026-09-26). Δύο προτιμήσεις, ΕΝΑ σχήμα.
    <SegmentedControl<ThemeChoice>
      aria-labelledby={labelledBy}
      orientation="vertical"
      value={current}
      onValueChange={setTheme}
    >
      {THEME_OPTIONS.map((option) => (
        <SegmentedControlItem key={option.value} value={option.value} className="min-h-11 gap-2">
          <option.icon className={iconSizes.sm} aria-hidden="true" />
          {/* Πρόσβαση ιδιότητας, όχι αποδόμηση: τη λύνει ο generator του κελύφους (ADR-744 §2). */}
          <span>{t(option.labelKey)}</span>
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}
