'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * `CanvasStackPreviewLeaves` — τα **εφήμερα προεπισκοπήσεως** overlays της ζώνης `z-20`.
 *
 * ## Το κριτήριο ένταξης είναι ΕΝΑ, και είναι μετρήσιμο
 * Εδώ μπαίνει ό,τι ζωγραφίζει **ό,τι δεν έχει δεσμευτεί ακόμη**: το λάσο που τραβάει τώρα ο
 * χρήστης, η γραμμή του μολυβιού πριν αφήσει το κουμπί, το ζωντανό μέτρημα, το παράθυρο zoom.
 * Κοινό τους δεν είναι ότι «μοιάζουν» — είναι ότι όλα ζουν στη ζώνη **`z-20`**, είναι
 * `pointer-events-none`, και **σβήνουν μόλις τελειώσει η χειρονομία**. Ό,τι επιβιώνει της
 * χειρονομίας (regions, dimensions, entities) ζωγραφίζεται από τους καμβάδες, όχι από εδώ.
 *
 * Το `BasemapPlacementLeaf` **δεν** ανήκει εδώ παρότι κι εκείνο είναι εφήμερο: ζει στο `z-30`
 * και **κατέχει τον δείκτη** (δέχεται συμβάντα), δηλαδή είναι το αντίθετο του
 * `pointer-events-none`. Το όριο δεν είναι «μοιάζουν» — είναι η ζώνη στρώσης, ίδιο κριτήριο με
 * το `CanvasStackHudLeaves`.
 *
 * ## Γιατί εξήχθη
 * Ο shell `CanvasLayerStack` πέρασε τις **500 γραμμές** (N.7.1) όταν προσγειώθηκε η χειροκίνητη
 * τοποθέτηση υποβάθρου (ADR-782 §23). Η εξαγωγή είναι **τοποθέτηση, όχι αλλαγή**: ίδια σειρά
 * render ⇒ **z-order αμετάβλητο**, ίδια props, ίδιες κλάσεις.
 *
 * ADR-040: **μηδέν** συνδρομές εδώ. Κάθε leaf εγγράφεται μόνο του στα δικά του stores, όπως
 * απαιτεί ο κανόνας των micro-leaves (CHECK 6C).
 */

import React from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { PolygonCropPreviewSubscriber } from './LassoCropPreviewSubscriber';
import { LassoFreehandPreviewSubscriber } from './LassoFreehandPreviewSubscriber';
import { SketchFreehandPreviewSubscriber } from './SketchFreehandPreviewSubscriber';
import { DistMeasureOverlayLeaf } from './DistMeasureOverlayLeaf';
import { ZoomWindowSubscriber } from './leaves/ZoomWindowSubscriber';
import type { Viewport } from '../../rendering/types/Types';

/** Η κοινή κλάση της ζώνης — μία γραφή, ώστε τα τέσσερα να μην μπορούν να αποκλίνουν. */
const PREVIEW_LAYER_CLASS =
  `absolute inset-0 w-full h-full pointer-events-none ${PANEL_LAYOUT.Z_INDEX['20']}`;

export interface CanvasStackPreviewLeavesProps {
  readonly viewport: Viewport;
  /**
   * Οι μονάδες της σκηνής — το ζωντανό «Μέτρημα» τυπώνει **αριθμό με μονάδα**, άρα δεν μπορεί
   * να τις μαντέψει. Ο shell λύνει το `?? 'mm'` πριν φτάσει εδώ.
   */
  readonly sceneUnits: string;
}

export const CanvasStackPreviewLeaves: React.FC<CanvasStackPreviewLeavesProps> = ({
  viewport,
  sceneUnits,
}) => (
  <>
    <PolygonCropPreviewSubscriber viewport={viewport} className={PREVIEW_LAYER_CLASS} />
    <LassoFreehandPreviewSubscriber viewport={viewport} className={PREVIEW_LAYER_CLASS} />
    {/* ADR-658 «Μολύβι» + ADR-680 εφήμερο «Μέτρημα» — live-overlay leaves (micro-leaf, ADR-040). */}
    <SketchFreehandPreviewSubscriber viewport={viewport} className={PREVIEW_LAYER_CLASS} />
    <DistMeasureOverlayLeaf
      viewport={viewport}
      sceneUnits={sceneUnits}
      className={PREVIEW_LAYER_CLASS}
    />
    {/* ⚠️ Το παράθυρο zoom γράφει τις ίδιες τέσσερις ιδιότητες μέσα από **tokens**
        (`INSET` / `POINTER_EVENTS`) αντί για ωμές utilities — διατηρείται ως έχει, ώστε η
        εξαγωγή να μένει καθαρή τοποθέτηση και να μην κρύβει αλλαγή κλάσης. */}
    <ZoomWindowSubscriber
      className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['20']}`}
    />
  </>
);
