/**
 * =============================================================================
 * 🏢 ENTERPRISE: Upload Entry Point Selector
 * =============================================================================
 *
 * UI για επιλογή τύπου εγγράφου πριν το upload.
 * Enterprise pattern από Salesforce, Dynamics, SAP.
 *
 * @module components/shared/files/UploadEntryPointSelector
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * @example
 * ```tsx
 * <UploadEntryPointSelector
 *   entityType="contact"
 *   selectedEntryPointId={selected}
 *   onSelect={(entryPoint) => setSelected(entryPoint.id)}
 * />
 * ```
 */

'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { SearchInput } from '@/components/ui/search/SearchInput';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ContactType } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import { selectOfferedEntryPoints } from '@/config/upload-entry-points';
import '@/lib/design-system';
import { gridPatterns } from '@/styles/design-tokens';
// ADR-784 §10.7 / CHECK 3.28 — κοινό συμβόλαιο + κοινό πεδίο τίτλου με τον HierarchicalEntryPointSelector.
// ADR-866 §2.10.8 Β4 — και η ΜΙΑ κάρτα τύπου: ήταν χειρόγραφο αντίγραφο του `EntryCard` (χωρίς `relative`).
import {
  EntryCard,
  EntryPointCustomTitleInput,
  type EntryPointSelectorBaseProps,
} from './entry-point-selector-shared';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ADR-784 §10.7 — τα δέκα κοινά props ζουν στη **βάση**· εδώ μένει ό,τι είναι ειδικό για τη ροή
 * μεταφόρτωσης (φιλτράρισμα κατά πρόσωπο επαφής, ADR-121).
 */
export interface UploadEntryPointSelectorProps extends EntryPointSelectorBaseProps {
  /** 🏢 ENTERPRISE: Contact type for persona-aware filtering (individual/company/service) */
  contactType?: ContactType;
  /** 🎭 ENTERPRISE: Active personas for individual contacts (ADR-121) */
  activePersonas?: PersonaType[];
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Upload Entry Point Selector
 *
 * Displays available entry points για το συγκεκριμένο entity type.
 * User selects τι τύπο εγγράφου θα ανεβάσει (ταυτότητα, φωτογραφία, κτλ).
 */
export function UploadEntryPointSelector({
  entityType,
  selectedEntryPointId,
  onSelect,
  className,
  language, // Optional override - defaults to current i18n language
  customTitle = '',
  onCustomTitleChange,
  categoryFilter,
  excludeCategories,
  allowedEntryPointIds,
  contactType,
  activePersonas,
}: UploadEntryPointSelectorProps) {
  const { t, i18n } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const [searchQuery, setSearchQuery] = useState('');

  // 🏢 ENTERPRISE: Use current i18n language unless explicitly overridden
  // Fixes bug where cards showed Greek text even with English selected
  const currentLanguage = (language || i18n.language?.split('-')[0] || 'en') as 'el' | 'en';

  // 🏢 ENTERPRISE: persona-aware για επαφές + φίλτρα κατηγορίας/λευκής λίστας — ο ΕΝΑΣ κριτής του καταλόγου
  // (ADR-866 §2.10 Β1), τον ίδιο που ρωτά η ζώνη ανεβάσματος για την κενή όψη.
  const entryPoints = selectOfferedEntryPoints({
    entityType, contactType, activePersonas, categoryFilter, excludeCategories, allowedEntryPointIds,
  });

  // 🏢 ENTERPRISE: Search filtering — searches both el/en label + description
  // "Άλλο Έγγραφο" (requiresCustomTitle) is always pinned visible
  const filteredEntryPoints = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return entryPoints;

    return entryPoints.filter((ep) => {
      // Always pin "Άλλο Έγγραφο" cards
      if (ep.requiresCustomTitle) return true;

      const haystack = [
        ep.label.el,
        ep.label.en,
        ep.description?.el,
        ep.description?.en,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(trimmed);
    });
  }, [entryPoints, searchQuery]);

  // Get selected entry point
  const selectedEntryPoint = entryPoints.find((ep) => ep.id === selectedEntryPointId);

  // If no entry points defined, return null
  if (entryPoints.length === 0) {
    return null;
  }

  const showSearch = entryPoints.length > 8;

  return (
    <section className={cn('space-y-2', className)} role="radiogroup" aria-label={t('upload.selectDocumentType')}>
      {/* Header */}
      <header>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t('upload.typeQuestion')}
        </h3>
        <p className={cn("text-xs", colors.text.muted)}>
          {t('upload.categoryHint')}
        </p>
      </header>

      {/* Search Input — visible only when >8 entry points */}
      {showSearch && (
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('upload.searchDocumentPlaceholder')}
          debounceMs={0}
          className="text-sm"
        />
      )}

      {/* Entry Points Grid */}
      {filteredEntryPoints.length === 0 ? (
        <p className={cn("py-6 text-center text-sm", colors.text.muted)}>
          {t('upload.noSearchResults')}
        </p>
      ) : (
        <div className={`gap-2 grid ${gridPatterns.cards.chip}`}>
          {filteredEntryPoints.map((entryPoint) => (
            <EntryCard
              key={entryPoint.id}
              entryPoint={entryPoint}
              isSelected={selectedEntryPointId === entryPoint.id}
              currentLanguage={currentLanguage}
              onSelect={onSelect}
              freeTitleLabel={t('upload.freeTitle')}
            />
          ))}
        </div>
      )}

      {/* Selected description */}
      {selectedEntryPointId && (
        <footer className="p-2 bg-muted/50 rounded-md border border-border">
          {entryPoints
            .filter((ep) => ep.id === selectedEntryPointId)
            .map((ep) => (
              <p key={ep.id} className={cn("text-xs", colors.text.muted)}>
                <strong className="text-foreground">{ep.label[currentLanguage]}:</strong>{' '}
                {ep.description?.[currentLanguage] || t('upload.documentForCategory')}
              </p>
            ))}
        </footer>
      )}

      {/* 🏢 ENTERPRISE: Custom Title Input (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
          Displayed when selected entry point requires custom title */}
      {/* ADR-784 §10.7 / CHECK 3.28 — ΕΝΑ πεδίο, κοινό με τον HierarchicalEntryPointSelector. */}
      {selectedEntryPoint?.requiresCustomTitle && (
        <EntryPointCustomTitleInput
          htmlId="custom-title"
          customTitle={customTitle}
          onCustomTitleChange={onCustomTitleChange}
        />
      )}
    </section>
  );
}
