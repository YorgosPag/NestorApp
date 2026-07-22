'use client';

/**
 * ImportedMeshMaterialMapDialog — ADR-686 Φ5 (Revit «Material Mapping»): ο χρήστης αντιστοιχίζει
 * **ανά κομμάτι** ενός εισαγόμενου μοντέλου (καρέκλα = δεκάδες κόμβοι) ένα υλικό βιβλιοθήκης.
 *
 * ## Γιατί πίνακας, όχι σύρσιμο ένα-ένα
 *
 * Το drag-drop υλικού πάνω σε κάθε κομμάτι ήδη δουλεύει (ΣΩΜΑ path, `applyEntityFaceAppearanceMap`),
 * αλλά ένα `.glb` φέρνει δεκάδες κόμβους με cryptic ονόματα (`HBase`, `HPellBk`, `HArmPads`). Η
 * πρακτική των μεγάλων (Revit Material Mapping / ArchiCAD) είναι **ένας πίνακας**: όλα τα κομμάτια
 * σε λίστα, ένα dropdown υλικού δίπλα στο καθένα, batch εφαρμογή σε ένα undo βήμα.
 *
 * ## Καθαρό component (props in, callbacks out)
 *
 * Καμία γνώση σκηνής/command/βιβλιοθήκης — αυτά ζουν στον `ImportedMeshMaterialMapHost`. Εδώ μόνο
 * το draft του εντύπου (entityId → materialId) και η συλλογή **των αλλαγών** στο «Εφαρμογή»: ό,τι
 * δεν άλλαξε δεν ξαναγράφεται (μηδέν άσκοπο undo entry).
 *
 * @see ../../../app/ImportedMeshMaterialMapHost — ο μεσάζων (scene + useMaterialLibrary + batch command)
 * @see ./ImportedMeshBoqDialog — το mirror template (ίδιο entity type, dialog + Select)
 * @see docs/centralized-systems/reference/adrs/ADR-686-imported-mesh-appearance-override.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Palette } from 'lucide-react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import type { BimMaterial } from '../../../bim/types/bim-material-types';
// ADR-686 Φ5 — ΙΔΙΑ λίστα υλικών με το PolygonMaterialPanel (catalog cladding + user library + flat
// χρώματα): κοινός SSoT `buildBodySwatches`. Χωρίς αυτό το dropdown έδειχνε μόνο το (συχνά άδειο) user library.
import { buildBodySwatches } from '../../../bim-3d/ui/polygon-material-swatches';
import { MaterialSwatch } from '../shared/MaterialSwatch';

const K = 'importedMeshMaterialMap';

/** Μία γραμμή του πίνακα — ένα κομμάτι (κόμβος) του μοντέλου με το τρέχον override του. */
export interface ImportedMeshMaterialMapRow {
  readonly entityId: string;
  readonly nodeName: string;
  /** Το ήδη αντιστοιχισμένο υλικό (`faceAppearance['*'].materialId`), ή `null` (auto/embedded). */
  readonly currentMaterialId: string | null;
}

/** Το αποτέλεσμα του «Εφαρμογή»: μόνο τα κομμάτια που ΑΛΛΑΞΑΝ. `materialId=null` → καθάρισμα. */
export interface ImportedMeshMaterialAssignmentInput {
  readonly entityId: string;
  readonly materialId: string | null;
}

export interface ImportedMeshMaterialMapDialogProps {
  readonly open: boolean;
  readonly sourceFileName: string | null;
  readonly rows: readonly ImportedMeshMaterialMapRow[];
  readonly materials: readonly BimMaterial[];
  readonly onSave: (assignments: readonly ImportedMeshMaterialAssignmentInput[]) => void;
  readonly onCancel: () => void;
}

/** entityId → materialId (`''` = κανένα). */
type DraftMap = Readonly<Record<string, string>>;

function buildInitialDraft(rows: readonly ImportedMeshMaterialMapRow[]): DraftMap {
  const draft: Record<string, string> = {};
  for (const row of rows) draft[row.entityId] = row.currentMaterialId ?? '';
  return draft;
}

export function ImportedMeshMaterialMapDialog({
  open, sourceFileName, rows, materials, onSave, onCancel,
}: ImportedMeshMaterialMapDialogProps) {
  const { t } = useTranslation('dxf-viewer-shell');
  const [draft, setDraft] = useState<DraftMap>({});

  // Η πλήρης λίστα επιλέξιμων υλικών «σώματος» — ίδιος SSoT με το PolygonMaterialPanel.
  const options = useMemo(() => buildBodySwatches(materials, t), [materials, t]);

  // Το έντυπο ξαναγεμίζει σε κάθε άνοιγμα: ανοίγει για ΑΛΛΟ μοντέλο κάθε φορά, οπότε ένα διατηρημένο
  // draft θα μετέφερε σιωπηλά τις αντιστοιχίσεις του προηγούμενου.
  useEffect(() => {
    if (open) setDraft(buildInitialDraft(rows));
  }, [open, rows]);

  const setMaterial = useCallback((entityId: string, materialId: string) => {
    setDraft((prev) => ({ ...prev, [entityId]: materialId }));
  }, []);

  // Μόνο οι πραγματικές αλλαγές — ό,τι έμεινε ίδιο δεν παράγει command.
  const changed = useMemo<readonly ImportedMeshMaterialAssignmentInput[]>(() => {
    const out: ImportedMeshMaterialAssignmentInput[] = [];
    for (const row of rows) {
      const next = draft[row.entityId] ?? '';
      if (next !== (row.currentMaterialId ?? '')) {
        out.push({ entityId: row.entityId, materialId: next || null });
      }
    }
    return out;
  }, [rows, draft]);

  const handleApply = useCallback(() => {
    if (changed.length > 0) onSave(changed);
    else onCancel();
  }, [changed, onSave, onCancel]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${K}.title`)}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {sourceFileName
              ? t(`${K}.description`, { file: sourceFileName })
              : t(`${K}.descriptionGeneric`)}
          </p>
        </DialogHeader>

        <TooltipProvider delayDuration={300}>
        <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto py-1">
          {rows.map((row) => {
            const value = draft[row.entityId] ?? '';
            return (
              <li key={row.entityId} className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-40 shrink-0 truncate text-sm">{row.nodeName}</span>
                  </TooltipTrigger>
                  <TooltipContent>{row.nodeName}</TooltipContent>
                </Tooltip>
                <Select
                  value={value || SELECT_CLEAR_VALUE}
                  onValueChange={(v) => setMaterial(row.entityId, v === SELECT_CLEAR_VALUE ? '' : v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t(`${K}.materialPlaceholder`)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_CLEAR_VALUE}>{t(`${K}.none`)}</SelectItem>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {value && <MaterialSwatch materialId={value} />}
              </li>
            );
          })}
        </ul>
        </TooltipProvider>

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            {t(`${K}.cancel`)}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Palette size={13} />
            {t(`${K}.apply`)}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
