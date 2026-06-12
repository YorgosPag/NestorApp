# HANDOFF — ADR-448 Phase 4b: Frame cascade (δοκάρια + attached κολώνες/τοίχοι ακολουθούν το ύψος ορόφου)

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΙ agents ταυτόχρονα — **icon-agent** σε `ui/ribbon/data/*.ts`· **ADR-449 finish-skin agent** σε `bim-3d/converters/bim-three-structural-converters.ts` / `columnToMesh`. **git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι παίκτες, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio — ΠΟΤΕ ο agent** (CLAUDE.md N.(-1)). Ο agent ετοιμάζει & σταματά.
> ⚠️ **ΚΑΝΟΝΕΣ:** N.14 (δήλωσε μοντέλο=Opus, περίμενε «ok»). N.17 (ΕΝΑ tsc τη φορά — ή IDE `mcp__ide__getDiagnostics` που ΔΕΝ spawn-άρει tsc). function ≤40γρ, file ≤500γρ, no `any`. N.6 (enterprise-id — ΔΕΝ αφορά, είναι updates όχι creates). N.0.1 ADR-driven (**code = SoT**). N.15 (ADR-448 §6/§8 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY μετά υλοποίηση). N.8 (~2-4 αρχεία → Plan Mode).

---

## 0. ΠΛΑΙΣΙΟ — Τι έγινε ΗΔΗ (Φ4, COMMITTED από Giorgio)

Η **ADR-448 Phase 4 (slab cascade)** ολοκληρώθηκε & **committed**. Ο `src/app/api/floors/floor-height-cascade.service.ts` έχει τώρα ένα **data-driven `CASCADE_TARGETS` registry** που, όταν αλλάζει `floor.height`, ξανα-υπολογίζει:
- walls + columns με `topBinding==='storey-ceiling'` → `params.height = newHeightMm + topOffset − baseOffset`
- ceiling/roof slabs → `params.levelElevation = newHeightMm`
- idempotent no-op skip (oldValue===newValue)· EntityAudit ανά entity· `CascadeResult{wallsUpdated,columnsUpdated,slabsUpdated,skipped}`.

**Browser-verify (live, project pagonis-87766):** ο Giorgio άλλαξε floor 1 (`flr_161aa890`) από 3.0→3.5m. DB επιβεβαίωσε: 4 roof slabs `levelElevation 3000→3500` ✅, 1 storey-ceiling κολώνα `height 4000→4500` ✅.

**ΑΛΛΑ — ο Giorgio είδε στο 3D ότι δοκάρια + κολώνες + τοίχοι ΔΕΝ τέντωσαν.** Από εδώ ξεκινά η Φ4b.

---

## 1. 🔬 ΔΙΑΓΝΩΣΗ (code = SoT + live data — επαληθευμένη)

Το πραγματικό δομικό μοντέλο σε ελληνική οικοδομή «από κάναβο» (ADR-441) **δεν** στηρίζεται σε `storey-ceiling` binding — στηρίζεται σε **δοκάρια + attach**:

1. **Τα δοκάρια ορίζουν την οροφή** μέσω `params.topElevation` (mm, top face· `beam-types.ts:122`). **ΔΕΝ είναι στο `CASCADE_TARGETS`** → έμειναν στο 3000 όταν ο όροφος πήγε 3.5. (Live: 5+ beams, όλα `topElevation: 3000`, `offsetFromStorey: 0`.)
2. **Όταν δημιουργείς δοκάρια/πλάκες από κάναβο, οι κολώνες & τοίχοι γίνονται `topBinding:'attached'`** (ADR-401 reverse auto-attach· `attachTopToIds: [beam/slab]`). Live: 8/9 κολώνες έγιναν attached (height παγωμένο 4000, attach σε roof slabs)· μόνο 1 έμεινε storey-ceiling (→ cascade 4500). Όλοι οι 12 τοίχοι = attached (height 3000).
3. **Render-time attach = LOWER-envelope** (`bim/geometry/column-vertical-profile.ts` `resolveColumnTopProfile`, mirror `wall-top-profile.ts`): `cornerTop = min(nominalTop, host_underside)`. **Κλιπάρει μόνο προς τα ΚΑΤΩ** (Revit «Attach Top: μην τρυπάς»). ΔΕΝ επεκτείνει την κολώνα προς τα ΠΑΝΩ για να φτάσει υψωμένο host.

**Συνέπεια:** ο `storey-ceiling`+slab cascade (Φ4) αφήνει 3 πράγματα στάσιμα → όλο το πλαίσιο μένει στα 3000:
- δοκάρια `topElevation` (κανείς δεν τα αγγίζει)
- attached κολώνες/τοίχοι `params.height` (ο gate `topBinding==='storey-ceiling'` τα παρακάμπτει)
- άρα οι attached φτάνουν μόνο μέχρι το **παλιό** host underside.

---

## 2. 🎯 ΛΥΣΗ (Revit-grade, ABSOLUTE/self-healing, FULL SSoT)

