# ADR-515 — Snap Marker Visual SSoT (σχήμα · χρώμα · μέγεθος, 2D + 3D)

- **Status**: Proposed → (In Progress)
- **Date**: 2026-06-24
- **Domain**: DXF Viewer — Snapping / Rendering (2D overlay + 3D markers)
- **Supersedes scope of**: ADR-137 (Snap Icon Geometry) — *extends*, does not replace
- **Related**: ADR-133 (SVG stroke width), ADR-134 (opacity), ADR-370 (generic BIM snaps),
  ADR-378 §Step 5 (shared 3D marker core), ADR-397 (rotation snaps), ADR-408 Φ9 (MEP connector),
  ADR-040 (micro-leaf overlay architecture)

---

## 1. Context — γιατί υπάρχει αυτό το ADR

Ζητήθηκε (Giorgio, 2026-06-24) πλήρης έλεγχος SSoT στα **σύμβολα έλξεων (snap markers)** του DXF
Viewer: είναι κεντρικοποιημένα τα **σχήματα**, τα **χρώματα**, τα **μεγέθη**;

Ο έλεγχος κάλυψε ολόκληρο το subapp `src/subapps/dxf-viewer/` (2D SVG overlay, 3D Three.js markers,
legacy canvas pipeline, config/tokens). Τα ευρήματα ακολουθούν.

---

## 2. Findings — η τρέχουσα κατάσταση (CODE = SOURCE OF TRUTH)

### 2.1 Ζωντανή διαδρομή 2D — `canvas-v2/overlays/SnapIndicatorOverlay.tsx`
Το **μόνο** σύστημα που ζωγραφίζει σύμβολα έλξης στην πραγματική εφαρμογή (SVG leaf, ADR-040).

| Πτυχή | Κατάσταση | Τεκμηρίωση |
|---|---|---|
| **Σχήματα** | ✅ **Κεντρικά** | ~18 σύμβολα σε ΕΝΑ `SnapShape()` switch (endpoint ■, midpoint △, center ○, intersection ✕, quadrant ◇, perpendicular ⊥, parallel ‖, tangent, node ⊙, bim_center ⊕, bim_corner ┘, bim_midpoint ▲, bim_mep_connector ◈, guide ═, text ▣, construction ✦, rotation_pivot/grip). |
| **Μεγέθη** | ✅ **Κεντρικά** | `SNAP_ICON_GEOMETRY` (ADR-137): `SIZE=12` + ratios + helpers· stroke από `PANEL_LAYOUT.SVG_ICON.STROKE_WIDTH` (ADR-133). |
| **Χρώματα** | ❌ **ΟΧΙ** | Γραμμή 372: `snapColor = canvasUI.overlay.colors.snap.border` (= green-400 `#4ade80`) εφαρμόζεται **μονόχρωμα σε ΚΑΘΕ τύπο**. |

### 2.2 Το πρόβλημα: τα χρώματα έλξης είναι **διασπαρμένα + νεκρά** (5 ασύνδετες πηγές)

