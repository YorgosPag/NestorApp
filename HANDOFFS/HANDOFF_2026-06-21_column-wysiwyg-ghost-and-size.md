# HANDOFF — Column ghost WYSIWYG + size consistency (Revit-grade)

**Date:** 2026-06-21 · **ADR:** ADR-398 (§3.7 column smart face-snap) + νέο §3.8 (WYSIWYG ghost) · σχετικά ADR-363 (9-anchor ghost), ADR-487/499/503 (living organism / auto-size), ADR-508 (bim/framing), ADR-040 (preview-canvas perf)
**Working tree:** ΚΟΙΝΟ με άλλον agent (ADR-508 walls + ADR-505/507 export). **COMMIT = μόνο Giorgio.**

---

## 🎯 ΣΤΟΧΟΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
Το εργαλείο «Κολώνα» έχει **3 ασύμβατες εμφανίσεις** + **bug μεγέθους**. Ο Giorgio θέλει **Revit-grade**, **FULL ENTERPRISE + FULL SSoT**:
1. **ΕΝΑ WYSIWYG φάντασμα** = οπτικά ΤΑΥΤΟΣΗΜΟ με την τελική τοποθετημένη κολώνα.
2. **Μέγεθος:** φάντασμα == τοποθετημένη (σταθερό nominal· ΟΧΙ silent auto-shrink κατά την τοποθέτηση· ΟΧΙ morphing ανά θέση).

### Οι 3 εμφανίσεις σήμερα (πρόβλημα)
- **Μακριά από οντότητες:** 9-anchor ghost (`ColumnAnchorGhostRenderer`) → 1 ενεργό + **8 ανενεργά @15%** = οι «περιμετρικές γραμμές» που μπερδεύουν.
- **Κοντά σε οντότητα (face-snap §3.7):** **1** φάντασμα (single-anchor filter) → χάνονται οι 8 γραμμές.
- **Τοποθετημένη:** πραγματικός `ColumnRenderer` (γεμάτο/hatch) → άλλο visual.

### Bug μεγέθους (40→25) — ΑΙΤΙΑ (επιβεβαιωμένη)
Φάντασμα = nominal (400 default, αφού ribbon Πλάτος/Βάθος κενά). Τοποθετείται 400, ΜΕΤΑ ο structural organism (ADR-499/503, `autoSized` default + two-way shrink χωρίς φορτίο) **shrink-άρει σιωπηλά στο min 250**. **Domain άλλου πράκτορα.**

---

## ✅ ΚΛΕΙΔΩΜΕΝΕΣ ΑΠΟΦΑΣΕΙΣ (Giorgio, μη τις ξανασυζητήσεις)
- **Q1 → WYSIWYG:** ΕΝΑ φάντασμα, μέσω του ΠΡΑΓΜΑΤΙΚΟΥ `ColumnRenderer` (γεμάτο/hatch/χρώμα), ίδιο με την τελική. Κατάργηση των 8 ανενεργών anchor-ghosts. 🟢/🔴 status = λεπτό overlay.
- **Q2 → Μέγεθος (Revit-grade):** το φάντασμα δείχνει **σταθερό** nominal (type dims / ribbon)· η τοποθετημένη **κρατά** αυτό το μέγεθος. **ΟΧΙ morphing ανά θέση** (ο Giorgio το απέρριψε ρητά — η Revit ΔΕΝ μαντεύει 35/25 ανά σημείο). Auto-size = **ξεχωριστό ρητό βήμα** (κουμπί «Αυτόματη Μελέτη»/design, ADR-487/500), ΟΧΙ στην τοποθέτηση.

---

## 🔍 SSoT AUDIT (ΕΓΙΝΕ — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ, ΜΗΝ ΦΤΙΑΞΕΙΣ ΔΙΠΛΟΤΥΠΑ)
**Ξανατρέξε grep για επιβεβαίωση πριν γράψεις — αλλά αυτά βρέθηκαν ήδη:**

