# HANDOFF — 3Δ: σκούρες γραμμές ακμών στις όψεις («Shaded with Edges», Revit-grade)

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα — **`git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`**)

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «όπως οι μεγάλοι παίκτες, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ:** **Ο Giorgio κάνει commit** — ΠΟΤΕ εσύ `git commit`/`push`. `git add` **ΜΟΝΟ δικά σου**. N.17 ένα tsc τη φορά. function ≤40γρ, file ≤500γρ, **no `any`/`as any`/`@ts-ignore`**, semantic HTML, no inline styles. Στο τέλος: browser-verify + N.15 docs.

---

## 0. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio)
Στο **3Δ canvas**, οι όψεις των οντοτήτων (κολώνες, πεδιλοδοκοί, πλάκες…) εμφανίζονται **flat-shaded χωρίς σκούρες γραμμές στις ακμές** — δεν υπάρχει το χαρακτηριστικό «μολυβιά» περίγραμμα/ακμές που δίνει ευκρίνεια. Τα στερεά «κολλάνε» οπτικά μεταξύ τους.

Ερώτημα Giorgio: **είναι είδος προβολής που δεν έχουμε ακόμη, ή λάθος στον κώδικα; Τι κάνουν οι μεγάλοι (Revit);**

**Screenshot:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-12 193448.jpg` (θεμελίωση + κολώνες σε 3Δ· καθαρές shaded όψεις, μηδέν edge line work).

---

## 1. ΑΠΑΝΤΗΣΗ ΣΤΟ «ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ» (Revit / ArchiCAD / Forge)
Είναι **Visual Style** — η Revit το λέει **«Shaded with Edges» / «Consistent Colors with Edges»**. Τεχνική:
1. **Shaded faces** (PBR/flat) **+ model edges** ζωγραφισμένες από πάνω.
2. Οι ακμές = **silhouette/feature edges**: (α) hard creases (δίεδρη γωνία > threshold ~30°), (β) boundary edges, (γ) view-dependent silhouette (το περίγραμμα του στερεού ως προς την κάμερα).
3. **Κρίσιμο για να ΦΑΙΝΟΝΤΑΙ:** οι όψεις ζωγραφίζονται με μικρό **depth bias (`polygonOffset`)** ώστε οι ακμές (depth-tested, από πάνω) να ΜΗΝ κάνουν z-fighting με τις ομοεπίπεδες όψεις. Χωρίς αυτό, οι ακμές «χάνονται» μέσα στις όψεις.
4. **Premium polish:** post-process **silhouette/outline pass** (normal+depth discontinuity, Sobel) για καθαρά view-dependent περιγράμματα ΚΑΙ σε καμπύλες επιφάνειες (που τα geometry edges δεν πιάνουν). three.js: `OutlinePass` ή custom normal-depth edge shader.

**Συμπέρασμα:** ΔΕΝ είναι «προβολή που δεν έχουμε» — **το σύστημα ακμών ΥΠΑΡΧΕΙ ήδη** στον κώδικα (ADR-375 Phase C.7) αλλά **δεν αποδίδει**. Άρα = **bug/gap στο rendering**, όχι missing feature.

---

## 2. CURRENT STATE — code = source of truth (ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ)
Το 3Δ edge system είναι σχεδιασμένο Revit-grade και **wired σε ΟΛΟΥΣ τους converters**:

| Στοιχείο | Αρχείο | Ρόλος |
|---|---|---|
| Attach SSoT | `bim-3d/converters/bim-three-edges.ts` → `attachEdgesProjection(mesh, category, subcategoryKey?)` | ΜΟΝΑΔΙΚΟ σημείο attach· καλείται από κολώνα/δοκό/θεμελίωση/τοίχο/πλάκα/σκάλα/point-converters |
| Style resolver | `bim-3d/edges/bim-3d-edge-resolver.ts` → `resolve3DEdgeStyle(ctx)` | mirror του 2Δ `resolveSubcategoryStyle` (ίδιο priority stack)· `visible = lineWidthPx > 0` |
| Overlay builder | `bim-3d/edges/bim-3d-edge-overlay-builder.ts` → `buildEdgeOverlay` + `attachEdgeOverlay` | **LineSegments2 + LineMaterial** (screen-space πάχος), `EdgesGeometry(geo, 30°)`, `depthTest:true`, `depthWrite:false`, default color `#1a1a1a` |
| Resolution SSoT | `bim-3d/edges/bim-edge-resolution-store.ts` (`bimEdgeResolutionStore`) | default **(1,1)**· `setSize` καλείται ΜΟΝΟ από `ThreeJsSceneManager.resize()` (γρ. 472) |
| Resize wiring | `bim-3d/scene/ThreeJsSceneManager.ts:465` `resize()` ← `BimViewport3D.tsx:179` (ResizeObserver) | τροφοδοτεί το resolution store |

