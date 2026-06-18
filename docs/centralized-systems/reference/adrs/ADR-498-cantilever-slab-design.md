# ADR-498 — Cantilever-aware slab design (topology-aware, mirror ADR-486)

**Status:** ✅ Slice 1+2 implemented (UNCOMMITTED) · **Date:** 2026-06-19
**Υλοποιεί:** ADR-487 §4-§5 (πλάκα οροφής → σωστή διαστασιολόγηση) · **Mirror του:** ADR-486 (topology-aware beam support)
**Συνέχεια:** ADR-495 (slab→beam load), ADR-497 (FEM axial)

---

## 1. Πρόβλημα (επιβεβαιωμένο σε production DB)

Μια **πλάκα-πρόβολος** (στηριζόμενη σε **1** δοκάρι, προεξέχουσα) σχεδιαζόταν ως
**αμφιέρειστη**: `suggest-slab-reinforcement.ts` χρησιμοποιούσε hardcoded `q·L²/8` με τη
**strength σχάρα ΚΑΤΩ** (sagging) και **άνω = μόνο ρ_min** (ρητό «hogging = DEFER»). Πρόβολος
απαιτεί `q·L²/2` (hogging) → **άνω** σχάρα = strength, **πολύ μεγαλύτερο πάχος** (L/d πρόβολος
≈8 vs ~20), και **καμία προειδοποίηση** όταν είναι πολύ λεπτή (`hasCodeViolations:false` —
σιωπηλό πέρασμα 5m προβόλου σε πλάκα 200mm).

## 2. Απόφαση — mirror του ADR-486 (beam) για πλάκες

Ακριβές mirror του topology-aware beam support pipeline, με **μία απόκλιση**: η στήριξη πλάκας
είναι **spatial** (οι πλάκες ΔΕΝ είναι κόμβοι του `StructuralGraph`), και προέρχεται από το
υπάρχον `slab-beam-support.ts` (ADR-495), όχι από τον graph.

### SSoT REUSE (μηδέν διπλότυπα — grep audit + 4 deep agents)
- **`slab-beam-support.ts`** (ADR-495): **EXTEND** (νέο export `computeSlabSupportConditions`) —
  reuse του `bearingBeams` + `perpMin/perpMax`· cantilever = ακριβώς 1 φέρουσα δοκός, μήκος =
  `max(|perpMin|,|perpMax|)`. Μηδέν νέα geometry.
- **`spanMomentDivisor(supportType)`** (`suggest-reinforcement.ts`): cantilever=2/fixed=12/simple=8
  → αντικατέστησε το hardcoded `÷8` του slab suggester.
- **`BeamSupportType`** ('simple'|'fixed'|'cantilever'): κοινός member support-type (reuse, μηδέν νέο enum).
- **`createDerivedMapStore<T>()`**: νέο `SlabSupportConditionStore`.
- **span/depth K-factor** providers: refactored ο `*SpanDepthSystemFactor` να δέχεται `supportType`
  (ΕΝΑ SSoT δοκάρι+πλάκα)· νέο `slabSpanDepthLimit` (EC2 slab-basic 20 / ΕΚΩΣ 18 × K).
- **`StructuralDiagnostic` + `runFootingDesignChecks` pattern**: νέο `runSlabChecks`.

## 3. Υλοποίηση