| # | Πηγή | Τιμή | Κατάσταση |
|---|---|---|---|
| 1 | `canvasUI.overlay.colors.snap.border` (`design-tokens/modules/canvas-ui.ts`) | green-400 `#4ade80` | **ΖΩΝΤΑΝΟ** (μονόχρωμο) |
| 2 | `canvas-ui.ts → snapIndicator.positioned` | green-500 `#22c55e`, μέγεθος **10px** | Ασύνδετο token (≠ #1 σε χρώμα & μέγεθος) |
| 3 | `UI_COLORS.OVERLAY_SNAP_POINT` (στο `OverlayPass.ts`) | magenta `#ff00ff`, ellipse 3px | **Νεκρό** (βλ. §2.4) |
| 4 | `UI_COLORS_BASE.SNAP_ENDPOINT/MIDPOINT/CENTER/INTERSECTION/PERPENDICULAR` + `DEFAULT_SNAP_SETTINGS` | type-specific (κόκκινο/πράσινο/μπλε/magenta…) | **Νεκρό** — κανείς renderer δεν τα διαβάζει |
| 5 | `CanvasSettings.ts` snap colors | BRIGHT_YELLOW / BRIGHT_GREEN | **Νεκρό** — τρίτη εκδοχή |

**Παράδοξο ονοματολογίας:** τα `SNAP_*` tokens χρησιμοποιούνται πραγματικά για **χρώματα grips**
(`types/gripSettings.ts`, `settings/io/migration-helpers.ts`, `settings-core/types/domain.ts`),
**όχι** για snaps — σύγχυση που πρέπει να καθαριστεί.

### 2.3 3D markers — `bim-3d/shared/snap-marker-core.ts`
✅ **Σωστό SSoT** (ADR-378 §Step 5): geometry + color + screen-scale + render-order σε ΕΝΑ σημείο,
reuse από `gizmo` (`bim-gizmo-overlay-markers.createSnapMarker`) + `PlacementSnapMarker`.
⚠️ **ΑΛΛΑ** χρώμα = cyan `#00e5ff` ≠ 2D πράσινο `#4ade80` ≠ legacy magenta → **ασυνέπεια 2D↔3D**.

### 2.4 Νεκρός κώδικας (δεύτερο/τρίτο snap-σύστημα που δεν τρέχει)
- `OverlayPass.renderSnapIndicators()` (magenta crosshair + ellipse) οδηγείται **μόνο** από
  `rendering/core/RenderPipeline.ts`, που **κανένα ζωντανό component δεν καλεί** (μόνο εσωτερικές
  self-references + docs/duplicates). Το ίδιο το `SnapTypes.ts` δηλώνει: *«Live snap rendering is
  owned exclusively by SnapIndicatorOverlay»*.
- `DEFAULT_SNAP_SETTINGS` type-specific colors (§2.2 #4) — αχρησιμοποίητα από ζωντανό renderer.

---

## 3. Ετυμηγορία

| Ερώτημα | Απάντηση |
|---|---|
| Σύμβολα κεντρικοποιημένα; | ✅ ΝΑΙ (2D `SnapShape` + 3D `snap-marker-core`) |
| Σχήματα κεντρικοποιημένα; | ✅ ΝΑΙ (ADR-137) |
| Μεγέθη κεντρικοποιημένα; | ✅ ΝΑΙ στο ζωντανό 2D (ADR-137) — ⚠️ ασύνδετο token 10px (§2.2 #2) |
| **Χρώματα κεντρικοποιημένα;** | ❌ **ΟΧΙ** — 5 διασπαρμένες πηγές, μονόχρωμο ζωντανό, type-specific νεκρά, 2D≠3D |

**Σχήματα & μεγέθη = Google-level. Χρώματα = το μοναδικό αδύναμο σημείο SSoT.**

---

## 4. Decision — Snap Marker Visual SSoT (full enterprise + full SSoT)

Δημιουργείται **ΕΝΑ** module που είναι η μοναδική πηγή για το *οπτικό* μέρος κάθε snap marker
(σχήμα-token + χρώμα + μέγεθος), καταναλωνόμενο **ταυτόχρονα** από 2D SVG overlay **και** 3D markers.

### 4.1 Νέο SSoT: `rendering/ui/snap/snap-visual-config.ts`
- **Δεν διπλασιάζει** το `SNAP_ICON_GEOMETRY` (ADR-137): το **κάνει re-export / reference** (geometry
  παραμένει εκεί).
- Ορίζει `SNAP_COLORS: Record<ExtendedSnapType, string>` — μία εγγραφή ανά τύπο (πηγή: η enum
  `ExtendedSnapType` στο `snapping/extended-types.ts`).
- Ορίζει `SNAP_MARKER_BASE_COLOR` (το AutoCAD-style ενιαίο marker color) ως default/fallback.
- `resolveSnapColor(type: ExtendedSnapType | string): string` — ΕΝΑ resolver, με ασφαλές fallback
  στο base color για άγνωστο τύπο.
- Το χρωματικό **μοντέλο** (μονόχρωμο AutoCAD-true ↔ type-specific Revit-rich) είναι **policy μέσα
  σε αυτό το SSoT**: αν μονόχρωμο, όλες οι εγγραφές δείχνουν στο `SNAP_MARKER_BASE_COLOR`· αν
  type-specific, κάθε εγγραφή έχει το δικό της. Αλλαγή policy = αλλαγή **σε ΕΝΑ αρχείο**.

### 4.2 Consumers (reuse, μηδέν διπλότυπο)
- **2D**: `SnapIndicatorOverlay.tsx` → `resolveSnapColor(type)` αντί του σταθερού
  `canvasUI.overlay.colors.snap.border`.
- **3D**: `snap-marker-core.ts` → το `SNAP_MARKER_COLOR` του 3D γίνεται **derived** από το ίδιο SSoT
  (THREE color = hex→0x μέσω helper), ώστε 2D & 3D να κινούνται μαζί.

### 4.3 Cleanup (ratchet — οι πηγές μειώνονται)
- `DEFAULT_SNAP_SETTINGS` type-specific snap colors + `CanvasSettings.ts` snap block →
  αφαίρεση/deprecation (νεκρά).
- `OverlayPass.renderSnapIndicators` + νεκρό `RenderPipeline` snap path → flag ως dead (αφαίρεση σε
  ξεχωριστό βήμα, εκτός scope ώστε να μη σπάσει το legacy pipeline build).
- `snapIndicator.positioned` token (10px green-500) → αφαίρεση ή ευθυγράμμιση με το SSoT μέγεθος.
- Τα `UI_COLORS_BASE.SNAP_*` που χρησιμοποιούνται για **grips** → μετονομασία σε grip-semantic
  ονόματα (ξεχωριστό housekeeping, flagged).

### 4.4 Google-level checklist (N.7.2)
- Proactive: το χρώμα ορίζεται στο lifecycle moment (config), όχι ως side-effect του renderer.
- Single Source of Truth: ΕΝΑ map + ΕΝΑΣ resolver, 2D & 3D καταναλωτές.
- Idempotent / pure: `resolveSnapColor` καθαρή συνάρτηση, χωρίς state.
- No race: pure config, μηδέν async.

---

## 5. Consequences
- **+** Ένα σημείο αλλαγής για κάθε snap χρώμα· 2D↔3D συνέπεια· εξάλειψη 4 νεκρών/διπλών πηγών.
- **+** Επεκτάσιμο: νέος snap type → μία εγγραφή στο map (TS exhaustiveness guard).
- **−** Απαιτεί άγγιγμα ADR-040 leaf (`SnapIndicatorOverlay`) → staging ADR-040 + ADR-515 (CHECK 6B/6D).

---

## 6. Changelog
- **2026-06-24** — Δημιουργία ADR. Καταγραφή ευρημάτων audit (§2-§3) + απόφαση SSoT (§4).
  Υλοποίηση: *(σε εξέλιξη)*.
