'use client';

/**
 * @fileoverview SearchableCombobox — Generic searchable dropdown with keyboard navigation
 * @description Reusable combobox built on Radix Popover + Input. Supports:
 *   - Debounced client-side filtering
 *   - Keyboard navigation (ArrowUp/Down, Enter, Escape)
 *   - ARIA combobox roles
 *   - Optional free text input
 *   - Optional secondary label per option
 *   - Loading state for lazy-loaded options
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 * @compliance CLAUDE.md — Radix Popover (ADR-001), zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDropdownTokens } from '@/hooks/useDropdownTokens';
import '@/lib/design-system';
import {
  ComboboxOption,
  SearchableComboboxProps,
  DEFAULT_MAX_DISPLAYED,
  DEFAULT_DEBOUNCE_MS,
} from './searchable-combobox-types';
// 🔑 «Ποια επιλογή εννοεί ο άνθρωπος;» — καθαρές συναρτήσεις, δοκιμάσιμες χωρίς DOM.
import { filterOptions, resolveOptionByText } from './searchable-combobox-matching';
// 🔑 «Ποια ΝΕΑ;» — άλλη ερώτηση, δική της κατάσταση, δικό της αρχείο.
import { SearchableComboboxAddNew } from './searchable-combobox-add-new';

export type { ComboboxOption, SearchableComboboxProps } from './searchable-combobox-types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Το `id` της **επισημασμένης** επιλογής — ο μόνος τρόπος να την **ακούσει** κανείς.
 *
 * 🔴 Η εστίαση DOM **δεν φεύγει ποτέ** από το `<input>` (APG «list autocomplete»), άρα
 * χωρίς `aria-activedescendant` το `ArrowDown` μετακινούσε την επισήμανση **οπτικά** και
 * ο αναγνώστης οθόνης **δεν ανακοίνωνε τίποτα**: το `Enter` επέλεγε κάτι που δεν είχε
 * ακουστεί ποτέ. Ίδιο `index` με το `filtered` ⇒ δείκτης και στόχος **δεν αποκλίνουν**.
 *
 * @see ADR-841 §7 Α19.4β — W3C ARIA APG, Combobox Pattern
 */
const optionDomId = (listboxId: string, index: number): string => `${listboxId}-opt-${index}`;

// ============================================================================
// COMPONENT
// ============================================================================

