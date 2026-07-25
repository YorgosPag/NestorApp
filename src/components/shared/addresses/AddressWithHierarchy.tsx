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
 * Uses the same hierarchy data as AdministrativeAddressPicker, but reorganized
 * to eliminate field duplication (settlement + postal code appear only in Section 1).
 *
 * For non-Greek addresses: the hierarchy section is simply not expanded.
 *
 * @module components/shared/addresses/AddressWithHierarchy
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { geocodeAddress } from '@/lib/geocoding/geocoding-service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import { AddressEditorContext, AddressFieldBadge } from '@/components/shared/addresses/editor';
// Re-exports for backward compatibility — consumers can still import from this file
export type { AddressWithHierarchyValue, AddressWithHierarchyProps } from './address-with-hierarchy-config';

// Pure field/format primitives — εξήχθησαν στο address-hierarchy-field-ops (N.7.1)
import {
  stripGreekAdminPrefix,
  applyResolvedPath,
  clearHierarchyLevels,
} from './address-hierarchy-field-ops';
// Τ.Κ. + χώρα: SSoT εκτός components (ADR-332 D16 / D12)
import {
  formatGreekPostalCode,
  parseGreekPostalCodeInput,
  toCanonicalGreekPostalCode,
} from '@/utils/address/postal-code';
import { isGreekAddressCountry } from '@/utils/address/country-codes';

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
  const { isLoading, resolvePath, getByLevel, levelOptions } = useAdministrativeHierarchy();
  const { t } = useTranslation('addresses');
  const colors = useSemanticColors();
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(defaultExpanded);
  const editorCtx = React.useContext(AddressEditorContext);
  const fieldStatus = editorCtx?.fieldStatus ?? null;
  const neighborhoodFieldNode = editorCtx?.neighborhoodFieldNode;

  const current = useMemo(
    () => ({ ...EMPTY_VALUE, ...value }),
    [value],
  );

  // ---------------------------------------------------------------------------
  // Άμυνα έναντι stale closures σε καθυστερημένα αποτελέσματα geocoding.
  //
  // Το `clearTimeout` ακυρώνει τον χρονιστή, ΟΧΙ ένα fetch που έχει ήδη φύγει.
  // Όταν το promise λυνόταν αργότερα, διάβαζε το closure της στιγμής που ξεκίνησε
  // — δηλαδή κατάσταση ΠΡΙΝ την επιλογή του χρήστη — και (α) περνούσε τον έλεγχο
  // «δεν υπάρχει οικισμός», (β) με το stale spread πετούσε το μόλις τεθέν
  // `settlementId` και όλη την ιεραρχία. Αποτέλεσμα: γραφόταν το διοικητικό όνομα
  // του geocoder αντί για την ετικέτα που είχε επιλέξει ο χρήστης.
  //
  // `currentRef`  → ζωντανή κατάσταση τη στιγμή της άφιξης του αποτελέσματος.
  // `autoFillEpochRef` → κάθε νέα ενέργεια ακυρώνει ό,τι είναι σε πτήση.
  // ---------------------------------------------------------------------------
  const currentRef = useRef(current);
  currentRef.current = current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const autoFillEpochRef = useRef(0);

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

  const handleBasicChange = useCallback(
    (field: 'street' | 'number' | 'postalCode' | 'country', val: string) => {
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
      autoFillEpochRef.current += 1;
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
    [current, onChange, resolvePath],
  );

  /**
   * Handle hierarchy level selection in collapsible section.
   * Resolves path upward from selected entity, clears more-specific levels.
   */
  const handleHierarchyChange = useCallback(
    (level: AdminLevel, newValue: string, option?: ComboboxOption | null) => {
      // Ρητή πρόθεση χρήστη — ακύρωσε κάθε auto-fill σε πτήση (βλ. handleSettlementChange).
      autoFillEpochRef.current += 1;
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
    [current, onChange, resolvePath],
  );

  // =========================================================================
  // AUTO-FILL: Resolve city from street + postalCode via geocoding
  // =========================================================================
  const autoFillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Κάθε επαναξιολόγηση ακυρώνει προηγούμενο αίτημα σε πτήση.
    const epoch = ++autoFillEpochRef.current;

    // Only auto-fill when: street + postalCode exist, but settlement is empty
    const hasStreet = current.street.trim().length > 2;
    const hasPostalCode = toCanonicalGreekPostalCode(current.postalCode).length === 5;
    const hasSettlement = current.settlementName.trim().length > 0;

    // Skip geocoding for non-Greek addresses — the Greek admin hierarchy is hidden anyway
    if (!hasStreet || !hasPostalCode || hasSettlement || disabled || !isGreekAddress) {
      return;
    }

    // Debounce 1.5s — don't call API while user is still typing
    if (autoFillTimerRef.current) {
      clearTimeout(autoFillTimerRef.current);
    }

    autoFillTimerRef.current = setTimeout(async () => {
      try {
        const atRequest = currentRef.current;
        const streetWithNumber = [atRequest.street, atRequest.number].filter(Boolean).join(' ');
        const result = await geocodeAddress({
          street: streetWithNumber,
          postalCode: atRequest.postalCode,
          country: 'gr',
        });

        // ⚠️ Από εδώ και κάτω μπορεί να έχουν περάσει δευτερόλεπτα και ο χρήστης
        // να έχει ήδη επιλέξει οικισμό. ΠΟΤΕ μην διαβάσεις το closure — μόνο
        // ζωντανή κατάσταση, και μόνο αν το αίτημα είναι ακόμη το τρέχον.
        if (epoch !== autoFillEpochRef.current) return;

        const live = currentRef.current;
        if (!result?.resolvedCity || live.settlementName.trim()) return;

        // Strip Greek admin prefixes before setting (Nominatim returns "Δημοτική Ενότητα X")
        onChangeRef.current({ ...live, settlementName: stripGreekAdminPrefix(result.resolvedCity) });
      } catch {
        // Silent fail — auto-fill is best-effort
      }
    }, 1500);

    return () => {
      if (autoFillTimerRef.current) {
        clearTimeout(autoFillTimerRef.current);
      }
    };
  }, [current.street, current.number, current.postalCode, current.settlementName, disabled, current, onChange]);

  // =========================================================================
  // AUTO-RESOLVE: When settlementName is set externally (e.g. from map drag)
  // without a settlementId, search hierarchy data for exact match and auto-fill
  // =========================================================================
  useEffect(() => {
    // Only trigger when: settlement name exists, no ID (set externally), data loaded, Greek address
    if (isLoading || !current.settlementName.trim() || current.settlementId || !isGreekAddress) return;

    // Normalize: strip accents, hyphens, lowercase
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-]/g, ' ').toLowerCase().trim();

    const cleanedName = stripGreekAdminPrefix(current.settlementName.trim()).replace(/-/g, ' ');
    const normalizedTarget = normalize(cleanedName);
    const postalCode = toCanonicalGreekPostalCode(current.postalCode);

    // Helper: fuzzy name match (exact or prefix-based for genitive handling)
    const nameMatches = (entityName: string): boolean => {
      const normalizedEntity = normalize(entityName);
      if (normalizedEntity === normalizedTarget) return true;
      if (normalizedTarget.length >= 4) {
        const targetWords = normalizedTarget.split(/\s+/);
        const entityWords = normalizedEntity.split(/\s+/);
        if (entityWords.length === targetWords.length) {
          return targetWords.every((tw, i) => {
            const prefixLen = Math.min(5, Math.min(tw.length, entityWords[i].length));
            return tw.substring(0, prefixLen) === entityWords[i].substring(0, prefixLen);
          });
        }
      }
      return false;
    };

    // =====================================================================
    // STRATEGY: Postal-code-first disambiguation
    // Step 1: If we have a postal code, find settlements in same postal zone
    // Step 2: Match by name among postal zone candidates
    // Step 3: Fallback to name-only search if no postal match
    // =====================================================================

    let bestMatch: { id: string; name: string } | null = null;

    if (postalCode.length === 5) {
      const postalZone = postalCode.substring(0, 3); // e.g. "118" for Athens center
      const allSettlements = getByLevel(8);
      // Step 1: Exact postal code + name match
      bestMatch = allSettlements.find(
        e => toCanonicalGreekPostalCode(e.postalCode ?? '') === postalCode && nameMatches(e.name)
      ) ?? null;
      // Step 2: Same postal zone (first 3 digits) + name match
      if (!bestMatch) {
        bestMatch = allSettlements.find(
          e => toCanonicalGreekPostalCode(e.postalCode ?? '').startsWith(postalZone) && nameMatches(e.name)
        ) ?? null;
      }
      // Step 3: Same broad zone (first 2 digits) + name match
      if (!bestMatch) {
        const broadZone = postalCode.substring(0, 2);
        bestMatch = allSettlements.find(
          e => toCanonicalGreekPostalCode(e.postalCode ?? '').startsWith(broadZone) && nameMatches(e.name)
        ) ?? null;
      }
    }

    // Step 4: Fallback — name-only search via getByLevel + nameMatches
    // (avoids genitive/nominative mismatch: searchOptions uses substring includes,
    // which fails when Nominatim returns "Ελευθερίου" but DB has "Ελευθέριο")
    if (!bestMatch) {
      const allSettlements = getByLevel(8);
      const candidate = allSettlements.find(e => nameMatches(e.name));
      if (candidate) {
        bestMatch = { id: candidate.id, name: candidate.name };
      }
    }
    if (!bestMatch) return;

    // Resolve full hierarchy from matched settlement
    const path = resolvePath(bestMatch.id);
    const updated = { ...current };
    updated.settlementName = bestMatch.name;
    for (const mapping of PATH_TO_VALUE) {
      const entity = path[mapping.pathKey];
      if (entity) {
        (updated[mapping.idField] as string | null) = entity.id;
        (updated[mapping.nameField] as string) = entity.name;
      }
    }
    onChange(updated);
  }, [current.settlementName, current.settlementId, current.postalCode, isLoading, isGreekAddress]);

  return (
    <section className="space-y-4">
      {/* Section 1: Basic Address Fields (always visible) */}
      <div className="space-y-3">
        {/* Row 1: Street + Number */}
        {showStreetFields && (
          <div className="grid grid-cols-3 gap-3">
            <fieldset className="col-span-2 space-y-1">
              <Label className={cn("text-xs font-medium", colors.text.muted)}>{t('form.street')}</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={current.street}
                  onChange={e => handleBasicChange('street', e.target.value)}
                  placeholder={t('form.streetPlaceholder')}
                  disabled={disabled}
                  className="flex-1"
                />
                {fieldStatus && <AddressFieldBadge status={fieldStatus.street} />}
              </div>
            </fieldset>
            <fieldset className="space-y-1">
              <Label className={cn("text-xs font-medium", colors.text.muted)}>{t('form.number')}</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={current.number}
                  onChange={e => handleBasicChange('number', e.target.value)}
                  placeholder={t('form.numberPlaceholder')}
                  disabled={disabled}
                  className="flex-1"
                />
                {fieldStatus && <AddressFieldBadge status={fieldStatus.number} />}
              </div>
            </fieldset>
          </div>
        )}
        {neighborhoodFieldNode}
        {/* Row 2: Postal Code + Settlement / City (same line) */}
        <div className="grid grid-cols-3 gap-3">
          <fieldset className="space-y-1">
            <Label className={cn("text-xs font-medium", colors.text.muted)}>{t('form.postalCode')}</Label>
            <div className="flex items-center gap-1.5">
              {/* Μάσκα εμφάνισης: το μοντέλο κρατά «54624», η οθόνη δείχνει
                  «546 24» (ADR-332 D16). Σε ξένη διεύθυνση περνά αυτούσιο. */}
              <Input
                value={isGreekAddress ? formatGreekPostalCode(current.postalCode) : current.postalCode}
                onChange={e => handleBasicChange('postalCode', e.target.value)}
                placeholder={t('form.postalCodePlaceholder')}
                maxLength={isGreekAddress ? 6 : undefined}
                inputMode={isGreekAddress ? 'numeric' : 'text'}
                disabled={disabled}
                className="flex-1"
              />
              {fieldStatus && <AddressFieldBadge status={fieldStatus.postalCode} />}
            </div>
          </fieldset>
          <fieldset className="col-span-2 space-y-1">
            <Label className={cn("text-xs font-medium", colors.text.muted)}>
              {t('hierarchy.settlementCity')}
            </Label>
            <div className="flex items-center gap-1.5">
              <SearchableCombobox
                value={current.settlementName}
                onValueChange={(newValue, option) => handleSettlementChange(newValue, option)}
                options={settlementOptions}
                placeholder={t('hierarchy.settlementPlaceholder')}
                emptyMessage={t('hierarchy.searchPlaceholder')}
                isLoading={isLoading}
                allowFreeText
                disabled={disabled}
                maxDisplayed={30}
                className="flex-1"
              />
              {fieldStatus && <AddressFieldBadge status={fieldStatus.city} />}
            </div>
          </fieldset>
        </div>
        {/* Row 3: Country */}
        <fieldset className="space-y-1">
          <Label className={cn("text-xs font-medium", colors.text.muted)}>{t('form.country')}</Label>
          <Input
            value={current.country}
            onChange={e => handleBasicChange('country', e.target.value)}
            placeholder={t('form.countryPlaceholder')}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {visibleFields.map(field => {
              const currentName = current[field.nameField] as string;
              const currentId = current[field.idField] as string | null;
              const isAutoFilled = currentId !== null;
              return (
                <fieldset key={field.level} className="space-y-1">
                  <label className={cn("text-xs font-medium", colors.text.muted)}>
                    {field.label}
                  </label>
                  <SearchableCombobox
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
