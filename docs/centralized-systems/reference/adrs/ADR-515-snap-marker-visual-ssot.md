# ADR-515 — Snap Marker Visual SSoT (σχήμα · χρώμα · μέγεθος, 2D + 3D)

- **Status**: Implemented (uncommitted)
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

### 4.1 Two-layer design tokens (Google pattern) — μηδέν hex literal εκτός palette
- **Primitive palette** → `SNAP_MARKER_COLORS` στο `config/color-config.ts` (το dxf-viewer color
  SSoT). Raw hex, reuse υπαρχόντων primitives όπου τιμή+νόημα συμπίπτουν (`HIGHLIGHTED_ENTITY`,
  `MAGENTA`, `YELLOW`, `GUIDE_X`, `SNAP_PERPENDICULAR`).
- **Semantic mapping** → `rendering/ui/snap/snap-visual-config.ts`:
  - `SNAP_COLORS: Record<ExtendedSnapType, string>` — μία εγγραφή ανά τύπο, **δείχνει στο palette**
    (κανένα hex literal). Type-safe → exhaustiveness guard.
  - `resolveSnapColor(type)` — ΕΝΑΣ resolver, ασφαλές fallback στο `SNAP_MARKER_BASE_COLOR`.
  - re-export `SNAP_ICON_GEOMETRY` (ADR-137) → ΕΝΑ import σημείο για snap visuals.
- Χρωματικό **μοντέλο** = type-specific (Revit-rich)· αλλαγή τιμής = ΕΝΑ σημείο (palette).

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

## 5b. Crosshair κεντρικό τετράγωνο — unify (κράτα ΛΕΥΚΟ) + «τρύπα» πάντα

**Απόφαση Giorgio (2026-06-24).** Το σταυρόνημα είχε **δύο** ομόκεντρα τετράγωνα στο κέντρο:

| Τετράγωνο | Πηγή | Απόφαση |
|---|---|---|
| 🟢 Πράσινο = **PICKBOX** | `cursor.*` (`SUCCESS_BRIGHT`), `pickboxRef` | **ΑΦΑΙΡΕΘΗΚΕ** |
| ⬜ Λευκό = **APERTURE / APBOX** | `crosshair.color` (WHITE), `apertureRef`, `showAperture/apertureSize` | **ΚΡΑΤΗΘΗΚΕ** |

### 5b.1 Ένας snap-hide μηχανισμός (μηδέν διπλότυπο)
Η λογική «το κεντρικό τετράγωνο εξαφανίζεται όταν φωτίζεται έλξη» (snap marker «κουμπώνει» το κέντρο)
**μεταφέρθηκε** από το pickbox στο aperture. `updatePickboxVisibility` → **`updateApertureVisibility`**:
κρυφό αν `!showAperture || apertureSize<=0 || snapActive`. Ίδια αλυσίδα SSoT
(`getFullSnapResult → toSnapIndicatorView → isSnapMarkerVisible`), ίδια ADR-040 συμπεριφορά
(γράφει DOM μόνο όταν αλλάζει το active state). **Δεν υπάρχουν πλέον δύο μηχανισμοί.**

### 5b.2 «Τρύπα» πάντα — οι γραμμές σταματούν στις παρειές του τετραγώνου
Reuse του υπάρχοντος gap μηχανισμού (`computeSegmentBoxes`/`computeCenterGap`, pure + unit-tested) —
**κανένας νέος μηχανισμός**. Άλλαξε μόνο η πηγή του gap:
- **Πριν**: `computeCenterGap({ useCursorGap, centerGapPx, pickBoxSize })` — gap από `pickBoxSize`
  (gripSettings) και **μόνο** όταν `use_cursor_gap` (default `false` → καμία τρύπα).