export function SearchableCombobox({
  value,
  onValueChange,
  options,
  placeholder = '',
  emptyMessage = 'No results found',
  isLoading = false,
  maxDisplayed = DEFAULT_MAX_DISPLAYED,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  allowFreeText = false,
  disabled = false,
  error,
  className,
  onAddNew,
  addNewButtonLabel = '+ Προσθήκη νέου',
}: SearchableComboboxProps) {
  const dropdown = useDropdownTokens();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Ιδιοκτησία του πεδίου (field ownership).
  //
  // Το περιεχόμενο του input προέρχεται από ΔΥΟ πηγές: τον χρήστη (πληκτρολόγηση
  // / επιλογή) ή το σύστημα (sync effect — reverse-geocoding auto-fill, φόρτωση
  // φόρμας, map drag). Όταν το γράφει το σύστημα, ο χρήστης που εστιάζει μετά
  // περιμένει να ΑΝΤΙΚΑΤΑΣΤΗΣΕΙ την πρόταση, όχι να γράψει στη συνέχειά της.
  //
  // Χωρίς αυτό: auto-fill «Θεσαλονίκης» → ο χρήστης πληκτρολογεί «Θεσσαλονί» →
  // ο δρομέας είναι στο τέλος → «ΘεσαλονίκηςΘεσσαλονί». Παρατηρήθηκε live
  // 2026-07-25 στο AddressWithHierarchy.
  //
  // Ίδια πειθαρχία με Chrome autofill / Google Maps: τιμή του συστήματος =
  // πρόταση, επιλέγεται ολόκληρη στο focus. Τιμή του χρήστη = δική του, ο
  // δρομέας μένει εκεί που έκανε κλικ.
  // ---------------------------------------------------------------------------
  const isSystemProvidedRef = useRef(false);

  // Sync input value from external value (e.g. when form resets or contact auto-fills)
  // Skip sync while popover is open — user is actively typing, don't override their input
  useEffect(() => {
    if (open) return;

    const matchingOption = options.find((o) => o.value === value);
    if (matchingOption) {
      setInputValue(matchingOption.label);
    } else if (value) {
      // Free text or value not yet in options (e.g. lazy-loading)
      setInputValue(value);
    } else {
      setInputValue('');
    }
    // Ό,τι γράφτηκε εδώ ήρθε από έξω — δεν το κατέχει ο χρήστης.
    isSystemProvidedRef.current = true;
  }, [value, options, open]);

  // Debounced filtering
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, debounceMs]);

  /**
   * 🔴 **`debounceMs = 0` ΣΗΜΑΙΝΕΙ ΜΗΔΕΝ, ΟΧΙ «ΕΝΑ TICK»** — και είναι **ορθότητα**, όχι
   * ταχύτητα *(ADR-841 §7 Α19.4α · N.7.2 #2 «race condition; ΟΧΙ»)*.
   *
   * Το `debouncedQuery` ενημερώνεται από `setTimeout`, άρα ακόμη και με `0` υπάρχει
   * **παράθυρο** όπου το πεδίο δείχνει *«ελαιο»* και ο κατάλογος είναι ακόμη **και οι 23**.
   * Μέσα σε εκείνο το παράθυρο, ένα `ArrowDown` + `Enter` επιλέγει από τη **ΛΑΘΟΣ ΛΙΣΤΑ**.
   *
   * ⚠️ **Μετρήθηκε ζωντανά 2026-09-04** στη ρίζα: πληκτρολόγηση *«ελαιο»* → `ArrowDown` →
   * `Enter` προσγειώθηκε στο **«Όλες οι ειδικότητες»** *(θέση 0 της αφιλτράριστης λίστας)*
   * αντί στον ελαιοχρωματιστή. Καμία πύλη δεν το ρώτησε — το βρήκε το **περπάτημα**.
   *
   * 🔑 Όταν ο καταναλωτής δηλώνει ότι **δεν χρειάζεται** debounce *(πληθυσμός στη μνήμη)*,
   * το φιλτράρισμα γίνεται **σύγχρονο με το πάτημα** και το παράθυρο **παύει να υπάρχει**.
   * Οι καταναλωτές με `debounceMs > 0` δεν επηρεάζονται καθόλου.
   */
  const effectiveQuery = debounceMs > 0 ? debouncedQuery : inputValue;

  /**
   * 🔴 **«ΕΨΑΞΕ Ο ΑΝΘΡΩΠΟΣ, Η ΑΠΛΩΣ ΒΛΕΠΕΙ ΤΗΝ ΕΠΙΛΟΓΗ ΤΟΥ;»** *(ADR-841 §7 Α19.4γ)*
   *
   * Το πεδίο δείχνει την **ετικέτα της τρέχουσας επιλογής** — αυτό είναι τιμή, **όχι
   * ερώτημα**. Χρησιμοποιώντας το ως φίλτρο, το άνοιγμα του καταλόγου έδειχνε **ΜΟΝΟ ό,τι
   * είχες ήδη διαλέξει**: για να αλλάξεις επιλογή, έπρεπε πρώτα να **σβήσεις**.
   *
   * ⚠️ **Ίσχυε και για τους επτά καταναλωτές** και δεν το είχε πιάσει καμία πύλη — φάνηκε
   * στο περπάτημα της 2026-09-04, μόλις το φιλτράρισμα έγινε σύγχρονο *(με debounce
   * απλώς **αργούσε** 150ms, δεν έλειπε)*. Κάθε design system δείχνει **ολόκληρη** τη
   * λίστα στο άνοιγμα — Material, Fluent, cmdk· ήμασταν η εξαίρεση.
   *
   * 🔑 **Κριτήριο χωρίς κατάσταση**: αν το κείμενο είναι **ακριβώς** η ετικέτα του κατόχου,
   * κανείς δεν έψαξε τίποτα. Μόλις πληκτρολογήσει έστω έναν χαρακτήρα διαφορετικά, το
   * φίλτρο ζωντανεύει. Δεν χρειάζεται δεύτερη σημαία που να μπορεί να αποκλίνει.
   */
  const incumbentLabel = useMemo(
    () => options.find((o) => o.value === value)?.label,
    [options, value],
  );
  const query = effectiveQuery === incumbentLabel ? '' : effectiveQuery;

  // Filtered + limited options — το κριτήριο ζει στο `searchable-combobox-matching`.
  const filtered = useMemo(
    () => filterOptions(options, query, maxDisplayed),
    [options, query, maxDisplayed],
  );

  // ⚠️ **Ίδια συνθήκη με την απόδοση παρακάτω, γραμμένη ΜΙΑ φορά**: το `aria-controls`
  //    δείχνει σε `id` που πρέπει να **υπάρχει**. Όταν δεν αποδίδεται `<ul>` (φόρτωση, ή
  //    μηδέν αποτελέσματα χωρίς «προσθήκη»), ένας δείκτης σε ανύπαρκτο στοιχείο είναι
  //    σφάλμα ARIA — χειρότερο από την απουσία του.
  const listboxRendered = !isLoading && !(filtered.length === 0 && !onAddNew);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered.length, query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      const item = items[highlightedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      // Ο χρήστης πήρε την ιδιοκτησία του πεδίου — μην ξαναεπιλέξεις το κείμενο.
      isSystemProvidedRef.current = false;

      if (!open) {
        setOpen(true);
      }

      // If allowFreeText, emit value immediately
      if (allowFreeText) {
        onValueChange(newValue, null);
      }
    },
    [open, allowFreeText, onValueChange],
  );

  const handleSelect = useCallback(
    (option: ComboboxOption) => {
      setInputValue(option.label);
      // Ρητή επιλογή χρήστη — δική του τιμή, όχι πρόταση του συστήματος.
      isSystemProvidedRef.current = false;
      onValueChange(option.value, option);
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onValueChange],
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    isSystemProvidedRef.current = false;
    onValueChange('', null);
    setOpen(false);
    inputRef.current?.focus();
  }, [onValueChange]);

  const handleBlur = useCallback(() => {
    // Small delay to allow click on option to register
    setTimeout(() => {
      if (!allowFreeText && inputValue) {
        // 🔴 Η ταυτότητα αποφασίζεται από την **ΤΙΜΗ** — δες
        //    `searchable-combobox-matching.ts` για το γιατί (ADR-834 §6.5.στ).
        const { incumbent, match } = resolveOptionByText(options, value, inputValue);

        if (match) {
          onValueChange(match.value, match);
          setInputValue(match.label);
        } else {
          // Revert to last valid value
          setInputValue(incumbent?.label ?? value);
        }
      }
      setOpen(false);
    }, 200);
  }, [allowFreeText, inputValue, options, value, onValueChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      if (filtered.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
            const target = filtered[highlightedIndex];
            if (!target.disabled) handleSelect(target);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [open, filtered, highlightedIndex, handleSelect],
  );

  // Το `select()` μέσα στο onFocus ακυρώνεται από το mouseup που ακολουθεί ένα
  // κλικ (ο browser επανατοποθετεί τον δρομέα). Κρατάμε σημαία ώστε ΕΚΕΙΝΟ το
  // mouseup —και μόνο αυτό— να μην χαλάσει την επιλογή.
  const pendingSelectAllRef = useRef(false);

  const handleFocus = useCallback(() => {
    if (disabled) return;
    if (options.length > 0) {
      setOpen(true);
    }
    // Πρόταση συστήματος → επιλέγεται ολόκληρη, ώστε η πληκτρολόγηση να την
    // αντικαταστήσει αντί να προσκολληθεί στο τέλος της.
    if (isSystemProvidedRef.current && inputRef.current?.value) {
      inputRef.current.select();
      pendingSelectAllRef.current = true;
    }
  }, [disabled, options.length]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (!pendingSelectAllRef.current) return;
    pendingSelectAllRef.current = false;
    e.preventDefault();
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      {/* PopoverAnchor (not Trigger) — we own open state via handleFocus / chevron
          onClick / handleBlur. Trigger's built-in toggle-on-click raced with
          handleFocus, producing the "first click flashes & closes, second click
          opens" bug reported 2026-04-25. */}
      <PopoverAnchor asChild>
        <div className={cn('relative w-full', className)}>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onMouseUp={handleMouseUp}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            // 🔴 ΤΑ ΔΥΟ ΠΟΥ ΕΛΕΙΠΑΝ (ADR-841 §7 Α19.4β) — δες `optionDomId`.
            aria-controls={open && listboxRendered ? listboxId : undefined}
            aria-activedescendant={
              open && highlightedIndex >= 0 ? optionDomId(listboxId, highlightedIndex) : undefined
            }
            aria-invalid={!!error}
            autoComplete="off"
            className={dropdown.combobox.inputPaddingRight}
          />
          {/* Loading spinner */}
          {isLoading && (
            <Spinner size="small" className="absolute right-8 top-1/2 -translate-y-1/2" />
          )}
          {/* Clear button */}
          {!isLoading && inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {/* Chevron indicator */}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { if (!disabled) setOpen(!open); }}
            className="absolute right-0 top-0 h-full px-2 flex items-center cursor-pointer"
            aria-label="Toggle dropdown"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={dropdown.content.sideOffset}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading ? (
          <div className={`flex items-center justify-center ${dropdown.combobox.loadingState}`}>
            <Spinner />
          </div>
        ) : (
          <>
            {filtered.length === 0 && !onAddNew ? (
              <p className={`${dropdown.combobox.emptyState} text-muted-foreground text-center`}>
                {emptyMessage}
              </p>
            ) : (
              <ul ref={listRef} id={listboxId} role="listbox" className={`${dropdown.combobox.listPadding} ${dropdown.content.maxHeightCombobox} overflow-y-auto`}>
                {filtered.length === 0 && (
                  <li className={`px-3 py-2 ${dropdown.item.fontSize} text-muted-foreground text-center`}>
                    {emptyMessage}
                  </li>
                )}
                {filtered.map((option, index) => (
                  <li
                    key={option.value}
                    id={optionDomId(listboxId, index)}
                    role="option"
                    aria-selected={highlightedIndex === index}
                    aria-disabled={option.disabled || undefined}
                    className={cn(
                      `flex flex-col ${dropdown.item.combobox} transition-colors ${dropdown.item.fontSize}`,
                      option.disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer',
                      !option.disabled && highlightedIndex === index
                        ? 'bg-accent text-accent-foreground'
                        : !option.disabled ? 'hover:bg-muted' : '',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!option.disabled) handleSelect(option);
                    }}
                    onMouseEnter={() => { if (!option.disabled) setHighlightedIndex(index); }}
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
              </ul>
            )}

            {/* «Δεν υπάρχει — φτιάξε το»: ξεχωριστή ευθύνη, ξεχωριστό αρχείο (ADR-841 §7 Α19.4). */}
            {onAddNew && (
              <SearchableComboboxAddNew
                onAddNew={onAddNew}
                onSubmitted={() => setOpen(false)}
                placeholder={placeholder}
                buttonLabel={addNewButtonLabel}
              />
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
