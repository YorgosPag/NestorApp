'use client';

/**
 * Hierarchical Address Picker — Greek Administrative Division.
 *
 * Bottom-up auto-fill: the user types at ANY level (e.g. settlement),
 * and all levels above auto-populate by traversing the parent chain.
 *
 * 8 levels: Settlement > Community > Municipal Unit > Municipality >
 *           Regional Unit > Region > Decentralized Admin > Major Geo Unit
 *
 * @see src/hooks/useAdministrativeHierarchy.ts
 * @see src/data/administrative-hierarchy.json
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import {
  useAdministrativeHierarchy,
  ADMIN_LEVEL_LABELS,
  type AdminPath,
  type AdminLevel,
} from '@/hooks/useAdministrativeHierarchy';
import { MapPin } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

/** The value object emitted by this picker */
export interface AdministrativeAddress {
  settlementId: string | null;
  settlementName: string;
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
  postalCode: string;
}

interface AdministrativeAddressPickerProps {
  value?: Partial<AdministrativeAddress>;
  onChange: (address: AdministrativeAddress) => void;
  disabled?: boolean;
  /** Which levels to show. Defaults to all 8. */
  visibleLevels?: AdminLevel[];
  /** Show postal code field. Default: true */
  showPostalCode?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

const EMPTY_ADDRESS: AdministrativeAddress = {
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
  postalCode: '',
};

/** Maps AdminPath keys to AdministrativeAddress field pairs */
const PATH_TO_ADDRESS: Array<{
  pathKey: keyof AdminPath;
  idField: keyof AdministrativeAddress;
  nameField: keyof AdministrativeAddress;
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

/** Placeholder i18n key mapping per level */
const LEVEL_PLACEHOLDER_KEYS: Record<AdminLevel, string> = {
  8: 'addressesSection.administrative.placeholders.city',
  7: 'addressesSection.administrative.placeholders.community',
  6: 'addressesSection.administrative.placeholders.unit',
  5: 'addressesSection.administrative.placeholders.municipality',
  4: 'addressesSection.administrative.placeholders.regionalUnit',
  3: 'addressesSection.administrative.placeholders.region',
  2: 'addressesSection.administrative.placeholders.decentralized',
  1: 'addressesSection.administrative.placeholders.geographic',
};

/** Ordered fields for display: bottom (settlement) to top (majorGeo) */
const LEVEL_FIELDS: Array<{
  level: AdminLevel;
  idField: keyof AdministrativeAddress;
  nameField: keyof AdministrativeAddress;
  label: string;
}> = [
  { level: 8, idField: 'settlementId', nameField: 'settlementName', label: ADMIN_LEVEL_LABELS[8] },
  { level: 7, idField: 'communityId', nameField: 'communityName', label: ADMIN_LEVEL_LABELS[7] },
  { level: 6, idField: 'municipalUnitId', nameField: 'municipalUnitName', label: ADMIN_LEVEL_LABELS[6] },
  { level: 5, idField: 'municipalityId', nameField: 'municipalityName', label: ADMIN_LEVEL_LABELS[5] },
  { level: 4, idField: 'regionalUnitId', nameField: 'regionalUnitName', label: ADMIN_LEVEL_LABELS[4] },
  { level: 3, idField: 'regionId', nameField: 'regionName', label: ADMIN_LEVEL_LABELS[3] },
  { level: 2, idField: 'decentAdminId', nameField: 'decentAdminName', label: ADMIN_LEVEL_LABELS[2] },
  { level: 1, idField: 'majorGeoId', nameField: 'majorGeoName', label: ADMIN_LEVEL_LABELS[1] },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function AdministrativeAddressPicker({
  value,
  onChange,
  disabled = false,
  visibleLevels,
  showPostalCode = true,
}: AdministrativeAddressPickerProps) {
  const { t } = useTranslation('contacts');
  const colors = useSemanticColors();
  const { isLoading, resolvePath, levelOptions } =
    useAdministrativeHierarchy();

  // Merge incoming value with defaults
  const currentAddress = useMemo(
    () => ({ ...EMPTY_ADDRESS, ...value }),
    [value],
  );

  // Determine visible levels (default: all 8)
  const fieldsToShow = useMemo(() => {
    if (!visibleLevels) return LEVEL_FIELDS;
    return LEVEL_FIELDS.filter((f) => visibleLevels.includes(f.level));
  }, [visibleLevels]);

  /**
   * Core logic: when user selects an entity at any level,
   * auto-fill all UPPER levels from the parent chain,
   * and clear all LOWER levels (they're no longer valid).
   */
  const handleEntitySelected = useCallback(
    (level: AdminLevel, entityId: string | null, freeTextName: string) => {
      const updated = { ...currentAddress };

      if (entityId) {
        // Resolve full path upward
        const path = resolvePath(entityId);

        // Fill all levels from the resolved path
        for (const mapping of PATH_TO_ADDRESS) {
          const entity = path[mapping.pathKey];
          if (entity) {
            (updated[mapping.idField] as string | null) = entity.id;
            (updated[mapping.nameField] as string) = entity.name;
            // Auto-fill postal code from settlement
            if (mapping.level === 8 && entity.postalCode) {
              updated.postalCode = entity.postalCode;
            }
          } else if (mapping.level < level) {
            // Clear levels BELOW the selected one (they're not determined)
            (updated[mapping.idField] as string | null) = null;
            (updated[mapping.nameField] as string) = '';
          }
        }
      } else {
        // Free text: just set the name at this level, clear ID
        const fieldDef = PATH_TO_ADDRESS.find((m) => m.level === level);
        if (fieldDef) {
          (updated[fieldDef.idField] as string | null) = null;
          (updated[fieldDef.nameField] as string) = freeTextName;
        }
        // Clear all levels below (they can't be auto-resolved from free text)
        for (const mapping of PATH_TO_ADDRESS) {
          if (mapping.level > level) {
            (updated[mapping.idField] as string | null) = null;
            (updated[mapping.nameField] as string) = '';
          }
        }
      }

      onChange(updated);
    },
    [currentAddress, onChange, resolvePath],
  );

  /**
   * Memoized options per level.
   * SearchableCombobox handles client-side filtering internally.
   * Even 13K settlements filter in <5ms via JS string includes.
   */
  const optionsByLevel = useMemo(() => {
    if (isLoading) return new Map<number, ComboboxOption[]>();
    const map = new Map<number, ComboboxOption[]>();
    for (const field of LEVEL_FIELDS) {
      map.set(field.level, levelOptions(field.level));
    }
    return map;
  }, [isLoading, levelOptions]);

  return (
    <section className="space-y-3" aria-label={t('addressesSection.administrative.title')}>
      <header className={cn("flex items-center gap-2 text-sm font-medium", colors.text.muted)}>
        <MapPin className="h-4 w-4" />
        <span>{t('addressesSection.administrative.title')}</span>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fieldsToShow.map((field) => {
          const currentName = currentAddress[field.nameField] as string;
          const currentId = currentAddress[field.idField] as string | null;
          const isAutoFilled = currentId !== null;

          return (
            <fieldset
              key={field.level}
              className="space-y-1"
            >
              <label className={cn("text-xs font-medium", colors.text.muted)}>
                {field.label}
              </label>
              <SearchableCombobox
                value={currentName}
                onValueChange={(newValue, option) => {
                  handleEntitySelected(
                    field.level,
                    option?.value ?? null,
                    newValue,
                  );
                }}
                options={optionsByLevel.get(field.level) ?? []}
                placeholder={t(LEVEL_PLACEHOLDER_KEYS[field.level])}
                emptyMessage={t('addressesSection.administrative.searchHint')}
                isLoading={isLoading}
                allowFreeText
                disabled={disabled}
                maxDisplayed={30}
                className={isAutoFilled ? 'opacity-75' : ''}
              />
            </fieldset>
          );
        })}

        {showPostalCode && (
          <fieldset className="space-y-1">
            <label className={cn("text-xs font-medium", colors.text.muted)}>
              {t('addressesSection.administrative.postalCode')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={currentAddress.postalCode}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
                onChange({ ...currentAddress, postalCode: val });
              }}
              placeholder={t('addressesSection.administrative.postalCodePlaceholder')}
              disabled={disabled}
              maxLength={5}
              className={cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder: focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", colors.text.muted)}
            />
          </fieldset>
        )}
      </div>
    </section>
  );
}
