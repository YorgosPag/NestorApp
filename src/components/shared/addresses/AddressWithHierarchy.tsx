'use client';
/**
 * =============================================================================
 * AddressWithHierarchy - Centralized Address + Greek Admin Hierarchy Component
 * =============================================================================
 *
 * Two-section layout:
 * 1. Basic fields (always visible): Settlement/City, Street, Number, Postal Code
 * 2. Collapsible Greek administrative hierarchy (toggle): Community, Municipal Unit,
 *    Municipality, Regional Unit, Region
 *
 * The ONE administrative-address picker: its dead twin `AdministrativeAddressPicker`
 * (0 consumers) was deleted 2026-09-21 (ADR-598 G11 «(δ)», CHECK 3.22). Settlement +
 * postal code appear only in Section 1 (no field duplication).
 *
 * For non-Greek addresses: the hierarchy section is simply not expanded.
 *
 * @module components/shared/addresses/AddressWithHierarchy
 */

import React, { useState, useCallback, useId, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { useAdministrativeHierarchy, type AdminLevel } from '@/hooks/useAdministrativeHierarchy';
import {
  EMPTY_VALUE,
  PATH_TO_VALUE,
  HIERARCHY_FIELDS,
  type AddressWithHierarchyProps,
  type AddressWithHierarchyValue,
} from './address-with-hierarchy-config';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import { AddressEditorContext, AddressFieldBadge } from '@/components/shared/addresses/editor';
// 🔑 «Πόσους χαρακτήρες κρατά αυτό το πεδίο;» — ΜΙΑ δήλωση, δύο αναγνώστες: το `maxLength`
//    του Τ.Κ. και το ωφέλιμο δάπεδο της γραμμής (ADR-332 D27 Ζ7).
import {
  GREEK_POSTAL_CODE_DISPLAY_LENGTH,
} from '@/components/shared/addresses/editor/address-field-widths';
// 🔑 Ο κανόνας «το σχόλιο δεν τρώει τον χώρο του δεδομένου» — ΕΝΑΣ, για τα τέσσερα πεδία
//    που εδώ ήταν γραμμένος τέσσερις φορές (ADR-332 D27 Ζ7).
import {
  AddressFieldControlRow,
  addressFieldGroup,
  addressFieldCell,
  addressFieldCellWide,
} from '@/components/shared/addresses/editor/components/AddressFieldControlRow';
// Re-exports for backward compatibility — consumers can still import from this file
export type { AddressWithHierarchyValue, AddressWithHierarchyProps } from './address-with-hierarchy-config';

// Pure field/format primitives — εξήχθησαν στο address-hierarchy-field-ops (N.7.1)
import {
  applyResolvedPath,
  clearHierarchyLevels,
} from './address-hierarchy-field-ops';
// 🔑 Η αυτόματη συμπλήρωση οικισμού (γεωκωδικοποίηση + ανάλυση ιεραρχίας) — άλλη ευθύνη,
//    δικό της αρχείο (N.7.1). ⛔ ΜΗΝ ξαναγράψεις εδώ `useEffect` με `geocodeAddress`:
//    οι παγίδες χρόνου (epoch, ζωντανά refs) ζουν μαζί με τον κώδικα που τις γεννά.
import { useSettlementAutoFill } from './use-settlement-autofill';
// Τ.Κ. + χώρα: SSoT εκτός components (ADR-332 D16 / D12)
import {
  formatGreekPostalCode,
  parseGreekPostalCodeInput,
} from '@/utils/address/postal-code';
import {
  ADDRESS_COUNTRY_OPTIONS,
  countryLabelKey,
  isGreekAddressCountry,
  toStoredCountryCode,
} from '@/utils/address/country-codes';

// =============================================================================
// COMPONENT
// =============================================================================
export function AddressWithHierarchy({
  value,
  onChange,
  disabled = false,
  showStreetFields = true,
  hierarchyLevels = [7, 6, 5, 4, 3],
  defaultExpanded = false,
}: AddressWithHierarchyProps) {
  const { isLoading, resolvePath, levelOptions } = useAdministrativeHierarchy();
  const { t } = useTranslation('addresses');
  // `${idBase}-<πεδίο>`: κάθε <Label> ονομάζει το πεδίο της (ADR-598 G11).
  const idBase = useId();
  const colors = useSemanticColors();
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(defaultExpanded);
  const editorCtx = React.useContext(AddressEditorContext);
  const fieldStatus = editorCtx?.fieldStatus ?? null;
  const neighborhoodFieldNode = editorCtx?.neighborhoodFieldNode;

  const current = useMemo(
    () => ({ ...EMPTY_VALUE, ...value }),
    [value],
  );

  // Settlement options (level 8 = most specific)
  const settlementOptions = useMemo(() => {
    if (isLoading) return [];
    return levelOptions(8);
  }, [isLoading, levelOptions]);

  // Hierarchy options per level
  const optionsByLevel = useMemo(() => {
    if (isLoading) return new Map<number, ComboboxOption[]>();
    const map = new Map<number, ComboboxOption[]>();
    for (const level of hierarchyLevels) {
      map.set(level, levelOptions(level));
    }
    return map;
  }, [isLoading, levelOptions, hierarchyLevels]);

  // Visible hierarchy fields (filtered by hierarchyLevels prop)
  const visibleFields = useMemo(
    () => HIERARCHY_FIELDS.filter(f => hierarchyLevels.includes(f.level)),
    [hierarchyLevels],
  );

  // Το ερώτημα «είναι ελληνική;» απαντιόταν εδώ με inline αλυσίδα `||` και
  // ξεχωριστά στο geocoding engine με πλήρη accent-insensitive χάρτη. Ένα σημείο
  // πλέον (ADR-332 D12) — αλλιώς κάθε νέα ορθογραφία έπρεπε να μπει δύο φορές.
  const isGreekAddress = isGreekAddressCountry(current.country);

  // 🔑 ADR-332 — «πώς βρίσκεται ο οικισμός όταν ο άνθρωπος δεν τον έγραψε;» είναι ΑΛΛΗ
  //    ευθύνη από «πώς δείχνει μια διεύθυνση», και ζει σε δικό της αρχείο (N.7.1,
  //    εξαγωγή 2026-09-12 στις 521 γραμμές — καμία αλλαγή συμπεριφοράς).
  // ⚠️ **Καλείται ΠΡΙΝ τους handlers επίτηδες**: εκείνοι ζητούν το
  //    `cancelPendingAutoFill`, και ένα `const` δεν hoist-άρεται.
  const { cancelPendingAutoFill } = useSettlementAutoFill({
    current,
    onChange,
    disabled,
    isGreekAddress,
  });

  // =========================================================================
  // ΧΩΡΑ — **επιλογέας, ποτέ ελεύθερο κείμενο** (ADR-332 D27 Φάση Α)
  //
  // 🔴 Ως σήμερα εδώ ήταν σκέτο `<Input value={current.country}>`, δηλαδή το **αποθηκευμένο**
  //    πεδίο ήταν ό,τι πληκτρολογούσε ο άνθρωπος ή ό,τι έγραφε η μηχανή («Ελλάδα»). Ένα
  //    ελεύθερο κείμενο πάνω σε **κωδικό** είναι αντίφαση: ή δείχνει «GR» στον άνθρωπο, ή
  //    αποθηκεύει ετικέτα — και το δεύτερο **ήταν** το εύρημα Ζ4α.
  //
  // ⚠️ `allowFreeText` **σκόπιμα**: ο πίνακας καλύπτει 16 χώρες· μια δέκατη έβδομη πρέπει να
  //    μπορεί ακόμη να γραφτεί. Καμία δυνατότητα δεν αφαιρείται — μόνο η **αμφισημία**.
  // =========================================================================
  const countryOptions = useMemo<ComboboxOption[]>(
    () => ADDRESS_COUNTRY_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t],
  );

  /** Ό,τι βλέπει ο άνθρωπος: η **μεταφρασμένη** ετικέτα· άγνωστη χώρα δείχνει το κείμενό της. */
  const countryDisplay = useMemo(() => {
    const key = countryLabelKey(current.country);
    return key ? t(key) : (current.country ?? '');
  }, [current.country, t]);

  const handleCountryChange = useCallback(
    (text: string, option: ComboboxOption | null) => {
      onChange({ ...current, country: option ? option.value : (toStoredCountryCode(text) ?? '') });
    },
    [current, onChange],
  );

  const handleBasicChange = useCallback(
    // Η **χώρα έφυγε** από εδώ (ADR-332 D27 Φάση Α): δεν είναι ελεύθερο κείμενο πια, έχει
    // δικό της χειριστή που γράφει **κωδικό**. Ο τύπος το δηλώνει, ώστε να μην ξαναπεράσει.
    (field: 'street' | 'number' | 'postalCode', val: string) => {
      // Ο Τ.Κ. μπαίνει στο μοντέλο ΚΑΝΟΝΙΚΟΣ («54624»)· η μάσκα «546 24» είναι
      // μόνο εμφάνιση (ADR-332 D16). Σε μη-ελληνική διεύθυνση το πεδίο μένει
      // διαφανές — το παλιό `replace(/\D/g,'')` ακρωτηρίαζε σιωπηλά ξένους Τ.Κ.
      // («SW1A 1AA» ➜ «11»).
      const next = field === 'postalCode'
        ? (isGreekAddress ? parseGreekPostalCodeInput(val) : val)
        : val;
      onChange({ ...current, [field]: next });
    },
    [current, onChange, isGreekAddress],
  );

  /**
   * Handle settlement selection — auto-fills entire hierarchy.
   * When user selects from combobox: resolve full path upward.
   * When user types free text: set name, clear hierarchy.
   */
  const handleSettlementChange = useCallback(
    (newValue: string, option?: ComboboxOption | null) => {
      // Ρητή πρόθεση χρήστη: ακύρωσε κάθε auto-fill σε πτήση. Ό,τι επέλεξε ο
      // χρήστης νικά πάντα μια εξωτερική πηγή (πειθαρχία `buildSelected`, ADR-601).
      cancelPendingAutoFill();
      const updated = { ...current };
      if (option?.value) {
        // Entity selected — resolve full parent chain
        applyResolvedPath(updated, resolvePath(option.value));
      } else {
        // Free text — set settlement name, clear hierarchy
        updated.settlementId = null;
        updated.settlementName = newValue;
        clearHierarchyLevels(updated, level => level !== 8);
      }
      onChange(updated);
    },
    [current, onChange, resolvePath, cancelPendingAutoFill],
  );

  /**
   * Handle hierarchy level selection in collapsible section.
   * Resolves path upward from selected entity, clears more-specific levels.
   */
  const handleHierarchyChange = useCallback(
    (level: AdminLevel, newValue: string, option?: ComboboxOption | null) => {
      // Ρητή πρόθεση χρήστη — ακύρωσε κάθε auto-fill σε πτήση (βλ. handleSettlementChange).
      cancelPendingAutoFill();
      const updated = { ...current };
      if (option?.value) {
        // Ό,τι δεν καλύπτεται από τη διαδρομή και είναι πιο ειδικό, καθαρίζεται.
        applyResolvedPath(updated, resolvePath(option.value), level);
      } else {
        // Free text at this level
        const fieldDef = PATH_TO_VALUE.find(m => m.level === level);
        if (fieldDef) {
          (updated[fieldDef.idField] as string | null) = null;
          (updated[fieldDef.nameField] as string) = newValue;
        }
        clearHierarchyLevels(updated, l => l > level);
      }
      onChange(updated);
    },
    [current, onChange, resolvePath, cancelPendingAutoFill],
  );

  return (
    <section className="space-y-4">
      {/* Section 1: Basic Address Fields (always visible) */}
      <div className="space-y-3">
        {/* Row 1: Street + Number */}
        {showStreetFields && (
          <div className={addressFieldGroup}>
            <fieldset className={cn(addressFieldCellWide, "space-y-1")}>
              <Label htmlFor={`${idBase}-street`} className={cn("text-xs font-medium", colors.text.muted)}>{t('form.street')}</Label>
              <AddressFieldControlRow
                field="street"
                badge={fieldStatus && <AddressFieldBadge status={fieldStatus.street} />}
              >
                <Input
                  id={`${idBase}-street`}
                  data-address-field="street"
                  value={current.street}
                  onChange={e => handleBasicChange('street', e.target.value)}
                  placeholder={t('form.streetPlaceholder')}
                  disabled={disabled}
                />
              </AddressFieldControlRow>
            </fieldset>
            <fieldset className={cn(addressFieldCell, "space-y-1")}>
              <Label htmlFor={`${idBase}-number`} className={cn("text-xs font-medium", colors.text.muted)}>{t('form.number')}</Label>
              <AddressFieldControlRow
                field="number"
                badge={fieldStatus && <AddressFieldBadge status={fieldStatus.number} />}
              >
                <Input
                  id={`${idBase}-number`}
                  data-address-field="number"
                  value={current.number}
                  onChange={e => handleBasicChange('number', e.target.value)}
                  placeholder={t('form.numberPlaceholder')}
                  disabled={disabled}
                />
              </AddressFieldControlRow>
            </fieldset>
          </div>
        )}
        {neighborhoodFieldNode}
        {/* Row 2: Postal Code + Settlement / City (same line) */}
        <div className={addressFieldGroup}>
          <fieldset className={cn(addressFieldCell, "space-y-1")}>
            <Label htmlFor={`${idBase}-postalCode`} className={cn("text-xs font-medium", colors.text.muted)}>{t('form.postalCode')}</Label>
            <AddressFieldControlRow
              field="postalCode"
              badge={fieldStatus && <AddressFieldBadge status={fieldStatus.postalCode} />}
            >
              {/* Μάσκα εμφάνισης: το μοντέλο κρατά «54624», η οθόνη δείχνει
                  «546 24» (ADR-332 D16). Σε ξένη διεύθυνση περνά αυτούσιο. */}
              <Input
                id={`${idBase}-postalCode`}
                data-address-field="postalCode"
                value={isGreekAddress ? formatGreekPostalCode(current.postalCode) : current.postalCode}
                onChange={e => handleBasicChange('postalCode', e.target.value)}
                placeholder={t('form.postalCodePlaceholder')}
                maxLength={isGreekAddress ? GREEK_POSTAL_CODE_DISPLAY_LENGTH : undefined}
                inputMode={isGreekAddress ? 'numeric' : 'text'}
                disabled={disabled}
              />
            </AddressFieldControlRow>
          </fieldset>
          <fieldset className={cn(addressFieldCellWide, "space-y-1")}>
            <Label htmlFor={`${idBase}-city`} className={cn("text-xs font-medium", colors.text.muted)}>
              {t('hierarchy.settlementCity')}
            </Label>
            <AddressFieldControlRow
              field="city"
              badge={fieldStatus && <AddressFieldBadge status={fieldStatus.city} />}
            >
              <SearchableCombobox
                id={`${idBase}-city`}
                value={current.settlementName}
                onValueChange={(newValue, option) => handleSettlementChange(newValue, option)}
                options={settlementOptions}
                placeholder={t('hierarchy.settlementPlaceholder')}
                emptyMessage={t('hierarchy.searchPlaceholder')}
                isLoading={isLoading}
                allowFreeText
                disabled={disabled}
                maxDisplayed={30}
              />
            </AddressFieldControlRow>
          </fieldset>
        </div>
        {/* Row 3: Country */}
        <fieldset className="space-y-1">
          <Label htmlFor={`${idBase}-country`} className={cn("text-xs font-medium", colors.text.muted)}>{t('form.country')}</Label>
          <SearchableCombobox
            id={`${idBase}-country`}
            value={countryDisplay}
            onValueChange={handleCountryChange}
            options={countryOptions}
            placeholder={t('form.countryPlaceholder')}
            emptyMessage={t('hierarchy.searchPlaceholder')}
            allowFreeText
            disabled={disabled}
          />
        </fieldset>
      </div>
      {/* Section 2: Collapsible Greek Administrative Hierarchy — only for GR addresses */}
      {isGreekAddress && (
      <div className="border-t border-border pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("w-full flex items-center justify-between hover:text-foreground", colors.text.muted)}
          onClick={() => setIsHierarchyOpen(prev => !prev)}
        >
          <span className="flex items-center gap-2 text-xs font-medium">
            <MapPin className="h-3.5 w-3.5" />
            {t('hierarchy.administrativeDivision')}
          </span>
          {isHierarchyOpen
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </Button>
        {isHierarchyOpen && (
          /* catalog-exempt: πεδία φόρμας διοικητικής ιεραρχίας (ετικέτα + συνδυαστικό πλαίσιο),
             όχι κάρτες. Το πλάτος του πεδίου το ορίζει η φόρμα και το ζευγάρωμα ετικέτας-πεδίου,
             όχι δηλωμένο δάπεδο κάρτας. */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {visibleFields.map(field => {
              const currentName = current[field.nameField] as string;
              const currentId = current[field.idField] as string | null;
              const isAutoFilled = currentId !== null;
              return (
                <fieldset key={field.level} className="space-y-1">
                  <label htmlFor={`${idBase}-${field.level}`} className={cn("text-xs font-medium", colors.text.muted)}>
                    {t(field.labelKey)}
                  </label>
                  <SearchableCombobox
                    id={`${idBase}-${field.level}`}
                    value={currentName}
                    onValueChange={(newValue, option) =>
                      handleHierarchyChange(field.level, newValue, option)
                    }
                    options={optionsByLevel.get(field.level) ?? []}
                    placeholder={t(field.placeholderKey)}
                    emptyMessage={t('hierarchy.searchPlaceholder')}
                    isLoading={isLoading}
                    allowFreeText
                    disabled={disabled}
                    maxDisplayed={30}
                    className={isAutoFilled ? 'opacity-75' : ''}
                  />
                </fieldset>
              );
            })}
          </div>
        )}
      </div>
      )}
    </section>
  );
}
