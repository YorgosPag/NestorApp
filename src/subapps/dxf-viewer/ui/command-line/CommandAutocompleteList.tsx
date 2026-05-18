'use client';
// ADR-357 Phase 14-B — Command Autocomplete List.
// Fuzzy-prefix dropdown shown above the CommandLineInput.
// ADR-040 compliant: subscribes ONLY to CommandLineStore (low-freq).

import React from 'react';
import type { AliasEntry } from '../../systems/command-line/CommandAliasRegistry';

interface CommandAutocompleteListProps {
  readonly matches: readonly AliasEntry[];
  readonly selectedIndex: number;
  readonly onSelect: (alias: string) => void;
}

export function CommandAutocompleteList({
  matches,
  selectedIndex,
  onSelect,
}: CommandAutocompleteListProps) {
  if (matches.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label="command suggestions"
      className="absolute bottom-full left-0 mb-0.5 w-52 max-h-48 overflow-y-auto rounded border border-border bg-popover shadow-lg z-[2000] text-xs"
    >
      {matches.map((entry, idx) => (
        <li
          key={entry.alias}
          role="option"
          aria-selected={idx === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(entry.alias);
          }}
          className={`flex items-center justify-between gap-2 px-2 py-1 cursor-pointer select-none ${
            idx === selectedIndex
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted'
          }`}
        >
          <span className="font-mono font-semibold">{entry.alias}</span>
          <span className="text-muted-foreground truncate">{entry.toolId}</span>
        </li>
      ))}
    </ul>
  );
}
