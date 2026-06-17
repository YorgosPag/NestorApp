# HANDOFF — ADR-472 **Slice S3**: Stale-Intent Invalidation + Re-Study Orchestration

**Ημ/νία:** 2026-06-17 · **Από:** Opus session (μετά το ADR-472 **S2 DONE**) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Status:** 🟡 S2 DONE (UNCOMMITTED) → **S3 PENDING** (gated). 🔴 oscillation risk — convergence guard ΥΠΟΧΡΕΩΤΙΚΟΣ.
**Commit/push/tsc = Giorgio.** **jest = τρέχει κανονικά.** **Shared tree** (άλλος agent δουλεύει ADR-471 beam render/detail-sheet — ΜΗΝ τον αγγίξεις).

---

## 0. ΤΟ ΟΡΑΜΑ & ΤΙ ΕΓΙΝΕ ΗΔΗ (S2)

Όραμα ADR-459 Φ9: *όταν αλλάζει η τοπολογία → ξανα-διαστασιολογείται **ο οπλισμός όλων** των μελών, real-time.*

**S2 (DONE, UNCOMMITTED 2026-06-17):** ο suggester έγινε **load-aware** — `As = max(ρ_min·Ac, strength(N/M))`,
EC2 §6.1 (κολόνα αξονική, δοκός κάμψη `w·L²/c`). **Output types αμετάβλητα.** Η strength logic ζει στον SSoT
πυρήνα `codes/suggest-reinforcement.ts` (`asStrengthColumnMm2`/`asStrengthBeamMm2`). Νέα SSoT `EN1990_ULS_FACTORS`.
33+253 jest GREEN.

**ΣΗΜΑΝΤΙΚΟ — άμεσο όφελος S2 χωρίς S3:** ο **read-time** re-derive των `auto:true`
(`resolveActiveColumnReinforcement`/`resolveActiveBeamReinforcement`) χρησιμοποιεί τον ίδιο builder → οι
auto-οπλισμένες κολόνες/δοκοί είναι ΗΔΗ load-aware **στην οθόνη/BOQ**. **ΑΛΛΑ** το **persisted** `params.reinforcement`
ΔΕΝ ανανεώνεται σε load change (το `buildReinforcePatch` έχει idempotent guard που κάνει skip τα ήδη-οπλισμένα).

**Τι λείπει (= το S3):** το persisted value να γίνεται **durable** σε load change (ώστε τα διαγνωστικά, το save,
το cross-session reload να βλέπουν τον σωστό οπλισμό) + το re-study να ενεργοποιείται όταν φτάνουν φρέσκα φορτία.

---

## 1. ΤΟ SPEC (αυτοτελές — διάβασέ το ΠΡΩΤΟ)

📄 `docs/centralized-systems/reference/adrs/ADR-472-load-aware-strength-reinforcement.md`
- **§2.3** = το S3 design (stale-intent invalidation).
- **§6** = πλήρη implementation notes του S2 (τι ΑΚΡΙΒΩΣ έγινε, αποκλίσεις από spec — ΔΙΑΒΑΣΕ το, χτίζεις πάνω).
- **§3** πίνακας slices, **§4** DEFER (100% ειλικρίνεια).

---

## 2. 🚨 SSOT AUDIT — GREP ΠΡΙΝ ΑΠΟ ΚΩΔΙΚΑ (ΥΠΟΧΡΕΩΤΙΚΟ)

**ΜΗΝ γράψεις γραμμή πριν τρέξεις αυτά τα grep** (full enterprise + full SSoT — επέκταση, ΟΧΙ διπλότυπα):

```
buildReinforcePatch|resolveActiveColumnReinforcement|resolveActiveBeamReinforcement|
runOrganismAutoReinforce|AutoReinforceOrganismCommand|useProactiveOrganismReinforce|
useProactiveStructuralLoads|PROACTIVE_REINFORCE_EVENTS|GEOMETRY_EDIT_TRIGGERS|
bim:structural-loads-computed|bim:structural-auto-reinforced|bim:auto-reinforce-requested|
isReinforceable|ReinforcePatch|reinforcement.auto
```

**Επιβεβαιωμένα SSoT σημεία (από S2 exploration — verify ότι ισχύουν ακόμη):**

