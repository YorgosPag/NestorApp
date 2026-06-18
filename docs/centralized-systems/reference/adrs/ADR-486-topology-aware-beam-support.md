# ADR-486 — Topology-aware Beam Support Condition (DERIVED-from-connectivity SSoT)

**Status:** 🟢 DONE (Phase A + B, UNCOMMITTED· 27 jest GREEN· 🔴 tsc+browser-verify+commit)
**Date:** 2026-06-18
**Context:** Revit/Robot-grade· συμπληρώνει ADR-459 (organism) / ADR-467 (load-path) / ADR-471·472 (reinforcement) / ADR-480·481 (analytical/FEM)

---

## 1. Πρόβλημα — Η διπλή αλήθεια στήριξης

Κάτοψη: 2 κολώνες + 1 δοκάρι ανάμεσα, κάθε κολώνα με πέδιλο. Ο χρήστης **μετακινεί/αποκολλά** τη μία κολώνα → το δοκάρι «κρέμεται» πλέον σε **μία** στήριξη (πρόβολος). Παρατηρήθηκε:

- Το **FEM/analytical (ADR-480/481)** ενημερωνόταν σωστά (το διάγραμμα M/V/N στον καμβά, ADR-483, έδειχνε πρόβολο).
- Ο **οπλισμός (tributary, ADR-471/472)** ΟΧΙ: το `buildBeamSectionContext` διάβαζε `p.supportType ?? 'simple'` (**αποθηκευμένο**) → ο suggester υπολόγιζε `M_Ed = wL²/8` (αμφιέρειστο) αντί `wL²/2` (πρόβολος).
- Το toast «Κανένα μέλος δεν χρειαζόταν οπλισμό» ήταν παραπλανητικό: ο πρόβολος ξανα-σχεδιαζόταν με stale `'simple'` → ίδιος οπλισμός → `materiallyDiffers=false` → μηδέν patch → count 0.

**Δεν ήταν διπλότυπος κώδικας** — ήταν **διπλή/αποκλίνουσα αλήθεια (divergent SSoT):** δύο μηχανισμοί απαντούσαν στην ίδια ερώτηση («πώς στηρίζεται το δοκάρι;») με διαφορετικό τρόπο και αποτέλεσμα.

## 2. Απόφαση — ΜΙΑ πηγή αλήθειας: η ζωντανή τοπολογία

Ο τύπος στήριξης του δοκαριού **παράγεται** από τη ζωντανή συνδεσιμότητα (`column-bearing` ακμές του `StructuralGraph`, ADR-459), **όχι** από το αποθηκευμένο `params.supportType`. Reuse του υπάρχοντος SSoT μετρητή `beamSupportColumnIds(graph, beamId)` (ADR-467).

**NEW pure SSoT** `bim/structural/organism/derive-beam-support.ts`:

```
resolveBeamSupportCondition(graph, beamId, stored) → { supportType, supportCount, stable }
```

Κανόνας precedence (συντηρητικός — η ΜΟΝΗ αλλαγή συμπεριφοράς είναι το «ακριβώς 1 στήριξη»):

| count κολωνών | derived supportType |
|---|---|
| **1** | **'cantilever'** (πρόβολος: moment-frame κόμβος + ελεύθερο άκρο) |
| 2+ | `stored ?? 'simple'` (διατηρεί ρητή πρόθεση χρήστη: simple/fixed) |
| 0 | `stored ?? 'simple'` (αμετάβλητο· η αστάθεια φλαγάρεται από τα analytical diagnostics, ADR-480) |

**Παραδοχή scope (v1):** στήριξη δοκαριού = ΜΟΝΟ κολώνες. Οι τοίχοι είναι **φορτίο** (`wall-beam-support`, ADR-478), όχι έδραση· beam-on-wall / beam-on-beam έδραση = DEFER (συνεπές με τον analytical builder ADR-480 που merge-άρει άκρα δοκαριού ΜΟΝΟ σε κορυφές κολώνας).

## 3. Υλοποίηση

### Phase A — Η αλήθεια (live canvas + checks)
- **NEW** `derive-beam-support.ts` — `resolveBeamSupportCondition` + `buildBeamSupportTypeMap(graph)` (graph node δοκαριού φέρει ήδη το stored supportType → graph-only, μηδέν re-fetch entities).
- **NEW** `beam-support-condition-store.ts` — transient store `beamId → BeamSupportType`· γράφεται στο organism pass· read synchronous από το render path (ADR-040 safe· DERIVED, ΠΟΤΕ persisted).
- `section-context.ts` — `buildBeamSectionContext` + `resolveActiveBeamReinforcement` + `resolveActiveMemberReinforcement` δέχονται **optional `supportType` override** (μένουν pure· graphless callers → stored fallback, μηδέν regression).
- `reinforcement-checks.ts` — χτίζει `buildBeamSupportTypeMap(graph)` (έχει graph) → περνά override → ο ρ-check τρέχει στη ΣΩΣΤΗ ροπή (πρόβολος → `ratioBelowMin` αν ανεπαρκής).
- `useStructuralOrganism.ts` — publish `buildBeamSupportTypeMap(graph)` στο store στο ίδιο recompute pass.
- `active-reinforcement.ts` — `resolveActiveBeamReinforcementForEntity` διαβάζει store → override· **NEW** `resolveActiveBeamSupportType(beamId)` convenience (renderers/overlays/detail).
- Render parity: `beam-rebar-2d.ts`, `beam-rebar-3d.ts` (layout = `buildBeamSectionContext(beam, override)` → πρόβολος = άνω συνεχείς ράβδοι)· `StructuralUtilizationOverlay` (`beamUtilization` override → σωστό As,req/χρώμα)· detail sheet (`beam-detail-sheet/section/elevation` + `BeamDetailHost` → PDF === live).

