/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * ============================================================================
 * ESCO Occupation Picker (ADR-034 · ADR-601)
 * ============================================================================
 *
 * Autocomplete for selecting ESCO-standardized occupations (bilingual EL/EN +
 * ISCO code). Search/debounce/keyboard/listbox + the linked-single-select shell
 * come from the shared picker SSoT. This component owns ONLY its data source
 * (EscoService) and its value shape (profession text + optional ESCO metadata).
 *
 * @module components/shared/EscoOccupationPicker
 */

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { EscoService } from '@/services/esco.service';
import type { EscoOccupationPickerProps, EscoSearchResult, EscoPickerValue } from '@/types/contacts/esco-types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { pickBilingualLabel, resolveEscoLang } from '@/components/shared/esco/esco-label';
import { LinkedSinglePickerView, useContactPickerTranslation } from '@/components/shared/pickers';
import '@/lib/design-system';

/** Maximum results to display */
const MAX_RESULTS = 10;

// ============================================================================
// COMPONENT
// ============================================================================

export function EscoOccupationPicker({
  value,
  escoUri,
  iscoCode: _iscoCode,
  onChange,
  disabled = false,
  placeholder,
  language,
}: EscoOccupationPickerProps) {
  const { t, i18n } = useContactPickerTranslation();
  const colors = useSemanticColors();
  const { lang, otherLang } = resolveEscoLang(language, i18n.language);

  const search = useCallback(async (query: string): Promise<EscoSearchResult[]> => {
    const response = await EscoService.searchOccupations({ query, language: lang, limit: MAX_RESULTS });
    return response.results;
  }, [lang]);

  return (
    <LinkedSinglePickerView<EscoSearchResult, EscoPickerValue>
      value={value}
      linkedId={escoUri}
      search={search}
      getResultLabel={(r) => pickBilingualLabel(r.occupation.preferredLabel, lang)}
      buildSelected={(r, label) => ({
        profession: label,
        escoUri: r.occupation.uri,
        escoLabel: label,
        iscoCode: r.occupation.iscoCode,
      })}
      buildFreeText={(text) => ({ profession: text, escoUri: undefined, escoLabel: undefined, iscoCode: undefined })}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder ?? t('individual.placeholders.profession')}
      clearLabel={t('common.clear')}
      selectedInputPadding="pr-16"
      leftIcon={<Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none", colors.text.muted)} />}
      badge={
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium px-1.5 py-0.5 rounded bg-[hsl(var(--bg-info))]/20 text-primary">
          {t('esco.badge')}
        </span>
      }
      getKey={(r) => r.occupation.uri}
      renderItemContent={(result) => (
        <>
          <span className="text-sm font-medium">
            {pickBilingualLabel(result.occupation.preferredLabel, lang)}
            <span className={cn("ml-2 text-xs font-mono", colors.text.muted)}>
              ({result.occupation.iscoCode})
            </span>
          </span>
          <span className={cn("text-xs", colors.text.muted)}>
            {pickBilingualLabel(result.occupation.preferredLabel, otherLang)}
          </span>
        </>
      )}
      labels={{
        searchResults: t('esco.searchResults'),
        noResults: t('esco.noResults'),
        useFreeText: t('esco.useFreeText'),
      }}
    />
  );
}

export default EscoOccupationPicker;
