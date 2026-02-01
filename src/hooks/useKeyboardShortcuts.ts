"use client"

import * as React from "react"

export function useKeyboardShortcut(
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: {
    metaKey?: boolean
    ctrlKey?: boolean,
    shiftKey?: boolean
  } = { metaKey: true, ctrlKey: true, shiftKey: false }
) {
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // 🛡️ ENTERPRISE: Guard against undefined e.key (dead keys, composition events, etc.)
      if (!e.key) return;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        (e.metaKey || e.ctrlKey) &&
        (options.shiftKey ? e.shiftKey : !e.shiftKey)
      ) {
        e.preventDefault()
        callback(e)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [key, callback, options])
}
