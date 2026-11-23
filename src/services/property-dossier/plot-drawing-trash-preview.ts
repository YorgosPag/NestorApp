/**
 * @fileoverview **Κάδος του τοπογραφικού σχεδίου: τι γίνεται με το περίγραμμα** — ο διάλογος πριν τη μεταφορά (ADR-920 §14.11 Ζ4).
 * @related components/shared/files/entity-files-manager-surface (ο καλών, `handleDelete`) · services/property/property-file-mutation-preview
 *   (το ίδιο σχήμα προεπισκόπησης) · lib/terrain/plot-outline/plot-outline-confirmation (η προέλευση στην εγγραφή)
 * @module services/property-dossier/plot-drawing-trash-preview
 *
 * 🏆 **Πρακτική των μεγάλων, και ό,τι τους λείπει** (έρευνα 2026-11-23):
 * - Revit: η τοπογραφία από DWG **μένει** όταν φύγει το DWG· Civil 3D: «Copy Deleted Dependent Objects», η αφαίρεση από τον
 *   ορισμό είναι **ρητή** («Remove From Definition»)· Figma: η διαγραφή του main component αφήνει τα instances («Restore»).
 *   ⇒ **Κανείς** δεν σβήνει το παράγωγο μαζί με την πηγή, ούτε το προτείνει στον διάλογο διαγραφής — άρα ούτε εμείς (Ζ3c).
 * - Εκεί που αποτυγχάνουν (Civil 3D: η εξάρτηση κρυμμένη· Figma: τα ορφανά δεν βρίσκονται): εδώ ο διάλογος **λέει** ότι το
 *   περίγραμμα μένει, **από πού** ήρθε, και **πού** αφαιρείται — και η καρτέλα «Τοπογραφικό σχέδιο» δείχνει μετά το σχέδιο
 *   στον κάδο με «Επαναφορά».
 */

import { formatNumber } from '@/lib/intl-formatting';
import { TOPOGRAPHIC_DRAWING_IDENTITY } from '@/lib/listings/topographic-drawing-file-record';
import { readConfirmedPlotOutline } from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import type { PropertyFileMutationPreview } from '@/services/property/property-file-mutation-preview';
import type { FileRecord } from '@/types/file-record';

type Translator = (key: string, options?: Record<string, unknown>) => string;

/**
 * Ο διάλογος πριν ο άνθρωπος στείλει στον κάδο ένα τοπογραφικό σχέδιο **με επιβεβαιωμένο περίγραμμα** — `null` για κάθε
 * άλλο αρχείο (ο καλών συνεχίζει με τη δική του ροή).
 */
export function buildPlotDrawingTrashPreview(
  file: Pick<FileRecord, 'publicationIdentity' | 'plotOutline' | 'displayName'>,
  t: Translator,
): PropertyFileMutationPreview | null {
  if (file.publicationIdentity !== TOPOGRAPHIC_DRAWING_IDENTITY) return null;
  const outline = readConfirmedPlotOutline(file.plotOutline);
  if (outline === null) return null;
  const origin = outline.origin.source === 'dxf'
    ? t('fileMutationPreview.plotDrawing.originDxf', { layer: outline.origin.layer })
    : t('fileMutationPreview.plotDrawing.originPdf', { page: outline.origin.page });
  return {
    title: t('fileMutationPreview.plotDrawing.title'),
    description: t('fileMutationPreview.plotDrawing.description', {
      displayName: file.displayName,
      area: formatNumber(outline.areaM2, { maximumFractionDigits: 0 }),
      origin,
    }),
    variant: 'default',
    confirmText: t('fileMutationPreview.plotDrawing.confirm'),
  };
}