| Τι | Πού | Ρόλος για S3 |
|---|---|---|
| `buildReinforcePatch` | `bim/structural/section-context.ts` (~γρ. 246) | idempotent guard `if (entity.params.reinforcement) return null` — column ~251, beam ~257. **ΕΔΩ η κύρια αλλαγή.** |
| `resolveActiveColumnReinforcement` | `section-context.ts` ~γρ. 101 | **SSoT merge** «fresh suggestion + διατήρηση detailing prefs» (`stirrups.type`, `crossTiePattern`). **REUSE — μην ξαναγράψεις το merge.** |
| `resolveActiveBeamReinforcement` | `section-context.ts` ~γρ. 148 | αντίστοιχο SSoT merge (`stirrups.type`, `stirrups.legs`). REUSE. |
| `runOrganismAutoReinforce` | `hooks/structural-auto-reinforce-core.ts` ~γρ. 56 | πυρήνας· εκπέμπει `bim:structural-auto-reinforced`. Καλεί `AutoReinforceOrganismCommand`. |
| `AutoReinforceOrganismCommand.buildPatches` | `core/commands/entity-commands/AutoReinforceOrganismCommand.ts` | iterates → `buildReinforcePatch(entity, provider)`· skip αν null. |
| `PROACTIVE_REINFORCE_EVENTS` | `hooks/useProactiveOrganismReinforce.ts` ~γρ. 38-47 | τα events του proactive reinforce. **ΕΔΩ προσθήκη `bim:structural-loads-computed`.** |
| `useProactiveStructuralLoads` | `hooks/useProactiveStructuralLoads.ts` | S1 — εκπέμπει `bim:structural-loads-computed` όταν τελειώσουν τα φορτία. ΔΕΝ ακούει reinforce events (loop guard). |

---

## 3. ΤΟ DESIGN ΤΟΥ S3 (Revit-grade, full SSoT)

### Κενό Α — stale-intent invalidation (`section-context.ts buildReinforcePatch`)

Σήμερα (column path):
```ts
if (entity.params.reinforcement) return null;   // skip ΟΛΑ τα οπλισμένα
```
Νέα συμπεριφορά (Revit: «by code» = live· «user override» = κλειδωμένο):
```ts
const stored = entity.params.reinforcement;
if (stored && !stored.auto) return null;         // ΧΕΙΡΟΚΙΝΗΤΟ → ΠΟΤΕ overwrite (user wins)
// auto===true (ή absent): re-derive από ΤΡΕΧΟΥΣΑ γεωμετρία+φορτίο
const fresh = resolveActiveColumnReinforcement(entity.params, provider); // ← SSoT REUSE (merge prefs ήδη μέσα)
if (stored && !reinforcementMateriallyDiffers(stored, fresh)) return null; // convergence: μηδέν diff → μηδέν patch
return { prev: entity.params, next: { ...entity.params, reinforcement: fresh } };
```
- **`resolveActiveColumnReinforcement`/`resolveActiveBeamReinforcement` ΕΙΝΑΙ ο SSoT** για το «fresh + merge prefs»
  (επέστρεφε `undefined` για absent — χειρίσου το: absent → suggest κανονικά όπως σήμερα).
- **NEW pure helper `reinforcementMateriallyDiffers(a, b)`** (στο `section-context.ts` ή δίπλα): σύγκρινε
  discrete πεδία — κολόνα `longitudinal.count`/`diameterMm`· δοκός `bottom`+`top` count/diameter. (Η As είναι
  derived από count·area → σύγκριση count+Ø = ΑΚΡΙΒΗΣ, **μηδέν float tolerance**.) Αυτό ΕΙΝΑΙ ο convergence guard:
  ίδιο φορτίο → ίδια πρόταση → μηδέν diff → μηδέν patch → μηδέν undo entry → μηδέν event storm.
- **Scope S3 = κολόνα + δοκός** (load-aware). Foundations re-size ήδη μέσω ADR-464 (A_req=N/σ) — ΜΗΝ τα αλλάξεις εδώ.

### Κενό Β — re-study orchestration (`useProactiveOrganismReinforce.ts`)

Ο proactive reinforce ΔΕΝ ακούει `bim:structural-loads-computed`. **Ελάχιστη-invasive, loop-safe λύση:**
```ts
const PROACTIVE_REINFORCE_EVENTS = [ ...υπάρχοντα..., 'bim:structural-loads-computed' ];
```
**Loop-safety (verify με grep πριν):** ο reinforce εκπέμπει `bim:structural-auto-reinforced`. Ο
`useProactiveStructuralLoads` (S1) **ΔΕΝ** ακούει `bim:structural-auto-reinforced` → reinforce **δεν** ξανα-trigger-άρει
load takedown → **μηδέν oscillation**. (Επιβεβαίωσε ότι ΚΑΝΕΝΑΣ listener του `bim:structural-auto-reinforced` δεν
εκπέμπει `bim:structural-loads-computed` — αλλιώς χρειάζεται explicit loop-guard flag.)
- **Mount order:** το `useProactiveStructuralLoads` πρέπει να είναι mounted **ΠΡΙΝ** τον reinforce (να γράψει
  φορτία → emit → reinforce διαβάζει φρέσκα). Verify στο `DxfViewerContent.tsx` (S1 ήδη τα τοποθέτησε με σειρά).
