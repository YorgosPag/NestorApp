# HANDOFF — ADR-402 Sub-Phase 1: Stair editing στο 3Δ

**Ημερομηνία σύνταξης:** 2026-05-31
**Συντάκτης:** Developer A (Opus 4.8, SOLO) — μετά την ολοκλήρωση Phase C (multi-select)
**Θέμα:** ADR-402 — 3D Viewport BIM Element Editing
**Φάση:** Sub-Phase 1 — επεξεργασία **σκάλας** μέσα από το 3Δ (νέο domain)
**Κατάσταση εκκίνησης:** Phase A + B + C (gizmo move/rotate/resize/snap + multi-select) ✅ DONE — **pending commit + 🔴 browser verify**.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ ΟΤΑΝ ΞΕΚΙΝΗΣΕΙΣ
1. **`git log`/`git status`** — έλεγξε αν η Phase A/B/C έγινε commit (ο Giorgio μπορεί να την έκανε μετά το handoff) ή αν είναι ακόμα uncommitted στο working tree. **ΜΗΝ υποθέσεις.** Σχετικά αρχεία: `bim-3d/{stores,animation,scene,gizmo,viewport,systems/selection,2d-section,systems/section,accessibility,panels,shortcuts}` + `i18n/locales/{el,en}/bim3d.json` + ADR-402 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
2. **Διάβασε** ADR-402 doc (status + Phase C section + 3 τελευταία changelog).
3. **Διάβασε memory:** `project_adr402_genarc_gizmo_port.md` (πλήρες state A/B/C) + `project_adr402_3d_bim_editing.md` + `project_adr393_stair_extended_grips.md` (stair grips v1+v2).
4. **🚨 ΕΠΑΛΗΘΕΥΣΕ ΣΤΟΝ BROWSER ΠΡΩΤΑ** (πριν γράψεις ΟΤΙΔΗΠΟΤΕ): επίλεξε μια σκάλα στο 3Δ. **Εμφανίζεται gizmo;** Μετακινείται/περιστρέφεται; Οι εντολές `MoveEntityCommand`/`RotateEntityCommand` είναι **type-agnostic** → η σκάλα **πιθανώς ήδη μετακινείται/περιστρέφεται**. Αν ναι, η Sub-Phase 1 = ΜΟΝΟ resize/parametric. ΜΗΝ ξαναγράψεις move/rotate.
5. **🚨 N.8:** stair resize = νέο SSoT (σύνθετη γεωμετρία) → αν είναι >3 αρχεία, Plan Mode. ΡΩΤΑ πρώτα.

---

## 1. ΓΙΑΤΙ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΟ DOMAIN
Οι σκάλες ΔΕΝ είναι απλό box όπως wall/column/beam/slab. Έχουν multi-flight γεωμετρία (straight/L/U/Γ), 5-13 grips (`getStairGrips`), και το `bim3d-resize-bridge.ts` **ΔΕΝ** έχει `computeStairResizeParams`. Άρα το resize/parametric editing απαιτεί νέα γέφυρα.

## 2. DESIGN QUESTIONS — ρώτησε τον Giorgio (ΑΠΛΑ ελληνικά + παραδείγματα, ΕΝΑ-ΕΝΑ)
1. **Τι θες να αλλάζεις στη σκάλα μέσα από το 3Δ;** Μόνο θέση/περιστροφή (που ίσως δουλεύει ήδη), ή και διαστάσεις; (Παράδειγμα: πλάτος σκάλας, ύψος βαθμίδας, αριθμός βαθμίδων.)
2. **Αν διαστάσεις:** ποιες προτεραιότητα; (πλάτος = πιο συχνό· ύψος βαθμίδας/πατήματος = building-code-driven, ίσως καλύτερα από πάνελ.)
3. **Grips στο 3Δ ή handles στο gizmo;** Οι σκάλες έχουν 5-13 χαρακτηριστικά σημεία (ADR-393)· θες drag πάνω σε αυτά (σαν 2Δ grips) ή απλά resize handles στο gizmo (σαν τα άλλα στοιχεία);

