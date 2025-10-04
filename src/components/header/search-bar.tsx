"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcuts"

export function HeaderSearchBar() {
  const [searchFocused, setSearchFocused] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  useKeyboardShortcut("k", () => {
    searchInputRef.current?.focus()
  })

  return (
    <div className="flex-1 max-w-md lg:max-w-lg xl:max-w-xl">
      <div
        className={cn(
          "relative group transition-all duration-300",
          searchFocused && "scale-[1.02]"
        )}
      >
        <Search
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors",
            searchFocused && "text-primary"
          )}
        />
        <Input
          ref={searchInputRef}
          type="search"
          placeholder="Αναζήτηση επαφών... (⌘K)"
          className={cn(
            "pl-10 pr-4 h-10 bg-muted/50 border-0 focus:bg-background transition-all duration-300",
            "hover:bg-muted/70 focus:ring-2 focus:ring-primary/20",
            searchFocused && "bg-background shadow-lg"
          )}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        <div
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 transition-opacity",
            searchFocused && "opacity-100"
          )}
        >
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>
      </div>
    </div>
  )
}