**Άρα τα overlays ΧΤΙΖΟΝΤΑΙ** (θετικό width για column pen 5 / foundation pen 4, σκούρο χρώμα) — αλλά **δεν φαίνονται**.

---

## 3. ROOT-CAUSE HYPOTHESES (ranked) + ΓΡΗΓΟΡΗ ΕΠΑΛΗΘΕΥΣΗ
**⚠️ ΠΡΩΤΑ ΕΠΑΛΗΘΕΥΣΕ — μην ξαναγράψεις σύστημα. Μάθημα: confirm repro/root-cause πριν re-implement.**

### Διαγνωστικό 2 λεπτών (κάνε ΑΥΤΟ πρώτα)
Στο `buildEdgeOverlay` (LineMaterial) βάλε προσωρινά `depthTest: false`:
- **Αν εμφανιστούν ακμές** (σαν wireframe «μέσα από» τα στερεά) → τα overlays ΥΠΑΡΧΟΥΝ & το resolution είναι ΟΚ → **root cause = z-fighting (Υπόθεση Α)**.
- **Αν ΠΑΛΙ τίποτα** → degenerate overlays → **resolution/width (Υπόθεση Β)**. Log `bimEdgeResolutionStore.getSize()` + `opts.lineWidthPx` τη στιγμή του build.

### Υπόθεση Α — z-fighting (ΠΙΘΑΝΟΤΕΡΟ) 🥇
**Μηδέν `polygonOffset` πουθενά** (επιβεβαιωμένο: `grep polygonOffset` = κενό). Οι ακμές είναι ομοεπίπεδες με τις όψεις στις γωνίες· με `depthTest:true` και ίδιο depth → z-fight → οι όψεις κερδίζουν → ακμές αόρατες.
**Fix (Revit-grade):** στα **element face materials** (`MaterialCatalog3D` / `material-catalog-defs`) πρόσθεσε `polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1` (push faces πίσω) ΩΣΤΕ οι depth-tested ακμές να κερδίζουν. SSoT: ΕΝΑ σημείο στο material factory (μην το βάλεις ανά-converter).

### Υπόθεση Β — LineMaterial.resolution timing 🥈
Το store default = **(1,1)**. Αν τα overlays χτίζονται ΠΡΙΝ το πρώτο `resize()` και το `subscribe()` δεν προλαβαίνει update (ή resize δεν φέρει σωστές διαστάσεις), το `LineMaterial.resolution=(1,1)` → εκφυλισμένο screen-space πάχος → αόρατες γραμμές.
**Έλεγχος:** log getSize() στο build + επιβεβαίωσε ότι το `subscribe` callback τρέχει με τις πραγματικές διαστάσεις μετά το mount.

### Υπόθεση Γ — depthTest/render order interplay (λιγότερο πιθανό)
`depthWrite:false` + render order· ίσως οι ακμές ζωγραφίζονται πριν τις όψεις. Ελέγξτε `renderOrder` του overlay vs mesh.

---

## 4. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (FULL ENTERPRISE + FULL SSoT)
**Φάση 1 — Διόρθωσε το ΥΠΑΡΧΟΝ pipeline (μικρό, στοχευμένο):**
1. Επαλήθευσε root cause με το διαγνωστικό §3.
2. Αν Α → `polygonOffset` SSoT στο element-material factory (`MaterialCatalog3D.buildMat`/`material-catalog-defs`). **Ένα σημείο.** Μην αγγίξεις converters.
3. Αν Β → fix resolution init (π.χ. seed το store με την πραγματική διάσταση στο scene init, ή force-update μετά το πρώτο layout).
4. Browser-verify: ακμές σκούρες ορατές σε κολώνες/πεδιλοδοκούς/πλάκες, ΟΧΙ «μέσα από» τα στερεά (only visible edges).

