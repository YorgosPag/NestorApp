/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * ============================================================================
 * ESCO Occupation Picker (ADR-132 · ADR-601)
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
import { Badge } from '@/components/ui/badge';
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
      selectedInputPadding="pr-24"
      leftIcon={<Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none", colors.text.muted)} />}
      badge={
        /*
          🔴 ADR-798 §8 — ΗΤΑΝ ΑΟΡΑΤΟ, ΟΧΙ ΑΠΛΩΣ ΔΥΣΑΝΑΓΝΩΣΤΟ.

          Εδώ έγραφε χειροποίητο `<span … bg-[hsl(var(--bg-info))]/20 text-primary>`.
          Στο **προεπιλεγμένο (σκοτεινό)** θέμα το `--primary` λύνεται σε
          `rgb(29,40,58)` — **ταυτόσημο** με το `--card` — άρα το κείμενο μετρήθηκε
          ζωντανά στο **1,00:1** πάνω στην επιφάνεια και **1,01:1** πάνω στο ίδιο το
          chip. Είναι η κλάση που τεκμηριώνει το CHECK 3.38 / ADR-770.

          ⚠️ **Η ΠΡΟΦΑΝΗΣ ΔΙΟΡΘΩΣΗ ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ**: το
          `text-[hsl(var(--text-info))]` — που χρησιμοποιεί ο **αδελφός**
          `EmployerPicker` — δίνει **5,77:1** στο σκοτεινό αλλά **3,19:1** στο
          **φωτεινό**, δηλαδή **κάτω από το AA**. Θα αντάλλασσε το ένα θέμα με το
          άλλο, αντί να θεραπεύσει.

          ✅ Το Badge SSoT με `variant="info"` είναι ζεύγος **`on-*`** (Material 3):
          γέμισμα `--status-info` + λευκό κείμενο ⇒ **5,17:1 ΚΑΙ ΣΤΑ ΔΥΟ** θέματα,
          σωστό **εκ κατασκευής** και όχι κατά τύχη. Ταυτόχρονα φεύγει ένα
          χειροποίητο badge υπέρ του κεντρικού (N.0.2).

          ⚠️ **ΜΗΝ το «λύσεις» αλλάζοντας το `--primary`** — απορρίφθηκε γραπτώς
          στο ADR-682 §5.5 και το επαναλαμβάνει το CLAUDE.md (CHECK 3.38).

          🔑 **Το `selectedInputPadding` ΔΕΝΕΤΑΙ με αυτό το badge.** Μετρημένο
          ζωντανά: το badge πιάνει `right-10` (40px) **+ 53px πλάτος = 93px** από
          το δεξί χείλος, ενώ το `pr-16` (64px) ήταν **μικρότερο από το ίδιο το
          badge** — δηλαδή σε στενή οθόνη το κείμενο περνούσε **από κάτω** του.
          Έγινε `pr-24` (96px). Αν αλλάξεις γέμιση/μέγεθος του badge, **ξαναμέτρα**:
          σε φαρδιά οθόνη η επικάλυψη είναι αόρατη και το test δεν τη ρωτά.
        */
        <Badge
          variant="info"
          className="absolute right-10 top-1/2 -translate-y-1/2 font-medium"
        >
          {t('esco.badge')}
        </Badge>
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
