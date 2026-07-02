# ADR-564 — Ενοποιημένο BIM Placement HUD & Τόξο Φοράς (SSoT overlay για τοίχο/κολόνα/δοκάρι/πέδιλο)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Φ-beam + Φ-column + Φ-foundation (linear + pad) IMPLEMENTED (UNCOMMITTED) · Φ-tests μερικώς |
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

## 3. Απόφαση / Αρχιτεκτονική (ΔΙΟΡΘΩΜΕΝΗ μετά από deep read)

> ⚠️ **Διόρθωση αρχικού σχεδίου (100% ειλικρίνεια):** η πρώτη εκδοχή αυτού του ADR πρότεινε *γενίκευση* του `WallHudMeta` σε ένα νέο `PlacementHudMeta`. Ανάγνωση του κώδικα αποκάλυψε ότι **υπάρχει ήδη SSoT painter ανά αρχέτυπο** — `wall-hud-paint.ts` (γραμμικά) **και** `column-hud-paint.ts` (footprint, με πλάτος/βάθος/∠/ύψος για rect/κύκλο/πολύγωνο/σύνθετο). Και οι δύο χρησιμοποιούνται ΗΔΗ στο **grip-drag**. Άρα **δεν χρειάζεται νέος τύπος/γενίκευση** — το πραγματικό κενό είναι ότι οι δύο painters + το τόξο **δεν καλούνται κατά την ΤΟΠΟΘΕΤΗΣΗ** για δοκάρι/κολόνα/πέδιλο. Αυτό είναι καθαρό **reuse**, όπως ζητά ο κανόνας SSoT audit.

**Αρχή:** κάθε `*-preview-helpers.ts` προσαρτά στο ghost του τα ΗΔΗ υπάρχοντα meta:
- **Γραμμικά μέλη** (wall ✅, beam, foundation strip/tie): `wallHud` (`WallHudMeta` μέσω `buildSegmentHudMeta`) + προ-μεταφρασμένο `hudSpecLabel` (ανά μέλος) → ο `drawing-hover-handler` καλεί `drawWallHud`. Το τόξο **φοράς** το ζωγραφίζει ο handler (`drawDirectionArc`, gate χαλαρωμένο ανά γραμμικό εργαλείο).
- **Footprint μέλη** (column, foundation pad): reuse `paintColumnHud` (footprint dims + ∠ + ύψος) + τόξο **στρέψης** στο `awaitingRotation`.

Ο handler διαβάζει το `wallHud` **γενικά** (χωρίς `activeTool` gate) — άρα οι λευκές ενδείξεις εμφανίζονται μόλις το ghost φέρει το meta. Μόνο το **τόξο** έχει gate που χαλαρώνει ανά εργαλείο.

```
useXTool → *-preview-helpers.ts (attach wallHud + hudSpecLabel  |  footprint: paintColumnHud meta)
        → generatePreviewEntity (dispatcher, αμετάβλητος)
        → drawing-hover-handler:
             · previewEntity.wallHud → drawWallHud(meta, hudSpecLabel ?? buildWallHudSpecLabel)   [γενικό, χωρίς gate]
             · τόξο φοράς/στρέψης → drawDirectionArc(pivot, ref, cursor, sweep)                    [gate ανά μέλος]
        → paintWallHud / paintColumnHud / paintDirectionArc   (ΑΜΕΤΑΒΛΗΤΟΙ pure painters)
```

---

## 4. Λεπτομερής σχεδιασμός

### 4.1 Ετικέτα spec ανά μέλος (N.11 — keys ΠΡΩΤΑ σε el+en)

Κάθε αρχέτυπο έχει τον δικό του thin `build*HudSpecLabel` (αδελφό του `wall-hud-spec-label.ts`), ώστε η μετάφραση να ζει εκτός pure painter:
- `tools.wall.hudSpec` (υπάρχει) → `πάχος X · ύψος Y`
- `tools.beam.hudSpec` (✅ νέο) → `b={width} · h={depth}` (δοκάρι = γραμμικό, διατομή width×depth)
- `tools.column.hudSpec` (υπάρχει, `ύψος X`) → η κολόνα δείχνει b/h ήδη ως aligned δ. στις παρειές (`paintColumnHud`)· το label = ύψος. **Ερώτημα §8** αν ο Giorgio θέλει σύνθετο `b=..·h=..·ύψ=..`.
- `tools.foundation.hudSpec` (νέο, μελλοντικό) → strip/tie: `b=X · h=Y` · pad: footprint dims + βάθος (μέσω `paintColumnHud`-style).

