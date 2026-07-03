# HANDOFF — «Δοκάρι από τοίχο»: να ΞΕΧΩΡΙΖΕΙ οπτικά το δοκάρι πάνω στον τοίχο (3D + 2D)

**Ημ/νία:** 2026-07-03
**Στόχος (λόγια Giorgio):** «Το δοκάρι από τοίχο δουλεύει σωστά (δημιουργείται, ο τοίχος κονταίνει, το ύψος του δοκαριού διαστασιολογείται real-time). ΑΛΛΑ επειδή το δοκάρι έχει **ίδιο footprint με τον τοίχο** και κάθεται flush από πάνω, **δεν ξεχωρίζει οπτικά** — μοιάζει να "καταπίνεται" από τον τοίχο. Θέλω να ξεχωρίζει, όπως οι μεγάλοι (Revit / Maxon Cinema 4D / Figma-level).»

**Σχετικά ADR:** **ADR-363** (BIM drawing / «Δοκάρι από τοίχο») · **ADR-401 D** (wall-top auto-attach) · **ADR-475** (auto member sizing) · **ADR-449** (structural finish skin / «σοβατισμένη όψη») · **ADR-567** (no-overlap placement — collision groups, ΝΕΟ, uncommitted).

---

## 0. Κανόνες συνεδρίας (ΑΠΑΡΑΒΑΤΟΙ)
- 🌐 **Απάντα ΠΑΝΤΑ στα Ελληνικά.**
- 🏢 **«Όπως οι μεγάλοι» (Revit / Maxon Cinema 4D / Figma-level) + FULL ENTERPRISE + FULL SSoT.** Αν οι μεγάλοι δεν προτείνουν κάτι → ακολούθα **την πρακτική τους**, μην εφευρίσκεις δικό σου.
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα.** Το χρώμα-SSoT ΥΠΑΡΧΕΙ ΗΔΗ (βλ. §3). Reuse — ΜΗΔΕΝ διπλότυπα, μηδέν νέο palette/material path.
- 🧭 **Ίχνευσε ΟΛΟ το pipeline** (entity → converter → material → render), όχι απομονωμένα.
- ❌ **ΜΗΝ τρέξεις `tsc`** (N.17). ✅ **jest** επιτρέπεται (γρήγορα, στοχευμένα).
- ❌ **ΜΗΝ commit / push** (N.(-1)). **Ο Giorgio κάνει τα commit.**
- ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Additive, μηδέν regression, commit με explicit pathspec (ποτέ `git add -A`).
- 📐 Στο clarify ξεκίνα με **συγκεκριμένο οπτικό/αριθμητικό παράδειγμα** (ASCII/χρώματα), όχι αφηρημένη ερώτηση.
- 🧠 **Αρχή Giorgio (μνήμη):** η κατασκευή = δυναμικός οργανισμός· διατομές/ύψη/οπλισμός επαναϋπολογίζονται real-time. **ΠΟΤΕ μην κλειδώνεις διάσταση μέλους** για να «διορθώσεις» οπτικό θέμα.

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (προηγούμενη συνεδρία) — μη το ξανακάνεις

### 1α. ADR-567 collision-groups fix (UNCOMMITTED — ο Giorgio θα κάνει commit)
Το «Δοκάρι από τοίχο» **δεν δημιουργούσε δοκάρι** — ο no-overlap guard (ADR-567) το μπλόκαρε («Δεν επιτρέπεται τοποθέτηση πάνω σε υπάρχουσα δομική οντότητα») επειδή το δοκάρι κάθεται με ίδιο footprint πάνω στον τοίχο. **Fix:** πρόσθεσα `StructuralCollisionGroup` — το overlap μπλοκάρει ΜΟΝΟ εντός ίδιας ομάδας:
- `vertical` = τοίχος + κολόνα (συγκρούονται μεταξύ τους)
- `beam` / `slab` / `foundation` = ξεχωριστά (οριζόντια/υπόβαση, διαφορετικό Z → δοκάρι/πλάκα πάνω σε τοίχο = **νόμιμο**)

