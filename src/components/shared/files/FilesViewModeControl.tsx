'use client';
/**
 * @fileoverview **Η επιλογή προβολής των αρχείων** — τριμερής σε υπολογιστή, ΕΝΑ κουμπί στο κινητό.
 * @related ADR-912 §12.14 · ADR-031 · `EntityFilesToolbar.tsx` (ο καταναλωτής)
 * @module components/shared/files/FilesViewModeControl
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390px)**: πλέγμα · λίστα · δέντρο = τρία κουμπιά σε δική τους γραμμή.
 *   Το δέντρο (και η εναλλαγή επιχειρησιακή/τεχνική όψη) είναι εργαλείο υπολογιστή: στα 358px δεν χωρά βάθος φακέλων.
 * 🔑 **Drive / Dropbox mobile**: ΕΝΑ κουμπί που δείχνει **την άλλη** προβολή (λίστα ⇄ πλέγμα). Η ετικέτα λέει τι θα
 *   γίνει με το πάτημα, όχι τι ισχύει τώρα (Material: «icon button that toggles» · WAI-ARIA: όνομα = ενέργεια).
 * 🔑 Αν το κινητό βρει την προβολή «δέντρο» (επιλέχθηκε σε υπολογιστή και μετά στένεψε το παράθυρο), το κουμπί οδηγεί
 *   στη λίστα· η προβολή δεν αλλάζει μόνη της κάτω από τον άνθρωπο.
 * 🔑 **CSS, όχι μέτρηση**: είναι θέμα **ορατότητας**, όχι δομής — άρα `md:` (= `MOBILE_BREAKPOINT`, το ίδιο 768), σωστό
 *   από το πρώτο καρέ του διακομιστή, χωρίς αναλαμπή σε υπολογιστή. Η μέτρηση (`useViewportClass`) μένει εκεί όπου
 *   κάτι **μετακομίζει** (η κάτω μπάρα).
 */
import React from 'react';
import { Code, Eye, Grid3X3, Image as ImageIcon, List, Network, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export type FilesViewMode = 'list' | 'tree' | 'gallery';
export type FilesTreeViewMode = 'business' | 'technical';

export interface FilesViewModeControlProps {
  readonly viewMode: FilesViewMode;
  readonly onViewModeChange: (mode: FilesViewMode) => void;
  readonly treeViewMode: FilesTreeViewMode;
  readonly onTreeViewModeChange: (mode: FilesTreeViewMode) => void;
  readonly displayStyle: 'standard' | 'media-gallery' | 'floorplan-gallery';
}

interface ModeOption<T extends string> {
  readonly value: T;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tooltip: string;
}

/** Ομάδα εικονιδίων-εναλλαγών με ετικέτα και tooltip — η ίδια για την προβολή και για την όψη του δέντρου. */
function ModeGroup<T extends string>({ label, options, value, onChange }: {
  readonly label: string;
  readonly options: readonly ModeOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const iconSizes = useIconSizes();
  return (
    <div className="flex gap-1 rounded-md border p-1 max-md:hidden" role="group" aria-label={label}>
      {options.map(({ value: option, icon: Icon, label: optionLabel, tooltip }) => (
        <Tooltip key={option}>
          <TooltipTrigger asChild>
            <ToggleButton
              pressed={value === option}
              variant="ghost"
              size="sm"
              onClick={() => onChange(option)}
              aria-label={optionLabel}
              className="px-2"
            >
              <Icon className={iconSizes.sm} aria-hidden="true" />
            </ToggleButton>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function FilesViewModeControl({
  viewMode,
  onViewModeChange,
  treeViewMode,
  onTreeViewModeChange,
  displayStyle,
}: FilesViewModeControlProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const iconSizes = useIconSizes();
  const gallery: ModeOption<FilesViewMode> = {
    value: 'gallery',
    icon: displayStyle === 'floorplan-gallery' ? ImageIcon : Grid3X3,
    label: t('manager.viewGallery'),
    tooltip: t('manager.viewGalleryTooltip'),
  };
  const list: ModeOption<FilesViewMode> = { value: 'list', icon: List, label: t('manager.viewList'), tooltip: t('manager.viewList') };

  const tree: ModeOption<FilesViewMode> = { value: 'tree', icon: Network, label: t('manager.viewTree'), tooltip: t('manager.viewTree') };
  // Στο κινητό: ΕΝΑ κουμπί προς την άλλη προβολή (από «δέντρο» ⇒ λίστα).
  const next = viewMode === 'list' ? gallery : list;
  const NextIcon = next.icon;
  return (
    <>
      {/* Κουμπί ενέργειας, όχι εναλλαγή: το όνομα λέει πού πηγαίνει (ένα `aria-pressed` εδώ θα έλεγε ψέματα). */}
      <Button type="button" variant="outline" size="sm" onClick={() => onViewModeChange(next.value)} aria-label={next.label} className="shrink-0 px-2 md:hidden">
        <NextIcon className={iconSizes.sm} aria-hidden="true" />
      </Button>
      <ModeGroup label={t('manager.viewModeGroup')} options={[gallery, list, tree]} value={viewMode} onChange={onViewModeChange} />
      {viewMode === 'tree' && (
        <ModeGroup
          label={t('manager.treeViewModeGroup')}
          options={[
            { value: 'business', icon: Eye, label: t('manager.businessView'), tooltip: t('manager.businessViewTooltip') },
            { value: 'technical', icon: Code, label: t('manager.technicalView'), tooltip: t('manager.technicalViewTooltip') },
          ]}
          value={treeViewMode}
          onChange={onTreeViewModeChange}
        />
      )}
    </>
  );
}