| Τι | Πού | Ρόλος |
|---|---|---|
| **WYSIWYG preview SSoT** | `canvas-v2/preview-canvas/PreviewRenderer.ts` + `canvas-v2/preview-canvas/bim-preview-render.ts` (`BimPreviewRenderer`) | Ρεντάρει real `*Entity` flagged `wysiwygPreview:true` μέσω του ΠΡΑΓΜΑΤΙΚΟΥ renderer. Δέχεται canonical viewport override (ADR-398 §3.4). **Η κολώνα ΠΡΕΠΕΙ να μπει εδώ.** |
| **Preview dispatcher** | `hooks/drawing/drawing-preview-generator.ts` (`generatePreviewEntity`) | Χειρίζεται wall/beam/foundation/slab — **ΟΧΙ column** (πρέπει να προστεθεί branch 'column'). |
| **Pattern «build entity + wysiwyg»** | `hooks/drawing/{beam,wall,foundation,slab}-preview-helpers.ts` | Mirror: φτιάχνουν `*Entity` με `wysiwygPreview` + `ghostStatusColor`. **Φτιάξε `column-preview-helpers.ts` ίδιο pattern.** |
| **Real column renderer** | `bim/renderers/ColumnRenderer.ts` | Το WYSIWYG visual. |
| **Status color SSoT** | `bim/ghosts/ghost-status-color.ts` (`resolveGhostStatusColor` 🟢/🔴) + `ghost-status-polygon-draw.ts` | Reuse για το overlay. |
| **Column entity build SSoT** | `hooks/drawing/column-completion.ts` (`buildDefaultColumnParams`, `buildColumnEntity`) | ΙΔΙΟΣ builder με το commit → preview === commit. **Reuse, μηδέν νέο geometry.** |
| **Column geometry SSoT** | `bim/geometry/column-geometry.ts` (`computeColumnGeometry`, anchor offset) | Ήδη παράγει το footprint. |
| **§3.7 face-snap (ΕΤΟΙΜΟ)** | `bim/columns/column-face-snap.ts` (`resolveColumnFaceSnap`), `column-placement-snap-context.ts` (`resolveColumnFaceSnapWithGlyph`), `bim/geometry/shared/footprint-face-frame.ts` | Δίνει `{position, anchor, status}`. **Reuse — το WYSIWYG ghost πρέπει να ζωγραφίζεται σε αυτό το position/anchor/status.** |

**ΠΡΟΣΟΧΗ — ⚠️ μην ψάξεις/φτιάξεις δικό σου bbox/face/preview helper:** όλα υπάρχουν πάνω. Το `footprint-face-frame.ts` (bbox/face) ήδη κοινό σε column + framing (μη το ξαναγράψεις).

---

## 📐 ΠΛΑΝΟ ΥΛΟΠΟΙΗΣΗΣ

### PART A — WYSIWYG ghost (δικό μου domain, ΥΛΟΠΟΙΗΣΕ)
1. NEW `hooks/drawing/column-preview-helpers.ts` (`generateColumnPreview(cursor, sceneUnits, faceSnap?)`) — mirror του `beam-preview-helpers`: reuse `buildColumnEntity`/`buildDefaultColumnParams` (ΙΔΙΟ με commit) → `ColumnEntity` με `wysiwygPreview:true` + `ghostStatusColor` (από §3.7 status). Θέση/anchor από `resolveColumnFaceSnapWithGlyph` (snap) ή ribbon/Tab anchor στο `getImmediateSnap()` cursor (free).
2. `drawing-preview-generator.ts` → ADD branch `if (tool === 'column')` → `generateColumnPreview` (mirror beam). Έτσι ο `PreviewRenderer` ρεντάρει την κολώνα με τον ΠΡΑΓΜΑΤΙΚΟ renderer = WYSIWYG.
3. **Κατάργησε** το schematic path: `useColumnGhostPreview` + `ColumnAnchorGhostRenderer` (9-anchor) → είτε διαγραφή είτε μετατροπή σε thin (κράτα ΜΟΝΟ ό,τι χρειάζεται). ⚠️ ADR-363 feature — τεκμηρίωσε στο ADR-363 + ADR-398 §3.8 ότι αντικαταστάθηκε από WYSIWYG. Tab anchor cycling ΠΑΡΑΜΕΝΕΙ (αλλάζει το single ghost).
4. ADR-040: ο `PreviewRenderer`/`drawing-preview-generator` είναι ήδη ADR-040-safe (το beam το χρησιμοποιεί). Μην προσθέσεις `useSyncExternalStore` σε orchestrators.