### SLICE 1 — Cantilever reinforcement
| # | Αρχείο | Αλλαγή |
|---|---|---|
| 1 | `loads/slab-beam-support.ts` | NEW `computeSlabSupportConditions` + `SlabSupportCondition` (extend `bearingBeams` με perp) |
| 2 | `organism/slab-support-condition-store.ts` | NEW `createDerivedMapStore<SlabSupportCondition>` |
| 3 | `hooks/useStructuralOrganism.ts` | publish `SlabSupportConditionStore.set(computeSlabSupportConditions(entities))` (**entities**, όχι graph) |
| 4 | `codes/structural-code-types.ts` | `SlabFoundationSectionContext` +`supportType?` +`cantileverSpanMm?` |
| 5 | `section-context.ts` | `buildSlabFoundationSectionContext(slab, supportCondition?)` + `resolveActiveSlabReinforcement(...)` |
| 6 | `codes/suggest-slab-reinforcement.ts` | `÷8`→`spanMomentDivisor(supportType)`· cantilever → strength **ΕΠΑΝΩ** (hogging) |
| 7 | `active-reinforcement.ts` | NEW `resolveActiveSlabSupportCondition` + thread στο `…ForEntity` |
| 8 | `reinforce-patch.ts` + `AutoReinforceOrganismCommand` + `structural-auto-reinforce-core.ts` | thread slab condition στο persisted patch |
| 9 | `reinforcement/slab-foundation-reinforcement-compute.ts` | ratio = `max(bottom, top)` (πρόβολος-hogging κυριαρχεί) |
| 9b | `reinforcement/footing-reinforcement-compute.ts` | **de-dup (N.0.2):** NEW SSoT `meshReinforcementRatio` (το ρ-formula `barArea/(spacing·d)` ήταν ×3: footing ×2 + slab)· reuse σε footing(×2)+slab |

### SLICE 2 — Warning (ανεπαρκές πάχος προβόλου)
| # | Αρχείο | Αλλαγή |
|---|---|---|
| 10 | `organism/slab-checks.ts` | NEW `runSlabChecks` — έλεγχος βέλους L/d· `cantileverSlabTooThin` warning (σιωπηλό αν επαρκές, mirror `checkBeamUnsupportedEnd`) |
| 11 | `codes/{eurocode,greek-legacy}-provider.ts` + interface | NEW `slabSpanDepthLimit` (reuse system-factor) |
| 12 | `structural-organism-types.ts` + `useStructuralOrganism.ts` + i18n el/en | νέος code + register + μηνύματα |

## 4. Scope / DEFER
- **Slice 3 — αυτόματη αύξηση πάχους πλάκας** (`AutoSizeSlabsCommand`+`buildSlabSizePatch`) = **DEFER**
  (νέο subsystem· το warning του Slice 2 ενημερώνει τον μηχανικό). Συνέχεια/two-way πλάκας = DEFER.
- 2Δ/3Δ renderers/detail/BOQ: **μηδέν αλλαγή** (σχεδιάζουν ό,τι mesh λάβουν μέσω `resolveActiveSlabReinforcementForEntity`, που τώρα είναι cantilever-aware).
- Reuse `BeamSupportType` (μηδέν νέο `SlabSupportType`).

## 5. Tests
- `loads/__tests__/slab-beam-support.test.ts` +4 (computeSlabSupportConditions).
- NEW `codes/__tests__/cantilever-slab-reinforcement.test.ts` (4· strength top σε πρόβολο, ÷2>÷8, regression).
- NEW `organism/__tests__/slab-checks.test.ts` (5· too-thin warning/silent/non-cantilever).
- Σύνολο `bim/structural`: 702 GREEN (τα 2 raft/slab failures = pre-existing ADR-476, `maxFreeSpanM` fixtures).

## 6. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία + Slice 1+2.** Topology-aware cantilever slab design (mirror ADR-486, spatial support από slab-beam-support): πρόβολος → q·L²/2 hogging άνω σχάρα + `slabSpanDepthLimit` L/d warning `cantileverSlabTooThin`. Λύνει το σιωπηλό πέρασμα ανέφικτων προβόλων. 13 jest νέα. UNCOMMITTED. |
| 2026-06-19 | **De-dup (N.0.2, Giorgio SSoT audit).** Το ρ-formula σχάρας `barArea/(spacing·d)` ήταν ×3 (footing ×2 + slab) → NEW SSoT `meshReinforcementRatio` στο `footing-reinforcement-compute`· reuse σε footing(×2)+slab. 69 jest GREEN. |
