'use client';

/**
 * ADR-901 Φ1 — μία ενότητα του καταλόγου (Α ακινήτου · Β πωλητή · Γ αγοραστή · Δ συναλλαγής).
 * Ό,τι θέλει ενέργεια εμφανίζεται πρώτο (σχήμα «inbox»)· οι γραμμές που δεν εφαρμόζονται
 * λόγω απαντήσεων διπλώνονται στο τέλος — ορατές, όχι σιωπηλά χαμένες.
 *
 * @module components/sales/conveyance/ConveyanceChecklistSection
 */

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { ChecklistSection } from '@/config/conveyance-checklist/types';
import type { ChecklistRow } from '@/types/conveyance-case';
import { ConveyanceChecklistRow, type OpenEvidenceFile, type RowDialogMode } from './ConveyanceChecklistRow';
import { STATUS_ORDER } from './conveyance-presentation';

interface ConveyanceChecklistSectionProps {
  readonly section: ChecklistSection;
  readonly rows: readonly ChecklistRow[];
  readonly canEdit: boolean;
  readonly onOpenDialog: (row: ChecklistRow, mode: RowDialogMode) => void;
  readonly onClear: (row: ChecklistRow) => void;
  /** ADR-901 Φ4 — ο επαγγελματίας ανοίγει/κατεβάζει τεκμήρια· ο οικοδεσπότης δεν το περνά. */
  readonly onOpenFile?: OpenEvidenceFile;
}

function byPriority(a: ChecklistRow, b: ChecklistRow): number {
  return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
}

export function ConveyanceChecklistSection({ section, rows, canEdit, onOpenDialog, onClear, onOpenFile }: ConveyanceChecklistSectionProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const [active, dormant] = useMemo(() => {
    const sorted = [...rows].sort(byPriority);
    return [sorted.filter((row) => row.notApplicableBy !== 'fact'), sorted.filter((row) => row.notApplicableBy === 'fact')];
  }, [rows]);

  if (rows.length === 0) return null;
  const renderRow = (row: ChecklistRow) => (
    <li key={row.itemId}>
      <ConveyanceChecklistRow row={row} canEdit={canEdit} onOpenDialog={onOpenDialog} onClear={onClear} onOpenFile={onOpenFile} />
    </li>
  );

  return (
    <section className="rounded-lg border bg-card p-3" aria-labelledby={`conveyance-section-${section}`}>
      <header className="mb-1">
        <h3 id={`conveyance-section-${section}`} className="text-sm font-semibold">{t(`sections.${section}`)}</h3>
        <p className={cn('text-xs', colors.text.muted)}>{t(`sectionHints.${section}`)}</p>
      </header>
      <ul className="divide-y">{active.map(renderRow)}</ul>
      {dormant.length > 0 && (
        <details className="mt-2">
          <summary className={cn('cursor-pointer text-xs', colors.text.muted)}>
            {t('row.notApplicableByFact')} ({dormant.length})
          </summary>
          <ul className="divide-y">{dormant.map(renderRow)}</ul>
        </details>
      )}
    </section>
  );
}