## 3. REFERENCE (θέσεις-κλειδιά)
- `bim/stairs/stair-grips.ts` (`getStairGrips`), `computeStairGeometry`.
- ADR-358 (stair↔floor), ADR-393 (extended grips: straight hides width/length, L/U/Γ 4 corners read-from-geometry + multi-flight transforms).
- Resize SSoT pattern να μιμηθείς: `bim-3d/gizmo/bim3d-resize-bridge.ts` (compute{Column,Wall,Beam,Slab}ResizeParams → καλεί 2Δ apply*GripDrag SSoT, mm↔canvas units). Πρόσθεσε `computeStairResizeParams` εκεί + `RESIZE_HANDLES_BY_TYPE.stair` στο `bim-gizmo-overlay.ts`.
- `UpdateStairParamsCommand` υπάρχει ήδη (`core/commands/entity-commands/`).
- Sub-Phase 1 πάνελ: `useBimGeometryEdit.ts` + `BimGeometryTab.tsx` — **PENDING stair** (νέες i18n keys el+en + StairParams schema· λείπει από resolveRows/formatter/audit — βλ. `project_adr402_3d_bim_editing.md` §Sub-Phase 1).

## 4. ΟΡΙΑ (ΑΥΣΤΗΡΑ)
- Αγγίζεις: `bim-3d/gizmo/bim3d-resize-bridge.ts` (+`computeStairResizeParams`), `bim-3d/gizmo/bim-gizmo-overlay.ts` (RESIZE_HANDLES_BY_TYPE.stair), `bim-3d/animation/bim3d-edit-interaction-handlers.ts` (buildResizeCommand→UpdateStairParamsCommand), προαιρετικά `useBimGeometryEdit`/`BimGeometryTab` (Sub-Phase 1 πάνελ stair) + i18n + tests + ADR-402 + trackers N.15.
- **ΜΗΝ αγγίξεις:** `bim/stairs/*` λογική (μόνο κλήση `getStairGrips`/`computeStairGeometry`/apply*GripDrag SSoT), `core/commands` λογική (μόνο κλήση `UpdateStairParamsCommand`), `snapping/*`. **ΜΗΝ σπάσεις Phase A/B/C** (gizmo, snap-bridge, multi-select).
- **Multi-select + stair:** το multi (Phase C) δείχνει μόνο move+rotate· το stair resize είναι single-only (συνεπές με Phase C resize-σε-ένα).
- **ΠΟΤΕ** `git add -A`· **ΠΟΤΕ** commit/push χωρίς εντολή Giorgio.

## 5. ΠΑΓΙΔΕΣ
- PowerShell deny → χρησιμοποίησε bash `wc -l`/`grep`, Grep/Read/Glob tools, ΟΧΙ `powershell.exe`.
- Stair grips διαβάζονται **από computed geometry** (SSoT), ΠΟΤΕ re-derive από raw mm (feedback `grip_positions_read_geometry`).
- ΜΗΝ υποθέσεις ότι το move/rotate δεν δουλεύει — επαλήθευσε browser ΠΡΩΤΑ (§0.4).
- Unit contracts (mm↔canvas) διαφέρουν ανά τύπο — δες τα σχόλια στο `bim3d-resize-bridge.ts` Phase B (column /mmScaleFor, beam raw mm, wall relative inline).

## 6. DEFINITION OF DONE
- [ ] Browser verify: stair move/rotate δουλεύει (επιβεβαίωση ή fix)
- [ ] Stair resize/parametric κατά §2 απαντήσεις Giorgio
- [ ] `npx jest src/subapps/dxf-viewer/bim-3d` PASS + `npx tsc --noEmit` 0
- [ ] ADR-402 + trackers N.15
- [ ] 🔴 browser verify Giorgio
