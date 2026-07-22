'use client';

/**
 * ImportedMeshListRow — ADR-683 **Φ3.1γ**: μία γραμμή του πάνελ εισαγόμενων.
 *
 * Δείχνει τον κόμβο και **την κατάστασή του**: ανατεθειμένος → άρθρο + μονάδα· ανανάθετος →
 * ρητή σήμανση εκκρεμότητας. Το κλικ είναι μία κίνηση («πήγαινέ με εκεί και άνοιξε το έντυπο»),
 * γι' αυτό ολόκληρη η γραμμή είναι `<button>` — όχι γραμμή με κρυφό κουμπί δράσης στην άκρη.
 *
 * Οι ετικέτες μονάδων έρχονται από τα **υπάρχοντα** κλειδιά του dialog (`importedMeshBoq.units.*`)
 * και όχι από νέα: μία ανάθεση πρέπει να διαβάζεται το ίδιο όπου κι αν εμφανίζεται.
 *
 * @see ../../../bim/entities/imported-mesh/imported-mesh-panel-rows — `ImportedMeshRow`
 * @see ../../components/imported-mesh/ImportedMeshBoqDialog — ο ιδιοκτήτης των ετικετών μονάδων
 */

import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ImportedMeshRow } from '../../../bim/entities/imported-mesh/imported-mesh-panel-rows';
import {
  IMPORTED_MESH_CATEGORY,
  importedMeshAssetId,
} from '../../../bim/entities/imported-mesh/imported-mesh-types';
import { bimMeshCache } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';

export interface ImportedMeshListRowProps {
  readonly row: ImportedMeshRow;
  /** Το αρχείο της εισαγωγής — μαζί με το `nodeName` σχηματίζει το κλειδί mesh για τον cache. */
  readonly uploadId: string;
  readonly onSelect: (entityId: string) => void;
}

export function ImportedMeshListRow({ row, uploadId, onSelect }: ImportedMeshListRowProps) {
  const { t } = useTranslation(['dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();

  // ADR-683 §mesh-load-missing-file — το `.glb` του κόμβου μπορεί να λείπει από το Storage (ορφανή
  // οντότητα): τότε το πλέγμα μένει μόνιμο placeholder κουτί. Το σημαίνουμε ρητά αντί για σιωπηλή
  // απουσία. Reactivity μέσω `meshAssetVersion` (bump και σε αποτυχία φόρτωσης — low-freq).
  const meshAssetVersion = useBim3DEntitiesStore((s) => s.meshAssetVersion);
  const fileUnavailable = useMemo(
    () =>
      bimMeshCache.getLoadState(IMPORTED_MESH_CATEGORY, importedMeshAssetId(uploadId, row.nodeName)) ===
      'error',
    [uploadId, row.nodeName, meshAssetVersion],
  );

  const assignment = row.assigned
    ? [row.categoryCode, row.unit ? t(`dxf-viewer-shell:importedMeshBoq.units.${row.unit}`) : null]
        .filter(Boolean)
        .join(' · ')
    : t('panels.importedMeshes.unassigned');

  const fullName = row.titleEL ?? row.nodeName;
  const tooltip = fileUnavailable ? `${fullName} — ${t('panels.importedMeshes.fileUnavailable')}` : fullName;

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(row.entityId)}
            className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${colors.text.primary}`}
          >
            <span className="truncate">{row.nodeName}</span>
            <span className="flex shrink-0 items-center gap-1">
              {fileUnavailable && (
                <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                  ⚠ {t('panels.importedMeshes.fileUnavailable')}
                </span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  row.assigned ? colors.text.muted : 'bg-destructive/15 text-destructive'
                }`}
              >
                {assignment}
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </li>
  );
}
