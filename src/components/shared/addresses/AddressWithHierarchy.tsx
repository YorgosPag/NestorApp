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
import {
  useAdministrativeHierarchy,
  ADMIN_LEVEL_LABELS,
  type AdminPath,
  type AdminLevel,
} from '@/hooks/useAdministrativeHierarchy';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { geocodeAddress } from '@/lib/geocoding/geocoding-service';

// =============================================================================
// TYPES
// =============================================================================

/** Full address value including Greek admin hierarchy */
export interface AddressWithHierarchyValue {
  // Basic fields
  street: string;
  number: string;
  postalCode: string;
  // Settlement = Oikismos / City
  settlementId: string | null;
  settlementName: string;
  // Greek administrative hierarchy (auto-filled from settlement selection)
  communityId: string | null;
  communityName: string;
  municipalUnitId: string | null;
  municipalUnitName: string;
  municipalityId: string | null;
  municipalityName: string;
  regionalUnitId: string | null;
  regionalUnitName: string;
  regionId: string | null;
  regionName: string;
  decentAdminId: string | null;
  decentAdminName: string;
  majorGeoId: string | null;
  majorGeoName: string;
}

interface AddressWithHierarchyProps {
  value?: Partial<AddressWithHierarchyValue>;
  onChange: (value: AddressWithHierarchyValue) => void;
  disabled?: boolean;
  /** Show street + number fields. Default: true */
  showStreetFields?: boolean;
  /** Which hierarchy levels to show in collapsible section. Default: [7,6,5,4,3] */
  hierarchyLevels?: AdminLevel[];
  /** Start with hierarchy section expanded. Default: false */
  defaultExpanded?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const EMPTY_VALUE: AddressWithHierarchyValue = {
  street: '',
  number: '',
  postalCode: '',
  settlementId: null,
  settlementName: '',
  communityId: null,
  communityName: '',
  municipalUnitId: null,
  municipalUnitName: '',
  municipalityId: null,
  municipalityName: '',
  regionalUnitId: null,
  regionalUnitName: '',
  regionId: null,
  regionName: '',
  decentAdminId: null,
  decentAdminName: '',
  majorGeoId: null,
  majorGeoName: '',
};

/** Maps hierarchy path keys to value fields */
const PATH_TO_VALUE: ReadonlyArray<{
  pathKey: keyof AdminPath;
  idField: keyof AddressWithHierarchyValue;
  nameField: keyof AddressWithHierarchyValue;
  level: AdminLevel;
}> = [
  { pathKey: 'settlement', idField: 'settlementId', nameField: 'settlementName', level: 8 },
  { pathKey: 'community', idField: 'communityId', nameField: 'communityName', level: 7 },
  { pathKey: 'municipalUnit', idField: 'municipalUnitId', nameField: 'municipalUnitName', level: 6 },
  { pathKey: 'municipality', idField: 'municipalityId', nameField: 'municipalityName', level: 5 },
  { pathKey: 'regionalUnit', idField: 'regionalUnitId', nameField: 'regionalUnitName', level: 4 },
  { pathKey: 'region', idField: 'regionId', nameField: 'regionName', level: 3 },
  { pathKey: 'decentAdmin', idField: 'decentAdminId', nameField: 'decentAdminName', level: 2 },
  { pathKey: 'majorGeo', idField: 'majorGeoId', nameField: 'majorGeoName', level: 1 },
];

/** Hierarchy fields for the collapsible section (levels 7-3, no settlement/postalCode) */
const HIERARCHY_FIELDS: ReadonlyArray<{
  level: AdminLevel;
  idField: keyof AddressWithHierarchyValue;
  nameField: keyof AddressWithHierarchyValue;
  label: string;
  placeholder: string;
}> = [
  { level: 7, idField: 'communityId', nameField: 'communityName', label: ADMIN_LEVEL_LABELS[7], placeholder: 'π.χ. Δημοτική Κοινότητα...' },
  { level: 6, idField: 'municipalUnitId', nameField: 'municipalUnitName', label: ADMIN_LEVEL_LABELS[6], placeholder: 'π.χ. Δημοτική Ενότητα...' },
  { level: 5, idField: 'municipalityId', nameField: 'municipalityName', label: ADMIN_LEVEL_LABELS[5], placeholder: 'π.χ. Δήμος Αθηναίων...' },
  { level: 4, idField: 'regionalUnitId', nameField: 'regionalUnitName', label: ADMIN_LEVEL_LABELS[4], placeholder: 'π.χ. Π.Ε. Αττικής...' },
  { level: 3, idField: 'regionId', nameField: 'regionName', label: ADMIN_LEVEL_LABELS[3], placeholder: 'π.χ. Περιφέρεια Αττικής...' },
];

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
  const { isLoading, findById, resolvePath, getByLevel, searchOptions, levelOptions } = useAdministrativeHierarchy();
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(defaultExpanded);

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

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /** Handle basic text field changes (street, number, postalCode) */
  const handleBasicChange = useCallback(
    (field: 'street' | 'number' | 'postalCode', val: string) => {
      onChange({ ...current, [field]: val });
    },
    [current, onChange],
  );

