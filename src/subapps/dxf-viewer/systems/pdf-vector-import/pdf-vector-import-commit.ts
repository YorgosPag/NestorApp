/**
 * ADR-941 Φ1 · Φ2α — η **εισαγωγή** του διανυσματικού PDF ενός ορόφου στη σκηνή: γραμμές στο `PDF_Geometry`, κείμενα στο
 * `PDF_Text` (ονόματα του AutoCAD `PDFIMPORT`, Δ5), οι γραμμένες τιμές που δένονται σε ακμή ως **πραγματικές διαστάσεις** στο
 * layer του στυλ διάστασης (≡ `DIMLAYER`, Δ13) — ως **μία** ενέργεια χρήστη = **ένα** Ctrl+Z (ADR-729, Δ7).
 *
 * Σειρά μέσα στην ατομική ομάδα (πρότυπο `topo-bake-commit`): layers (`ensureNamedLayer` / `ensureDimensionLayer`,
 * ιδεμποτικά — άρνηση ⇒ **τίποτα** δεν γράφεται, με λόγο) → **διαγραφή** της προηγούμενης εισαγωγής της ΙΔΙΑΣ πηγής (μαζί
 * και οι διαστάσεις της, Δ16· μάθημα ADR-722) → γεωμετρία + κείμενα μέσω `completeEntities` (ByLayer, Δ6) → διαστάσεις μέσω
 * `addDimensionsToScene` (το SSoT των παραγόμενων διαστάσεων: το `useDimAssociationObserver` πιάνει τις συσχετίσεις).
 *
 * 🔑 Η πηγή είναι το **ίδιο** υπόβαθρο που βλέπει ο χρήστης: η ταυτότητά του (`background.id`) ελέγχεται και **μετά** την
 *   ασύγχρονη ανάγνωση — αν άλλαξε στο μεταξύ, τίποτα δεν γράφεται (ADR-929 §6.12).
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
import { ensureDimensionLayer, ensureNamedLayer, type NamedLayerRefusal } from '../../services/named-layer';
import { addDimensionsToScene } from '../../bim/scene/add-dimensions-to-scene';
import { getDimStyleRegistry } from '../dimensions/dim-style-registry';
import { resolveSceneUnits } from '../../utils/scene-units';
import { isPdfVectorImportOf, pdfVectorGeometry, pdfVectorTexts, type PdfVectorLayers } from './pdf-vector-entities';
import { bindPdfDimensions, type PdfDimensionReading } from './pdf-vector-dimension-binding';
import { pdfDimensionEntities } from './pdf-vector-dimension-entities';

/** Τα ονόματα layer του AutoCAD `PDFIMPORT` — δεδομένο που ταξιδεύει σε DWG/DXF, όχι ετικέτα οθόνης (Δ5). */
export const PDF_IMPORT_LAYER_NAMES = { geometry: 'PDF_Geometry', text: 'PDF_Text' } as const;

const PDF_VECTOR_IMPORT_TOOL = 'pdf-vector-import';

export interface PdfVectorImportTarget {
  readonly floorId: string;
  readonly levelId: string;
  readonly getScene: (levelId: string) => SceneModel | null;
  readonly setScene: (levelId: string, scene: SceneModel) => void;
}

/** Οι μετρήσεις μιας επιτυχούς εισαγωγής. */
export interface PdfVectorImportCounts {
  readonly lines: number;
  readonly texts: number;
  /** Πραγματικές διαστάσεις από γραμμένες τιμές (Φ2α). */
  readonly dimensions: number;
  /** Από αυτές, όσες κρατούν το γραμμένο κείμενο επειδή διαφωνούν με τη γεωμετρία (Δ14). */
  readonly overriddenDimensions: number;
  /** Γραμμένα μήκη που δεν δέθηκαν σε ακμή — έμειναν κείμενα (Δ12). */
  readonly unboundDimensions: number;
  readonly replaced: number;
  readonly skippedFills: number;
}

/** Τι έγινε — ΠΑΝΤΑ με όνομα, ποτέ σιωπηλό μηδέν. */
export type PdfVectorImportOutcome =
  | ({ readonly kind: 'imported' } & PdfVectorImportCounts)
  | { readonly kind: 'not-vector' }
  | { readonly kind: 'source-changed' }
  | { readonly kind: 'refused'; readonly reason: NamedLayerRefusal };

interface FloorPdfVectors {
  readonly content: PdfVectorContent;
  readonly placement: RasterPlacement;
  readonly sourceKey: string;
}

/** Το περιεχόμενο + η τοποθέτηση του υποβάθρου του ορόφου, μόνο αν είναι ακόμη το ίδιο μετά την ανάγνωση. */
export async function readFloorPdfVectors(floorId: string): Promise<FloorPdfVectors | PdfVectorImportOutcome> {
  const before = getFloorBackground(floorId);
  const provider = getFloorProvider(floorId);
  if (!before || !provider) return { kind: 'not-vector' };
  const content = await provider.getVectorContent();
  if (!content) return { kind: 'not-vector' };
  const after = getFloorBackground(floorId);
  if (!after || after.id !== before.id) return { kind: 'source-changed' };
  return { content, placement: { transform: after.transform, naturalBounds: after.naturalBounds }, sourceKey: after.id };
}