### PART B — Μέγεθος (αγγίζει ADR-499/503/487 — ΣΥΝΤΟΝΙΣΜΟΣ, ΜΗΝ το κάνεις μόνος χωρίς go)
- Στόχος: νεοτοποθετημένη κολώνα **κρατά το nominal** (= φάντασμα)· **ΟΧΙ** auto-shrink στην τοποθέτηση.
- Πιθανές προσεγγίσεις (αποφάσισε με Giorgio + structural agent): (α) ο auto-sizer ΑΓΝΟΕΙ κολώνες χωρίς applied load· (β) `autoSized=false` σε χειροκίνητη τοποθέτηση μέχρι ρητή μελέτη· (γ) η «Αυτόματη Μελέτη» (ADR-500) είναι ο ΜΟΝΟΣ που resize-άρει.
- **ΜΗΝ** πειράξεις `bim/structural/sizing/*` χωρίς συνεννόηση (shared tree, domain άλλου). Flag-αρε στο ADR-398 §3.8 + ΕΚΚΡΕΜΟΤΗΤΕΣ.

---

## 🧪 TESTS + VERIFY
- NEW `column-preview-helpers.test.ts` (mirror beam-preview-helpers test): free → ghost @ nominal+anchor· face-snap → ghost @ position/anchor/status· WYSIWYG entity flagged.
- Regression: `column-face-snap` (21), `footprint-face-frame` (10), `member-ghost-snap`, `useColumnTool`, `column-placement-snap-context` — ΟΛΑ GREEN.
- Browser (`https://nestorconstruct.gr/dxf/viewer` ή localhost): φάντασμα κολώνας = ΙΔΙΟ visual free/snap/τοποθετημένη· μέγεθος φαντάσματος == τοποθετημένης· έλξεις «ΓΩΝΙΑ/ΜΕΣΟ ΤΟΙΧΟΥ» δουλεύουν· τοίχος όλες παρειές 🟢.
- **N.17:** ΠΡΙΝ tsc → έλεγξε ότι δεν τρέχει άλλος tsc (κοινό tree).

---

## 📦 ΚΑΤΑΣΤΑΣΗ §3.7 (ΕΤΟΙΜΟ, UNCOMMITTED — χτίζεις ΠΑΝΩ σε αυτό)
Smart face-snap κολώνας: κουμπώνει σε παρειές δοκαριού/**τοίχου**/κολώνας, auto-λαβή ανά ζώνη, continuous slide, 🟢/🔴, έλξεις+γλυφές, τοίχος όλες πράσινες. FULL SSoT (footprint-face-frame + resolveColumnFaceSnapWithGlyph + publishSnapMarker). 46 jest GREEN.

**Δικά μου αρχεία §3.7 (git add ΜΟΝΟ αυτά + τα νέα του Part A):**
`bim/columns/column-face-snap.ts`[NEW]+test, `bim/columns/column-placement-snap-context.ts`, `bim/geometry/shared/footprint-face-frame.ts`[NEW]+test, `systems/cursor/{ColumnPlacementGhostStatusStore,snap-scheduler,mouse-handler-up}.ts`, `hooks/drawing/useColumnTool.ts`, `hooks/tools/useColumnGhostPreview.ts`, `ADR-398`.
**⚠️ Άγγιξα ΚΑΙ `bim/framing/member-column-face-snap.ts`** (μετάβαση στο κοινό `footprint-face-frame` SSoT, behavior-preserving, Q2) → **συντονισμός με ADR-508 agent πριν commit**.

---

## 🚧 ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **SSoT AUDIT (grep) ΠΡΙΝ ΚΑΘΕ ΝΕΟ ΚΩΔΙΚΑ** — reuse, μηδέν διπλότυπα. Self-audit ΠΡΙΝ παρουσιάσεις (ο Giorgio πιάνει διπλότυπα).
- **FULL ENTERPRISE + FULL SSoT.** No `any`/`as any`/`@ts-ignore`. Files ≤500, functions ≤40.
- **COMMIT/PUSH = μόνο Giorgio** (N.(-1)). Μην κάνεις commit.
- **Shared tree:** stage ΜΟΝΟ δικά σου· μην αγγίζεις `bim/framing/*` (εκτός του ήδη), `bim/structural/sizing/*`, export/ADR-505/507 του άλλου agent.
- **N.17:** ΕΝΑ tsc τη φορά.
- **Γλώσσα:** απάντα στον Giorgio ΕΛΛΗΝΙΚΑ.
