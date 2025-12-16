"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)

  // Fix hydration mismatch - wait for client mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch flash
  if (!mounted) {
    return <div className="invisible">{children}</div>
  }

  return (
    <NextThemesProvider {...props}>
      {children}
    </NextThemesProvider>
  )
}
