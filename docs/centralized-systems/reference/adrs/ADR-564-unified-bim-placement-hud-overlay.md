# ADR-564 — Ενοποιημένο BIM Placement HUD & Τόξο Φοράς (SSoT overlay για τοίχο/κολόνα/δοκάρι/πέδιλο)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Φ-beam IMPLEMENTED (UNCOMMITTED) · υπόλοιπες φάσεις PROPOSED |
| **Date** | 2026-07-02 |
| **Category** | DXF Viewer · BIM Placement · Preview Overlay SSoT |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-564-unified-bim-placement-hud-overlay.md` |
| **Author** | Opus 4.8 (Giorgio order) |
| **Related ADRs** | ADR-363 (BIM drawing mode / wall ortho-tracking), ADR-397 §15 (rotation-direction arc SSoT), ADR-508 (§wall-hud + unified linear-member framing), ADR-362 (dimension text SSoT), ADR-398 (column placement snap + ghost coloring), ADR-514 (unified BIM cursor snap), ADR-040 (preview-canvas micro-leaf perf — CHECK 6B/6D), ADR-550 (unified entity render contract) |

---

## 1. Πρόβλημα / Κίνητρο

Κατά τη σχεδίαση **τοίχου** (εργαλείο `wall`), μετά το **1ο κλικ** και ενώ ο χρήστης κινείται προς το 2ο κλικ, ο καμβάς δείχνει ένα πλούσιο real-time HUD «έτοιμου διαστασιολογημένου αρχιτεκτονικού σχεδίου» (πέρα από το απλό dynamic-input πεδίο μήκος/γωνία που δείχνουν AutoCAD/Revit):

- **Λευκές ενδείξεις κειμένου** πάνω στο σώμα-φάντασμα:
  - aligned **διάσταση μήκους** κάτω από τον άξονα (π.χ. `1,298 m`) — μεγαλώνει live,
  - ετικέτα **BIM ταυτότητας** στη μέση (π.χ. `πάχος 0,210 m · ύψος 3,000 m`),
  - **γωνία** `∠ 30,0°` στην αρχή.
- **Χρωματισμένο τόξο φοράς** από την αρχή του τοίχου προς τον κέρσορα: 🟢 πράσινο (πάνω από τον x-άξονα, sweep ≥ 0) / 🔴 κόκκινο (κάτω, sweep < 0) + βελάκι + διακεκομμένη baseline 0° + **χρωματιστές μοίρες** (signed, 2 δεκαδικά, π.χ. `30,00°`).
- **Σημάδι κορυφής** (τετράγωνο preview grip) στην αρχή.

> Στιγμιότυπο αναφοράς: `Στιγμιότυπο οθόνης 2026-07-02 223002.jpg` (τοίχος 30° / 1298 m, πράσινο τόξο).

**Απόφαση Giorgio:** Θέλω **μία και μοναδική πηγή αλήθειας** — αυτόν ακριβώς τον κώδικα της real-time προεπισκόπησης (λευκές ενδείξεις + έγχρωμα τόξα) να τον εφαρμόσω **και στην κολόνα, και στο δοκάρι, και στα πέδιλα**. Όχι αντιγραφή — ενοποίηση.

---

## 2. Τρέχουσα κατάσταση (code map — SOURCE OF TRUTH)

### 2.1 Οι painters είναι ΗΔΗ entity-agnostic (numbers-in, μηδέν wall-specific λογική)

| Αρχείο | Ρόλος | Κρίσιμα σύμβολα |
|---|---|---|
| `canvas-v2/preview-canvas/wall-hud-paint.ts` | **Γραμμικό** spec-HUD painter (aligned μήκος + `∠θ` + spec). **Pure, 2D+3D projector seam (ADR-543).** | `WallHudMeta`, `buildSegmentHudMeta(start,end,sceneUnits,thicknessMm,heightMm)`, `paintWallHudCore(ctx,meta,specLabel,proj)`, `paintWallHud(...)`, `WallHudProjector` |
| `canvas-v2/preview-canvas/column-hud-paint.ts` | **Footprint** spec-HUD painter (aligned δ. σε ΚΑΘΕ παρειά — πλάτος & βάθος — + `∠θ` + ύψος)· χειρίζεται rect/κυκλική/πολύγωνο/σύνθετο. **Pure.** ⚠️ **ΥΠΑΡΧΕΙ ΗΔΗ** (χρησιμοποιείται μόνο στο grip-drag). | `paintColumnHud(ctx,footprint,params,heightSpecLabel,sceneUnits,transform,viewport)` |
| `canvas-v2/preview-canvas/direction-arc-paint.ts` | Έγχρωμο τόξο φοράς (🟢/🔴 + βελάκι + baseline + signed μοίρες). **Pure, ΚΟΙΝΟ SSoT ADR-397 §15.** | `paintDirectionArc(ctx,pivotW,anchorW,cursorW,sweepDeg,transform,viewport)`, `resolveDirectionArc`, `resolveDirectionArcColor`, `DIRECTION_ARC_MIN_SWEEP_DEG` |
| `bim/ghosts/ghost-status-color.ts` | 🟢/🔴/🟠 παλέτα SSoT | `resolveGhostStatusColor('beam'\|'overlap'\|'warning'\|'neutral')` |
| `hooks/drawing/wall-hud-spec-label.ts` | i18n ετικέτα `πάχος·ύψος` (μετάφραση εκτός pure painter, N.11) | `buildWallHudSpecLabel(meta)` → `i18n.t('tools.wall.hudSpec', …)` |
| `canvas-v2/preview-canvas/PreviewRenderer.ts` / `PreviewCanvas.tsx` | Plumbing (ΗΔΗ γενικό, απλώς εκτίθεται) | `drawWallHud(meta,specLabel,…)`, `drawDirectionArc(…)`, `drawGhostFaceDimensions(…)` |

**Απόδειξη επεκτασιμότητας:** το εργαλείο **γραμμή** ΗΔΗ ξαναχρησιμοποιεί τον ίδιο painter μέσω πεδίου `liveDimHud` (`WallHudMeta`) με **κενό** specLabel — `drawing-hover-handler.ts:302-305`. Δηλαδή ο painter είναι ήδη «member-agnostic»· λείπει μόνο η προσάρτηση meta + η άρση των wall-gates.

### 2.2 Πού «κλειδώνει» στον τοίχο (τα 2 σημεία που πρέπει να γενικευτούν)

`hooks/drawing/drawing-hover-handler.ts` (`processDrawingHover`), μετά το `drawPreview`:

- **Spec-HUD** — γραμμές 294-298: διαβάζει `previewEntity.wallHud` (μόνο ο τοίχος το προσαρτά) → `drawWallHud(wallHud, buildWallHudSpecLabel(wallHud))`.
- **Τόξο φοράς** — γραμμές 306-318: **hard gate `activeTool === 'wall'`**. pivot = `lastRefPt`, ref = world-X (`{x:lastRefPt.x+1, y:lastRefPt.y}`), sweep = bearing.

### 2.3 Τι δείχνουν σήμερα τα άλλα 3 (και τι ΗΔΗ μοιράζονται)

| Εργαλείο | Τοποθέτηση | Τι δείχνει σήμερα | Τι λείπει (vs τοίχος) |
|---|---|---|---|
| **Κολόνα** (`useColumnTool`) | 2-click place+rotate (ADR-398 §3.10b) | WYSIWYG ghost (`assemblePlacementGhost`), faceDimensions, polar/rect grid, alignment guide, **πορτοκαλί** γραμμή στρέψης στο `awaitingRotation` (`getColumnRotationLock()` + `drawPolarTrackingLine`, γρ. 365-368) | ❌ spec-HUD κειμένου · ❌ **έγχρωμο** τόξο φοράς (μόνο πορτοκαλί ευθεία) |
| **Δοκάρι** (`useBeamTool`) | 2-click start→end (γραμμικό, mirror wall) | WYSIWYG ghost (`BeamRenderer`), listening/face dims, grid, 🔴 overlap χρώμα | ❌ spec-HUD (μήκος/`b·h`) · ❌ τόξο φοράς |
| **Πέδιλο pad** (`useFoundationTool`) | 2-click place+rotate (ADR-514 Φ6d, mirror column) | WYSIWYG ghost (`FoundationRenderer`), faceDimensions, grid | ❌ spec-HUD · ❌ τόξο φοράς |
| **Πέδιλο strip/tie-beam** | 2-click γραμμικό (mirror beam) | WYSIWYG band ghost, faceDimensions, grid | ❌ spec-HUD (μήκος/`b·d`) · ❌ τόξο φοράς |

**Ήδη κοινή υποδομή** (δεν την αγγίζουμε — απλώς προσθέτουμε πάνω της):
- `hooks/drawing/wysiwyg-preview-shared.ts` — `toWysiwygPreviewEntity`, `resolveGhostFaceDimensionsMeta`.
- `bim/placement/placement-ghost-assembly.ts` — ghost + dims + grid (κολόνα + pad).
- `bim/placement/bim-cursor-snap.ts` — `resolveBimCursorSnap` (και τα 4).
- `hooks/drawing/drawing-preview-generator.ts` — `generatePreviewEntity` dispatcher.
- `drawing-hover-handler.ts` — ΕΝΑ κοινό paint pipeline μετά το `drawPreview`.

### 2.4 Δύο αρχέτυπα μέλους (κρίσιμη διάκριση για τη γενίκευση)

1. **Γραμμικά μέλη** (`wall`, `beam`, `foundation-strip`, `foundation-tie-beam`): έχουν άξονα start→end → **μήκος + γωνία + spec** + τόξο **φοράς** (heading, pivot=αρχή, ref=world-X).
2. **Σημειακά/footprint μέλη** (`column`, `foundation-pad`): τοποθέτηση + περιστροφή → **διαστάσεις διατομής (bx×by) + spec** + τόξο **στρέψης** (pivot=κλειδωμένη θέση, ref=άξονας αναφοράς/world-X, sweep=γωνία περιστροφής). ΔΕΝ έχουν «μήκος άξονα» → η aligned dim μήκους παραλείπεται (η διατομή φαίνεται ήδη από faceDimensions/cartesian grid).

---

## 3. Απόφαση / Αρχιτεκτονική

Δημιουργούμε **Placement HUD SSoT** γενικεύοντας τα ΗΔΗ υπάρχοντα, **χωρίς νέο μηχανισμό, νέα παλέτα ή bespoke per-tool drawing** (Giorgio SSoT audit rule). Ο ίδιος painter (`wall-hud-paint`) + ο ίδιος arc (`direction-arc-paint`) καταναλώνονται από **και τα 4** εργαλεία μέσω ενός γενικού descriptor που κρέμεται στο ghost entity — ακριβώς όπως σήμερα ο τοίχος (`wallHud`) και η γραμμή (`liveDimHud`).

**Αρχή:** ένα προαιρετικό πεδίο `placementHud?: PlacementHudMeta` + `directionArc?: DirectionArcDescriptor` στο preview entity· ο `drawing-hover-handler` τα διαβάζει **γενικά** (χωρίς `activeTool` gate)· κάθε `*-preview-helpers.ts` τα γεμίζει με τα δικά του νούμερα.

```
useXTool → *-preview-helpers.ts (attach placementHud + directionArc)
        → generatePreviewEntity (dispatcher, αμετάβλητος)
        → drawing-hover-handler: ΕΝΑ γενικό branch
             · previewEntity.placementHud → drawPlacementHud(meta, buildPlacementHudSpecLabel(meta))
             · previewEntity.directionArc → drawDirectionArc(pivot, ref, cursor, sweep)
        → paintWallHudCore / paintDirectionArc  (ΑΜΕΤΑΒΛΗΤΟΙ pure painters)
