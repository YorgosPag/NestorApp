# ADR-475 — Αυτόματη Διαστασιολόγηση Μελών (Serviceability-Driven, Revit-grade)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-464 (footing auto-design — το sizing precedent), ADR-467 (load path), ADR-472 (load-aware reinforcement), ADR-459 (organism/proactive), ADR-456 (code providers).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.

---

## 1. Context — γιατί

Στόχος Giorgio: *ο μηχανικός σχεδιάζει γεωμετρία· φορτία + ροπές + οπλισμός + πέδιλα + **διαστάσεις
μελών** = αυτόματα, Revit-grade.* Μετά τα ADR-464/467/472/474 αυτόματα είναι: φορτία, ροπές κολόνας,
οπλισμός, μέγεθος πεδίλου. **Έλειπε** η αυτόματη διαστασιολόγηση **δοκαριών**.

**Εύρημα (test model):** κάναβος 10×10, 4 κολόνες 400×400, 4 δοκάρια 250×500 span 9.6m, residential.
Τα φορτία (G 215.75 / Q 50 kN) + ο οπλισμός (4Ø32) υπολογίζονταν **σωστά**, αλλά το δοκάρι 500mm σε
άνοιγμα 9.6m είναι **δομικά ανεπαρκές** (EC2 §7.4 βέλος: L/d=21.3 ≫ ~14) και το σύστημα **σιωπούσε**
(`hasCodeViolations:false`). Ρίζα: ο `beam-validator` έλεγχε flat `span/h > 20` → 9600/500=19.2 < 20 →
καμία ένδειξη· **και** καμία βαθμίδα δεν μεγάλωνε τη διατομή.

## 2. Decision

### 2.1 Core SSoT — `bim/structural/sizing/member-sizing.ts` (pure)
`suggestBeamSection(provider, ctx) → { widthMm, depthMm, governedBy }` = **ελάχιστη επαρκής** διατομή:
- **SLS βέλος** (EC2 §7.4.2 Table 7.4N): `d_req = span / (l/d)_limit`, όριο ανά κώδικα/στήριξη.
- **ULS κάμψη**: `ρ ≤ ρ_max` ⇒ `d² ≥ M_Ed/(z·f_yd·b·ρ_max)`.
- **ULS διάτμηση**: `V_Ed ≤ V_Rd,max` (θλιπτήρας, EC2 §6.2.3, θ=45° ⇒ `0.27·f_cd·b·d`).
- Τελικό `h = max(όλων) ∨ MIN_BEAM_DEPTH_MM`, round ↑ 50mm, clamp 1500mm.
- **Depth-only (v1):** το `width` = αρχιτεκτονική επιλογή → αμετάβλητο (width-bump = DEFER).
- **REUSE** (μηδέν duplicate μηχανικής, N.0.2): `spanMomentDivisor`, `BEAM_EFFECTIVE_DEPTH_FACTOR`,
  `BEAM_LEVER_ARM_FACTOR` (exported από `suggest-reinforcement`), `rebarFydMpa`, `concreteFcdMpa`.
- **Member-generic σχεδίαση** ώστε να επεκταθεί σε κολόνα (slenderness EC2 §5.8) — DEFER.

### 2.2 Provider serviceability limit
`StructuralCodeProvider += beamSpanDepthLimit(ctx): number` = `K · basic` (K: αμφιέρειστη 1.0 /
αμφίπακτη 1.5 / πρόβολος 0.4). Basic l/d: **Eurocode 14**, **Greek-legacy 13** (conservative). `BeamSectionContext
+= concreteGrade?` (για f_cd στον shear· absent ⇒ `DEFAULT_CONCRETE_GRADE`).

### 2.3 Override / lock — `BeamParams += autoSized?`
Default = **AUTO** (absent/true → πλήρης αυτοματοποίηση). Χειροκίνητη αλλαγή **διατομής** (depth/width)
μέσω ribbon/panel (`useBeamParamsDispatcher`) ή grip (`commitBeamGripDrag`) → `autoSized:false` =
**LOCK** (Revit override, user wins). Άλλες αλλαγές (supportType/material/span) κρατούν το auto ενεργό.

