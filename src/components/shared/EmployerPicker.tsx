'use client';

/**
 * ============================================================================
 * Employer Picker — Entity-Linked Autocomplete (ADR-177 · ADR-601)
 * ============================================================================
 *
 * Autocomplete for selecting an employer from existing Company contacts.
 * Search/debounce/keyboard/listbox + the linked-single-select shell come from
 * the shared picker SSoT (useLinkedSinglePicker → useAsyncPickerSearch +
 * PickerPopoverShell + PickerSearchInput + PickerResultsList). This component
 * owns ONLY its data source (ContactsService client cache) and its value shape.
 * Migrated off the raw `<PopoverTrigger>` (fixes the zero-height dropdown flash).
 *
 * @module components/shared/EmployerPicker
 */

import React, { useRef, useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import { ContactsService } from '@/services/contacts.service';
import type { CompanyContact } from '@/types/contacts';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { LinkedSinglePickerView, useContactPickerTranslation } from '@/components/shared/pickers';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

/** Value emitted by EmployerPicker */
export interface EmployerPickerValue {
  /** Human-readable employer text (always set) */
  employer: string;
  /** Linked Company contact ID (set only when user selects from autocomplete) */
  employerId?: string;
}

/** Props for EmployerPicker */
interface EmployerPickerProps {
  /** Current employer text value */
  value: string;
  /** Linked Company contact ID (undefined = free text) */
  employerId?: string;
  /** Callback when value changes */
  onChange: (value: EmployerPickerValue) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Custom placeholder text */
  placeholder?: string;
}

/** Maximum results to display */
const MAX_RESULTS = 10;

const logger = createModuleLogger('EmployerPicker');

/** Internal search result shape */
interface CompanySearchResult {
  id: string;
  companyName: string;
  tradeName?: string;
  vatNumber?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EmployerPicker({
  value,
  employerId,
  onChange,
  disabled = false,
  placeholder,
}: EmployerPickerProps) {
  const { t } = useContactPickerTranslation();
  const colors = useSemanticColors();

  // Cache: all company contacts (fetched once, filtered client-side)
  const companyCacheRef = useRef<CompanySearchResult[] | null>(null);
  const fetchingRef = useRef(false);

  const fetchCompanyContacts = useCallback(async (): Promise<CompanySearchResult[]> => {
    if (companyCacheRef.current) return companyCacheRef.current;
    if (fetchingRef.current) return [];

    fetchingRef.current = true;
    try {
      // Fetch all contacts without type filter to avoid composite index requirement.
      // Client-side filtering is more resilient and company count is typically <500.
      const { contacts } = await ContactsService.getAllContacts({ limitCount: 500 });

      const mapped: CompanySearchResult[] = contacts
        .filter((c): c is CompanyContact => c.type === 'company')
        .map((c) => ({
          id: c.id ?? '',
          companyName: c.companyName ?? '',
          tradeName: c.tradeName,
          vatNumber: c.vatNumber,
        }))
        .filter((c) => c.id && c.companyName);

      companyCacheRef.current = mapped;
      logger.info('Company contacts cached', { count: mapped.length });
      return mapped;
    } catch (error) {
      logger.error('Failed to fetch company contacts', { error });
      return [];
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Data source — owns filtering + slicing
  const search = useCallback(async (query: string): Promise<CompanySearchResult[]> => {
    const companies = await fetchCompanyContacts();
    const term = query.toLowerCase().trim();
    return companies
      .filter((c) => {
        const nameMatch = c.companyName.toLowerCase().includes(term);
        const tradeMatch = c.tradeName?.toLowerCase().includes(term) ?? false;
        const vatMatch = c.vatNumber?.includes(term) ?? false;
        return nameMatch || tradeMatch || vatMatch;
      })
      .slice(0, MAX_RESULTS);
  }, [fetchCompanyContacts]);

  return (
    <LinkedSinglePickerView<CompanySearchResult, EmployerPickerValue>
      value={value}
      linkedId={employerId}
      search={search}
      getResultLabel={(r) => r.companyName}
      buildSelected={(r, label) => ({ employer: label, employerId: r.id })}
      buildFreeText={(text) => ({ employer: text, employerId: undefined })}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder ?? t('individual.placeholders.employer')}
      clearLabel={t('common.clear')}
      selectedInputPadding="pr-20"
      leftIcon={<Building2 className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none", colors.text.muted)} />}
      badge={
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium text-[hsl(var(--text-success))] bg-[hsl(var(--bg-success))]/10 px-1.5 py-0.5 rounded">
          {t('employer.linkedBadge')}
        </span>
      }
      getKey={(r) => r.id}
      renderItemContent={(result) => (
        <>
          <span className="text-sm font-medium">
            {result.companyName}
            {result.tradeName && result.tradeName !== result.companyName && (
              <span className={cn("ml-1.5 text-xs", colors.text.muted)}>
                ({result.tradeName})
              </span>
            )}
          </span>
          {result.vatNumber && (
            <span className={cn("text-xs", colors.text.muted)}>
              {t('employer.vat')}: {result.vatNumber}
            </span>
          )}
        </>
      )}
      labels={{
        searchResults: t('employer.searchResults'),
        noResults: t('employer.noResults'),
        useFreeText: t('employer.useFreeText'),
      }}
    />
  );
}

export default EmployerPicker;