- **Τώρα**: `computeCenterGap({ showCenterSquare, centerSquareSize, useCursorGap, centerGapPx })` —
  όταν το κεντρικό τετράγωνο είναι ορατό, `gap = apertureSize/2 + CENTER_SQUARE_GAP_CLEARANCE` (=2px)
  **πάντα** (ανεξάρτητα από `use_cursor_gap`) → οι 4 γραμμές σταματούν στις εξωτερικές παρειές του
  τετραγώνου + μικρό clearance ώστε να μην ακουμπούν το περίγραμμά του → **πάντα τρύπα** στο εσωτερικό.
  Χωρίς ορατό τετράγωνο → fallback στο προαιρετικό `use_cursor_gap` (συμπεριφορά αμετάβλητη).

### 5b.3 Dead-UI flag (cursor pickbox)
Το πράσινο pickbox ζωγραφιζόταν **μόνο** στο `CrosshairOverlay`. Μετά την αφαίρεση, το `cursor.*`
block (shape/size/color/line_width) στο cursor settings **δεν παράγει πλέον ορατό στοιχείο**, αλλά
παραμένει στο schema/migration γιατί το επεξεργάζεται ακόμα το settings panel
(`ui/components/dxf-settings/settings/special/CursorSettings.tsx`) + ribbon `settings-tab-cursor.ts`.
→ **Flagged ως dead-UI candidate** (cleanup του panel + migration = ξεχωριστό βήμα· δεν αγγίχθηκε για
να μη σπάσει το settings migration — εντολή handoff).

---

## 6. Changelog
- **2026-06-24** — Δημιουργία ADR. Καταγραφή ευρημάτων audit (§2-§3) + απόφαση SSoT (§4).
- **2026-06-24** — Υλοποίηση (χρωματικό μοντέλο: **type-specific / Revit-rich**, επιλογή Giorgio):
  - **NEW** `rendering/ui/snap/snap-visual-config.ts` — SSoT: `SNAP_COLORS` (type-safe
    `Record<ExtendedSnapType,string>`, 28/28 μέλη — exhaustiveness guard), `SNAP_MARKER_BASE_COLOR`,
    `resolveSnapColor(type)`, `snapColorToThreeHex()` + re-export του `SNAP_ICON_GEOMETRY` (ADR-137,
    ΕΝΑ entry point για snap visuals).
  - **2D** `SnapIndicatorOverlay.tsx` — `snapColor = resolveSnapColor(type)` (ήταν μονόχρωμο
    `canvasUI.overlay.colors.snap.border`)· αφαιρέθηκε το πλέον αχρησιμοποίητο `canvasUI` import.
  - **3D** `bim-3d/shared/snap-marker-core.ts` — `SNAP_MARKER_COLOR` derived από
    `SNAP_MARKER_BASE_COLOR` (ήταν inline `0x00e5ff`) → 2D & 3D κινούνται μαζί.
  - 🔴 Εκκρεμεί: tsc + browser-verify + commit (staging ADR-040 + ADR-515 → CHECK 6B/6D).
- **2026-06-24 (housekeeping §4.3)** — αφαίρεση νεκρών snap-specific πηγών (επιβεβαιωμένα μηδέν
  ζωντανός consumer μέσω grep):
  - `design-tokens/modules/canvas-ui.ts` — αφαιρέθηκαν `overlay.colors.snap` (border/background/glow)
    **και** `overlay.snapIndicator.positioned` (10px circle, green-500) — αμφότερα αχρησιμοποίητα.
  - `SnapTypes.ts` — αφαιρέθηκαν τα 4 type-color fields (`endpointColor`/`midpointColor`/`centerColor`/
    `intersectionColor`) από το `SnapSettings` interface **και** το `DEFAULT_SNAP_SETTINGS`.
  - `CanvasSettings.ts` — αφαιρέθηκαν τα αντίστοιχα 4 type-color fields από το snap block.
  - **ΕΚΤΟΣ scope** (δεν αγγίχθηκε): `OverlayPass.renderSnapIndicators` + `RenderPipeline` — ολόκληρο
    το 3-pass canvas pipeline είναι ήδη flagged `DEADCODE` (γραμμή 1)· η αφαίρεσή του είναι ξεχωριστό
    pipeline-wide ratchet, όχι snap-specific.
