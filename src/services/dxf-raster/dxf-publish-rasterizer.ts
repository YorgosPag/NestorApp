/**
 * =============================================================================
 * DXF → PNG ΣΕ ΠΟΙΟΤΗΤΑ ΑΓΓΕΛΙΑΣ (ADR-922)
 * =============================================================================
 *
 * Το **ίδιο** χωνί με τη μικρογραφία (`rasterizeDxfScene` → `serializeDxfSceneToSvg` → resvg) — καμία δεύτερη μηχανή.
 * Αλλάζουν μόνο οι **παράμετροι της εκτύπωσης**, γιατί η ερώτηση είναι άλλη: η μικρογραφία απαντά «τι αρχείο είναι
 * αυτό;» σε 1200×800· η εικόνα δημοσίευσης απαντά «πώς είναι το σπίτι;» σε μια αγγελία που μεγεθύνεται.
 *
 * | παράμετρος | μικρογραφία | δημοσίευση | γιατί |
 * |---|---|---|---|
 * | πλαίσιο | σταθερό 1200×800 | **αναλογίες του σχεδίου**, μακριά πλευρά {@link DXF_PUBLISH_LONG_EDGE_PX} | στενό τοπογραφικό δεν χάνεται σε άσπρο περιθώριο |
 * | χρώματα | χρώματα επιπέδων | **μονόχρωμο μελάνι** | το ACI 7 (λευκό) εξαφανίζεται σε λευκό χαρτί· CAD «monochrome.ctb» |
 * | φόντο | `#f8f9fa` | **λευκό** | χαρτί, όπως κάθε κάτοψη αγγελίας (Zillow · Idealista · Rightmove) |
 *
 * 🔑 **Τα κρυφά επίπεδα ΜΕΝΟΥΝ κρυφά** — η μονοχρωμία αφαιρεί μόνο το χρώμα, ποτέ την ορατότητα. Ό,τι ο σχεδιαστής
 * έκλεισε (π.χ. επίπεδο με σημειώσεις ιδιοκτήτη) δεν βγαίνει ποτέ στον κόσμο.
 *
 * ⚠️ **Τα κείμενα δεν αποδίδονται ακόμη**: ο rasterizer τρέχει χωρίς γραμματοσειρές (`loadSystemFonts: false`) — ίδιο
 * όριο με τη μικρογραφία, καταγεγραμμένο στο ADR-922 §Ανοιχτά. Οι γραμμές, τα τόξα και οι κύκλοι αποδίδονται πλήρως.
 *
 * @module services/dxf-raster/dxf-publish-rasterizer
 */

import { rasterizeDxfScene, type RasterizeDxfResult } from './dxf-raster-generator';
import type { DxfSceneBoundsLike, DxfSceneInput, DxfSceneLayerLike } from './svg-from-dxf-scene';

/** Η μακριά πλευρά του PNG — πάνω από το μεγαλύτερο παράγωγο του ραφιού (2560px), ώστε να μην μεγεθύνεται ποτέ. */
export const DXF_PUBLISH_LONG_EDGE_PX = 3000;

/** Πόσο στενό επιτρέπεται να γίνει το πλαίσιο — πέρα από αυτό, μια γραμμή 1×40 δεν είναι κάτοψη αλλά λωρίδα. */
const MAX_ASPECT = 4;

const PUBLISH_INK = '#1f2328';
const PUBLISH_PAPER = '#ffffff';
const PUBLISH_STROKE_PX = 2;
const PUBLISH_PADDING_RATIO = 0.04;

/** Το πλαίσιο σε εικονοστοιχεία, με τις αναλογίες του σχεδίου (περιορισμένες σε {@link MAX_ASPECT}). */
export function publishCanvasOf(bounds: DxfSceneBoundsLike | undefined): { width: number; height: number } {
  const drawingWidth = bounds ? bounds.max.x - bounds.min.x : 0;
  const drawingHeight = bounds ? bounds.max.y - bounds.min.y : 0;
  const raw = drawingWidth > 0 && drawingHeight > 0 ? drawingWidth / drawingHeight : 4 / 3;
  const aspect = Math.min(MAX_ASPECT, Math.max(1 / MAX_ASPECT, raw));
  return aspect >= 1
    ? { width: DXF_PUBLISH_LONG_EDGE_PX, height: Math.round(DXF_PUBLISH_LONG_EDGE_PX / aspect) }
    : { width: Math.round(DXF_PUBLISH_LONG_EDGE_PX * aspect), height: DXF_PUBLISH_LONG_EDGE_PX };
}

/** Τα επίπεδα **χωρίς χρώμα, με την ορατότητά τους** — ο σειριοποιητής πέφτει τότε στο μελάνι (`defaultStroke`). */
function monochromeLayers(
  layers: Record<string, DxfSceneLayerLike> | undefined,
): Record<string, DxfSceneLayerLike> | undefined {
  if (layers === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(layers).map(([name, layer]) => [name, layer.visible === false ? { visible: false } : {}]),
  );
}

/** **Σκηνή DXF → PNG δημοσίευσης.** Καθαρή συνάρτηση: ίδια σκηνή ⇒ ίδια bytes. */
export function rasterizeDxfForPublication(scene: DxfSceneInput): RasterizeDxfResult {
  const { width, height } = publishCanvasOf(scene.bounds);
  return rasterizeDxfScene(
    { ...scene, layers: monochromeLayers(scene.layers) },
    {
      width,
      height,
      background: PUBLISH_PAPER,
      defaultStroke: PUBLISH_INK,
      strokeWidth: PUBLISH_STROKE_PX,
      paddingRatio: PUBLISH_PADDING_RATIO,
    },
  );
}
