# HANDOFF — Foundation: υψόμετρο-από-ρυθμίσεις (Slice 4) + render isolation (Slice 5) + ανοιχτό grid-recreator

**Ημ/νία:** 2026-06-18 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά.** · **ADR-484 UNCOMMITTED.** tsc/commit = Giorgio (N.17/N.-1).
> ⚠️ Shared tree με ADR-483 agent. git add ΜΟΝΟ δικά μας. ΠΟΤΕ `-A`.

## 0. TL;DR — τι συμβαίνει
Ο χρήστης έβλεπε **4 πράσινα strip πεδιλοδοκούς στο ΙΣΟΓΕΙΟ** (λάθος όροφος) + καφέ pad στη Θεμελίωση,
σε «Όλοι οι όροφοι». Διάγνωση μέσω console diagnostics (`[FND-DIAG]`) — ΕΠΙΒΕΒΑΙΩΜΕΝΟ:
```
all-floors foundations: floorId=ΙΣΟΓΕΙΟ(flr_215e39f3) isFoundationFloor=FALSE count=4 tops=[-1000×4]  ❌
all-floors foundations: floorId=ΘΕΜΕΛΙΩΣΗ(flr_c25e29a6) isFoundationFloor=TRUE count=1 tops=[-1000]  ✓
```
**Ρίζα:** τα 4 strips είναι baked στο **scene blob του Ισογείου** (`file_80efad96`). Διαγράφηκαν από Firestore
(`floorplan_foundations`) αλλά ΟΧΙ από το blob → ο all-floors aggregator τα διάβαζε από το blob και τα
ζωγράφιζε στον Ισόγειο. (Hard refresh τα έκρυβε προσωρινά γιατί ο aggregator `loaded` Map δεν είναι realtime.)

## 1. ✅ ΤΙ ΕΓΙΝΕ (UNCOMMITTED, δικά μας)

### Slice 4 — foundation υψόμετρο ΑΠΟ ΤΙΣ ΡΥΘΜΙΣΕΙΣ ορόφου (Revit-canonical) — ΕΠΙΒΕΒΑΙΩΜΕΝΟ στο browser
Το auto-design pad έπαιρνε `topElevationMm` από τη βάση κολώνας (=0). Τώρα παράγεται από το FFL του foundation
level (ρυθμίσεις «Βάθος θεμελίωσης» → F στο -1m). Console: `finalTopElevationMm: -1000, foundationLevelElevationMm: -1000` ✅.
- NEW `bim/types/foundation-types.ts → resolveFoundationTopElevationMm(ffl, kind)` + `TIE_BEAM_RISE_MM` (null FFL→παλιά constants).
- NEW `bim/foundations/foundation-level-elevation.ts → resolveActiveFoundationLevelElevationMm()` (reuse useFoundationLevelStore· target.floorElevationMm / activeFloorElevationMm).
- `hooks/drawing/foundation-completion.ts`: override field `foundationLevelElevationMm` + derivation (ρητό user-set υπερισχύει).
- Wired: `useAutoFoundationDesign.tsx`(buildAutoFooting), `useFoundationTool.ts`(single+2click+from-wall), `foundation-grid-commit.ts`, `tie-beam-grid-commit.ts`.

### Slice 5 — render isolation: foundations ΜΟΝΟ στον foundation level — ΘΕΛΕΙ BROWSER-VERIFY
Οι all-floors aggregators πετούν foundation entities από κάθε **μη-foundation** όροφο (legacy blob garbage δεν εμφανίζεται).
- NEW `systems/levels/scene-bim-load-policy.ts → stripAllFoundations(scene)` (+test).
- `useFloors3DAggregator.ts`(resolveEntities: non-foundation floor → `{...base, foundations: []}`).
- `useBuildingFloorScenes.ts`(2D: non-foundation → `stripAllFoundations(stripped)`).

### Slice 1-3 (προηγούμενη session, UNCOMMITTED) — βλ. προηγ. handoff
S1 cross-level Properties· S2 Revit-canonical level assignment· S3 cross-floor aggregator guard (`resolveFloorScopedScene`, defense-in-depth, ΑΣΧΕΤΟ με αυτό το bug αλλά correct — κράτησέ το).

**Tests:** 27 jest GREEN (foundation-types, foundation-completion, scene-bim-load-policy, cross-floor-link, useFloors3DAggregator).
**Pre-existing fails (ΟΧΙ δικά μας):** 2 στο `foundation-preview-helpers.test.ts` (WYSIWYG preview 'polyline'→'foundation').

