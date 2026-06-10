# HANDOFF — Grid-First Auto-Design Θεμελίωσης & Ανέγερσης (εσχάρα πεδίλων + associative grid hosting)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα)

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «Να το κάνεις ΟΠΩΣ ΤΟ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT. ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ — FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST** (μην ξαναφτιάξεις SSoT). Απάντα στον Giorgio **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). N.17: ΕΝΑ tsc τη φορά (έλεγξε για άλλον πρώτα). Renderer/canvas/preview/guide touch → stage **ADR-040** (CHECK 6B/6D). Ξεκίνα με **Plan Mode** ή (αν 5+ αρχεία & 2+ domains) ρώτα Giorgio Plan vs Orchestrator (N.8). Μοντέλο: **Opus**.

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ
- **`docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md`** — ΟΛΟ. Είναι το master doc αυτής της δουλειάς (φιλοσοφία §8, εύρημα guides §8.8, έρευνα κώδικα §4, ανοιχτές αποφάσεις §5).
- **`ADR-189-construction-grid-guide-system.md`** — το υπάρχον σύστημα κανάβου/guides.
- **`ADR-436-bim-foundation-discipline.md`** — pad/strip/tie-beam foundation (data model, geometry, tools).

---

## 1. ΤΟ ΟΡΑΜΑ (φιλοσοφία Giorgio — ADR-441 §8)
Η εφαρμογή έχει **διπλό mode**: (α) design-from-scratch, (β) **import-driven bottom-up erection** — εισάγεις DXF στατικά μηχανικού → ανεγείρεις **ημι-αυτόματα** το 3D, bottom-up: **θεμελίωση → υπόγεια → ισόγειο → όροφοι** (οπλισμένο σκυρόδεμα). Στόχος: **δραστική επιτάχυνση 3D στησίματος, ημι-αυτόματο, παραμετρικό, πολυπαραγοντικό.**

Θεμελίωση: δίνεις **περίγραμμα** → «φτιάξε εσχάρα πεδίλων **N×M φατνώματα**», με αυξομείωση φατνωμάτων, **κεντρικά/έκκεντρα**, **μετακίνηση χωρίς να «σπάει»**, διαφορετικά **πάχη/ύψη** ανά πέδιλο. Μετά συνδετήριες (κεντρικές/έκκεντρες), μετά τοιχία/κολώνες.