```

---

## 4. Λεπτομερής σχεδιασμός

### 4.1 Γενίκευση του HUD meta & painter (rename, μηδέν αλλαγή συμπεριφοράς)

`wall-hud-paint.ts`:
- `WallHudMeta` → **`PlacementHudMeta`** (superset). Νέα πεδία:
  - `memberKind: 'wall' | 'beam' | 'column' | 'foundation'` (οδηγεί την i18n ετικέτα),
  - `showAxisDimension: boolean` (γραμμικά = true· σημειακά = false → παράλειψη aligned μήκους + `∠θ`),
  - τα `thicknessMm/heightMm` γίνονται γενικές διαστάσεις spec (μένουν numeric· η σημασιολογία στην ετικέτα).
- `WallHudMeta` κρατιέται ως **type alias** (`export type WallHudMeta = PlacementHudMeta`) για μηδενικό breakage στους 2 υπάρχοντες καταναλωτές (wall + line + grip-drag).
- `paintWallHudCore`: όταν `!showAxisDimension` → ζωγράφισε **μόνο** το spec label (χωρίς aligned dim / χωρίς `∠θ`), γιατί σε σημειακό μέλος η γωνία δίνεται από το τόξο στρέψης και η διατομή από το grid.
- Προαιρετικό cosmetic rename module → `placement-hud-paint.ts` με re-export από το παλιό path (ή διατήρηση ονόματος + σχόλιο). **Προτίμηση:** κράτα το path, γενίκευσε το JSDoc — λιγότερο import churn.

### 4.2 Γενίκευση της i18n ετικέτας spec

`wall-hud-spec-label.ts` → `buildPlacementHudSpecLabel(meta: PlacementHudMeta)`:
- `switch (meta.memberKind)` → i18n key ανά μέλος. **N.11: πρώτα προσθήκη keys** σε ΚΑΙ τα δύο locale files:
  - `src/i18n/locales/el/dxf-viewer-shell.json` + `src/i18n/locales/en/dxf-viewer-shell.json`
  - `tools.wall.hudSpec` (υπάρχει) → `πάχος X · ύψος Y`
  - `tools.beam.hudSpec` (νέο) → `πλάτος X · ύψος Y`
  - `tools.column.hudSpec` (νέο) → `X · Y · ύψος Z` (bx·by·height)
  - `tools.foundation.hudSpec` (νέο) → pad: `X · Y · βάθος Z` · strip/tie: `πλάτος X · ύψος Y`
- `buildWallHudSpecLabel` → thin wrapper (`memberKind:'wall'`) για back-compat (grip-drag consumer αμετάβλητος).

### 4.3 Γενικό wiring στον hover-handler (άρση των wall-gates)

`drawing-hover-handler.ts`:
- Αντικατάστησε το `previewEntity.wallHud` branch με **γενικό** `previewEntity.placementHud` (ο τοίχος πλέον γεμίζει `placementHud` αντί `wallHud`· `liveDimHud` της γραμμής παραμένει ή μεταναστεύει ομοίως).
- Αντικατάστησε το `if (activeTool === 'wall')` τόξο με **γενικό** `previewEntity.directionArc` descriptor:
  ```
  interface DirectionArcDescriptor { pivot: Point2D; refAxis: Point2D; cursor: Point2D; sweepDeg: number; }
  ```
  Το κάθε preview-helper (ή ο hover-handler για γραμμικά) το χτίζει. Γραμμικά: pivot=αρχή, ref=world-X, sweep=bearing. Σημειακά: pivot=locked origin, ref=άξονας αναφοράς, sweep=rotation deg.

### 4.4 Per-tool meta builders

- `beam-preview-helpers.ts` (`generateBeamPreview`, μετά το 1ο κλικ): `placementHud` (γραμμικό, `memberKind:'beam'`, μήκος/γωνία/`b·h`) + `directionArc` (heading). Reuse `buildSegmentHudMeta`.
- `foundation-preview-helpers.ts`: strip/tie → γραμμικό (mirror beam)· pad → σημειακό (`showAxisDimension:false`, spec `b·d·βάθος`, τόξο στρέψης στο `awaitingRotation`).
- `column-preview-helpers.ts` (`generateColumnPreview`): σημειακό `placementHud` (`bx·by·height`) + τόξο στρέψης στο `awaitingRotation`.

### 4.5 Τόξο ΣΤΡΕΨΗΣ parity για σημειακά μέλη (κολόνα/pad)

Σήμερα `drawing-hover-handler.ts:365-368` δείχνει **πορτοκαλί** ευθεία (`drawPolarTrackingLine`) στο column place+rotate μέσω `getColumnRotationLock()` + `resolveColumnRotationDeg()`. Για parity με τον τοίχο:
- Πρόσθεσε **δίπλα** (ή αντί) το έγχρωμο `drawDirectionArc(colRot.origin, refAxis, previewPt, snappedDeg)` — ΙΔΙΟ SSoT arc. Ανοιχτό σχεδιαστικό ερώτημα (βλ. §8): κρατάμε ΚΑΙ την ευθεία ΚΑΙ το τόξο, ή μόνο το τόξο; (Πρόταση: τόξο = SSoT ένδειξη φοράς· η ευθεία μένει ως tracking guide μόνο όταν υπάρχει polar snap.)
- **SSoT παρατήρηση/ρίσκο:** το pad χρησιμοποιεί `PlacementRotationStore` (`setPlacementRotationLock`) ενώ ο hover-handler διαβάζει `getColumnRotationLock()`. Πιθανό να μη δείχνει σήμερα καθόλου rotation ένδειξη το pad. **Task:** ενοποίηση του rotation-lock read (κολόνα + pad → ΜΙΑ πηγή) πριν driver-άρει και το τόξο και την ευθεία. Να επαληθευτεί στον browser.

---

## 5. Φάσεις υλοποίησης

| Φάση | Περιεχόμενο | Αρχεία (κύρια) |
|---|---|---|
| **Φ0** | Γενίκευση type + painter (`WallHudMeta`→`PlacementHudMeta`, alias, `showAxisDimension`). Μηδέν behavior change στον τοίχο/γραμμή. | `wall-hud-paint.ts` |
| **Φ1** | i18n keys (el+en) + `buildPlacementHudSpecLabel` + wrapper. | `wall-hud-spec-label.ts`, 2× locale json |
| **Φ2** | Γενικό wiring (`placementHud` + `directionArc` descriptors, άρση gates). Τοίχος migrate σε γενικά πεδία (regression baseline). | `drawing-hover-handler.ts` |
| **Φ3** | Beam meta builder (γραμμικό) + browser-verify. | `beam-preview-helpers.ts` |
| **Φ4** | Foundation strip/tie (γραμμικό) + pad (σημειακό) meta + rotation-lock unification. | `foundation-preview-helpers.ts`, rotation store |
| **Φ5** | Column meta (σημειακό) + rotation arc parity. | `column-preview-helpers.ts` |
| **Φ6** | Tests + ADR changelog + co-stage ADR-040. | `__tests__/*`, ADRs |

Κάθε φάση: 🔴 browser-verify ΠΡΙΝ commit (ADR-040 CHECK 6D — canvas drawing files απαιτούν co-staged ADR).

---

## 6. Τι ΔΕΝ κάνουμε (non-goals)

- ❌ Νέος painter / νέα παλέτα χρωμάτων / νέο store — **μόνο** reuse `wall-hud-paint` + `direction-arc-paint` + `ghost-status-color`.
- ❌ Bespoke drawing ανά εργαλείο (copy-paste του wall branch × 3).
- ❌ Αλλαγή της γεωμετρίας/commit των ghosts — μόνο overlay ένδειξη.
- ❌ (Προς το παρόν) 3D siblings (`bim-3d/viewport/wall-hud/…`) — ο 2D projector seam (ADR-543) τα καλύπτει αργότερα με μηδέν επανασχεδίαση.
- ❌ Άγγιγμα του DynamicInput HTML overlay (`systems/dynamic-input/`) — το `30.0° / 1297.6` pill είναι ήδη γενικό, ξεχωριστό σύστημα.

---

## 7. Επιπτώσεις / SSoT / ADR-040

- **SSoT:** μία πηγή για spec-HUD (`paintPlacementHud`) + μία για τόξο φοράς (`paintDirectionArc`), καταναλούμενες από 4 εργαλεία + grip-drag + line tool.
- **ADR-040:** οι painters παραμένουν pure micro-leaf safe (zero React/store). Τα commits που αγγίζουν `drawing-hover-handler.ts` / `preview-canvas/*` απαιτούν **co-staged ADR** (CHECK 6B/6D) — stage ADR-564 **και** ADR-040 (+ ADR-397/508 changelog).
- **N.11:** όλες οι νέες ετικέτες μέσω i18n keys (el+en) — μηδέν hardcoded string στον pure painter.
- **N.7.1:** τα αρχεία μένουν <500 γρ.· ο painter είναι ήδη 200 γρ.

---

## 8. Εκκρεμότητες / ανοιχτά ερωτήματα (για Giorgio)

1. **Σημειακά μέλη — spec χωρίς άξονα:** στην κολόνα/pad, όπου δεν υπάρχει «μήκος», δείχνουμε ΜΟΝΟ `bx·by·height` label + τόξο στρέψης; (Πρόταση: ναι — η διατομή φαίνεται ήδη από faceDimensions/grid.)
2. **Τόξο vs πορτοκαλί ευθεία στο column/pad rotate:** κρατάμε και τα δύο ή μόνο το έγχρωμο τόξο; (Πρόταση: τόξο = ένδειξη φοράς· ευθεία μόνο σε polar-snap.)
3. **Ετικέτα spec κολόνας:** `20 · 40 · ύψος 3,00 m` ή `b=20 · h=40 · ύψ.=3,00 m`; (χρειάζεται συγκεκριμένο αριθμητικό παράδειγμα από Giorgio).
4. **rotation-lock SSoT:** ενοποίηση `ColumnRotationStore` + `PlacementRotationStore` σε μία ανάγνωση — να επιβεβαιωθεί ότι το pad σήμερα δείχνει rotation ένδειξη.

---

## 9. Δοκιμές (jest, targeted — N.17: όχι tsc)

- `wall-hud-paint`: `buildSegmentHudMeta` numeric (υπάρχον) + νέο `showAxisDimension:false` path (μόνο spec).
- `buildPlacementHudSpecLabel`: σωστό i18n key ανά `memberKind` (wall/beam/column/foundation) + display units.
- `direction-arc-paint`: υπάρχοντα tests καλύπτουν sign/χρώμα/geometry — προσθήκη descriptor-driven case αν χρειαστεί.
- Per-tool preview-helper: το ghost φέρει `placementHud`/`directionArc` με σωστά νούμερα.

---

## 10. Changelog

- **2026-07-02 (Opus 4.8) — ADR δημιουργήθηκε (🟡 PROPOSED).** Deep search (4 parallel Explore agents) χαρτογράφησε: (α) τους ΗΔΗ entity-agnostic painters `wall-hud-paint.ts` + `direction-arc-paint.ts`, (β) τα 2 μόνο σημεία wall-lock (`.wallHud` attach + `activeTool==='wall'` gate στον `drawing-hover-handler.ts:294-318`), (γ) την ήδη κοινή placement υποδομή (`wysiwyg-preview-shared`, `placement-ghost-assembly`, `bim-cursor-snap`), (δ) την απόδειξη επεκτασιμότητας μέσω του line tool (`liveDimHud` reuse). Σχέδιο 6 φάσεων: γενίκευση `WallHudMeta→PlacementHudMeta` + `buildPlacementHudSpecLabel` (i18n el+en) + γενικό `directionArc` descriptor + per-tool meta builders + rotation-arc parity για σημειακά μέλη. Non-goals: μηδέν νέος painter/παλέτα/store. 🔴 Αναμονή έγκρισης Giorgio για υλοποίηση (ανοιχτά ερωτήματα §8) + co-stage ADR-040 (CHECK 6B/6D) στα implementation commits.
