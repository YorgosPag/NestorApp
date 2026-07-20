'use client';

/**
 * ImportedMeshUploadSection — ADR-683 **Φ3.1γ**: μία εισαγωγή (`.glb`) με τους κόμβους της.
 *
 * Η ομάδα είναι πρώτης τάξεως γιατί το `uploadId` **είναι** η ταυτότητα «αυτά ήρθαν μαζί»
 * (linked-model μοντέλο, βλ. `imported-mesh-types`). Ο χρήστης ρωτά «τι μου έστειλε ο συνεργάτης
 * Χ;», όχι «ποιοι κόμβοι υπάρχουν συνολικά» — ίδια γραμμή με το Manage Links του Revit.
 *
 * @see ../../../bim/entities/imported-mesh/imported-mesh-panel-rows — `ImportedMeshUploadGroup`
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ImportedMeshUploadGroup } from '../../../bim/entities/imported-mesh/imported-mesh-panel-rows';
import { ImportedMeshListRow } from './ImportedMeshListRow';

export interface ImportedMeshUploadSectionProps {
  readonly group: ImportedMeshUploadGroup;
  readonly onSelect: (entityId: string) => void;
}

export function ImportedMeshUploadSection({ group, onSelect }: ImportedMeshUploadSectionProps) {
  const colors = useSemanticColors();

  return (
    <article className="flex flex-col gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <h4 className={`truncate px-1 text-[11px] font-medium ${colors.text.muted}`}>
            {group.sourceFileName}
          </h4>
        </TooltipTrigger>
        <TooltipContent>{group.sourceFileName}</TooltipContent>
      </Tooltip>
      <ul className="flex flex-col">
        {group.rows.map((row) => (
          <ImportedMeshListRow key={row.entityId} row={row} onSelect={onSelect} />
        ))}
      </ul>
    </article>
  );
}