### 2.4 Patch + convergence — `sizing/beam-size-patch.ts`
`buildBeamSizePatch(entity, provider) → {prev,next} | null` (mirror `buildReinforcePatch`): μη-δοκάρι /
locked / converged → `null`. `beamSectionMateriallyDiffers` = exact compare (50mm-quantized → σταθερό
σημείο, anti-oscillation). **Ξεχωριστό module** (όχι μέσα στο section-context) ώστε να σπάσει ο κύκλος
`section-context → member-sizing → section-context`.

### 2.5 Pipeline (proactive, idempotent, atomic undo)
- `AutoSizeMembersCommand` — batch undoable· geometry-mutating (`computeBeamGeometry`+`validateBeamParams`
  recompute, mirror `UpdateBeamParamsCommand`)· το `depth` γίνεται **persisted** γεωμετρία.
- `member-auto-size-core.runMemberAutoSize` (light, provider-injected) → exec command → emit
  `bim:beam-params-updated` ανά resized δοκάρι (persist + re-chain φορτία/οπλισμός).
- `useProactiveMemberSizing` ακούει `bim:structural-loads-computed` (+ create/move/from-grid) —
  **ΟΧΙ** `bim:beam-params-updated` (self-emit → loop). **Mount ΠΡΙΝ** το `useProactiveOrganismReinforce`
  (ο οπλισμός υπολογίζεται στη νέα διατομή). Αλυσίδα `sizing → beam-params-updated → loads →
  loads-computed → sizing` τερματίζει στον convergence guard.

### 2.6 Belt-and-suspenders — `beam-validator.validateSlenderness`
Αναβάθμιση από flat `span/h > 20` σε **`span/d_eff > K · 14`** (EC2 §7.4.2, d_eff=0.9h, K ανά
στήριξη). Conservative, code-agnostic. Πιάνει τις οριακά ανεπαρκείς διατομές που σιωπούσαν· με auto-size
ενεργό μόνο τα **LOCKED** ανεπαρκή φτάνουν εδώ → `hasCodeViolations:true` νόμιμα. `BASIC_SPAN_EFFECTIVE_DEPTH_LIMIT`
αντικατέστησε τα `MAX_SPAN_DEPTH_RATIO`/`MAX_CANTILEVER_SPAN_DEPTH_RATIO` (beam-types).

## 3. Επαλήθευση

- **Test model** (greek-legacy, simple, 9.6m): l/d 13 → d_req 738 → h 820 → **round 850mm** (SLS-governed).
  Eurocode → 800mm. Ο οπλισμός πέφτει σε λογικό ρ (~1%)· `hasCodeViolations` πλέον false **νόμιμα**.
- 9 jest `member-sizing` + 7 `beam-size-patch` + 2 νέα `beam-validator` (belt-and-suspenders) → GREEN.

## 4. DEFER

- **Κολόνες** (slenderness EC2 §5.8 + αξονικό) — το SSoT είναι ήδη member-generic.
- **Width auto-bump** σε διάτμηση (v1 = depth-only).
- **Organism diagnostic** για locked-ανεπαρκές (Giorgio: αρκεί ο validator· §4β agent — όχι τώρα).
- Εθνικό παράρτημα l/d ανά ρ (v1 = conservative basic 14/13).

## 5. Files

NEW: `bim/structural/sizing/member-sizing.ts` (+test), `bim/structural/sizing/beam-size-patch.ts`
(+test), `core/commands/entity-commands/AutoSizeMembersCommand.ts`, `hooks/member-auto-size-core.ts`,
`hooks/useProactiveMemberSizing.ts`.
MOD: `codes/structural-code-types.ts` (provider method + ctx field), `codes/eurocode-provider.ts`,
`codes/greek-legacy-provider.ts`, `codes/suggest-reinforcement.ts` (exports), `types/beam-types.ts`
(`autoSized` + `BASIC_SPAN_EFFECTIVE_DEPTH_LIMIT`), `types/beam.schemas.ts`, `validators/beam-validator.ts`,
`ui/ribbon/hooks/bridge/useBeamParamsDispatcher.ts`, `hooks/grips/grip-parametric-commits.ts`,
`app/DxfViewerContent.tsx`.

## Changelog

- **2026-06-18** (Opus) — ADR-475 αρχική υλοποίηση (Slices 1-5). Core sizing + provider l/d limit +
  autoSized lock + proactive pipeline + belt-and-suspenders validator. 18 νέα jest. UNCOMMITTED.