### Phase B — First-pass + toasts
- `reinforce-patch.ts` — `buildReinforcePatch(entity, provider, supportType?)` threads override στο beam path (auto re-study **και** absent suggest).
- `AutoReinforceOrganismCommand` — constructor δέχεται `supportTypeByBeamId?` map → per-beam στο `buildReinforcePatch`.
- `structural-auto-reinforce-core.ts` — χτίζει `buildBeamSupportTypeMap(buildStructuralGraph(entities))` (pure, jest-clean) → περνά στο command. Έτσι ο πρόβολος ξανα-σχεδιάζεται → `materiallyDiffers` → patch → count>0 → **το toast `structuralOrganism.autoReinforced` γίνεται αυτόματα σωστό** (μηδέν επιπλέον κώδικας toast).

## 4. Συνέπειες / Trade-offs

- ✅ Οπλισμός & FEM-διάγραμμα **συγκλίνουν** στην ίδια αλήθεια στήριξης (πρόβολος → wL²/2 παντού: ρ-check, 2Δ/3Δ rebar, utilization, detail PDF, BOQ).
- ✅ Πλήρως DERIVED — μηδέν persisted-stale, μηδέν migration.
- ✅ Συντηρητικό: μόνο «1 στήριξη» αλλάζει· 2+ στηρίξεις/ρητό fixed/cantilever διατηρούνται.
- ⚠️ **Q4 (κολώνα):** η αξονική κολώνας ακολουθεί ήδη το tributary (auto re-derive). Η **πρόσθετη ροπή προβόλου** στην κολώνα-στήριξη δεν μεταφέρεται από tributary (μόνο αξονική) → **DEFER** (πλήρης σύγκλιση με FEM end-forces).

## 5. DEFER
- Πλήρης tributary↔FEM convergence (οπλισμός από FEM end-forces ADR-481).
- Ροπή προβόλου → κολώνα-στήριξη (M_Ed κολώνας).
- Συνέχεια (2+ στηρίξεις → continuous beam negative moments, αρνητικός οπλισμός στήριξης).
- beam-on-wall / beam-on-beam έδραση ως connectivity.

## 6. Centralization (Boy-Scout, N.0.2)

Το τρίπτυχο **«resolve reinforcement → resolve supportType → `buildBeamSectionContext` → `resolveBeamRebarLayout`»** ζούσε copy-paste στους live renderers. Ενοποιήθηκε σε **ΕΝΑ** store-coupled SSoT `resolveActiveBeamRebarLayout(beam) → { reinforcement, layout } | null` (`active-reinforcement.ts`) → `beam-rebar-2d` + `beam-rebar-3d` το καλούν με ΕΝΑ read (εγγυημένη parity 2Δ===3Δ, μηδέν διπλότυπο pattern). Οι **pure** detail-sheet builders ΔΕΝ το χρησιμοποιούν (κρατούν `supportType` param ώστε να μένουν unit-testable χωρίς store) — σωστό purity boundary.

## 7. Changelog
- **2026-06-18 — §C (auto-design πρόβολος, υλοποιεί ADR-487 §4 «ο στατικός διορθώνει σιωπηλά»):** Η topology-awareness επεκτάθηκε στο **auto-sizing** (ADR-475), που έλειπε → ο sizer έβλεπε stored `'simple'` (wL²/8) ενώ ο οπλισμός χρησιμοποιούσε ήδη τον πρόβολο (wL²/2) → **διπλή αλήθεια** → ρ=4.77% > 4% (η εικόνα του Giorgio). FIX: `buildBeamSizePatch(entity, provider, supportTypeOverride?)` → ο `AutoSizeMembersCommand` περνά `resolveActiveBeamSupportType(id)` (ίδιο SSoT με τον οπλισμό). Αποτέλεσμα: πρόβολος → ο sizer **μεγαλώνει το ύψος** (wL²/2 + αυστηρό l/d) ώστε ρ≤ρ_max → **σιωπηλά**, μηδέν παρέμβαση χρήστη. + `checkBeamUnsupportedEnd`: **1 στήριξη = έγκυρος πρόβολος → καμία ειδοποίηση** (warning ΜΟΝΟ για αιωρούμενο 0-support· coveredCount-based, αφαιρέθηκε το stored-`supportType` gate). Fallback: αν ο πρόβολος ξεπερνά το πρακτικό όριο ύψους (1500mm) → ρ μένει >4% → warning + ADR-490 marker (auto-design, warn only if infeasible). MOD `beam-size-patch.ts`(+test cantilever-deeper), `AutoSizeMembersCommand.ts`, `organism-checks.ts`(+test 1-support=no-warn). 17 jest GREEN. **Phase 2 (FEM-driven οπλισμός κολώνας στήριξης για ροπή προβόλου) = ADR-491, ξεχωριστά.** UNCOMMITTED.
- **2026-06-18** — Phase A+B υλοποίηση. NEW `derive-beam-support.ts` + `beam-support-condition-store.ts`· override threading σε section-context/reinforce-patch/checks/command/core/render/detail/utilization. + Boy-Scout κεντρικοποίηση `resolveActiveBeamRebarLayout` (ΕΝΑ SSoT για live renderers). 35 jest GREEN. Pre-existing 2 raft/slab failures (ADR-476 fixture) άσχετα. UNCOMMITTED.
