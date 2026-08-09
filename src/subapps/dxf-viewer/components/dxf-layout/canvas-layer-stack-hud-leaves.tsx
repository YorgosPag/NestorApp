'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — ΔΙΑΒΑΣΕ ADR-040 ΠΡΙΝ ΑΛΛΑΞΕΙΣ
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * `CanvasStackHudLeaves` — τα HUD που ζουν **και στις δύο προβολές**.
 *
 * ## Το κριτήριο ένταξης είναι ΕΝΑ, και είναι μετρήσιμο
 * Εδώ μπαίνει ό,τι κάθεται **πάνω από το `BimViewport3D`** (`absolute inset-0 z-50`), δηλαδή ό,τι
 * ο χρήστης οφείλει να βλέπει είτε σχεδιάζει σε κάτοψη είτε περιστρέφει το κτίριο. Το
 * `NorthArrowLeaf` **δεν** ανήκει εδώ παρότι είναι κι εκείνο screen-anchored: ζει στο `z-30`,
 * δηλαδή **κάτω** από το 3Δ, και είναι HUD μιας προβολής. Το όριο δεν είναι «μοιάζουν» — είναι η
 * ζώνη στρώσης.
 *
 * ## Γιατί ΕΝΑ mount και όχι ένα ανά προβολή
 * Ο `CanvasLayerStack` είναι γονέας **και** των καμβάδων του 2Δ **και** του `CanvasLayerStack3dLeaf`.
 * Δύο mounts — ένα σε κάθε προβολή — θα ζωγράφιζαν **δύο φορές** το ίδιο πράγμα τη στιγμή που το
 * 3Δ σκεπάζει το 2Δ. Το πρότυπο το έθεσε το Performance HUD (ADR-366 §B.5.U)· η απόδοση του
 * υποβάθρου χάρτη (ADR-782 §14) είναι ο δεύτερος κάτοικος.
 *
 * ADR-040: **μηδέν** συνδρομές εδώ. Αυτό το αρχείο είναι τοποθέτηση· κάθε leaf εγγράφεται μόνο του
 * στα δικά του low-freq stores, όπως απαιτεί ο κανόνας των micro-leaves (CHECK 6C).
 */

import React from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { BasemapAttributionLeaf } from './BasemapAttributionLeaf';
import { UnifiedPerformanceHudLeaf } from './UnifiedPerformanceHudLeaf';

export interface CanvasStackHudLeavesProps {
  /** Λύνει τον ζωντανό καμβά του 2Δ — το Performance HUD τον θέλει για στιγμιότυπα. */
  getCanvas2D: () => HTMLCanvasElement | null;
}

export const CanvasStackHudLeaves: React.FC<CanvasStackHudLeavesProps> = ({ getCanvas2D }) => (
  <>
    {/* ADR-782 §14 — απόδοση παρόχου υποβάθρου: **ΝΟΜΙΚΗ υποχρέωση** της άδειας OSM, όχι
        διακόσμηση. ⚠️ Χωρίς αυτό το leaf οι ζωγράφοι του χάρτη ΔΕΝ ζωγραφίζουν — η επιφάνεια
        δηλώνεται στο μητρώο και η `resolveBasemapPaint()` τη ρωτά (basemap-paint-decision). */}
    <BasemapAttributionLeaf className={`absolute bottom-1 right-1 ${PANEL_LAYOUT.Z_INDEX['55']}`} />
    {/* ADR-366 §B.5.U — unified 2D+3D Performance HUD (θέση/z δικά του, δες PerformanceHUD). */}
    <UnifiedPerformanceHudLeaf getCanvas2D={getCanvas2D} />
  </>
);
