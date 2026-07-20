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

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ImportedMeshRow } from '../../../bim/entities/imported-mesh/imported-mesh-panel-rows';

export interface ImportedMeshListRowProps {
  readonly row: ImportedMeshRow;
  readonly onSelect: (entityId: string) => void;
}

export function ImportedMeshListRow({ row, onSelect }: ImportedMeshListRowProps) {
  const { t } = useTranslation(['dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();

  const assignment = row.assigned
    ? [row.categoryCode, row.unit ? t(`dxf-viewer-shell:importedMeshBoq.units.${row.unit}`) : null]
        .filter(Boolean)
        .join(' · ')
    : t('panels.importedMeshes.unassigned');

  const fullName = row.titleEL ?? row.nodeName;

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
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                row.assigned ? colors.text.muted : 'bg-destructive/15 text-destructive'
              }`}
            >
              {assignment}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{fullName}</TooltipContent>
      </Tooltip>
    </li>
  );
}
