# HANDOFF — ADR-422 L1: Heat-Load Engine (Μηχανολογική Μελέτη Θέρμανσης, ΤΟΤΕΕ/ΚΕΝΑΚ)

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit / 4M-FineHEAT) — **FULL ENTERPRISE + FULL SSOT**. Πλήρης συμμόρφωση ελληνικών κανονισμών.»
**Εκτέλεση:** **στρώμα-στρώμα με Plan Mode** (κλειδωμένο στο ADR-422). Per-layer verify + commit.
**⚠️ SHARED working tree** με άλλον agent (mep-fixture/sanitary/licensing). `git add` **ΜΟΝΟ** δικά σου αρχεία — **ΠΟΤΕ `-A`**. **COMMIT τα κάνει ο Giorgio, ΟΧΙ εσύ.**

---

## 0) ΤΙ ΘΑ ΚΑΝΕΙΣ

Υλοποίηση του **L1 — Heat-Load Engine** του ADR-422: υπολογισμός θερμικών απωλειών (θερμικό φορτίο **Φ** σε W) **ανά θερμικό χώρο** (`thermal-space` entity, ήδη υλοποιημένο στο L0), κατά **EN 12831 / ΤΟΤΕΕ 20701-1**.

**Τύπος (locked, ADR-422 §3):**
```
Φ_space = Σ (U · A · ΔΤ · f)        ← απώλειες αγωγής (τοίχοι/κουφώματα/πλάκες/οροφή)
        + 0.34 · n · V · ΔΤ          ← απώλειες αερισμού/διείσδυσης
        (+ θερμογέφυρες / reheat — όπως αποφασίσεις στο Plan Mode)
ΔΤ = Ti − Te(κλιματική ζώνη)
```

**ΠΡΩΤΟ ΒΗΜΑ: Plan Mode** — διάβασε κώδικα, επιβεβαίωσε τι υπάρχει (code = source of truth), σχεδίασε το engine + UI, πάρε **εσύ** τις Revit-grade αποφάσεις (μάθημα [[feedback_make_revit_grade_decisions_yourself]]: μη ρωτάς για standard professional επιλογές — αποφάσισε + ζήτα έγκριση plan). Ζήτα έγκριση plan από Giorgio, μετά υλοποίησε.

---

## 1) ΚΛΕΙΔΩΜΕΝΕΣ ΑΠΟΦΑΣΕΙΣ (ADR-422 §2 — μην τις ξανα-ρωτήσεις)
- **D2:** Defaults Ti/ACH ανά χρήση = config SSoT (ΤΟΤΕΕ 20701-1)· per-space override. → **ήδη υπάρχει** στο `thermal-space-use-catalog.ts`.
- **D3:** **Te (design outdoor temp) ανά κλιματική ζώνη** → **ΠΡΟΣΘΗΚΗ στο `kenak-thermal-config.ts`** (L1). ΤΟΤΕΕ 20701-3 (ζώνες Α/Β/Γ/Δ). Η κλιματική ζώνη είναι ρύθμιση κτιρίου: `Building.climateZone` (υπάρχει ήδη από ADR-396 P8).
- **D4** (L2, όχι τώρα): ΔΤ συστήματος multi-preset 80/60·70/55·45/35.