**Αρχεία (8, uncommitted, ΟΛΑ τα diagnostics έχουν αφαιρεθεί):**
- `bim/placement/structural-placement-overlap.ts` — `StructuralCollisionGroup` + `structuralCollisionGroupOf()` + `candidateType` στο `findStructuralOverlap`
- `bim/placement/__tests__/structural-placement-overlap.test.ts` — +8 jest (40 total, πράσινα)
- `bim/scene/append-entity-to-scene.ts`, `bim/walls/add-wall-to-scene.ts`, `bim/walls/filling-walls-compute.ts`, `hooks/drawing/wall-ghost-build.ts`, `hooks/canvas/useRegionPerimeterMouseMove.ts` — περνούν `candidateType`
- `docs/.../adrs/ADR-567-structural-no-overlap-placement.md` — §1.1 + changelog Φ1b

**✅ Browser-verified από Giorgio:** το δοκάρι δημιουργείται, ο τοίχος κονταίνει σωστά.

### 1β. Root-cause του «ξανακαταπίνει» (ΔΕΝ είναι bug)
Με diagnostic logging αποδείχθηκε πλήρως: μετά τη δημιουργία (depth 500, underside 2500) ο **auto-sizer (ADR-475, `buildBeamSizePatch`)** ξαναϋπολογίζει το ύψος **500→350** (~3s μετά, βάσει ανοίγματος). Ο τοίχος **σωστά** ακολουθεί (underside 2500→2650, μένει `attached`, δεν κάνει revert — persistence OK). Ο Giorgio **επιβεβαίωσε ότι αυτό είναι σωστό & επιθυμητό** (δυναμικός οργανισμός). **Δεν αλλάζουμε τίποτα στο sizing/attach.**

Η όλη αλυσίδα (create → attach → auto-size → wall-follow) δουλεύει. Το ΜΟΝΟ που μένει = **οπτική διάκριση**.

---

## 2. Η ΕΡΓΑΣΙΑ (αυτή η συνεδρία)

**Το δοκάρι πάνω στον τοίχο πρέπει να ΞΕΧΩΡΙΖΕΙ οπτικά** (3D κυρίως, ίσως και 2D κάτοψη), ώστε να μη «λιώνει» μέσα στον τοίχο. Πρόβλημα: ίδιο footprint (πλάτος = πάχος τοίχου) + flush + πιθανό ίδιο υλικό/χρώμα στην «σοβατισμένη όψη».

**Πώς το κάνουν οι μεγάλοι (grep + επιβεβαίωσε):**
- **Revit:** τα δομικά μέλη έχουν category color (Structural Framing) — το δοκάρι φαίνεται με διακριτό χρώμα/subcategory ακόμη κι όταν συμπίπτει με τοίχο· «Structural» view template δίνει δικό του χρώμα ανά κατηγορία.
- Πιθανή σωστή λύση = **ο 3D όγκος του δοκαριού να χρησιμοποιεί το category color (amber) του `bim-object-styles`**, όχι uniform concrete/plaster που το εξομοιώνει με τον τοίχο. Ή/και ελαφρύ edge/outline.

---

## 3. SSoT INVENTORY (reuse — grep ΠΡΙΝ γράψεις)