**Πώς το κάνουν οι μεγάλοι = GRID-FIRST** (Revit/Tekla/CSI ETABS-SAFE/**ProtaStructure**=πιο κοντινός/Allplan/SCIA/Graitec): κάναβος αξόνων = SSoT, τα στοιχεία **constrained** σε αυτόν, **associative** (move άξονα → όλα ακολουθούν). Πλήρως-αυτόματο 2D→3D = **άλυτο παντού** → όλοι ημι-αυτόματο human-in-the-loop. ✅ Ο στόχος Giorgio είναι ρεαλιστικός & state-of-the-art.

---

## 2. ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (ADR-441 §8.8) — ο κάναβος ΥΠΑΡΧΕΙ ΗΔΗ
Το `src/subapps/dxf-viewer/systems/guides/` (ADR-189) **ΕΙΝΑΙ ήδη πλούσιος structural grid** (~80% έτοιμο), ΟΧΙ απλές γραμμές:
- Named άξονες **Α/Β/Γ…×1/2/3…** + **bubbles** (`guide-annotations-renderer.ts`), **bay dimensions** (B3), **groups**, **presets 4/5/6/8m** (`CreateGridFromPresetCommand`), **`GuideSnapEngine`** (X/Y/XZ), **IFC4 `IFCGRID`/`IFCGRIDAXIS`**, full command set + undo.
- Store: `systems/guides/guide-store.ts` (in-memory singleton, observer, max 500), `Guide` interface (`id/axis/offset/label/style/groupId/parentId/startPoint/endPoint`).

**ΛΕΙΠΟΥΝ 2 κρίσιμα για Revit-grade grid που οδηγεί ανέγερση:**
1. **Persistence** — guides = **session-only** (χάνονται σε reload· καμία Firestore). Τα BIM entities persist, οι guides όχι.
2. **Associative hosting** *(το κρισιμότερο)* — **καμία** BIM entity (wall/column/beam/foundation/slab) δεν φέρει `guideId`/`gridAxisId`. Move άξονα → **τίποτα δεν ακολουθεί**. **= το «move-no-break» που ζητά ο Giorgio.**

Δευτερεύοντα: per-floor/per-level scope (τώρα global singleton), bubble extents, per-view crop.

---

## 3. ΤΙ ΥΠΑΡΧΕΙ ΓΙΑ REUSE (έρευνα 2026-06-11 — SEARCH FIRST)
| Κομμάτι | Path | Σχόλιο |
|---|---|---|
| Boolean union πολυγώνων | `bim/geometry/shared/safe-polygon-boolean.ts` → `safeUnion` | polygon-clipping MIT, crash-proof. Για ένωση εσχάρας/BOQ. |
| Region/rectangle detection | `bim/walls/perimeter-from-faces.ts`, `bim/walls/wall-in-region.ts` | extractClosedPolygons / findRectanglesFromSegments / unionTouchingPolygons. |
| Strip από τοίχο (1) | `bim/foundations/foundation-from-wall.ts` → `buildStripFromWall` | Βάση για batch. |
| Foundation builders | `hooks/drawing/foundation-completion.ts` (`buildFoundationEntity`, `completeFoundationFromTwoClicks`), `bim/geometry/foundation-geometry.ts` (`computeFoundationGeometry`, band/pad) | strip & tie-beam = ίδιο geometry. |
| Batch pattern | `hooks/drawing/use-wall-commit.ts` → `buildFillingWalls`/`commitPerimeterFaces` | Πρότυπο `buildFoundationsFromAll…`. |
| Wall auto-join/miter | `bim/walls/wall-region-autojoin.ts`, `bim/walls/wall-trims.ts` | Πρότυπο join διασταυρώσεων. |
| Atomic undo | `core/commands/CompoundCommand.ts` | Για όλη την εσχάρα = 1 undo. |
| Foundation tool/ribbon | `hooks/drawing/useFoundationTool.ts`, `foundation-preview-store.ts`, `tool-definitions.ts`, `ui/ribbon/data/home-tab-draw.ts`, `contextual-foundation-tab.ts` | Entry points. |
| **Grid/guides** | `systems/guides/*` (store/commands/snap/annotations), ADR-189 | Ο κάναβος — επεκτείνεται, ΔΕΝ ξαναγράφεται. |

**ΛΕΙΠΟΥΝ (νέος κώδικας):** persistence guides (Firestore) · associative hosting (`guideId` σε BIM entities + follow-on-move) · `buildStripGridFromWalls`/from-grid · crossing-join/union · grid foundation FSM/placement-mode/ribbon · (αν ενιαίο σώμα) polygon-with-holes kind ή reuse SlabEntity.

---

## 4. ΑΝΟΙΧΤΕΣ ΑΠΟΦΑΣΕΙΣ (εκκρεμεί Giorgio — ADR-441 §5) — ΡΩΤΑ ΠΡΙΝ ΥΛΟΠΟΙΗΣΕΙΣ
1. **Με τι ξεκινάμε;** (α) **Associative grid hosting** (το θεμέλιο — Revit way) · (β) **εσχάρα πεδίλων standalone** (γρηγορότερο αποτέλεσμα).
2. **Πηγή εσχάρας:** από τοίχους / από περίγραμμα-region / από κολώνες / **από τον κάναβο (grid)**.
3. **Αναπαράσταση:** διακριτοί πεδιλοδοκοί + join (Revit-like, BOQ ανά στοιχείο) / ένα ενοποιημένο σώμα `safeUnion` (όπως οι εικόνες Giorgio).
4. **Συνδετήριες ταυτόχρονα:** ναι / όχι (v1).

**Πρόταση Opus:** ξεκίνα από **(1α) associative grid hosting** (το θεμέλιο που οδηγεί τα πάντα), μετά εσχάρα = «πέδιλα στις γραμμές/τομές του grid». Αλλά **ρώτα τον Giorgio** — μπορεί να θέλει πρώτα το γρήγορο visual (εσχάρα standalone).

---

## 5. ΕΚΚΡΕΜΕΙ VERIFY+COMMIT ΑΠΟ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ SESSION (δικά μου αρχεία — ο Giorgio κάνει commit)
**(Α) WYSIWYG placement preview (Τοίχος + Πεδιλοδοκός/Συνδετήρια)** — DONE, pending browser-verify + commit:
- NEW `canvas-v2/preview-canvas/bim-preview-render.ts`, `canvas-v2/preview-canvas/tracking-paint.ts`
- MOD `canvas-v2/preview-canvas/PreviewRenderer.ts`, `hooks/drawing/wall-preview-helpers.ts`, `hooks/drawing/foundation-preview-helpers.ts`
- Stage **ADR-040 + ADR-363 + ADR-436** changelogs. Verify: placement δείχνει πραγματικό fill/hatch/πάχος (όχι πράσινες γραμμές), final===preview.

**(Β) Location Line = Finish Face ίσιου τοίχου (κλικ=παρειά όχι κέντρο)** — DONE, pending browser-verify + commit:
- MOD `hooks/drawing/wall-completion.ts` (NEW `defaultEdgeAlignmentPoint`), `hooks/drawing/wall-preview-helpers.ts`, `hooks/drawing/use-wall-tool-event-listeners.ts`
- Stage **ADR-363**. Verify: awaitingEnd rubber-band δείχνει παρειά στη γραμμή· typed-length ίδιο.

**(Γ) tsc full check** — ΔΕΝ έτρεξε (έτρεχαν 2 tsc άλλου agent, N.17). Τρέξε όταν ελευθερωθεί.

> Δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` γραμμές ADR-040/363/436/441 + `MEMORY.md` Pending Design.

---

## 6. SANITY / ΚΑΝΟΝΕΣ
- **ΠΟΤΕ** commit/push (Giorgio). `git add` ΜΟΝΟ δικά σου, **ΠΟΤΕ -A**.
- N.17: πριν tsc → έλεγξε `Get-CimInstance Win32_Process … node.exe … tsc`. ΕΝΑ τη φορά.
- Renderer/canvas/preview/guide-render touch → **stage ADR-040** (CHECK 6B/6D), κράτα imperative (zero React re-render).
- N.6 enterprise-id για κάθε νέο Firestore doc (αν προσθέσεις persistence guides/foundation).
- N.15: μετά από κάθε υλοποίηση → ADR changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY, ίδιο commit.
- **ΜΗΝ** adr-index (shared tree).

---

## 7. QUICK START (νέα session)
1. Διάβασε ADR-441 (όλο) + ADR-189 + ADR-436.
2. Ρώτα Giorgio τις 4 ανοιχτές αποφάσεις (§4) — ιδίως «associative hosting πρώτα ή εσχάρα standalone;».
3. Plan Mode (ή Orchestrator αν 5+ αρχεία/2+ domains — N.8). Opus.
4. SEARCH FIRST (§3) → υλοποίηση FULL ENTERPRISE + FULL SSOT, Revit-grade.