**Πηγή αριθμών (γενικό, όχι από τον painter):** η ετικέτα κρέμεται προ-έτοιμη στο ghost ως `hudSpecLabel`· ο handler την προτιμά, αλλιώς fallback στο `buildWallHudSpecLabel` (τοίχος) — μηδέν αλλαγή τοίχου.

### 4.2 Γενικό wiring στον hover-handler (χαλάρωση gate)

`drawing-hover-handler.ts`:
- **Spec-HUD (γενικό, ΗΔΗ):** `previewEntity.wallHud` → `drawWallHud(wallHud, previewEntity.hudSpecLabel ?? buildWallHudSpecLabel(wallHud))`. Δουλεύει για ΚΑΘΕ μέλος που προσαρτά `wallHud`.
- **Τόξο φοράς (γραμμικά):** το gate `activeTool === 'wall'` → `activeTool === 'wall' || activeTool === 'beam'` (και αργότερα foundation strip/tie). pivot=`lastRefPt` (= `getBimOrthoReference`, δείχνει την αρχή του μέλους αφού τα BIM tools κρατούν σημεία σε dedicated preview stores — ADR-363), ref=world-X, sweep=bearing.
- **Τόξο στρέψης (footprint):** στο `awaitingRotation` (κολόνα/pad), δίπλα στην πορτοκαλί ευθεία → `drawDirectionArc(colRot.origin, refAxis, previewPt, snappedDeg)`.

### 4.3 Per-tool wiring

- **Δοκάρι** (`beam-preview-helpers.ts`, awaitingEnd straight/cantilever): ✅ **ΥΛΟΠΟΙΗΘΗΚΕ** — `buildSegmentHudMeta(start,end,width,depth)` + `buildBeamHudSpecLabel(width,depth)` περνούν στο `toWysiwygPreviewEntity`· gate τόξου χαλάρωσε. curved → χωρίς HUD (το άκρο ορίζεται από control point).
- **Πέδιλο** (`foundation-preview-helpers.ts`): strip/tie → γραμμικό (mirror beam)· pad → footprint (`paintColumnHud`-style) + τόξο στρέψης.
- **Κολόνα** (`column-preview-helpers.ts`): footprint HUD μέσω `paintColumnHud` κατά την τοποθέτηση + τόξο στρέψης στο `awaitingRotation`.

### 4.4 Τόξο ΣΤΡΕΨΗΣ parity + rotation-lock SSoT (κολόνα/pad)

Σήμερα `drawing-hover-handler.ts` δείχνει **πορτοκαλί** ευθεία (`drawPolarTrackingLine`) στο column place+rotate μέσω `getColumnRotationLock()` + `resolveColumnRotationDeg()`. Απόφαση Giorgio (§8): **και τα δύο** (πορτοκαλί ευθεία + έγχρωμο τόξο). **SSoT ρίσκο:** το pad χρησιμοποιεί `PlacementRotationStore` (`setPlacementRotationLock`) ενώ ο handler διαβάζει `getColumnRotationLock()` → πιθανή ασυμφωνία· ενοποίηση rotation-lock read πριν το wiring. Να επαληθευτεί στον browser.

---

## 5. Φάσεις υλοποίησης

| Φάση | Περιεχόμενο | Αρχεία (κύρια) | Status |
|---|---|---|---|
| **Φ-beam** | Δοκάρι (γραμμικό): `wallHud`+`hudSpecLabel` στο ghost + `hudSpecLabel` param στο `toWysiwygPreviewEntity` + i18n `tools.beam.hudSpec` (el+en) + `buildBeamHudSpecLabel` + χαλάρωση gate τόξου. | `beam-preview-helpers.ts`, `beam-hud-spec-label.ts`, `wysiwyg-preview-shared.ts`, `drawing-hover-handler.ts`, 2× locale json | ✅ UNCOMMITTED |
| **Φ-foundation-linear** | Πέδιλο strip/tie (γραμμικό, mirror δοκαριού): `wallHud`+`hudSpecLabel` + χαλάρωση gate + `getBimOrthoReference` foundation case + i18n. | `foundation-preview-helpers.ts`, `foundation-hud-spec-label.ts`, `bim-ortho-reference.ts`, locale | ✅ UNCOMMITTED |
| **Φ-column** | Κολόνα (footprint): reuse `paintColumnHud` κατά την τοποθέτηση + τόξο στρέψης στο `awaitingRotation`. | `column-preview-helpers.ts`, `PreviewRenderer.ts`, `PreviewCanvas.tsx`, `drawing-hover-handler.ts` | ✅ UNCOMMITTED |
| **Φ-foundation-pad** | Πέδιλο pad (footprint): extract entity-agnostic `paintFootprintHud` (κοινό κολόνα+pad) + τόξο στρέψης (ΗΔΗ λειτουργεί — shared lock). rotation-lock **ΗΔΗ ενοποιημένο** (ADR-514 Φ6d). | `foundation-preview-helpers.ts`, `column-hud-paint.ts`, `PreviewRenderer.ts`, `PreviewCanvas.tsx`, `drawing-hover-handler.ts` | ✅ UNCOMMITTED |
| **Φ-tests** | jest για spec-labels + attach meta· ADR changelog· co-stage ADR-040. | `__tests__/*`, ADRs | ⬜ PROPOSED |

