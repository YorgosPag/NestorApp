'use client';

/**
 * ADR-652 M3 — Η μπάρα φίλτρου μιας βιβλιοθήκης περιεχομένου (κοινό UI SSoT).
 *
 * Αναζήτηση + κατηγορία + (προαιρετικά) chips βιβλιοθήκης — το ίδιο τρίπτυχο που έχουν ο
 * Revit family browser και το Figma assets panel. Το χρησιμοποιούν και το palette των block
 * και το panel των υλικών: μία εμφάνιση, μία συμπεριφορά, μία διόρθωση.
 *
 * Presentational: κρατά ΜΗΔΕΝ κατάσταση — ο γονέας κατέχει το {@link LibraryFilterState}.
 * Οι ετικέτες έρχονται μεταφρασμένες από τον γονέα (κάθε panel έχει δικό του i18n namespace).
 *
 * @see ./library-filter.ts — ο pure κανόνας που εφαρμόζει το state
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LIBRARY_FILTER_ALL, type LibraryFilterState } from './library-filter';

/** Μια επιλογή φίλτρου — η τιμή είναι domain string, η ετικέτα ήδη μεταφρασμένη. */
export interface LibraryFilterOption {
  readonly value: string;
  readonly label: string;
}

export interface LibraryFilterBarProps {
  readonly value: LibraryFilterState;
  readonly onChange: (next: LibraryFilterState) => void;
  readonly searchPlaceholder: string;
  /** Οι κατηγορίες ΧΩΡΙΣ το «όλα» — το προσθέτει η μπάρα. */
  readonly categories: readonly LibraryFilterOption[];
  readonly allCategoriesLabel: string;
  /**
   * Chips βιβλιοθήκης ΧΩΡΙΣ το «όλα». Κενό ⇒ δεν εμφανίζονται καθόλου (μια βιβλιοθήκη με
   * ένα μόνο scope δεν χρειάζεται διακόπτη).
   */
  readonly scopes?: readonly LibraryFilterOption[];
  readonly allScopesLabel?: string;
  readonly ariaLabel: string;
}

const inputClass =
  'w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

export const LibraryFilterBar: React.FC<LibraryFilterBarProps> = ({
  value,
  onChange,
  searchPlaceholder,
  categories,
  allCategoriesLabel,
  scopes,
  allScopesLabel,
  ariaLabel,
}) => {
  const scopeChips: readonly LibraryFilterOption[] =
    scopes && scopes.length > 0 && allScopesLabel
      ? [{ value: LIBRARY_FILTER_ALL, label: allScopesLabel }, ...scopes]
      : [];

  return (
    <nav className="flex flex-shrink-0 flex-col gap-1.5 py-2" aria-label={ariaLabel}>
      <input
        type="search"
        placeholder={searchPlaceholder}
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
        className={inputClass}
      />

      <Select
        value={value.category}
        onValueChange={(category) => onChange({ ...value, category })}
      >
        <SelectTrigger size="sm" className="h-6 text-xs">
          <SelectValue placeholder={allCategoriesLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={LIBRARY_FILTER_ALL}>{allCategoriesLabel}</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {scopeChips.length > 0 && (
        <ul className="flex flex-wrap gap-0.5">
          {scopeChips.map((s) => (
            <li key={s.value}>
              <button
                type="button"
                onClick={() => onChange({ ...value, scope: s.value })}
                aria-pressed={value.scope === s.value}
                className={[
                  'rounded px-1.5 py-0.5 text-[10px] transition-colors',
                  value.scope === s.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};