**ΑΡΧΗ:** το SSoT είναι `offsetFromStorey` + το νέο storey height. **Κάθε** storey-driven elevation ξανα-υπολογίζεται **απόλυτα** (όχι delta — self-healing, διορθώνει και stale state από χαμένες αλλαγές). Δύο προσθήκες στο ΥΠΑΡΧΟΝ `CASCADE_TARGETS` registry (επεκτείνεις, ΔΕΝ ξαναγράφεις):

### A) NEW target — δοκάρια (`FLOORPLAN_BEAMS`)
- `field: 'params.topElevation'`
- `shouldCascade`: όλα τα beams του ορόφου (δεν έχουν binding· είναι όλα storey-driven μέσω `offsetFromStorey`). *(Αν θες gate: skip μόνο αν υπάρχει explicit «pinned/absolute» flag — ΔΕΝ υπάρχει σήμερα, οπότε cascade όλα.)*
- `derive`: `newHeightMm + (offsetFromStorey ?? 0)`.
- **ΠΡΟΣΟΧΗ sloped beams** (`topElevationEnd?`, `beam-types.ts:133` — Revit sloped beam): πρέπει να **διατηρηθεί η κλίση**. Αν `topElevationEnd !== undefined`, ξεχωριστό update: `params.topElevationEnd = newTop + (oldTopElevationEnd − oldTopElevation)` (preserve το span της κλίσης). Το `zOffset` (drop-from-ceiling) μένει ως έχει (προστίθεται στο render, ADR-369 §854). → ίσως χρειαστείς 2ο field στο entry ή ειδικό handling· κράτα το ≤40γρ/func με helper.
- `entityType: 'beam'` (ήδη valid `AuditEntityType`, `audit-trail.ts:38`).

### B) Διεύρυνση gate — attached κολώνες/τοίχοι
- Άλλαξε το `STRETCH_TARGET.shouldCascade` από `p.topBinding === 'storey-ceiling'` σε **«cascade όταν binding ∈ {storey-ceiling, attached}»** (skip `absolute` / `unconnected` — user-pinned).
- Η ΥΠΑΡΧΟΥΣΑ formula `newHeightMm + topOffset − baseOffset` δίνει σωστό nominal για attached (π.χ. attached κολώνα baseOffset −1000 → 4500· nominalTop = −1000+4500 = 3500 = νέα οροφή). **Το attach lower-envelope τότε κλιπάρει στο host face** (που ΚΙ ΑΥΤΟ ανέβηκε μέσω του beam/slab cascade) → όλο το πλαίσιο τεντώνεται συνεπώς.

**Γιατί δουλεύει (verified by hand):** μετά το beam cascade, beam underside ανεβαίνει· μετά το height cascade, το nominal των attached ανεβαίνει· το `min(nominal, host_underside)` δίνει σωστή υψωμένη κορυφή και για beam-attached ΚΑΙ για slab-attached. Storey-ceiling (unattached) → όπως πριν.

---

## 3. SEAMS (code = SoT — επαλήθευσέ τα)

| Σημείο | Αρχείο | Φ4b |
|---|---|---|
| **Cascade registry** | `src/app/api/floors/floor-height-cascade.service.ts` | (A) NEW beam entry στο `CASCADE_TARGETS` (+ sloped-beam `topElevationEnd` handling). (B) Διεύρυνε `STRETCH_TARGET.shouldCascade` → {storey-ceiling, attached}. Extend `CascadeResult` +`beamsUpdated`. `summarise()` +beam count. |
| **Handler** | `src/app/api/floors/floors.handlers.ts` (~270) | Αμετάβλητο interface (αγνοεί το result). |
| **Beam fields** | `bim/types/beam-types.ts` | read-only ref: `topElevation:122`, `topElevationEnd?:133` (κλίση), `zOffset?:135`, `offsetFromStorey?:165`. |
| **Collection** | `src/config/firestore-collections.ts:360` | `COLLECTIONS.FLOORPLAN_BEAMS = 'floorplan_beams'`. |
| **Render attach (read-only)** | `bim/geometry/column-vertical-profile.ts` + `wall-top-profile.ts` | επιβεβαιώνει lower-envelope semantics — ΜΗΝ τα πειράξεις, μόνο κατανόησέ τα. |
| **Audit type** | `src/types/audit-trail.ts:38` | `'beam'` ήδη valid. |

