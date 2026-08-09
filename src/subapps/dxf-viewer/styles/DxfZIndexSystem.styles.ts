/**
 * 🏢 ENTERPRISE DXF Z-INDEX SYSTEM
 *
 * Professional DXF-specific z-index hierarchy που eliminates ALL hardcoded z-index chaos
 * και implements Fortune 500-grade layering architecture για το DXF Viewer system.
 *
 * ✅ Enterprise Standards:
 * - Professional DXF canvas layering hierarchy
 * - Modal and overlay z-index management
 * - Collaboration system positioning
 * - TypeScript strict typing με readonly properties
 * - Zero hardcoded values (999999 elimination!)
 * - Integration με global design-tokens.ts
 * - Semantic layer definitions
 * - Performance-optimized z-index calculations
 */

import { zIndex as globalZIndex } from '../../../styles/design-tokens';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

interface DxfZIndexHierarchy {
  readonly canvas: {
    readonly background: number;
    readonly dxfCanvas: number;
    readonly layerCanvas: number;
    readonly overlayBase: number;
  };
  readonly overlays: {
    readonly selection: number;
    readonly crosshair: number;
    readonly snap: number;
    readonly cursor: number;
    readonly zoom: number;
  };
  readonly ui: {
    readonly collaboration: number;
    readonly toolbar: number;
    readonly sidebar: number;
    // 🗑️ `notifications` — ΜΗΔΕΝ καταναλωτές (ADR-780 Φ.Γ).
  };
  readonly modals: {
    readonly base: number;
    readonly import: number;
    // 🗑️ `settings` · `help` — ΜΗΔΕΝ καταναλωτές (ADR-780 Φ.Γ). Ήταν `modal + 20/+30`,
    // δηλαδή δύο σκαλιά που **δεν ζωγράφιζε κανείς** αλλά έσπαγαν τη μονοτονία της κλίμακας.
  };
}

// ============================================================================
// 🎨 ENTERPRISE DXF Z-INDEX HIERARCHY
// ============================================================================

/**
 * 🎯 PROFESSIONAL DXF Z-INDEX HIERARCHY
 * Eliminates 999999 chaos με semantic layer management
 * Based on CAD software standards (AutoCAD, SolidWorks, etc.)
 */
export const dxfZIndex: DxfZIndexHierarchy = {
  /**
   * 🎯 CANVAS LAYERS: Core rendering hierarchy
   * Background (0) → DXF Content (5) → Interactive Layer (10) → Overlays (15+)
   */
  canvas: {
    background: 0,           // Canvas background
    dxfCanvas: 5,           // Main DXF content rendering
    layerCanvas: 10,        // Interactive drawing layer
    overlayBase: 15         // Base for all overlays
  },

  /**
   * 🎯 OVERLAY LAYERS: Interactive elements που float above canvas
   * Selection (20) → Drawing Tools (30) → User Feedback (40+)
   */
  overlays: {
    selection: 20,          // Selection marquee, grips
    crosshair: 30,         // Drawing crosshair
    snap: 35,              // Snap indicators
    cursor: 40,            // Cursor tooltip, coordinates
    zoom: 45               // Zoom window, magnifier
  },

  /**
   * 🎯 UI LAYERS: Application interface elements
   * Uses global design tokens as base + DXF-specific offsets
   */
  ui: {
    collaboration: globalZIndex.docked + 5,    // 15 - Collaboration overlay
    toolbar: globalZIndex.sticky,              // 1100 - Toolbars, panels
    // ADR-780 Φ.Γ: ήταν `sticky + 10`. Η αριθμητική ΔΕΝ μετακινείται μαζί με τον ρόλο της —
    // μετά τη συμπίεση της κλίμακας θα έδινε τιμή **ταυτόσημη με τον `banner`**, δηλαδή δύο
    // επιφάνειες σε ένα σκαλί με τη σειρά τους να την αποφασίζει το DOM.
    sidebar: globalZIndex.workspaceSidePanel   // Floating workspace side palette
  },

  /**
   * 🎯 MODAL LAYERS: Dialog and modal management
   * Standard → Import → Settings → Help
   *
   * 🔴 ΤΟ `critical` ΑΦΑΙΡΕΘΗΚΕ (ADR-780 Φάση Β, 2026-08-09) — ήταν **δεύτερος** ρόλος
   * με το ίδιο όνομα: `critical` σήμαινε **1500** εδώ και **2147483647** στην κλίμακα
   * (`design-tokens.json ▸ zIndex`). Ακριβώς το σχήμα που γέννησε το ADR-780 (§2.1:
   * δύο λεξιλόγια, ίδιο όνομα ρόλου, διαφορετικός αριθμός) — και το 1500 ήταν επιπλέον
   * ταυτόσημο με τον ρόλο `popover`, δηλαδή δύο ονόματα για ένα σκαλί.
   * Μετρημένο πριν τη διαγραφή: `criticalModal`, `CRITICAL_MODAL` και
   * `createModalZIndex('critical')` είχαν **ΜΗΔΕΝ** καταναλωτές σε όλο το `src/`.
   */
  modals: {
    base: globalZIndex.modal,              // Standard modals
    // ADR-780 Φ.Γ: ήταν `modal + 10`· μετά τη συμπίεση θα έπεφτε πάνω στον `canvasSnap`.
    // Τα `settings` (+20) και `help` (+30) είχαν **ΜΗΔΕΝ** καταναλωτές και διαγράφηκαν —
    // νεκρό σκαλί δεν αποκτά ρόλο, φεύγει.
    import: globalZIndex.viewerImportModal // DXF import surface
  }
} as const;