## 2. 🔴 ΠΡΟΣΩΡΙΝΑ DIAGNOSTICS — ΑΦΑΙΡΕΣΕ ΠΡΙΝ ΤΟ COMMIT
`console.warn('[FND-DIAG]'...)` σε 3 σημεία:
- `bim/foundations/foundation-level-elevation.ts` (resolveActiveFoundationLevelElevationMm)
- `hooks/drawing/foundation-completion.ts` (buildDefaultFoundationParams, μετά το topElevationMm)
- `hooks/data/useFloors3DAggregator.ts` (stack useMemo, `if (entities.foundations.length>0)`)

## 3. 🚨 ΑΝΟΙΧΤΟ — grid recreator (επόμενο βήμα)
Console: `buildDefaultFoundationParams kind:"strip" foundationLevelElevationMm:-1000` καλείται **πολλές φορές μαζί**
→ ο grid-foundation deriver ξαναχτίζει την εσχάρα strips από τους άξονες (κάναβο). Το Slice 5 τα **κρύβει** στο
render, ΑΛΛΑ αν το grid **persist-άρει** strips στον ΕΝΕΡΓΟ (μη-foundation) όροφο = data pollution.
**ΕΡΩΤΗΣΗ ΠΟΥ ΕΜΕΙΝΕ:** ghost preview (αβλαβές) ή commit/reconcile (γράφει σε λάθος όροφο);
→ expand ΕΝΑ `[FND-DIAG] buildDefaultFoundationParams kind:strip` και δες το **stack trace**:
  - `foundation-grid-ghost.ts` → αβλαβές (preview-only).
  - `commitFoundationGridFromGuides`/`tie-beam-grid-commit`/command → **χρειάζεται Slice-2-style routing**:
    το grid foundation creation να δρομολογείται ΠΑΝΤΑ στον foundation level (όπως το manual στο `add-foundation-to-scene`).
    Σημεία: `bim/foundations/foundation-grid-commit.ts`, `tie-beam-grid-commit.ts` (χρησιμοποιούν `deps.levelId` = active).

## 4. DATA (Giorgio)
- Τα 4 legacy strips ζουν ακόμη στο blob `file_80efad96` (Ισόγειο). Το Slice 5 τα κρύβει στο all-floors.
  Για πλήρη καθαρισμό: άνοιξε Ισόγειο active → (reconcile τα πετά από active) → re-save ώστε το blob να καθαρίσει,
  ή αγνόησέ τα (κρυμμένα). MCP write allowlist ΔΕΝ έχει `floorplan_foundations` → in-app deletion μόνο.
- Διαγραφές foundations: ΠΑΝΤΑ in-app (όχι direct DB) για live optimistic update χωρίς hard refresh.

## 5. 🔴 ΕΠΟΜΕΝΑ
1. BROWSER-VERIFY Slice 5: refresh «Όλοι οι όροφοι» → τα 4 πράσινα στο Ισόγειο **εξαφανίζονται**· το
   `[FND-DIAG] all-floors foundations isFoundationFloor:false` **δεν εμφανίζεται** πλέον.
2. Απάντησε grid ghost-vs-commit (§3) → αν commit, Slice 6 routing.
3. Αφαίρεσε diagnostics (§2).
4. tsc (Giorgio) + commit. git add λίστα: foundation-types.ts(+test), foundation-level-elevation.ts[NEW],
   foundation-completion.ts(+test), useFoundationTool.ts, useAutoFoundationDesign.tsx, foundation-grid-commit.ts,
   tie-beam-grid-commit.ts, scene-bim-load-policy.ts(+test), useFloors3DAggregator.ts, useBuildingFloorScenes.ts,
   cross-floor-link.ts(+test)[S3], useFoundationLevelSync.ts[S3], ADR-484, adr-index. ΟΧΙ ADR-483.

## 6. ❌ ΜΗΝ
- ΜΗΝ commit-άρεις με τα [FND-DIAG] μέσα.
- ΜΗΝ αλλάξεις χρώματα ανά kind (ADR-445 by design).
- ΜΗΝ αγγίξεις ADR-483.
- ΜΗΝ διπλασιάσεις elevation/foundation logic — reuse resolveFoundationTopElevationMm + resolveActiveFoundationLevelElevationMm + stripAllFoundations.
