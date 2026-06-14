# HANDOFF — ADR-456 Slice 3: Σχεδίαση Οπλισμού (2Δ κάτοψη + τομή + 3Δ)

**Ημερομηνία:** 2026-06-14
**ADR:** ADR-456 — Στατικά: Ποσότητες & Οπλισμός
**Μοντέλο:** Opus (render pipeline + γεωμετρία, ADR-040-aware).
**Status εισόδου:** Slice 1 (ποσότητες) + Slice 2 (UI panel + building-level κανονισμός) ✅ DONE, **UNCOMMITTED** (tsc clean στα δικά μου αρχεία· 15 νέα + 50 regression jest GREEN). Slice 3 = ΑΥΤΟ.

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ Ελληνικά στον Giorgio.
2. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent → `git add` **ΜΟΝΟ δικά σου**, ΠΟΤΕ `-A`.
3. **COMMIT:** τον κάνει ο Giorgio, ΟΧΙ εσύ (N.(-1)).
4. **ADR-040 (κρίσιμο εδώ):** το Slice 3 αγγίζει render pipeline. Pre-commit CHECK 6B/6C/6D ΜΠΛΟΚΑΡΕΙ αν αλλάξεις canvas/renderer αρχεία **χωρίς να stage-άρεις ADR-040 ή σχετικό ADR**. Διάβασε `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` ΠΡΙΝ αγγίξεις renderer + stage το ADR στο ίδιο commit. **Μην βάλεις `hoveredEntityId`/`selectedEntityIds` στο bitmap cache key** (60fps rebuild → FPS 1).
5. **ΕΝΑ tsc τη φορά (N.17):** check `Get-CimInstance ... *tsc*` πριν τρέξεις· background.
6. **Plan πρώτα (N.0.1):** Phase 1 Recognition → plan → έγκριση Giorgio ΠΡΙΝ κώδικα.

---

## 1. Τι ΥΠΑΡΧΕΙ ήδη (το θεμέλιο που καλεί το render)

**Πρόθεση οπλισμού** (per-element, persisted): `ColumnParams.reinforcement?: ColumnReinforcement`
- `bim/structural/reinforcement/column-reinforcement-types.ts`:
  `{ longitudinal: {diameterMm, count}, stirrups: {diameterMm, spacingMm, spacingCriticalMm?}, coverMm }`
- `bim/structural/reinforcement/column-reinforcement-compute.ts`: μήκη/τεμάχια/βάρος/ρ + `criticalZoneLengthMm` (EC8 lcr) + `computeStirrupCount` (πύκνωση 2 κρίσιμων ζωνών). **Δίνει ΠΛΗΘΟΣ/ΒΗΜΑ, ΟΧΙ θέσεις** — το Slice 3 πρέπει να παράγει τις ΘΕΣΕΙΣ.
- Κανονισμός (ενεργός): `useStructuralSettingsStore.getState().codeId` → `resolveStructuralCode(codeId)` (`bim/structural/codes`). Τα limits (min cover, ελάχ. Ø) είναι στους providers.

**Geometry-is-SSoT:** οι θέσεις ράβδων/συνδετήρων ΠΟΤΕ δεν αποθηκεύονται — re-derived on-demand από `reinforcement` + section dims (mirror του `ColumnGeometry`).

## 2. Στόχος Slice 3 — Revit-grade σχεδίαση

**Α. Κάτοψη (2Δ):**
- Διαμήκεις ράβδες = γεμάτες κουκκίδες (Ø-scaled) στις θέσεις: 4 γωνίες (inset κατά `cover + Ø_stirrup + Ø_long/2`) + οι υπόλοιπες (`count-4`) κατανεμημένες στην περίμετρο του εσωτερικού ορθογωνίου (Revit: ομοιόμορφα ανά πλευρά).
- Συνδετήρας/στεφάνι = κλειστό ορθογώνιο περίγραμμα (περιμετρικά, inset κατά `cover`) + γωνιακά γαντζάκια (135°). Προαιρετικά εσωτερικοί δεσμοί (cross-ties) αν count μεγάλο — DEFER αν φουσκώνει.

