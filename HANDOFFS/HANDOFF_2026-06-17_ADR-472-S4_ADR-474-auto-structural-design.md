# HANDOFF — ADR-472 **S4** + ADR-474: Πλήρως Αυτόματος Δομικός Σχεδιασμός (Revit-grade)

**Ημ/νία:** 2026-06-17 · **Από:** Opus session · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Status:** 🟢 ΟΛΑ DONE + browser-verified στη βάση · **UNCOMMITTED** (commit = **Giorgio**, ΟΧΙ ο agent).
**Shared working tree** με άλλον agent (ADR-471/473 joint reinforcement) — **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A**.
**tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέχει κανονικά.**

---

## 0. ΤΙ ΕΓΙΝΕ ΣΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (3 κομμάτια)

Όραμα Giorgio: *ο μηχανικός σχεδιάζει γεωμετρία — τίποτε άλλο. Φορτία+ροπές+οπλισμός+πέδιλα = αυτόματα,
Revit-grade.* Η αλυσίδα **γεωμετρία → φορτία → οπλισμός → πέδιλο → persisted** δουλεύει end-to-end (επιβεβαιωμένο σε Firestore).

### (Α) ADR-472 **S3** — Stale-intent invalidation + re-study — **ΗΔΗ COMMITTED** (`4567a1af`)
`buildReinforcePatch` re-derive `auto:true` σε load change· manual locked· convergence guard `materiallyDiffers`·
`bim:structural-loads-computed` → re-reinforce (terminal chain, μηδέν oscillation). *Δεν χρειάζεται ξανά — committed.*

### (Β) ADR-472 **S4** — Auto ονομαστική ροπή M_Ed + M-N κολόνας — **UNCOMMITTED**
- `ColumnSectionContext += designMomentKnm?` (`codes/structural-code-types.ts`).
- NEW SSoT `nominalColumnEccentricityMm` (EC2 §6.1(4) e₀=max(h/30,20mm)) + `nominalColumnMomentKnm(N,h)` στο
  `codes/suggest-reinforcement.ts`· ο builder `resolveColumnDesignLoad` (`section-context.ts`) το παράγει αυτόματα
  (h=minThicknessMm, ασθενής άξονας). **Μηδέν input.**
- `asStrengthColumnMm2` = αξονική **+** καμπτική (`asMomentColumnMm2`, steel-couple). Backward-compat: absent moment→0.

### (Γ) ADR-474 — Occupancy-driven auto loads + edge-tributary realism + SSoT inheritance — **UNCOMMITTED**
1. **Auto area loads:** NEW `bim/structural/loads/occupancy-loads.ts` — `OccupancyCategory` (EN1991-1-1 A–E),
   `OCCUPANCY_IMPOSED_KPA` (q_k), `resolveDefaultDeadLoadKpa` (g_k από πάχος πλάκας), `resolveEffectiveAreaLoads`
   (explicit kPa **κερδίζει**· αλλιώς auto). Default residential → zero-input. `StructuralSettings += occupancy` +
   store `setOccupancy`. Boy-scout: dedupe του διπλού `?? 0` σε 2 hooks.
2. **Edge-tributary fix (Revit-grade):** `tributaryWidth` (`load-takedown.ts`) — **καμία mirror** στην περίμετρο·
   ακραία/γωνιακή κολώνα = πραγματικό ¼/½ φάτνωμα (ratios 1:2:4). Έλυσε υπερμεγέθη πέδιλα (γωνιακή έπαιρνε 4× φορτίο).
   `storeyCount` **ΑΝΕΓΓΙΧΤΟ** (σωστός πολλαπλασιαστής δηλωμένου κτιρίου).
3. **Occupancy SSoT inheritance:** η structural occupancy **κληρονομεί** από `Building.category`
   (NEW `OCCUPANCY_BY_BUILDING_CATEGORY` + `resolveOccupancyFromBuildingCategory` + hook `useBuildingOccupancy`).
   Precedence: `structuralSettings.occupancy` override → `building.category` → default residential. Μηδέν διπλασιασμός.