  /**
   * Handle settlement selection — auto-fills entire hierarchy.
   * When user selects from combobox: resolve full path upward.
   * When user types free text: set name, clear hierarchy.
   */
  const handleSettlementChange = useCallback(
    (newValue: string, option?: ComboboxOption | null) => {
      const updated = { ...current };

      if (option?.value) {
        // Entity selected — resolve full parent chain
        const path = resolvePath(option.value);
        for (const mapping of PATH_TO_VALUE) {
          const entity = path[mapping.pathKey];
          if (entity) {
            (updated[mapping.idField] as string | null) = entity.id;
            (updated[mapping.nameField] as string) = entity.name;
            // Auto-fill postal code from settlement
            if (mapping.level === 8 && entity.postalCode) {
              updated.postalCode = entity.postalCode;
            }
          }
        }
      } else {
        // Free text — set settlement name, clear hierarchy
        updated.settlementId = null;
        updated.settlementName = newValue;
        for (const mapping of PATH_TO_VALUE) {
          if (mapping.level !== 8) {
            (updated[mapping.idField] as string | null) = null;
            (updated[mapping.nameField] as string) = '';
          }
        }
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
      const updated = { ...current };

      if (option?.value) {
        const path = resolvePath(option.value);
        for (const mapping of PATH_TO_VALUE) {
          const entity = path[mapping.pathKey];
          if (entity) {
            (updated[mapping.idField] as string | null) = entity.id;
            (updated[mapping.nameField] as string) = entity.name;
            if (mapping.level === 8 && entity.postalCode) {
              updated.postalCode = entity.postalCode;
            }
          } else if (mapping.level > level) {
            // Clear more-specific levels (higher number = more specific)
            (updated[mapping.idField] as string | null) = null;
            (updated[mapping.nameField] as string) = '';
          }
        }
      } else {
        // Free text at this level
        const fieldDef = PATH_TO_VALUE.find(m => m.level === level);
        if (fieldDef) {
          (updated[fieldDef.idField] as string | null) = null;
          (updated[fieldDef.nameField] as string) = newValue;
        }
        // Clear more-specific levels
        for (const mapping of PATH_TO_VALUE) {
          if (mapping.level > level) {
            (updated[mapping.idField] as string | null) = null;
            (updated[mapping.nameField] as string) = '';
          }
        }
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
    // Only auto-fill when: street + postalCode exist, but settlement is empty
    const hasStreet = current.street.trim().length > 2;
    const hasPostalCode = current.postalCode.trim().length === 5;
    const hasSettlement = current.settlementName.trim().length > 0;

    if (!hasStreet || !hasPostalCode || hasSettlement || disabled) {
      return;
    }

    // Debounce 1.5s — don't call API while user is still typing
    if (autoFillTimerRef.current) {
      clearTimeout(autoFillTimerRef.current);
    }

    autoFillTimerRef.current = setTimeout(async () => {
      try {
        const streetWithNumber = [current.street, current.number].filter(Boolean).join(' ');
        const result = await geocodeAddress({
          street: streetWithNumber,
          postalCode: current.postalCode,
        });

        if (result?.resolvedCity && !current.settlementName.trim()) {
          // Auto-fill settlement name (user can still change it)
          onChange({ ...current, settlementName: result.resolvedCity });
        }
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
    // Only trigger when: settlement name exists, no ID (set externally), data loaded
    if (isLoading || !current.settlementName.trim() || current.settlementId) return;

    // Normalize: strip accents, hyphens, lowercase
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-]/g, ' ').toLowerCase().trim();

    const cleanedName = current.settlementName.trim().replace(/-/g, ' ');
    const normalizedTarget = normalize(cleanedName);
    const postalCode = current.postalCode.trim();

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
        e => e.postalCode === postalCode && nameMatches(e.name)
      ) ?? null;

      // Step 2: Same postal zone (first 3 digits) + name match
      if (!bestMatch) {
        bestMatch = allSettlements.find(
          e => e.postalCode?.startsWith(postalZone) && nameMatches(e.name)
        ) ?? null;
      }

      // Step 3: Same broad zone (first 2 digits) + name match
      if (!bestMatch) {
        const broadZone = postalCode.substring(0, 2);
        bestMatch = allSettlements.find(
          e => e.postalCode?.startsWith(broadZone) && nameMatches(e.name)
        ) ?? null;
      }
    }

    // Step 4: Fallback — name-only search (no postal code or no postal match)
    if (!bestMatch) {
      const firstWord = cleanedName.split(/\s+/)[0];
      const nameMatched = searchOptions(firstWord, 8, 50);
      const candidate = nameMatched.find(opt => nameMatches(opt.label));
      if (candidate) {
        bestMatch = { id: candidate.value, name: candidate.label };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.settlementName, current.settlementId, current.postalCode, isLoading]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <section className="space-y-4">
      {/* Section 1: Basic Address Fields (always visible) */}
      <div className="space-y-3">
        {/* Row 1: Street + Number */}
        {showStreetFields && (
          <div className="grid grid-cols-3 gap-3">
            <fieldset className="col-span-2 space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Οδός</Label>
              <Input
                value={current.street}
                onChange={e => handleBasicChange('street', e.target.value)}
                placeholder="π.χ. Σαμοθράκης"
                disabled={disabled}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Αριθμός</Label>
              <Input
                value={current.number}
                onChange={e => handleBasicChange('number', e.target.value)}
                placeholder="π.χ. 16"
                disabled={disabled}
              />
            </fieldset>
          </div>
        )}

        {/* Row 2: Postal Code + Settlement / City (same line) */}
        <div className="grid grid-cols-3 gap-3">
          <fieldset className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Τ.Κ.</Label>
            <Input
              value={current.postalCode}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
                handleBasicChange('postalCode', val);
              }}
              placeholder="π.χ. 54621"
              maxLength={5}
              inputMode="numeric"
              disabled={disabled}
            />
          </fieldset>
          <fieldset className="col-span-2 space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              Οικισμός / Πόλη
            </Label>
            <SearchableCombobox
              value={current.settlementName}
              onValueChange={(newValue, option) => handleSettlementChange(newValue, option)}
              options={settlementOptions}
              placeholder="π.χ. Θεσσαλονίκη, Μαρούσι, Λεπτοκαρυά..."
              emptyMessage="Πληκτρολογήστε για αναζήτηση..."
              isLoading={isLoading}
              allowFreeText
              disabled={disabled}
              maxDisplayed={30}
            />
          </fieldset>
        </div>
      </div>

      {/* Section 2: Collapsible Greek Administrative Hierarchy */}
      <div className="border-t border-border pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground"
          onClick={() => setIsHierarchyOpen(prev => !prev)}
        >
          <span className="flex items-center gap-2 text-xs font-medium">
            <MapPin className="h-3.5 w-3.5" />
            Διοικητική Διαίρεση Ελλάδας
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
                  <label className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </label>
                  <SearchableCombobox
                    value={currentName}
                    onValueChange={(newValue, option) =>
                      handleHierarchyChange(field.level, newValue, option)
                    }
                    options={optionsByLevel.get(field.level) ?? []}
                    placeholder={field.placeholder}
                    emptyMessage="Πληκτρολογήστε για αναζήτηση..."
                    isLoading={isLoading}
                    allowFreeText
                    disabled={disabled}
                    maxDisplayed={30}
                    className={isAutoFilled ? 'opacity-75' : ''}
                  />
                </fieldset>
              );
            })}

            {/* Country — auto-filled as "Ελλάδα" for Greek admin hierarchy */}
            <fieldset className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Χώρα
              </label>
              <Input
                value="Ελλάδα"
                disabled
                readOnly
                className="opacity-75"
              />
            </fieldset>
          </div>
        )}
      </div>
    </section>
  );
}