**Β. Τομή / 3Δ:**
- Κατακόρυφες ράβδες = γραμμές/κύλινδροι σε όλο το ύψος στις θέσεις της κάτοψης.
- Στεφάνια = οριζόντιοι ορθογώνιοι δακτύλιοι ανά βήμα (πυκνά `spacingCriticalMm` στις κρίσιμες ζώνες άκρων `lcr`, αραιά `spacingMm` στη μέση) — reuse `computeStirrupCount` λογική.

**Γ. Ορατότητα:** πρέπει να ελέγχεται (νέο toggle, π.χ. `showReinforcement` στο bimRenderSettings, mirror `showFinishSkin`) — ο οπλισμός δείχνεται μόνο όταν ζητηθεί/zoom.

## 3. SSoT design (πρόταση — επιβεβαίωσε στο Recognition)
- **NEW** `bim/structural/reinforcement/column-rebar-layout.ts` (pure): `ColumnReinforcement + sectionDims + cover → { longitudinalBars: Point2D[], stirrupPolygon: Point2D[], stirrupLevelsZ: number[] }`. ΕΝΑ SSoT· καλείται και από 2Δ και από 3Δ (μηδέν διπλή τοποθέτηση).
- **2Δ render:** βρες πού ζωγραφίζεται η κάτοψη κολώνας (`ColumnRenderer` / `DxfRenderer` entity pipeline) → πρόσθεσε rebar overlay πίσω από hover/select. Reuse `bim-dim-labels`/render-palette tokens. Επικάλυψη με `material hatch` — απόφαση layering.
- **3Δ render:** βρες τον `columnToMesh`/structural converter (memory: shared tree με ADR-449) → πρόσθεσε rebar meshes (instanced αν πολλά).
- **Toggle:** `showReinforcement` στο `bim-render-settings` (config + store + ribbon View tab, mirror ακριβώς το `showFinishSkin` — υπάρχει pattern).

## 4. Recognition pointers (διάβασε)
- `bim/finishes/` + ADR-449 σοβάς = ΑΚΡΙΒΟ template «derived overlay geometry από prop + render 2Δ&3Δ + toggle». **Mirror το.**
- 2Δ: `canvas-v2/dxf-canvas/DxfRenderer.ts` + όποιος `ColumnRenderer`/`bim renderer` ζωγραφίζει το column footprint + material hatch (`drawMaterialHatch`).
- 3Δ: `bim-3d/.../columnToMesh` (grep) + πώς ο σοβάς/finish skin μπαίνει στο 3Δ.
- Toggle precedent: grep `showFinishSkin` (config `bim-render-settings-types.ts` + store `bim-render-settings-store.ts` + ribbon View tab `view-tab-bim-settings.ts`).
- ADR-040 §performance-critical files list (στο CLAUDE.md).

## 5. Verify (browser)
`/dxf/viewer` → ορθογ. κολώνα με οπλισμό (πάτα «Auto οπλισμός» στο panel «Στατικά/Οπλισμός») → ενεργοποίησε `showReinforcement` → κάτοψη δείχνει κουκκίδες ράβδων + στεφάνι· 3Δ/τομή δείχνει κατακόρυφες + δακτυλίους. Άλλαξε Ø/πλήθος → ενημερώνεται live. **FPS check:** pan/zoom να μένει 60fps (ADR-040).

## 6. DEFER
Cross-ties/εσωτερικοί δεσμοί πολυάριθμων ράβδων· σχεδίαση οπλισμού δοκού/πεδίλου (Slice 5)· bar bending schedule· κλίμακα-aware LOD (κρύψε ράβδες σε πολύ small zoom).

## 7. git add (ΜΟΝΟ δικά σου)
Νέα `column-rebar-layout.ts` + render edits + toggle (config/store/ribbon) + ADR-456 changelog + ADR-040 changelog (CHECK 6B) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY. Προσοχή shared-tree στα 3Δ converters (ADR-449 agent).

**Memory:** `reference_structural_quantities_ssot.md`, `reference_bim_dim_labels_ssot.md`, `reference_structural_color_identity_ssot.md`.
