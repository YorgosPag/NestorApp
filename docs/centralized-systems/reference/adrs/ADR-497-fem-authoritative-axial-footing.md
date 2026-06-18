# ADR-497 — FEM-authoritative axial: single source of truth (κολώνα-N → πέδιλο)

**Status:** ✅ Slice 2A implemented (UNCOMMITTED) · **Date:** 2026-06-19
**Υλοποιεί:** ADR-487 §3-§4 (ΕΝΑΣ οργανισμός, μηδέν διπλή αλήθεια) · **Συνέχεια:** ADR-495 (slab→beam), ADR-491 (FEM→column moment)
**Mirror του:** ADR-491 (column-fem-moment bridge, engaged-gated override)

> ⚠️ **Αρίθμηση:** το ADR-496 πιάστηκε από άλλον agent (`ADR-496-smart-column-type-change-align-to-beam`) ενώ υλοποιούνταν αυτό. Η δουλειά μετα-αριθμήθηκε **494→495 (slab) → 497 (FEM axial)**.

---

## 1. Πρόβλημα — δύο παράλληλες αλήθειες για το ίδιο μέγεθος

Μετά το ADR-495 (slab→beam) το **δοκάρι + FEM ροπές κολώνας** αντιδρούν στον πρόβολο, αλλά
το **gravity αξονικό N της κολώνας/πεδίλου** προερχόταν από **δύο διαφορετικούς μηχανισμούς**:

| Μηχανισμός | Πηγή αξονικού | Καταναλωτής |
|---|---|---|
| **Μ1 — Tributary takedown** (ADR-464/467) | grid spacing × ορόφους × area-loads (**slab-agnostic**) | `appliedLoad` → οπλισμός/μέγεθος πεδίλου |
| **Μ2 — FEM solver** (ADR-481) | επίλυση πλαισίου (βλέπει τον πρόβολο) | διαγράμματα + ροπή κολώνας (ADR-491) |

Έτρεχαν **παράλληλα χωρίς ιεραρχία** → μπορούσαν να διαφωνήσουν για το ίδιο N. Σε
**πρόβολο/άνισα ανοίγματα** η διαφωνία είναι σοβαρή: το πέδιλο (Μ1) **δεν έβλεπε** τον
πρόβολο → δεν άλλαζε. Double-truth (ADR-487 §3 το απαγορεύει).

## 2. Απόφαση — ιεραρχία single-source-of-truth (Revit + Robot)

- **Persisted `appliedLoad` = tributary seed/fallback** (πάντα διαθέσιμο· σωστό για
  μεμονωμένο ζεύγος κολώνα+πέδιλο εκτός πλαισίου).
- **FEM = αυθεντία στον σχεδιασμό, engaged-gated** (ADR-488 — όταν ο μηχανικός «παρατηρεί
  στατικά», Revit «analytical results enabled»).
- **Κανόνας:** `engaged → FEM υπερισχύει· αλλιώς → tributary`. Μία ιεραρχία, μηδέν διαφωνία.
- **Read-time override, ΜΗΔΕΝ νέο persisted/reactive write** (το ADR-491 έμαθε ότι reactive
  FEM↔design = infinite loop· εδώ καθαρά active resolver).

Στην επαγγελματική ροή **Revit → Robot** το FEM είναι η ΜΙΑ αλήθεια για δυνάμεις/αντιδράσεις·
το tributary = χειρωνακτικός έλεγχος. Αυτό υλοποιεί ακριβώς αυτό το μοντέλο.

## 3. Υλοποίηση (Slice 2A — πέδιλο)

### NEW `analytical/column-fem-axial.ts` (pure, mirror `column-fem-moment.ts`)
`resolveColumnFemAxial(result, columnId): { slsKn, ulsKn } | undefined` — διαβάζει το
**αξονικό βάσης κολώνας** ανά combination (`combinationKind` 'sls'→έδραση, 'uls'→αντοχή·
max-abs· `unstable`/εκτός/μηδέν → undefined → tributary fallback). + `buildColumnFemAxialMap`.

### NEW `footing-design/footing-support-column.ts` (pure SSoT — de-dup, N.0.2)
`resolveSupportingColumn(footingId, entities): ColumnEntity | null` — το entity-FK footing→column
mapping ζούσε copy-pasted σε **3 σημεία** (`resolveSupportingColumnDims`, `footing-load-takedown`,
και ο νέος FEM resolver). Ενοποιήθηκε εδώ· **και τα 3 το χρησιμοποιούν** (μηδέν διπλότυπο).

### MOD `active-reinforcement.ts` (store-coupled, engaged-gated — mirror ADR-491)
`resolveActiveColumnFemAxial(id)` + `resolveActiveFootingFemAxial(footingId, entities)` (reuse
`resolveSupportingColumn`) + `buildActiveFootingFemAxialMap(entities)` (batch για τον runner).
Κοινό gate `resolveEngagedAnalysisResult` (ΕΝΑ SSoT με τον persisted path).

### MOD `footing-design-input.ts` (παραμένει pure)
`buildPadFootingDesignInput(..., femAxialOverride?)` — override μόνο το **axialKn** των
SLS/ULS (κρατά ροπές)· χωρίς override → tributary (μηδέν regression).

### MOD callers (store-coupled, περνούν το override)
- `useStructuralOrganism.ts` → `runFootingDesignChecks(..., buildActiveFootingFemAxialMap(entities))`
  (diagnostics: έδραση/διάτρηση/τέμνουσα FEM-aware).
- `footing-design-checks.ts` (pure runner) → +`femAxialByFooting?` param.
- `FoundationDetailHost.tsx` → `resolveActiveFootingFemAxial(...)` (detail sheet FEM-aware).

## 4. Scope / DEFER

- **Slice 2A αλλάζει:** έδραση/διάτρηση/τέμνουσα/μέγεθος πεδίλου (→ As ακολουθεί τη γεωμετρία)
  + detail sheet, όταν engaged & ο πρόβολος (ADR-495) τρέφει το FEM.
- **DEFER:** (Β) column M-N να χρησιμοποιεί FEM-N (τώρα μόνο FEM-M από ADR-491· N=tributary)·
  ribbon bearing readout (`foundation-structural-bridge`, χωρίς entities)· σεισμικός συνδυασμός·
  footing moment override (τώρα μόνο axial).

## 5. Tests
- NEW `analytical/__tests__/column-fem-axial.test.ts` — 8 cases (SLS/ULS extraction, max-abs,
  unstable, εκτός, λείπει combo, singular skip, μηδέν, map).
- NEW footing override case (`buildPadFootingDesignInput` με femAxialOverride). `runFootingDesignChecks`
  backward-compatible (footing-punching/flexure GREEN).

## 6. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία + Slice 2A.** Single-source-of-truth ιεραρχία FEM-authoritative axial κολώνας→πέδιλο (engaged-gated, read-time override, μηδέν persisted churn). NEW `column-fem-axial.ts` + active resolvers + footing-input override + 3 callers. Λύνει το double-truth «πέδιλο δεν βλέπει τον πρόβολο». Μετα-αριθμήθηκε ADR-496→497 (collision). UNCOMMITTED. |
| 2026-06-19 | **De-dup (N.0.2).** Το entity-FK footing→column lookup (3 copies) → NEW SSoT `footing-support-column.ts` `resolveSupportingColumn`· reuse σε `resolveSupportingColumnDims` + `footing-load-takedown` + ο νέος FEM resolver. 33 jest GREEN. |