### ⚠️ Προσοχές
- **Server-side Firestore Admin.** Slab/wall/column queries ήδη φιλτράρουν `companyId`+`floorId` (CHECK 3.10) — κράτα το ίδιο για το beam query.
- **Idempotent:** absolute formula → ίδιο height = ίδιο αποτέλεσμα· το `oldValue===newValue` skip ήδη υπάρχει στο `collectCascade`.
- **Sloped beam:** ο `derive` επιστρέφει 1 αριθμό· το `topElevationEnd` χρειάζεται 2ο update στο ίδιο batch.update. Σκέψου: είτε ειδικό `CascadeTarget.extraUpdates?(params,newHeightMm)` hook, είτε ξεχωριστή beam-specific διαδρομή. Κράτα SSoT + ≤40γρ.
- **EntityAudit baseline (CHECK 3.17):** ο cascade ήδη καλεί `recordChange` ανά entry — μην αυξήσεις baseline.
- **Tests:** το `__tests__/floor-height-cascade.service.test.ts` ΥΠΑΡΧΕΙ (6 tests, in-memory db double + `jest.mock('firebase-admin/firestore')`). **Extend** το: beam flat cascade· beam sloped (preserve κλίση)· attached column/wall height cascade· skip absolute/unconnected· idempotent.

---

## 4. ΣΕΙΡΑ ΕΡΓΑΣΙΑΣ (N.0.1)

1. **Recognition (code = SoT):** ξανα-διάβασε `floor-height-cascade.service.ts` (το committed registry), `beam-types.ts` (topElevation/topElevationEnd/zOffset/offsetFromStorey), `column-vertical-profile.ts` (lower-envelope). Επιβεβαίωσε beam gap + attached gate gap.
2. **Δήλωσε μοντέλο (N.14) = Opus. Περίμενε «ok».**
3. **Mode (N.8):** ~2-4 αρχεία (service + test + ADR + ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY) → Plan Mode.
4. **ADR-448 ΠΡΩΤΑ:** §6 → πρόσθεσε **Phase 4b** (frame cascade: beams + attached height· code=SoT γιατί η Φ4 ήταν μερική). §8 changelog. **Status: ξανα-άνοιξε** «🟢 Phase 4 DONE· Φ4b follow-up» (η Φ4 έκλεισε πρόωρα — διόρθωσέ το με αλήθεια).
5. **Υλοποίηση:** (A) beam target + sloped handling, (B) διεύρυνση gate, `beamsUpdated`. Boy-Scout SSoT — επέκταση registry, μηδέν duplicate loop.
6. **Verify:** jest (extend suite) + IDE diagnostics (N.17). MCP firestore read-only (project `pagonis-87766`, floor `flr_161aa890` τώρα @3.5m): άλλαξε σε 4.0 → επιβεβαίωσε beams `topElevation 3000→4000`, attached columns `height→5000`, walls `height 3000→...`. Browser (Giorgio): άλλαξε ύψος ορόφου → ΟΛΟ το πλαίσιο (δοκάρια+κολώνες+τοίχοι+οροφή) τεντώνεται μαζί.
7. **N.15** + STOP για commit (Giorgio· git add ΜΟΝΟ δικά σου: `floor-height-cascade.service.ts` + test + ADR-448 + ΕΚΚΡΕΜΟΤΗΤΕΣ· **ΟΧΙ** `bim-three-structural-converters.ts`/ADR-449, **ΟΧΙ** `ui/ribbon/data/*`/icon-agent).
8. **Μετά τη Φ4b:** ADR-448 πραγματικά CLOSED. Vertical-continuity validation (λείπει ενδιάμεσος όροφος / κολώνα δεν στοιχίζεται) → ακόμα DEFER ως ξεχωριστό ADR.

---

## 5. LIVE DATA BASELINE (project pagonis-87766, μετά το 3.5 test)

- **Floor 1** `flr_161aa890` (1ος Όροφος): `height=3.5`, `elevation=3`. Floor 2 `flr_528ca26e`: `height=3`, άδειος.
- **Beams (≥5):** όλα `params.topElevation: 3000`, `depth: 500`, `offsetFromStorey: 0`, flat (χωρίς topElevationEnd) — **ΟΛΑ stale @3000** (το bug).
- **Columns (9):** 8 `topBinding:'attached'` `height:4000` (attach σε roof slabs)· 1 `topBinding:'storey-ceiling'` `height:4500` (`col_699cc53e`).
- **Walls (12):** όλα `topBinding:'attached'` `height:3000`.
- **Slabs (8):** 4 `roof` `levelElevation:3500` (Φ4 ✅)· 4 `floor` `levelElevation:0`.

→ Μετά τη Φ4b + νέα αλλαγή ύψους, τα beams/attached πρέπει να ακολουθήσουν. (Σημ: επειδή beams είναι ήδη stale @3000 ενώ floor=3.5, η **absolute** formula τα διορθώνει στην επόμενη αλλαγή — γι' αυτό absolute, ΟΧΙ delta.)

## 6. REFERENCE
- **SSoT προς extend:** `src/app/api/floors/floor-height-cascade.service.ts` (`CASCADE_TARGETS`, `STRETCH_TARGET`, `collectCascade`, `summarise`).
- **ADRs:** ADR-448 §6 (αυτό)· ADR-369 §9 Q5 §854 (beam topElevation = floor.elevation· ο υπάρχων storey cascade)· ADR-401 (attach top/base lower-envelope)· ADR-195 (EntityAudit).
- **MEMORY:** `project_adr448_storey_aware_dxf.md` (Φ1-4 ιστορικό).