- **`config/bim-object-styles.ts`** — ΤΟ χρώμα-SSoT ανά κατηγορία. **Δοκός = amber `#b07d1f`** (`BIM_CATEGORY_LINE_COLORS.beam`), τοίχος γκρι (`wallExterior #2b2f36` / `wallInterior #6b7280`). `BIM_OBJECT_STYLES.beam` έχει projection/cut color. **Άρα το «ξεχωριστό χρώμα» ΥΠΑΡΧΕΙ ήδη** — το ζήτημα είναι αν το **3D solid** το εφαρμόζει.
- **3D converters (grep):** `bim-3d/converters/BimToThreeConverter.ts` (`wallToMesh`, `columnToMesh`), `bim-3d/converters/bim-three-structural-converters.ts` (beam mesh + `structural-finish-3d`). → **Βρες πού παίρνει χρώμα/υλικό ο 3D όγκος δοκαριού** και αν αγνοεί το category color.
- **ADR-449 finish skin («σοβατισμένη όψη», `showFinishSkin`):** ΥΠΟΨΙΑ — αν το plaster skin είναι ON, ΟΛΑ βάφονται σοβάς → δοκάρι == τοίχος. Έλεγξε πώς συμπεριφέρεται με skin ON vs OFF. `bim/finishes/structural-finish-*`.
- **2D:** το `BeamRenderer.ts` ήδη χρησιμοποιεί το amber category color (κάτοψη) — δες αν φτάνει· στην κάτοψη το ίδιο footprint είναι εγγενές (ίσως διακεκομμένο «στοιχείο από πάνω» à la Revit).
- **Μην αγγίξεις:** ADR-040 micro-leaf αρχεία (CanvasSection κ.λπ.) χωρίς λόγο· CHECK 6B/6C/6D.

---

## 4. CLARIFY ΜΕ GIORGIO ΠΡΩΤΑ (concrete)
Ξεκίνα με ASCII/χρώματα, π.χ.:
```
Τώρα (σοβατισμένη όψη):   [τοίχος γκρι][δοκάρι γκρι]  → λιώνουν
Revit-style:              [τοίχος γκρι][δοκάρι amber] → ξεχωρίζει
```
Ρώτησε: (Α) πάντα διακριτό category color στο δοκάρι (και με σοβά), ή (Β) μόνο σε «structural» view / όταν skin OFF; (Γ) και στην 2D κάτοψη διακεκομμένο overhead;

---

## 5. VERIFICATION
- jest στοχευμένα (colors/converter). **ΟΧΙ tsc** (N.17).
- Browser: 3D «Δοκάρι από τοίχο» → το δοκάρι ξεχωρίζει από τον τοίχο (και μετά το auto-size 350).
- Μηδέν regression σε άλλα δομικά (τοίχος/κολόνα/πλάκα χρώματα).

---

## 6. ΞΕΧΩΡΙΣΤΟ TODO — συμμάζεμα `MEMORY.md` (εγκρίθηκε από Giorgio)
Το `~/.claude/projects/C--Nestor-Pagonis/memory/MEMORY.md` έφτασε ~289KB (όριο ~24KB) → κόβεται στο φόρτωμα. **Εγκρίθηκε:** κράτα **Feedback + Reference (τεχνικά gotchas)**· **αφαίρεσε τα «Project/Pending» task summaries** (παραβιάζουν τον κανόνα `feedback_memory_only_feedback_rules` — η κατάσταση ζει σε ADR+git). ⚠️ Περιέχουν pointers σε **uncommitted** δουλειά — πριν διαγράψεις, βεβαιώσου ότι κάθε 🔴 έχει ADR/HANDOFF αντίστοιχο· αλλιώς κράτα μονόγραμμο pointer. Στόχος index < 17KB.

---

## 7. ΚΑΤΑΣΤΑΣΗ working tree
- **Uncommitted (δικό μου, έτοιμο για commit από Giorgio):** τα 8 αρχεία ADR-567 (§1α).
- Τα diagnostic logs που είχα βάλει σε `useStructuralAutoAttach.ts` / `use-beam-commit.ts` / `AttachWallsTopCommand.ts` / `useWallPersistence.ts` / `bim-3d/scene/bim-scene-attach-syncs.ts` **έχουν αφαιρεθεί** (net-zero σε αυτά).
- ⚠️ Άλλος agent δουλεύει στο ίδιο tree — commit ΜΟΝΟ με explicit pathspec.