---

## 1. ΕΠΑΛΗΘΕΥΣΗ (browser + Firestore, ΕΓΙΝΕ)

Κάναβος 10×10, 4 γωνιακές κολόνες 400×400, κτίριο 3 ορόφων (`category: residential`, **χωρίς ρητά kPa**):
- appliedLoad γωνιακής = **596.4 / 150 kN** (= ¼ tributary 25 m² × 3 ορόφους × residential 7.5/2.0). ✅
- Πέδιλο = **1.6×1.6 m** (A=N/σ, σ=300 kPa). ✅ (πριν το fix: 2283.9/600 → 3.15×3.15 m).
- Οπλισμός = 8Ø16 (σωστό min — N_Ed~1030<αντοχή 2667). 8Ø25 εμφανίζεται μόνο σε βαριά φόρτιση.

**jest:** S4 = 12· occupancy = 13· load-takedown/path = 76· **full structural sweep = 461 GREEN, μηδέν regression.**
(Άσχετο pre-existing failure: `state/__tests__/bim-vg-overrides.test.ts` — VG colors, ΟΧΙ structural/loads· μη δικό μου.)

---

## 2. ΑΡΧΕΙΑ — `git add` ΜΟΝΟ ΑΥΤΑ (Giorgio· shared tree)

**S4 (Β):**
```
src/subapps/dxf-viewer/bim/structural/codes/structural-code-types.ts        (M)
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts        (M)
src/subapps/dxf-viewer/bim/structural/section-context.ts                    (M)
src/subapps/dxf-viewer/bim/structural/codes/__tests__/suggest-reinforcement-moment.test.ts (NEW)
```
**ADR-474 (Γ):**
```
src/subapps/dxf-viewer/bim/structural/loads/occupancy-loads.ts              (NEW)
src/subapps/dxf-viewer/bim/structural/loads/__tests__/occupancy-loads.test.ts (NEW)
src/subapps/dxf-viewer/bim/structural/loads/load-takedown.ts                (M — edge tributary)
src/subapps/dxf-viewer/bim/structural/loads/load-path-takedown.ts           (M — comment)
src/subapps/dxf-viewer/bim/structural/loads/__tests__/load-takedown.test.ts (M)
src/subapps/dxf-viewer/bim/structural/loads/__tests__/load-path-takedown.test.ts (M)
src/subapps/dxf-viewer/bim/structural/structural-settings.ts                (M)
src/subapps/dxf-viewer/state/structural-settings-store.ts                   (M)
src/subapps/dxf-viewer/hooks/useProactiveStructuralLoads.ts                 (M)
src/subapps/dxf-viewer/hooks/useStructuralLoadTakedown.ts                   (M)
src/subapps/dxf-viewer/hooks/useBuildingOccupancy.ts                        (NEW)
```
**Docs:**
```
docs/centralized-systems/reference/adrs/ADR-472-load-aware-strength-reinforcement.md  (M — §6γ + changelog + S4)
docs/centralized-systems/reference/adrs/ADR-474-occupancy-driven-auto-loads.md        (NEW)
docs/centralized-systems/reference/adr-index.md                                       (M — shared: έχει & ADR-473 άλλου agent)
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt                                                                 (M)
```

## 2β. 🚫 ΜΗΝ αγγίξεις/stage-άρεις (άλλος agent — ADR-471/473 joint reinforcement)
`ADR-471-*.md`, `ADR-473-*.md`, `bim-3d/converters/joint-rebar-3d.ts`, `bim-3d/scene/bim-scene-joint-rebar-sync.ts`,
`bim-3d/scene/bim-scene-point-syncs.ts`, `bim-3d/scene/BimSceneLayer.ts`, `bim/columns/column-structural-attach-coordinator.ts`,
`bim/structural/organism/joint-reinforcement-quantities*.ts`, `bim/structural/organism/reinforcement-checks.ts`,
`bim/structural/organism/structural-graph.ts`, `bim/structural/__tests__/active-member-reinforcement.test.ts`.