Κάθε φάση: 🔴 browser-verify ΠΡΙΝ commit (ADR-040 CHECK 6D — canvas drawing files απαιτούν co-staged ADR: stage ADR-564 + ADR-040 + ADR-397/508).

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

## 8. Αποφάσεις Giorgio (2026-07-02) + εκκρεμότητες

- ✅ **Σημειακά μέλη — πλήρες HUD** όπως ο τοίχος (Giorgio). Η κολόνα/pad ήδη δείχνει b/h ως aligned δ. στις παρειές + ∠ + ύψος μέσω `paintColumnHud` — δηλαδή **ήδη πλουσιότερο** από τον τοίχο.
- ✅ **Τόξο + πορτοκαλί ευθεία μαζί** στην περιστροφή κολόνας/pad (Giorgio «και τα δύο»).
- ✅ **Στυλ ετικέτας** `b=20 · h=40 · ύψ.=3,00 m` (Giorgio). Εφαρμόστηκε ήδη στο δοκάρι ως `b={width} · h={depth}`.
- ⬜ **Ανοιχτό:** για την κολόνα, το `paintColumnHud` δείχνει b/h ως δ. παρειών + label μόνο «ύψος». Να επιβεβαιωθεί αν ο Giorgio θέλει ΚΑΙ σύνθετο `b=..·h=..·ύψ=..` label (πιθανή διπλοεμφάνιση με τις δ. παρειών) ή να μείνει το «ύψος» label + δ. παρειών.
- ✅ **rotation-lock SSoT:** SSoT audit (Φ-foundation) απέδειξε ότι το `ColumnRotationStore` είναι **ήδη** byte-for-byte alias του `PlacementRotationStore` (ADR-514 Φ6d). Το pad γράφει `setPlacementRotationLock` (`useFoundationTool:378`) και ο handler διαβάζει `getColumnRotationLock()` = **ΤΟ ΙΔΙΟ lock**. Άρα η πορτοκαλί ευθεία + το τόξο στρέψης του pad στο `awaitingRotation` **ήδη λειτουργούν** (το block handler:388 δεν έχει `activeTool` gate) — **καμία unification δεν χρειάστηκε** (η αρχική ανησυχία ήταν speculative).
- ⬜ **Ανοιχτό (pad label):** το footprint HUD του pad δείχνει πλάτος/μήκος ως δ. παρειών + `βάθος X` label (parity με κολόνα «ύψος X»). Να επιβεβαιωθεί αν ο Giorgio θέλει σύνθετο `b=..·h=..·βάθ=..` (§5 handoff) — ίδιο εκκρεμές με την κολόνα.

---

## 9. Δοκιμές (jest, targeted — N.17: όχι tsc)

- `wall-hud-paint`: `buildSegmentHudMeta` numeric (υπάρχον) + νέο `showAxisDimension:false` path (μόνο spec).
- `buildPlacementHudSpecLabel`: σωστό i18n key ανά `memberKind` (wall/beam/column/foundation) + display units.
- `direction-arc-paint`: υπάρχοντα tests καλύπτουν sign/χρώμα/geometry — προσθήκη descriptor-driven case αν χρειαστεί.
- Per-tool preview-helper: το ghost φέρει `placementHud`/`directionArc` με σωστά νούμερα.

---

## 10. Changelog

