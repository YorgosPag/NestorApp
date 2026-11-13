/**
 * ADR-941 Φ1 — η **εισαγωγή** του διανυσματικού PDF ενός ορόφου στη σκηνή: γραμμές στο `PDF_Geometry`, κείμενα στο
 * `PDF_Text` (ονόματα του AutoCAD `PDFIMPORT`, Δ5), ως **μία** ενέργεια χρήστη = **ένα** Ctrl+Z (ADR-729, Δ7).
 *
 * Σειρά μέσα στην ατομική ομάδα (πρότυπο `topo-bake-commit`): layers (`ensureNamedLayer`, ιδεμποτικό) → **διαγραφή** της
 * προηγούμενης εισαγωγής της ΙΔΙΑΣ πηγής (αλλιώς το δεύτερο πάτημα στοίβαζε διπλότυπα — μάθημα ADR-722) → εγγραφή μέσω
 * `completeEntities` (το SSoT δημιουργίας οντοτήτων: αποθήκευση, απόδοση, εξαγωγή ως έχουν). Στυλ ByLayer (Δ6).
 *
 * 🔑 Η πηγή είναι το **ίδιο** υπόβαθρο που βλέπει ο χρήστης: η ταυτότητά του (`background.id`) ελέγχεται και **μετά** την
 *   ασύγχρονη ανάγνωση — αν άλλαξε στο μεταξύ, τίποτα δεν γράφεται (τα px της παλιάς εικόνας δεν διαβάζονται ποτέ με την
 *   τοποθέτηση της νέας, ADR-929 §6.12).
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-import-commit
 */

import type { SceneModel } from '../../types/scene';
import type { Entity } from '../../types/entities';
import { completeEntities } from '../../hooks/drawing/completeEntity';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { DeleteMultipleEntitiesCommand } from '../../core/commands/entity-commands/DeleteEntityCommand';
import { createLevelSceneManagerAdapter } from '../entity-creation/LevelSceneManagerAdapter';
import { getFloorBackground, getFloorProvider } from '../../floorplan-background/stores/floorplanBackgroundStore';
import type { RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import type { PdfVectorContent } from '../../pdf-background/services/pdf-vector-content';
import { ensureNamedLayer, type NamedLayerRefusal } from '../../services/named-layer';
import { isPdfVectorImportOf, pdfVectorEntities, type PdfVectorLayers } from './pdf-vector-entities';

/** Τα ονόματα layer του AutoCAD `PDFIMPORT` — δεδομένο που ταξιδεύει σε DWG/DXF, όχι ετικέτα οθόνης (Δ5). */
export const PDF_IMPORT_LAYER_NAMES = { geometry: 'PDF_Geometry', text: 'PDF_Text' } as const;

const PDF_VECTOR_IMPORT_TOOL = 'pdf-vector-import';

export interface PdfVectorImportTarget {
  readonly floorId: string;
  readonly levelId: string;
  readonly getScene: (levelId: string) => SceneModel | null;
  readonly setScene: (levelId: string, scene: SceneModel) => void;
}

/** Τι έγινε — ΠΑΝΤΑ με όνομα, ποτέ σιωπηλό μηδέν. */
export type PdfVectorImportOutcome =
  | { readonly kind: 'imported'; readonly lines: number; readonly texts: number; readonly replaced: number; readonly skippedFills: number }
  | { readonly kind: 'not-vector' }
  | { readonly kind: 'source-changed' }
  | { readonly kind: 'refused'; readonly reason: NamedLayerRefusal };

/** Το περιεχόμενο + η τοποθέτηση του υποβάθρου του ορόφου, μόνο αν είναι ακόμη το ίδιο μετά την ανάγνωση. */
export async function readFloorPdfVectors(
  floorId: string,
): Promise<{ content: PdfVectorContent; placement: RasterPlacement; sourceKey: string } | PdfVectorImportOutcome> {
  const before = getFloorBackground(floorId);
  const provider = getFloorProvider(floorId);
  if (!before || !provider) return { kind: 'not-vector' };
  const content = await provider.getVectorContent();
  if (!content) return { kind: 'not-vector' };
  const after = getFloorBackground(floorId);
  if (!after || after.id !== before.id) return { kind: 'source-changed' };
  return { content, placement: { transform: after.transform, naturalBounds: after.naturalBounds }, sourceKey: after.id };
}

function ensureImportLayers(target: PdfVectorImportTarget): PdfVectorLayers | NamedLayerRefusal {
  const accessor = { currentLevelId: target.levelId, getLevelScene: target.getScene, setLevelScene: target.setScene };
  const geometry = ensureNamedLayer(accessor, { name: PDF_IMPORT_LAYER_NAMES.geometry });
  if (!geometry.ok) return geometry.reason;
  const text = ensureNamedLayer(accessor, { name: PDF_IMPORT_LAYER_NAMES.text });
  if (!text.ok) return text.reason;
  return { geometry: geometry.layerId, text: text.layerId };
}

function previousImportIds(target: PdfVectorImportTarget, sourceKey: string): string[] {
  const scene = target.getScene(target.levelId);
  return (scene?.entities ?? []).filter((e) => isPdfVectorImportOf(e, sourceKey)).map((e) => e.id);
}

/** Διάβασε και γράψε (Δ7). `undoName` = η ήδη μεταφρασμένη ετικέτα του βήματος αναίρεσης. */
export async function importFloorPdfVectors(target: PdfVectorImportTarget, undoName: string): Promise<PdfVectorImportOutcome> {
  const read = await readFloorPdfVectors(target.floorId);
  if ('kind' in read) return read;
  const { content, placement, sourceKey } = read;
  return getGlobalCommandHistory().runAsSingleUndo(undoName, (): PdfVectorImportOutcome => {
    const layers = ensureImportLayers(target);
    if (typeof layers === 'string') return { kind: 'refused', reason: layers };
    const replacedIds = previousImportIds(target, sourceKey);
    if (replacedIds.length > 0) {
      getGlobalCommandHistory().execute(new DeleteMultipleEntitiesCommand(
        replacedIds, createLevelSceneManagerAdapter(target.getScene, target.setScene, target.levelId),
      ));
    }
    const entities = pdfVectorEntities({ content, placement, layers, sourceKey });
    completeEntities(entities as Entity[], {
      tool: PDF_VECTOR_IMPORT_TOOL, levelId: target.levelId, getScene: target.getScene, setScene: target.setScene, skipStyles: true,
    });
    const texts = entities.filter((e) => e.type === 'text').length;
    return { kind: 'imported', lines: entities.length - texts, texts, replaced: replacedIds.length, skippedFills: content.skippedFills };
  });
}