---

## 3. ΚΑΤΑΣΤΑΣΗ ΒΑΣΗΣ (Firestore — σωστό SSoT state, ΜΗΝ το «διορθώσεις»)

- Building `bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d` («Κτήριο Α1»): `structuralSettings` = `{codeId: greek-legacy,
  defaultConcreteGrade: C25/30, soilBearingCapacityKpa: 300}`. **Τα `deadAreaLoadKpa`/`liveAreaLoadKpa` ΣΒΗΣΤΗΚΑΝ
  σκόπιμα** (test ADR-474) — τα φορτία τώρα παράγονται από `category: residential` (7.5/2.0). **ΣΩΣΤΟ Revit-grade
  SSoT state — ΜΗΝ επαναφέρεις kPa** (θα ήταν διπλότυπο που δεν ακολουθεί αλλαγή χρήσης).
- Δοκιμαστικό περιβάλλον: level «Ισόγειο» `lvl_21982f3b-...` (floorId `flr_215e39f3-...`, project `proj_12788b6a-...`,
  company `comp_9c7c1a50-...`), `showReinforcement: true`. Έχει 4 κολόνες + 4 πέδιλα (1.6m) από την επαλήθευση.
- MCP Firestore tools διαθέσιμα (ToolSearch: `mcp__firestore__firestore_query/get_document/update_document`).

---

## 4. ΤΙ ΕΚΚΡΕΜΕΙ / ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ

1. **tsc** (Giorgio, N.17) — μετά τις αλλαγές. Πιθανά σημεία προσοχής: `useBuildingOccupancy` (νέος import path),
   inline `isOccupancyCategory` στο `structural-settings.ts` (type-only import, Turbopack isolatedModules — σκόπιμο).
2. **commit** (Giorgio) — μόνο τα αρχεία §2.
3. **Συνέχεια ελέγχων** (ο λόγος του handoff): π.χ.
   - S4 ορατό: βαριά/πολυώροφη φόρτιση → οπλισμός > 8Ø16 (8Ø25) + persisted.
   - Override: όρισε `structuralSettings.occupancy='commercial'` (ή building.category) → φορτία ανεβαίνουν (q_k 5.0).
   - Δοκάρια ένωσης → re-study οπλισμού (S3) ορατό.

## 5. ΚΑΝΟΝΕΣ
- **Full Enterprise + Full SSoT, Revit-grade.** Μηδέν `any`/`as any`/`@ts-ignore`/inline styles/hardcoded strings.
- **REUSE υπάρχοντα SSoT** (resolveActive*, occupancy-loads, tributary) — μην ξαναγράψεις.
- **ΟΧΙ commit/push** (Giorgio). **ΟΧΙ tsc** (Giorgio). jest OK.
- **Shared tree:** git add ΜΟΝΟ δικά σου (§2), ΠΟΤΕ -A, μην αγγίξεις §2β.
- **Design-for-declared-building:** η θεμελίωση/οπλισμός σχεδιάζονται για το δηλωμένο τελικό κτίριο (storeyCount), όχι
  για ό,τι έχει σχεδιαστεί — αυτό είναι σωστό (Giorgio το επιβεβαίωσε).

## 6. ΣΧΕΤΙΚΑ ADR / MEMORY
- `docs/.../adrs/ADR-472-load-aware-strength-reinforcement.md` (§6β S3, §6γ S4).
- `docs/.../adrs/ADR-474-occupancy-driven-auto-loads.md` (§3β edge tributary, §3γ inheritance).
- MEMORY: `project_adr472_load_aware_strength.md`, `project_adr474_occupancy_auto_loads.md`.