**Φάση 2 (προαιρετικό polish — μόνο αν ο Giorgio θέλει view-dependent silhouettes σε καμπύλες):**
- Visual Style toggle **«Shaded with Edges» on/off** ως SSoT (πιθανώς υπάρχει ήδη `VISUAL_STYLE_*` infra — δες `RibbonButtonIconPaths` visual-* + το 3Δ visual-style store· **ΕΛΕΓΞΕ αν υπάρχει store/toggle πριν φτιάξεις νέο**).
- Post-process `OutlinePass`/normal-depth edge shader για silhouettes (συμπληρωματικό στα geometry edges).

**SSoT σημεία (μη δημιουργείς διπλότυπα):**
- Edge attach: ΜΟΝΟ `attachEdgesProjection` (bim-three-edges.ts).
- Edge style: ΜΟΝΟ `resolve3DEdgeStyle` (mirror του 2Δ resolver — μην ξαναγράψεις priority).
- Face material: ΜΟΝΟ `MaterialCatalog3D` factory (το `polygonOffset` μπαίνει εδώ, μία φορά).
- Resolution: ΜΟΝΟ `bimEdgeResolutionStore`.

---

## 5. ΑΡΧΕΙΑ (πιθανά NEW/MOD — εξαρτάται από root cause)
**MOD (Υπόθεση Α):** `bim/materials/material-catalog-defs.ts` ή/και `bim-3d/materials/MaterialCatalog3D.ts` (`buildMat` → polygonOffset). Ίσως `bim-3d-edge-overlay-builder.ts` (renderOrder/bias tuning).
**MOD (Υπόθεση Β):** `bim-3d/scene/ThreeJsSceneManager.ts` (seed resolution στο init) ή `bim-edge-resolution-store.ts`.
**Tests:** `bim-3d/converters/__tests__/bim-three-edges.test.ts` (υπάρχει)· πρόσθεσε assertion για polygonOffset στο material factory / για resolution seed.
**Docs (N.15 + N.0.1):** ADR-375 Phase C.7 changelog (το edge system) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. **ΜΗΝ adr-index** (shared tree).

**⚠️ ADR-040:** πολλά bim-3d αρχεία είναι ΕΚΤΟΣ της 2Δ micro-leaf λίστας, ΑΛΛΑ έλεγξε CHECK 6D αν αγγίξεις render-critical· stage το σχετικό ADR.

---

## 6. ΒΗΜΑΤΑ (σειρά)
1. **PHASE 1 (RECOGNITION):** Διάβασε §2 αρχεία + ADR-375 Phase C.7. Τρέξε το διαγνωστικό §3 (depthTest:false) στον browser ΜΕ ΤΟΝ GIORGIO ή με runtime log → κλείδωσε root cause.
2. Δήλωσε root cause + plan (Plan Mode αν >3 αρχεία) → ζήτα έγκριση.
3. Υλοποίησε τη minimal SSoT διόρθωση (Φάση 1).
4. Browser-verify με Giorgio (ακμές ορατές, only-visible, σε όλα τα structural).
5. N.15 docs (ADR-375 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ). **Commit ο Giorgio.**

---

## 7. ΣΧΕΤΙΚΟ CONTEXT (read-only)
- **ADR-375 Phase C.7** = το 3Δ edge overlay system (industry research μέσα του).
- **ADR-377 Phase E** = 2Δ⟷3Δ subcategory parity (edges διαβάζουν objectStyles).
- **ADR-366** = 3D BIM viewer (γενικό).
- Μόλις ολοκληρώθηκε (ίδια session, εκκρεμεί browser-verify+commit): **ADR-445 v1.2** foundation per-kind ΧΡΟΙΕΣ (πέδιλο sienna `#8a5a3c` / πεδιλοδοκός teal `#2f7d6a` / συνδετήρια κεραμυδί `#b5651d`) — γι' αυτό στο screenshot οι πεδιλοδοκοί/συνδετήριες είναι teal/πορτοκαλί. Άσχετο με το edge θέμα.
- **Άλλος agent στο shared tree** — `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`.