- **2026-06-24 (feature: pickbox-hide-on-snap, Giorgio)** — το πράσινο τετράγωνο (cursor pick-box) στο
  κέντρο του σταυρονήματος εξαφανίζεται όταν φωτίζεται έλξη (το snap marker «κουμπώνει» το κέντρο):
  - **NEW SSoT** `isSnapMarkerVisible(view)` (type predicate) στο `snapping/extended-types.ts` — ΕΝΑΣ
    κανόνας «πότε φωτίζεται έλξη» (grid/guide σιωπηλά). Καταναλωτές: `SnapIndicatorOverlay` (return null
    αντί inline grid/guide check — refactor προς SSoT) **και** `CrosshairOverlay`.
  - `CrosshairOverlay.tsx` — subscription στο `ImmediateSnapStore` (ΙΔΙΑ αλυσίδα με τον
    `SnapIndicatorSubscriber`: `getFullSnapResult → toSnapIndicatorView → isSnapMarkerVisible`)·
    κεντρικό `updatePickboxVisibility()` (κρυφό αν `!cursor.enabled || snapActive`)· γράφει DOM ΜΟΝΟ
    όταν αλλάζει το active state (ADR-040 compositor-safe, κανένα re-render).
  - Επιβεβαιωμένο: `setFullSnapResult(null)` σε loss-of-snap → pickbox επανεμφανίζεται. Μηδέν διπλή πηγή.
- **2026-06-24 (self-audit fix, Giorgio SSoT review)** — αφαίρεση διπλότυπων που είχα εισάγει:
  - **Διπλότυπο palette**: τα hex ήταν literals μέσα στο `snap-visual-config` ενώ ήδη υπήρχαν tokens
    στο `color-config` (`#FF3B30`, `#9B59B6`, `#00BCD4`…). FIX: νέο primitive `SNAP_MARKER_COLORS` στο
    `color-config.ts` (reuse `HIGHLIGHTED_ENTITY`/`MAGENTA`/`YELLOW`/`GUIDE_X`/`SNAP_PERPENDICULAR`)·
    το `SNAP_COLORS` δείχνει εκεί — **μηδέν hex literal** στο semantic layer.
  - **Περιττός helper**: `snapColorToThreeHex` (custom parseInt) αφαιρέθηκε — αντικαταστάθηκε με το
    standard codebase pattern `new THREE.Color(hex).getHex()` στο `snap-marker-core`.
- **2026-06-24 (crosshair κεντρικό τετράγωνο: unify + τρύπα πάντα, Giorgio — βλ. §5b)**:
  - `CrosshairOverlay.tsx` — **αφαιρέθηκε** το πράσινο pickbox (`pickboxRef` + JSX + style block).
    Μένει ΕΝΑ κεντρικό τετράγωνο, το λευκό **aperture**. Η snap-hide λογική μετονομάστηκε/μεταφέρθηκε
    `updatePickboxVisibility → updateApertureVisibility` (ΕΝΑΣ μηχανισμός, ίδια SSoT αλυσίδα).
  - `crosshair-compositor-layout.ts` — `computeCenterGap` άλλαξε signature: τώρα δέχεται
    `{ showCenterSquare, centerSquareSize, useCursorGap, centerGapPx }` και επιστρέφει
    `centerSquareSize/2 + CENTER_SQUARE_GAP_CLEARANCE` όταν το τετράγωνο είναι ορατό (νέα export const
    `CENTER_SQUARE_GAP_CLEARANCE = 2`) → οι γραμμές σταματούν στις παρειές του τετραγώνου **πάντα**.
    Fallback στο `use_cursor_gap` χωρίς ορατό τετράγωνο. **Reuse**, όχι νέος μηχανισμός.
  - Tests `__tests__/crosshair-compositor-layout.test.ts` — ενημερώθηκε το `computeCenterGap` describe
    (16/16 GREEN).
  - Dead-UI flag: το cursor pickbox `cursor.*` block παραμένει στο schema/migration (settings panel),
    flagged ως dead-UI candidate (§5b.3).
  - 🔴 Εκκρεμεί: browser-verify (ένα λευκό τετράγωνο, τρύπα πάντα, εξαφάνιση στο snap) + commit
    (staging ADR-040 + ADR-515 → CHECK 6B/6D).
