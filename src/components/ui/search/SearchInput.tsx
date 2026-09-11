/**
 * 🏢 ENTERPRISE Unified Search Input Component
 * Κεντρικοποιημένο search input που αντικαθιστά όλα τα διάσπαρτα implementations
 *
 * @version 1.1.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - No any, no inline styles, centralized system
 *
 * FEATURES:
 * - 🎯 Backward compatible με όλα τα existing patterns
 * - 🚀 Configurable debouncing — ΜΙΑ κατεύθυνση ροής (`useSearchInputValue`, 2026-09-11)
 * - ♿ Full accessibility support
 * - 🎨 Consistent styling με centralized constants
 * - 🔧 Type-safe interfaces
 */

'use client';

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SearchInputProps } from './types';
import { SEARCH_CONFIG, SEARCH_UI, DEBOUNCE_PRESETS } from './constants';
import { useSearchInputValue } from './useSearchInputValue';
import '@/lib/design-system';

/**
 * 🏢 Enterprise Search Input Component
 *
 * Unified implementation που διατηρεί την ίδια εμφάνιση με τα existing components
 * αλλά με centralized logic και enterprise features
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  debounceMs = DEBOUNCE_PRESETS.STANDARD,
  maxLength = SEARCH_CONFIG.maxLength,
  showClearButton = true,
  disabled = false,
  className,
  onClear,
  onFocus,
  onBlur,
  ...props
}: SearchInputProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();
  // 🔴 Ήταν δύο effects σε αντίθετες κατευθύνσεις ⇒ ατέρμονη ανταλλαγή τιμών (βλ. hook).
  const { localValue, change, clear } = useSearchInputValue(value, onChange, debounceMs);

  /**
   * 🔴 ΗΤΑΝ `placeholder.includes('.') ? t(placeholder) : placeholder` — ΔΙΑΚΡΙΣΗ
   * «ΚΛΕΙΔΙ Ή ΚΕΙΜΕΝΟ;» ΜΕ ΣΤΙΞΗ (ADR-744 §16).
   *
   * Δούλευε **κατά τύχη**: το μεταφρασμένο «Αναζήτηση**...**» περιέχει τελείες,
   * άρα **περνούσε** τον έλεγχο και ξαναέμπαινε στο `t()` — και σωζόταν μόνο
   * επειδή το i18next επιστρέφει το ίδιο string σε αστοχία. Την ημέρα που ένα
   * μεταφρασμένο κείμενο τύχαινε να **είναι** υπαρκτό κλειδί, η οθόνη θα έδειχνε
   * **άλλο κείμενο** — σιωπηλά.
   *
   * 🔑 **ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΤΗΝ ΑΛΛΑΓΗ**: και οι **13** καλούντες του `SearchInput`
   * περνούν **ήδη μεταφρασμένο** κείμενο (`placeholder={t('…')}`). **Κανένας**
   * δεν περνά κλειδί. Η μόνη ζωντανή διαδρομή του ευρετικού ήταν η **προεπιλογή**
   * — δηλαδή ο έλεγχος περιεχομένου υπήρχε για να λύσει ένα πρόβλημα που είχε
   * **ένα** στιγμιότυπο, και το έλυνε για **όλα** τα υπόλοιπα λάθος.
   *
   * Πλέον το `placeholder` είναι **κείμενο, πάντα**, και το κλειδί λύνεται **στη
   * θέση όπου δηλώνεται**. Πρότυπο των μεγάλων (Figma · Lingui): η διάκριση
   * κλειδιού/κειμένου ανήκει στον **τύπο**, ποτέ στο **περιεχόμενο**.
   */
  const resolvedPlaceholder = placeholder ?? t(SEARCH_CONFIG.placeholderDefaultKey);

  // 🧹 Clear handler — ρητή πράξη: ο γονέας ενημερώνεται ΑΜΕΣΩΣ
  const handleClear = useCallback(() => {
    clear();
    onClear?.();
  }, [clear, onClear]);

  // 📝 Input change handler — η εκπομπή γίνεται ΑΠΟ ΤΟ ΣΥΜΒΑΝ, ποτέ από effect
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // 🛡️ Enforce maxLength if specified
    if (maxLength && newValue.length > maxLength) {
      return;
    }

    change(newValue);
  }, [change, maxLength]);


  // 🎨 Icon classes - consistent με existing implementations
  const iconClasses = cn(
    SEARCH_UI.ICON.POSITION,
    SEARCH_UI.ICON.SIZE,
    SEARCH_UI.ICON.COLOR,
    SEARCH_UI.ICON.ACCESSIBILITY
  );

  // 🎨 Input classes - διατηρεί existing styling με optimized padding
  const inputClasses = cn(
    '!pl-12 w-full', // !important για override του shadcn/ui px-4/px-3 + ensure full width
    SEARCH_UI.INPUT.FOCUS, // 🏢 Enterprise centralized focus ring
    SEARCH_UI.INPUT.RESPONSIVE,
    disabled && SEARCH_UI.INPUT.DISABLED,
    className
  );

  // 🧹 Clear button classes
  const clearButtonClasses = cn(
    'absolute right-3 top-1/2 -translate-y-1/2',
    `${iconSizes.sm} text-muted-foreground hover:text-foreground`,
    'cursor-pointer transition-colors',
    'focus:outline-none focus:ring-1 focus:ring-ring focus:rounded'
  );

  return (
    <div className={SEARCH_UI.CONTAINER.BASE}>
      {/* 🔍 Search Icon - consistent positioning */}
      <Search className={iconClasses} />

      {/* 📝 Search Input */}
      <Input
        type="text"
        placeholder={resolvedPlaceholder}
        value={localValue}
        onChange={handleInputChange}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        className={inputClasses}
        autoComplete="off"
        spellCheck="false"
        {...props}
      />

      {/* 🧹 Clear Button - conditional rendering */}
      {showClearButton && localValue.length > 0 && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={clearButtonClasses}
          aria-label={t('labels.clearSearch')}
          tabIndex={-1}
        >
          <X />
        </button>
      )}
    </div>
  );
}

