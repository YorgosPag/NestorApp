'use client';
// ADR-357 Phase 14-B — Command Autocomplete List.
// Fuzzy-prefix dropdown shown above the CommandLineInput.
// ADR-040 compliant: subscribes ONLY to CommandLineStore (low-freq).

import React from 'react';

/**
 * Μία υπόδειξη, ανεξάρτητα από **ποιο** μητρώο τη γέννησε.
 *
 * ADR-739 Φ.Δ βήμα 4 — μέχρι τότε ο τύπος ήταν κατευθείαν το `AliasEntry` του μητρώου
 * εργαλείων και η δεύτερη στήλη έδειχνε το ωμό `toolId`. Με το `CommandActionRegistry` οι
 * πηγές έγιναν **δύο**, και μια ενέργεια **δεν έχει** `toolId`. Ένα δηλωμένο πεδίο
 * εμφάνισης είναι η ειλικρινής ένωση· η εναλλακτική («βάλε το actionId σε πεδίο που
 * λέγεται toolId») θα ήταν ψέμα στον τύπο για να γλιτώσουμε τρεις γραμμές.
 */
export interface CommandSuggestion {
  readonly alias: string;
  /** Τι θα κάνει — εργαλείο ή ενέργεια. **Μόνο για εμφάνιση**, ποτέ για δρομολόγηση. */
  readonly detail: string;
}

interface CommandAutocompleteListProps {
  readonly matches: readonly CommandSuggestion[];
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
          <span className="text-muted-foreground truncate">{entry.detail}</span>
        </li>
      ))}
    </ul>
  );
}
