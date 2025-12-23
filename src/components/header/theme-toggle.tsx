"use client"

import * as React from "react"
import { useTheme } from "next-themes"
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

export function ThemeToggle() {
  const iconSizes = useIconSizes();
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className={`${iconSizes.sm} rotate-0 scale-100 dark:-rotate-90 dark:scale-0 ${TRANSITION_PRESETS.STANDARD_ALL}`} />
          <Moon className={`absolute ${iconSizes.sm} rotate-90 scale-0 dark:rotate-0 dark:scale-100 ${TRANSITION_PRESETS.STANDARD_ALL}`} />
          <span className="sr-only">Αλλαγή θέματος</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Θέμα Εμφάνισης</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className={`mr-2 ${iconSizes.sm}`} />
            <span>Φωτεινό</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className={`mr-2 ${iconSizes.sm}`} />
            <span>Σκοτεινό</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className={`mr-2 ${iconSizes.sm}`} />
            <span>Σύστημα</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