const accessorOf = (target: PdfVectorImportTarget) =>
  ({ currentLevelId: target.levelId, getLevelScene: target.getScene, setLevelScene: target.setScene });

interface ImportLayers extends PdfVectorLayers {
  /** Το layer του στυλ διάστασης — μόνο όταν υπάρχουν διαστάσεις να γραφτούν. */
  readonly dimension: string | null;
}

function ensureImportLayers(target: PdfVectorImportTarget, needsDimensionLayer: boolean): ImportLayers | NamedLayerRefusal {
  const accessor = accessorOf(target);
  const geometry = ensureNamedLayer(accessor, { name: PDF_IMPORT_LAYER_NAMES.geometry });
  if (!geometry.ok) return geometry.reason;
  const text = ensureNamedLayer(accessor, { name: PDF_IMPORT_LAYER_NAMES.text });
  if (!text.ok) return text.reason;
  if (!needsDimensionLayer) return { geometry: geometry.layerId, text: text.layerId, dimension: null };
  const dimension = ensureDimensionLayer(accessor, getDimStyleRegistry().getActiveStyle());
  if (!dimension.ok) return dimension.reason;
  return { geometry: geometry.layerId, text: text.layerId, dimension: dimension.layerId };
}

/** Διαγραφή της προηγούμενης εισαγωγής της ίδιας πηγής· πόσες οντότητες αντικαταστάθηκαν. */
function removePreviousImport(target: PdfVectorImportTarget, sourceKey: string): number {
  const scene = target.getScene(target.levelId);
  const ids = (scene?.entities ?? []).filter((e) => isPdfVectorImportOf(e, sourceKey)).map((e) => e.id);
  if (ids.length > 0) {
    getGlobalCommandHistory().execute(new DeleteMultipleEntitiesCommand(
      ids, createLevelSceneManagerAdapter(target.getScene, target.setScene, target.levelId),
    ));
  }
  return ids.length;
}

/** Γεωμετρία, κείμενα (εκτός όσων έγιναν διαστάσεις) και διαστάσεις, με τα ήδη εξασφαλισμένα layers. */
function writeImport(
  target: PdfVectorImportTarget, read: FloorPdfVectors, reading: PdfDimensionReading, layers: ImportLayers, undoName: string,
): Omit<PdfVectorImportCounts, 'replaced' | 'skippedFills'> {
  const entityInput = { content: read.content, placement: read.placement, layers, sourceKey: read.sourceKey };
  const geometry = pdfVectorGeometry(entityInput);
  const scene = target.getScene(target.levelId);
  const { dimensions, overridden } = layers.dimension === null || !scene
    ? { dimensions: [], overridden: 0 }
    : pdfDimensionEntities({
      bindings: reading.bindings, content: read.content, geometryIds: geometry.map((g) => g.id), placement: read.placement,
      sceneUnits: resolveSceneUnits(scene), styleId: getDimStyleRegistry().getActiveStyle().id, layerId: layers.dimension,
      sourceKey: read.sourceKey,
    });
  const asDimensions = new Set(dimensions.length > 0 ? reading.bindings.map((b) => b.textIndex) : []);
  const texts = pdfVectorTexts(entityInput, asDimensions);
  completeEntities([...geometry, ...texts] as Entity[], {
    tool: PDF_VECTOR_IMPORT_TOOL, levelId: target.levelId, getScene: target.getScene, setScene: target.setScene, skipStyles: true,
  });
  if (dimensions.length > 0) addDimensionsToScene(dimensions, accessorOf(target), { tool: PDF_VECTOR_IMPORT_TOOL, undoName });
  return {
    lines: geometry.length, texts: texts.length, dimensions: dimensions.length, overriddenDimensions: overridden,
    unboundDimensions: reading.unbound + (dimensions.length > 0 ? 0 : reading.bindings.length),
  };
}

/** Διάβασε και γράψε (Δ7). `undoName` = η ήδη μεταφρασμένη ετικέτα του βήματος αναίρεσης. */
export async function importFloorPdfVectors(target: PdfVectorImportTarget, undoName: string): Promise<PdfVectorImportOutcome> {
  const read = await readFloorPdfVectors(target.floorId);
  if ('kind' in read) return read;
  const reading = bindPdfDimensions(read.content);
  return getGlobalCommandHistory().runAsSingleUndo(undoName, (): PdfVectorImportOutcome => {
    const layers = ensureImportLayers(target, reading.bindings.length > 0);
    if (typeof layers === 'string') return { kind: 'refused', reason: layers };
    const replaced = removePreviousImport(target, read.sourceKey);
    const counts = writeImport(target, read, reading, layers, undoName);
    return { kind: 'imported', ...counts, replaced, skippedFills: read.content.skippedFills };
  });
}