// 🗑️ ΔΙΑΓΡΑΦΗΚΑΝ (ADR-780 Φάση Γ) — **ΜΗΔΕΝ καταναλωτές, μετρημένο**:
//   createModalZIndex · createOverlayZIndex · createCanvasZIndex · getMemoizedZIndex
//   clearDxfZIndexCache · getDxfZIndexCacheStats · validateDxfZIndexHierarchy
//   getDxfZIndexInfo · DXF_ZINDEX
//
// 🔑 ΔΕΝ ΗΤΑΝ ΑΠΛΩΣ ΝΕΚΡΟΣ ΚΩΔΙΚΑΣ — ΗΤΑΝ **ΕΡΓΟΣΤΑΣΙΑ** ΤΗΣ ΕΚΤΗΣ ΚΛΙΜΑΚΑΣ. Και τα
// πέντε `create*ZIndex(τύπος, offset)` επέστρεφαν `ρόλος + αριθμός`, δηλαδή παρήγαγαν
// σκαλιά που **δεν υπάρχουν στην κλίμακα** — ακριβώς το σχήμα που το ADR-780 Φ.Γ βρήκε
// στο `portal-overlay.ts` (17 σκαλιά με `modal + 50…90`). Ένα τέτοιο σκαλί δεν
// μετακινείται μαζί με τον ρόλο του, άρα **σπάει τη μονοτονία** που κάνει κάθε μελλοντική
// επαναρίθμηση αποδείξιμη. Νεκρά σήμερα· ο πρώτος που τα καλούσε αύριο θα τα ξαναγεννούσε.
//
// ⚠️ Το `validateDxfZIndexHierarchy` έλεγχε διπλότυπα με `console.warn` — **ακριβώς** ό,τι
// κάνει σήμερα ο `findScaleDisorder` του CHECK 3.50, αλλά **χωρίς να το τρέχει κανείς**.
// Ένας έλεγχος που δεν εκτελείται είναι σχόλιο (μάθημα CHECK 3.36).

/**
 * ✅ Η ΙΕΡΑΡΧΙΑ. Τα **στυλ** των επιφανειών (`dxfComponentStyles`, `dxfOverlayStyles`,
 * `dxfAccessibility`, δυναμικά utilities) ζουν στο αδελφό `DxfSurface.styles.ts` —
 * χωρίστηκαν στο ADR-780 Φάση Β όταν το ενιαίο αρχείο έφτασε τις 600 γραμμές (N.7.1).
 *
 * ΤΙ ΑΠΑΝΤΑ ΕΔΩ: «ποιο κάθεται πάνω από ποιο», παραγόμενο από το SSoT
 * (`design-tokens.json ▸ zIndex` → `zIndexScale` → `globalZIndex`).
 * ⚠️ Κάτω από το 1000 οι αριθμοί είναι **τοπική** στοίβαξη μέσα στο δοχείο του canvas —
 * δεν είναι καθολικό στρώμα και γι' αυτό δεν ζητούν ρόλο (CHECK 3.50, `local-stacking`).
 */