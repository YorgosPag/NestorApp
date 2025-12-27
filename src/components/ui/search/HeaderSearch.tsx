/**
 * 🏢 ENTERPRISE Header Search Component
 * Unified header search με keyboard shortcuts και focus effects
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - Centralized header search functionality
 *
 * FEATURES:
 * - ⌨️ Keyboard shortcuts (⌘K)
 * - 🎯 Focus effects με scale animation
 * - ♿ Full accessibility support
 * - 🎨 Consistent με existing header design
 */

"use client";

import React, { useState, useRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useIconSizes } from '@/hooks/useIconSizes';
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS } from "@/components/ui/effects";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { SEARCH_UI } from "./constants"; // 🏢 ENTERPRISE search constants
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";

interface HeaderSearchProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
  showShortcut?: boolean;
  shortcutKey?: string;
}

/**
 * 🏢 Enterprise Header Search με keyboard shortcuts
 * Διατηρεί την ίδια ακριβώς εμφάνιση με το existing HeaderSearchBar
 */
export function HeaderSearch({
  placeholder = "Αναζήτηση επαφών... (⌘K)",
  onSearch,
  className,
  showShortcut = true,
  shortcutKey = "k"
}: HeaderSearchProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ⌨️ Keyboard shortcut handling
  useKeyboardShortcut(shortcutKey, () => {
    searchInputRef.current?.focus();
  });

  // 📝 Handle search input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch?.(value);
  };

  // 🎯 Focus handlers
  const handleFocus = () => {
    setSearchFocused(true);
  };

  const handleBlur = () => {
    setSearchFocused(false);
  };

  // ⌨️ Escape key handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      searchInputRef.current?.blur();
      setSearchValue("");
      onSearch?.("");
    }
  };

  return (
    <div className={cn("flex-1 max-w-md lg:max-w-lg xl:max-w-xl", className)}>
      <div
        className={cn(
          "relative group",
          TRANSITION_PRESETS.SMOOTH_ALL,
          searchFocused && "scale-[1.02]"
        )}
      >
        {/* 🔍 Search Icon */}
        <Search
          className={cn(
            `absolute left-3 top-1/2 -translate-y-1/2 ${iconSizes.sm} text-muted-foreground`,
            TRANSITION_PRESETS.STANDARD_COLORS,
            searchFocused && "text-primary"
          )}
        />

        {/* 📝 Search Input */}
        <Input
          ref={searchInputRef}
          type="search"
          placeholder={placeholder}
          value={searchValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            `pl-10 pr-4 h-10 bg-muted/50 border-0 focus:${colors.bg.primary}`,
            SEARCH_UI.INPUT.FOCUS, // 🏢 Enterprise centralized focus ring
            TRANSITION_PRESETS.SMOOTH_ALL,
            HOVER_BACKGROUND_EFFECTS.MUTED,
            searchFocused && `${colors.bg.primary} shadow-lg`
          )}
          autoComplete="off"
        />

        {/* ⌨️ ESC Shortcut Indicator */}
        {showShortcut && (
          <div
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0",
              TRANSITION_PRESETS.STANDARD_OPACITY,
              searchFocused && "opacity-100"
            )}
          >
            <kbd className={`pointer-events-none inline-flex ${iconSizes.md} select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground`}>
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
        )}
      </div>
    </div>
  );
}