## 2) SSoT ΘΕΜΕΛΙΟ — REUSE, ΜΗΝ FORK (επιβεβαιωμένο code)
- **U-value math:** `src/subapps/dxf-viewer/bim/thermal/assembly-u-value.ts` → `computeAssemblyUValue` (ISO 6946) + `SURFACE_RESISTANCES_BY_FLOW` (wall/roof/floor). `bim/thermal/wall-assembly-thermal.ts` → `computeWallTypeUValue(dna)` per wall-type, on-demand.
- **ΚΕΝΑΚ config:** `src/subapps/dxf-viewer/bim/thermal/kenak-thermal-config.ts` (ζώνες Α/Β/Γ/Δ + `KENAK_MAX_U_WALL`). ⚠️ **ΛΕΙΠΕΙ Te ανά ζώνη → πρόσθεσέ το εδώ** (D3).
- **Θερμικός χώρος (L0):** `bim/types/thermal-space-types.ts` (params: useType/setpoint Ti/ACH/height + `computeThermalSpaceGeometry` → area/perimeter/**volume**). `bim/thermal/thermal-space-use-catalog.ts` (resolvers Ti/ACH). Collection `floorplan_thermal_spaces` (floor-scoped, ADR-420).
- **Όρια χώρου (ποιοι τοίχοι/κουφώματα τον περικλείουν):** `bim/geometry/envelope-perimeter.ts` / `envelope-wall-graph.ts` → per-region `chain.wallIds` + exterior face loop. `bim/walls/perimeter-from-faces.ts` (click-in-region SSoT, ADR-419) — το L0 ήδη το χρησιμοποιεί (`getCachedRegionPerimeters`/`pickSmallestContainingPerimeter`).
- **Κουφώματα:** `OpeningGeometry.area` (m²). ⚠️ **ΛΕΙΠΕΙ per-opening glazing U (Ug) → πρόσθεσέ το** (config ανά opening type ή per-instance, Revit-style· δες ADR-421 opening types).
- **Εξωτ./εσωτ. ταξινόμηση & exposed slabs:** ADR-396 envelope work — `envelope-element-applicator.ts` (Z1 proximity / Z2-Z3 exposed slabs / Z4 exterior openings), `exposed-slab-classifier.ts`. Χρήσιμο για να ξέρεις ποια στοιχεία είναι **εξωτερικά** (μετράνε στο ΔΤ προς Te) vs **εσωτερικά** (ΔΤ προς γειτονικό χώρο ή 0).
- **PDF/Schedule (για το Report layer αργότερα):** `bim/schedule/*` (`BimScheduleDialog`, `SchedulePreviewTable`, `scheduleToPdfBlob` + `registerGreekFont`).

## 3) ΚΕΝΑ ΠΟΥ ΠΡΟΣΘΕΤΕΙ ΤΟ L1
1. **Te ανά κλιματική ζώνη** στο `kenak-thermal-config.ts` (ΤΟΤΕΕ 20701-3). Wiring από `Building.climateZone`.
2. **Per-opening Ug** (glazing U). Πιθανό config SSoT ανά opening type (διπλό/τριπλό τζάμι) + per-instance override, mirror του Ti/ACH pattern.
3. **NEW pure engine** `bim/thermal/heat-load/*` — π.χ. `heat-load-engine.ts` (`computeSpaceHeatLoad(space, boundaries, climateZone)`) + tests. Pure, μηδέν side-effects, full unit tests (ΤΟΤΕΕ worked examples).
4. **UI/overlay** εμφάνισης φορτίου ανά χώρο (Revit «analytical»): είτε επέκταση του thermal-space tag/tab (Φ σε W + W/m²) είτε 2D analytical overlay. **ΑΠΟΦΑΣΙΣΕ στο Plan Mode** — προτίμησε reuse του υπάρχοντος thermal-space renderer/tab.

## 4) ΜΟΝΑΔΕΣ — ΚΡΙΣΙΜΟ (latent bug class, δες memory)
- Το footprint των area-entities είναι σε **scene-units** (το σχέδιο Giorgio ≈ μέτρα/cm, status bar «cm»), **ΟΧΙ πάντα mm**. Χρησιμοποίησε **`mmScaleFor(params)`** (mm→scene) και **`sceneToM`** (scene→m) — όπως διορθώθηκε στο `mep-underfloor-geometry.ts` + `computeThermalSpaceGeometry`. Για το L1: area/volume πρέπει να φτάνουν στο engine σε **m² / m³** (το `computeThermalSpaceGeometry` ήδη επιστρέφει σωστά μετά το fix). ⚠️ `floor-finish` area έχει ΑΚΟΜΑ το ίδιο latent bug (MM_TO_M hardcode) — flagged, ΟΧΙ δικό σου scope.

## 5) ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (CLAUDE.md)
- **FULL ENTERPRISE + FULL SSOT**, Revit/4M-FineHEAT grade. Καμία διπλή λογική — reuse §2.
- No `any`/`as any`/`@ts-ignore`. Functions **≤40 γρ.**, code files **≤500 γρ.** (engines/config/types εξαιρούνται αν χωρίς logic). Semantic HTML, no inline styles.
- **i18n SSoT:** όλα τα labels μέσω `t('...')` με keys **πρώτα** σε `el` **και** `en` locale JSON. Καμία hardcoded ελληνική/αγγλική συμβολοσειρά.
- Enterprise IDs (αν νέο entity/doc): `enterprise-id.service` + `setDoc`. (Το L1 πιθανόν να είναι engine + derived cache — αν γράψεις derived doc, enterprise id.)
- **TSC (N.17):** ΠΡΙΝ τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (process check). ΕΝΑ tsc τη φορά, background, μη μπλοκάρεις.
- **ADR-040:** το L1 είναι πιθανότατα **ΕΚΤΟΣ** (pure engine + analytical UI, κανένα high-freq canvas micro-leaf). Επιβεβαίωσε ότι δεν αγγίζεις CanvasSection/DxfRenderer/HoverStore/κλπ.
- **N.15 (μετά την υλοποίηση):** ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + **ADR-422 changelog** (νέο L1 entry) + memory `project_adr422_thermal_space.md`. **ΜΗΝ** αγγίξεις το `adr-index.md` (shared tree).

## 6) PENDING COMMIT (ο Giorgio θα κάνει commit — εσύ ΟΧΙ)
Είναι uncommitted στο tree (όλα ✅/🟡 από προηγούμενες sessions, ο Giorgio αποφασίζει):
- **Σημερινό DXF dataloss fix (ADR-399, ✅ browser-verified):** `useSceneState.ts` (deterministic link + replace cleanup), `dual-write-to-files.ts` (throw), `useLevelSceneLoader.ts` + `useAutoSaveSceneManager.ts` (handoff fixes), ADR-399 changelog.
- **ADR-422 L0** (✅ browser-verified) + όλα τα ADR-408 Εύρος Β heating items + πλήθος άλλων.
- Μην βασιστείς ότι έχουν φύγει στο production — ΔΕΝ έχουν γίνει commit/deploy.

## 7) ROADMAP (μετά το L1)
L2 radiator sizing (Φ→ισχύς, LMTD/exponent, γράφει `mep-radiator.params`) → L3 pipe sizing (m=Φ/(c·ΔΤ)→DN, γράφει `mep-segment.params.diameter`) → L4 hydraulic balancing (Darcy + index circuit + valve presets) → **Report PDF** (reuse `bim/schedule/*`).

## 8) ΠΗΓΕΣ ΝΑ ΔΙΑΒΑΣΕΙΣ ΠΡΩΤΑ
- `docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md` (το ADR — §2 αποφάσεις, §3 στρώματα).
- memory `project_adr422_thermal_space.md` (L0 + μάθημα «νέο BIM entity = πολλά σημεία εγγραφής» + unit-bug).
- `docs/centralized-systems/reference/adrs/ADR-396-*.md` (envelope/U-value/ΚΕΝΑΚ — το θερμικό θεμέλιο).
- ADR-040 list στο `CLAUDE.md` (για να επιβεβαιώσεις ότι είσαι εκτός).
