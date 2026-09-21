'use client';

/**
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ ΤΟΥ COMBOBOX**: οι επιλογές και, στο τέλος, η «Προσθήκη «x»».
 * @related ADR-841 §7 Α19.4 · ADR-598 G11 · components/ui/searchable-combobox.tsx
 * @module components/ui/searchable-combobox-listbox
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η «ΠΡΟΣΘΗΚΗ ΝΕΟΥ» ΕΙΝΑΙ **ΕΠΙΛΟΓΗ**, ΟΧΙ ΚΟΥΜΠΙ ΕΞΩ ΑΠΟ ΤΗ ΛΙΣΤΑ (ADR-841 §7 Α19.4δ)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι 2026-09-21 η δημιουργία ζούσε στο `searchable-combobox-add-new.tsx`: κουμπί **κάτω
 * από** το `role="listbox"`, που άνοιγε **δεύτερο** πεδίο κειμένου μέσα στο popover. Η εστίαση
 * DOM όμως μένει **πάντα** στο πεδίο αναζήτησης (APG «list autocomplete»), άρα τα ↑/↓ **δεν
 * έφταναν ποτέ** στο κουμπί (WCAG 2.1.1). Επιπλέον ο άνθρωπος έγραφε το ίδιο πράγμα **δύο
 * φορές**: μία για να ψάξει και μία για να το φτιάξει.
 *
 * Οι μεγάλοι το λύνουν με **ένα** πεδίο: react-select *Creatable* (`createOptionPosition:
 * 'last'`), MUI Autocomplete `freeSolo` («Add "x"»), Headless UI *custom values*, Linear
 * «Create label». Το κείμενο της αναζήτησης **είναι** το κείμενο της νέας επιλογής. Η
 * προσφορά είναι το τελευταίο `role="option"`, έχει δείκτη όπως κάθε άλλη επιλογή και
 * ανακοινώνεται μέσω `aria-activedescendant`.
 *
 * **Layering**: leaf UI — καμία κατάσταση. Ο γονέας κατέχει δείκτη, φίλτρο και ενέργειες.
 */

import type { RefObject } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDropdownTokens } from '@/hooks/useDropdownTokens';
import '@/lib/design-system';
import type { ComboboxOption } from './searchable-combobox-types';

/**
 * Το `id` της **επισημασμένης** επιλογής — ο μόνος τρόπος να την **ακούσει** κανείς.
 *
 * 🔴 Η εστίαση DOM **δεν φεύγει ποτέ** από το `<input>` (APG «list autocomplete»), άρα
 * χωρίς `aria-activedescendant` το `ArrowDown` μετακινούσε την επισήμανση **οπτικά** και
 * ο αναγνώστης οθόνης **δεν ανακοίνωνε τίποτα**: το `Enter` επέλεγε κάτι που δεν είχε
 * ακουστεί ποτέ. Ίδιο `index` με τον κατάλογο ⇒ δείκτης και στόχος **δεν αποκλίνουν**.
 * Η επιλογή δημιουργίας παίρνει το `index` **μετά** την τελευταία επιλογή.
 *
 * @see ADR-841 §7 Α19.4β — W3C ARIA APG, Combobox Pattern
 */
export const optionDomId = (listboxId: string, index: number): string =>
  `${listboxId}-opt-${index}`;

export interface SearchableComboboxListboxProps {
  readonly id: string;
  readonly listRef: RefObject<HTMLUListElement | null>;
  /** Οι **ήδη φιλτραρισμένες** επιλογές — ο κατάλογος δεν φιλτράρει. */
  readonly options: readonly ComboboxOption[];
  readonly highlightedIndex: number;
  /** Το **ορατό** κείμενο της προσφοράς δημιουργίας · `null` ⇒ δεν προσφέρεται. */
  readonly addNewText: string | null;
  readonly onSelect: (option: ComboboxOption) => void;
  readonly onAddNew: () => void;
  readonly onHighlight: (index: number) => void;
}

export function SearchableComboboxListbox({
  id,
  listRef,
  options,
  highlightedIndex,
  addNewText,
  onSelect,
  onAddNew,
  onHighlight,
}: SearchableComboboxListboxProps) {
  const dropdown = useDropdownTokens();
  const addNewIndex = options.length;
  const addNewHighlighted = highlightedIndex === addNewIndex;

  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      className={`${dropdown.combobox.listPadding} ${dropdown.content.maxHeightCombobox} overflow-y-auto`}
    >
      {options.map((option, index) => (
        <li
          key={option.value}
          id={optionDomId(id, index)}
          role="option"
          aria-selected={highlightedIndex === index}
          aria-disabled={option.disabled || undefined}
          className={cn(
            `flex flex-col ${dropdown.item.combobox} transition-colors ${dropdown.item.fontSize}`,
            option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            !option.disabled && highlightedIndex === index
              ? 'bg-accent text-accent-foreground'
              : !option.disabled ? 'hover:bg-muted' : '',
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!option.disabled) onSelect(option);
          }}
          onMouseEnter={() => { if (!option.disabled) onHighlight(index); }}
        >
          <span className="font-medium">
            {option.label}
            {option.disabled && option.disabledHint && (
              <span className={`ml-2 ${dropdown.item.fontSizeSecondary} font-normal text-muted-foreground italic`}>
                ({option.disabledHint})
              </span>
            )}
          </span>
          {option.secondaryLabel && (
            <span className={`${dropdown.item.fontSizeSecondary} text-muted-foreground`}>
              {option.secondaryLabel}
            </span>
          )}
        </li>
      ))}

      {addNewText !== null && (
        <li
          id={optionDomId(id, addNewIndex)}
          role="option"
          aria-selected={addNewHighlighted}
          className={cn(
            `flex items-center ${dropdown.item.gap} ${dropdown.item.combobox} ${dropdown.item.fontSize} cursor-pointer transition-colors`,
            options.length > 0 && dropdown.combobox.addNewDivider,
            // 🔴 **ΟΧΙ `text-primary`** (CHECK 3.38, ADR-770): στο σκοτεινό θέμα το `--primary`
            //    λύνεται **ταυτόσημα με το `--card`** ⇒ 1,00:1, δηλαδή αόρατη πρόσκληση. Το
            //    `--text-info` είναι token **σκοπού** με ξεχωριστή τιμή ανά θέμα: ενέργεια, μπλε.
            addNewHighlighted
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted text-[hsl(var(--text-info))]',
          )}
          // Ίδια σύμβαση με τις υπόλοιπες επιλογές: το `mousedown` κρατά την εστίαση στο
          // πεδίο, αλλιώς το blur θα ακύρωνε το κείμενο πριν φτάσει η ενέργεια.
          onMouseDown={(e) => {
            e.preventDefault();
            onAddNew();
          }}
          onMouseEnter={() => onHighlight(addNewIndex)}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{addNewText}</span>
        </li>
      )}
    </ul>
  );
}