- **Self-weight feedback:** ο οπλισμός αλλάζει το βάρος ελάχιστα· αφού reinforce ⊀→ load recompute, δεν υπάρχει
  κύκλος. Πρακτικά συγκλίνει σε 1 iteration (το τεκμηριώνεις, δεν χρειάζεται iterative solver).

---

## 4. SLICES / ΒΗΜΑΤΑ

1. **SSOT audit (grep §2)** → verify ότι τα paths/events ισχύουν (μπορεί άλλος agent να μετακίνησε κώδικα).
2. **`section-context.ts`:** guard change + `reinforcementMateriallyDiffers` (REUSE `resolveActive*`). Πρόσεξε
   το absent-vs-auto-vs-manual triage. (Shared file — ήδη modified από S1/S2.)
3. **`useProactiveOrganismReinforce.ts`:** πρόσθεσε `bim:structural-loads-computed` + loop-safety comment.
4. **jest:** (α) load change → re-design (count/Ø αλλάζει)· (β) manual (`auto:false`) → ΠΟΤΕ overwrite·
   (γ) no-oscillation / idempotent (ίδιο φορτίο 2× → δεύτερη φορά μηδέν patch)· (δ) absent → suggest όπως σήμερα.
   Δες patterns: `bim/structural/codes/__tests__/suggest-reinforcement-load-aware.test.ts` (S2),
   `hooks/__tests__/structural-auto-reinforce-core.test.ts`, `organism/__tests__/reinforcement-checks.test.ts`.
5. **Docs (N.15, ίδιο commit):** ADR-472 §6/changelog + status `S3 DONE`· `adr-index.md` (×2 entries)·
   `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ. — τι εκκρεμεί)· MEMORY `project_adr472_load_aware_strength.md`.

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)

- **PLAN MODE + SSOT AUDIT (grep) ΠΡΩΤΑ** → plan → **έγκριση Giorgio** → υλοποίηση → jest → docs. **ΟΧΙ commit/push** (Giorgio).
- **tsc = Giorgio** (N.17 — ένα tsc τη φορά· μην το τρέξεις). **jest** OK.
- **Shared tree:** `git add` **ΜΟΝΟ τα δικά σου**, ΠΟΤΕ `-A`. Άλλος agent = ADR-471 (`active-reinforcement.ts`,
  `useStructuralAutoReinforce.ts`, `beam-detail-*`, `beam-rebar-layout.ts`) — **ΜΗΝ τα αγγίξεις/stage-άρεις**.
- **Full Enterprise + Full SSoT, Revit-grade.** Μηδέν `any`/`as any`/`@ts-ignore`/inline styles/hardcoded strings.
  **REUSE `resolveActive*` ως SSoT merge** — μην ξαναγράψεις τη λογική «fresh + preserve prefs».
- **100% ειλικρίνεια:** preliminary auto-sizing (Revit-without-Robot)· DEFER biaxial/slenderness/seismic capacity·
  `designMomentKnm` + M-N interaction προστίθενται ΕΔΩ (S3) μόνο αν χρειαστεί — αλλιώς defer ρητά.

---

## 6. ΑΡΧΕΙΑ S2 (UNCOMMITTED — ο Giorgio θα τα κάνει commit· χτίζεις από πάνω)

`loads/load-combinations.ts` (M) · `codes/eurocode-provider.ts` (M) · `codes/greek-legacy-provider.ts` (M) ·
`codes/structural-code-types.ts` (M) · `section-context.ts` (M, shared με S1) · `codes/suggest-reinforcement.ts` (M) ·
`codes/__tests__/suggest-reinforcement-load-aware.test.ts` (NEW) · `ADR-472` (M) · `adr-index.md` (M) ·
`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (M).

## 7. ΠΡΩΤΟ ΒΗΜΑ

1. Διάβασε **ADR-472 §2.3 + §6**.
2. **SSOT audit (grep §2)** — verify paths/events.
3. **PLAN MODE** → plan Κενό Α + Κενό Β + tests → **έγκριση Giorgio** → υλοποίηση → jest → docs. **ΟΧΙ commit.**