- **2026-07-02 (Opus 4.8) — Φ-foundation ΥΛΟΠΟΙΗΘΗΚΕ (linear + pad, UNCOMMITTED).** Το πέδιλο (και τα δύο αρχέτυπα) δείχνει πλέον τις ΙΔΙΕΣ λευκές ενδείξεις + έγχρωμο τόξο φοράς με τοίχο/δοκάρι/κολόνα — καθαρό **reuse** των υπαρχόντων painters (μηδέν διπλότυπο, SSoT audit με grep πρώτα). **(A) Γραμμικό (strip/tie-beam, καθρέφτης δοκαριού):** (1) νέο `foundation-hud-spec-label.ts` (`buildFoundationHudSpecLabel` linear «b·h» + `buildFoundationPadHudSpecLabel` pad «βάθος») + i18n `tools.foundation.hudSpec`/`padHudSpec` (el+en, single-brace CHECK 3.9)· (2) `foundation-preview-helpers.ts` `makeFoundationBandGhost` → `buildSegmentHudMeta` (πλάτος band ως offset) + `hudSpecLabel` μέσω `toWysiwygPreviewEntity` (ΙΔΙΟΣ `paintWallHud` με τον τοίχο)· (3) `drawing-hover-handler.ts` — gate τόξου ΦΟΡΑΣ χαλάρωσε σε `wall||beam||foundation-strip||foundation-tie-beam`· (4) **bug fix §2A:** `bim-ortho-reference.ts` — προστέθηκαν foundation cases (read `foundationPreviewStore.endPoint ?? startPoint`) + entries στο `BIM_ORTHO_TOOLS` → χωρίς αυτό `lastRefPt=null` → το τόξο ΔΕΝ εμφανιζόταν (+ τώρα F8/F10 δουλεύουν). **(B) Pad (footprint, καθρέφτης κολόνας):** SSoT audit απέδειξε ότι το rect/profile branch του `column-hud-paint.ts` είναι **ColumnParams-agnostic** → **extraction** entity-agnostic `paintFootprintHud(footprint, FootprintHudDescriptor, …)` (rect/circular/polygon/profile)· το `paintColumnHud` έγινε thin wrapper (map `ColumnParams`→descriptor, **μηδέν αλλαγή συμπεριφοράς κολόνας**, 62/62 jest). `PreviewRenderer.drawFootprintHud` + `PreviewCanvas` handle (inject transform/viewport)· `foundation-preview-helpers.attachFoundationPadHud` προσαρτά `footprintHud:{footprint,descriptor,heightSpecLabel}` (pad = πάντα `kind:'rectangular'`) και στα 2 pad return sites· handler block `previewEntity.footprintHud → drawFootprintHud`. **(C) rotation-lock:** SSoT audit απέδειξε ότι `ColumnRotationStore`=alias του `PlacementRotationStore` (ADR-514 Φ6d) → το τόξο στρέψης + πορτοκαλί ευθεία του pad στο `awaitingRotation` **ΗΔΗ λειτουργούσαν** (καμία unification — §8). Το πέδιλο δείχνει: γραμμικό → μήκος+∠+«b·h»+🟢/🔴 τόξο φοράς· pad → πλάτος/βάθος ανά παρειά+∠+«βάθος»+πορτοκαλί ευθεία+🟢/🔴 τόξο στρέψης. **Tests:** +2 foundation-preview-helpers (linear `wallHud`/`hudSpecLabel`, pad `footprintHud`) +1 bim-ortho-reference (foundation cases). N.17: όχι tsc (verified μέσω jest + static reads). 🔴 **browser-verify** (strip/tie 1ο→2ο κλικ· pad τοποθέτηση+περιστροφή) + commit (co-stage ADR-040/397/508/564, CHECK 6B/6D). ⬜ Ανοιχτό: σύνθετο pad label (§8). Επόμενο: Φ-3D siblings (ADR-543 projector seam).
- **2026-07-02 (Opus 4.8) — Φ-column ΥΛΟΠΟΙΗΘΗΚΕ (UNCOMMITTED).** Κολόνα (footprint μέλος) → reuse του υπάρχοντος `paintColumnHud` (μέχρι τώρα μόνο grip-drag) και κατά την **τοποθέτηση**, σε ΟΛΕΣ τις φάσεις (awaitingPosition/Rotation/Lean). (1) `PreviewRenderer.ts` — νέα μέθοδος `drawColumnHud(footprint, params, heightSpecLabel, transform, viewport)` (delegate `paintColumnHud`, `this.sceneUnits`)· (2) `PreviewCanvas.tsx` — έκθεση `drawColumnHud` στο handle (ενίει transform/viewport)· (3) `column-preview-helpers.ts` — νέος `attachColumnHud` προσαρτά `columnHud:{footprint,params}` (αναφορές του ghost, μηδέν copy) και στα 3 return sites· (4) `drawing-hover-handler.ts` — block `previewEntity.columnHud` → `drawColumnHud(...)` + `buildColumnHudSpecLabel(params.height)` (i18n `tools.column.hudSpec`, υπάρχον), **ΚΑΙ** στο `getColumnRotationLock()` block προστέθηκε το έγχρωμο **τόξο στρέψης** (`drawDirectionArc`) ΔΙΠΛΑ στην πορτοκαλί ευθεία (Giorgio «και τα δύο»). Η κολόνα δείχνει πλέον live πλάτος/βάθος ανά παρειά + ∠ γωνία + ύψος + (στην περιστροφή) πορτοκαλί ευθεία + 🟢/🔴 τόξο φοράς. rect/κύκλος/πολύγωνο/σύνθετο όλα καλύπτονται από το `paintColumnHud`. 🔴 **browser-verify** (τοποθέτηση + περιστροφή κολόνας) + commit (co-stage ADR-040/397/508/564, CHECK 6B/6D). N.17: όχι tsc. ⬜ Ανοιχτό: σύνθετο `b=..·h=..·ύψ=..` label vs «ύψος» (§8). Επόμενο: Φ-foundation.
- **2026-07-02 (Opus 4.8) — Φ-beam ΥΛΟΠΟΙΗΘΗΚΕ (UNCOMMITTED) + διόρθωση αρχιτεκτονικής.** Deep read αποκάλυψε ότι **υπάρχει ήδη** `column-hud-paint.ts` (footprint HUD painter) πλάι στο `wall-hud-paint.ts` (γραμμικός), και οι δύο σε χρήση στο grip-drag → η αρχική πρόταση «γενίκευση `WallHudMeta`» **ακυρώθηκε** υπέρ καθαρού **reuse** (SSoT audit). Δοκάρι (γραμμικό μέλος): (1) `wysiwyg-preview-shared.ts` — προαιρετικό `hudSpecLabel` param στο `toWysiwygPreviewEntity`· (2) νέο `beam-hud-spec-label.ts` (`buildBeamHudSpecLabel`) + i18n `tools.beam.hudSpec` = `b={width} · h={depth}` (el+en, single-brace CHECK 3.9)· (3) `beam-preview-helpers.ts` — awaitingEnd straight/cantilever προσαρτά `wallHud` (`buildSegmentHudMeta`) + `hudSpecLabel` μέσω `makeBeamWysiwygGhost`· (4) `drawing-hover-handler.ts` — spec label προτιμά `previewEntity.hudSpecLabel` (fallback τοίχου, μηδέν αλλαγή) + gate τόξου `wall || beam`. Το δοκάρι δείχνει πλέον live μήκος + ∠ γωνία + `b·h` + 🟢/🔴 τόξο φοράς, ΙΔΙΟΙ pure painters με τον τοίχο. 🔴 **browser-verify** (δοκάρι 1ο→2ο κλικ) + commit (co-stage ADR-040/397/508, CHECK 6D). N.17: όχι tsc. Επόμενο: Φ-foundation-linear / Φ-column.
- **2026-07-02 (Opus 4.8) — ADR δημιουργήθηκε (🟡 PROPOSED).** Deep search (4 parallel Explore agents) χαρτογράφησε: (α) τους ΗΔΗ entity-agnostic painters `wall-hud-paint.ts` + `direction-arc-paint.ts`, (β) τα 2 μόνο σημεία wall-lock (`.wallHud` attach + `activeTool==='wall'` gate στον `drawing-hover-handler.ts:294-318`), (γ) την ήδη κοινή placement υποδομή (`wysiwyg-preview-shared`, `placement-ghost-assembly`, `bim-cursor-snap`), (δ) την απόδειξη επεκτασιμότητας μέσω του line tool (`liveDimHud` reuse). Σχέδιο 6 φάσεων: γενίκευση `WallHudMeta→PlacementHudMeta` + `buildPlacementHudSpecLabel` (i18n el+en) + γενικό `directionArc` descriptor + per-tool meta builders + rotation-arc parity για σημειακά μέλη. Non-goals: μηδέν νέος painter/παλέτα/store. 🔴 Αναμονή έγκρισης Giorgio για υλοποίηση (ανοιχτά ερωτήματα §8) + co-stage ADR-040 (CHECK 6B/6D) στα implementation commits.
