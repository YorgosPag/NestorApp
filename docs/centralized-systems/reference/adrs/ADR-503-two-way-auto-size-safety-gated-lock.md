# ADR-503 — Two-way auto-size + safety-gated lock (μηδέν σπατάλη + μηδέν ανασφαλές κλείδωμα)

**Status:** 🟡 Slice 1 + Slice 2 + Slice 3 DONE (two-way column section + ν-floor + safety-gated lock κολώνα **+ organism-wide lock: δοκός/πλάκα/πέδιλο**) — UNCOMMITTED 2026-06-19
**Date:** 2026-06-19
**Υλοποιεί:** ADR-487 §4 (live αυτο-διόρθωση) + §5 (δυναμική επανα-διαστασιολόγηση) + §8.4 (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί)
**Σχετικά:** ADR-499 (auto-correcting organism / column sizing B2), ADR-502 (live reaction-aware takedown), ADR-475 (auto member sizing)

---

## 1. Πρόβλημα (Giorgio)

Η εφαρμογή πρέπει να είναι «έξυπνη»: ο αρχιτέκτονας βάζει κολώνα στον καμβά **χωρίς να ξέρει στατικά** — την παίρνει ως **default 400×400** από την παλέτα. Άρα το σύστημα πρέπει να διαστασιολογεί **διατομή + οπλισμό** αυτόματα ώστε:
- να μην υπάρχει **υποδιαστασιολόγηση** (ανασφαλές), ΚΑΙ
- να μην υπάρχει **υπερδιαστασιολόγηση** (σπατάλη υλικού/χρήματος).

**Δύο κενά (confirmed grep 2026-06-19):**
1. Ο `suggestColumnSection` (ADR-499) ήταν **grow-only** (`Math.max(params.width, s)`) → η υπερδιαστασιολόγηση ΔΕΝ διορθωνόταν → **σπατάλη**.
2. **Δεν υπήρχε πουθενά** έλεγχος ανηγμένου αξονικού `ν = N_Ed/(A_c·f_cd)` (EC8). Άσχετο για grow-only (μεγάλες διατομές τον περνούν), αλλά **κρίσιμο για shrink**.

**Απόφαση Giorgio (2026-06-19):** (Q1) two-way auto-size· (Q2) όταν ο μηχανικός κλειδώνει υποδιαστασιολογημένη διατομή → **μπλοκάρεται** (μένει AUTO ώσπου να γίνει ασφαλής). Invariant: καμία persisted οντότητα ποτέ κάτω από το επαρκές.

## 2. Slice 1 — Two-way column section + ν-floor (DONE)

**Αρχείο:** `bim/structural/sizing/column-sizing.ts`.

- `suggestColumnSection` → **two-way**: επιστρέφει το **ελάχιστο επαρκές** `s×s` (μεγαλώνει Ή μικραίνει), αφαιρώντας το grow-only `Math.max(params.width, s)`.
- NEW `MAX_AXIAL_LOAD_RATIO = 0.65` (EC8 §5.4.3.2.1, DCM). Το `columnSectionFits` ελέγχει τώρα **τετράγωνη trial `s×s`** + δύο πύλες: **(α) ν ≤ 0.65** (η πύλη που κάνει το shrink ασφαλές, reuse `concreteFcdMpa`) **(β) οπλισμός `As,req ≤ ρ_max·A_c`**. Floor = `max(height/30 λυγηρότητα, MIN_COLUMN_DIMENSION_MM=250)`.
- **Scope two-way v1:** ΜΟΝΟ τετράγωνες (`width===depth`, default παλέτας). Μη-τετράγωνες (ρητή αρχιτεκτονική πρόθεση) → **grow-only** (διατηρεί aspect· proportional shrink = DEFER).
- Ο **οπλισμός** ήταν ήδη two-way (derived, recompute κάθε φορά) → ρέει αυτόματα.

**Convergence-safe:** στο ντετερμινιστικό takedown η ζήτηση κολώνας ΔΕΝ εξαρτάται από τη δική της δυσκαμψία — μόνο γεωμετρία + ίδιο βάρος (μικρό κλάσμα) → μονότονη σύγκλιση, μηδέν ταλάντωση. Το 50mm quantization + `columnSectionMateriallyDiffers` κλείνει τον βρόχο.

**Επαλήθευση live μοντέλου (Firestore proj_12788b6a):** κολώνα 400×400, appliedLoad dead=430.09 + live=105.65 (ULS ≈ 739 kN) → two-way προτείνει **300×300** (ν=0.49 ✓· εξοικονόμηση ~44% διατομής). Χωρίς το ν-floor θα πήγαινε ανασφαλώς σε 250×250 (ν=0.71 > 0.65, EC8 παραβίαση). Jest το επιβεβαιώνει.

## 3. Slice 2 — Safety-gated lock (ΕΠΟΜΕΝΗ ΣΥΝΕΔΡΙΑ)

**DONE 2026-06-19.** Πριν: το `autoSized:false` (lock) έμπαινε **μόνο στα δοκάρια** (`grip-parametric-commits.ts:333` + `useBeamParamsDispatcher`)· στις κολώνες ο μηχανισμός lock **δεν υπήρχε** (ούτε grip `column-width`/`column-depth`, ούτε panel `useColumnParamsDispatcher`).

**Υλοποίηση:**
- NEW pure `isColumnSectionAdequate(provider, params, moment?)` → `{ adequate, minWidthMm, minDepthMm }` (`column-sizing.ts`). `adequate` ⇔ η **πραγματική** `width×depth` περνά τις πύλες αντοχής **ΚΑΙ** το γεωμετρικό floor. Boy-scout de-dup (N.0.2): εξαγωγή `rectangularSectionFits(w,d)` (το `columnSectionFits(s)` έγινε thin wrapper) + `columnDimensionFloorMm(height)` (λυγηρότητα EC2 ∨ MIN EC8).
- NEW **ΕΝΑ SSoT** `resolveColumnSectionLock(provider, prev, next, moment?)` (`column-size-patch.ts`): δεν άλλαξε διατομή → pass-through· manual ≥ επαρκές → `autoSized:false`· manual < επαρκές → **ΜΠΛΟΚ** (clamp στο ελάχιστο επαρκές, μένει AUTO, `rejected:true`). Αντικαθιστά το copy-paste του δοκού σε 2 σημεία.
- Wiring 2 call sites (thin): `useColumnParamsDispatcher` (panel/ribbon) + `commitColumnGripDrag` (grip). Provider = `resolveStructuralCode(codeId)`, moment = `resolveActiveColumnDesignMoment(id)` (ίδιο SSoT με τον auto-sizer).
- Toast: NEW typed event `bim:column-section-rejected` + registrar στο `structural-attach-notifications.ts` με **stable `id`** (μηδέν storm κατά το συνεχές section-grip drag). i18n `structuralOrganism.columnSectionRejected` (el+en).
- **Jest:** +5 `isColumnSectionAdequate` (200/250→ανεπαρκές, 300/500→επαρκές, circular→no-op) +3 `resolveColumnSectionLock` (pass-through / lock OK / ΜΠΛΟΚ-clamp). 28/28 sizing GREEN· 1226 pass structural+commands (7 pre-existing fails: 6 raft ADR-476 + 1 AssignWallType).

## 4. Slice 3 — Organism-wide safety-gated lock (DONE 2026-06-19)

**Εύρημα:** οι sizers (`suggestBeamSection`/`suggestSlabThickness`/`suggestPadDimensions`) ήταν **ήδη two-way** → το Slice 3 πρόσθεσε **ΜΟΝΟ** το lock-gate (reject-if-inadequate), per-member, mirror του `resolveColumnSectionLock`.

**Δοκός** (`sizing/beam-size-patch.ts`): NEW pure `isBeamSectionAdequate(provider, beam, next, support?, torsion?)` (depth-driven· `adequate ⇔ next.depth ≥ suggested.depthMm`, ctx από τα **next** params + topology-aware `resolveActiveBeamSupportType`/`resolveActiveBeamTorsion`) + `resolveBeamSectionLock` (ΕΝΑ SSoT). Αντικατέστησε το inline `sectionChanged ? {...,autoSized:false} : ...` σε 2 σημεία: `commitBeamGripDrag` (grip) + `useBeamParamsDispatcher` (panel/ribbon).

**Πλάκα** (`sizing/slab-size-patch.ts`): NEW `isSlabSectionAdequate` + `resolveSlabSectionLock` (composite `dna` → pass-through· `suggestSlabThickness` cantilever-only → `undefined` = no-op gate, αλλά κλειδώνει manual πάχος). Wiring `useSlabParamsDispatcher` — που **δεν κλείδωνε καθόλου** (διορθώνει και το pre-existing gap: χειροκίνητο πάχος έμενε AUTO → ο proactive κύκλος το ξαναέγραφε).

**Πέδιλο** (`sizing/pad-size-patch.ts`): NEW `isPadAutoSized` (lock-flag = **`autoDesigned`**, ΟΧΙ νέο field — το `FoundationParams` δεν έχει `autoSized`· το μόνο που ξαναδιαστασιολογεί pad είναι ο `auto-foundation-layout` reconciler, gated σε `autoDesigned===true`) + pure `buildPadSizingInput` (διαστάσεις στηρίζουσας κολώνας μέσω explicit FK `footingId` + service N=G+Q + σ_allow) + `isPadSectionAdequate`/`resolvePadSectionLock` (reuse `suggestPadDimensions`). **Adequate → `autoDesigned:false`** (κλειδώνει από τον reconciler, επιτρέπεται over-dimensioned)· **inadequate → clamp στην ελάχιστη επαρκή, διατηρεί `autoDesigned`** + reject. Wiring 2 pad width/length sites: `commitFoundationGripDrag` (grip) + `useRibbonFoundationBridge.dispatchParams` (ribbon numeric). strip/tie-beam → pass-through.

**Toast (per-member, mirror):** 3 typed events `bim:{beam,slab,foundation}-section-rejected` + 3 registrar handlers με **stable `id` ανά τύπο** (μηδέν storm στο grip drag) + i18n `{beam,slab,footing}SectionRejected` (el+en). Το `columnSectionRejected` αμετάβλητο.

**Jest:** +5 beam (13/13), +7 slab (16/16), +10 NEW pad → 88/88 sizing GREEN.

## 5. Tests (από repo ROOT)

`sizing/__tests__/column-sizing.test.ts` (11, +3 ADR-503): τετράγωνη χωρίς φορτίο→250 (shrink)· live 400×400→300 (ν-governed proof)· ν monotonic· idempotent· μη-τετράγωνη→grow-only. `column-size-patch.test.ts` updated (400×400→patch 250). Πλήρες structural+commands: 1104 pass / 7 pre-existing fails (6 raft ADR-476 `maxFreeSpanM` + 1 AssignWallTypeCommand — confirmed stash baseline, ΟΧΙ δικά μου).

## 6. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία + Slice 1.** Two-way `suggestColumnSection` (shrink+grow στο ελάχιστο επαρκές) + NEW ν-floor `MAX_AXIAL_LOAD_RATIO=0.65` (EC8) στο `columnSectionFits` (η πύλη ασφαλείας του shrink). Square-only v1· μη-τετράγωνες grow-only. Live-model verified (400×400→300×300). Slice 2 (safety-gated lock) + Slice 3 (organism-wide) = handoff. UNCOMMITTED. |
| 2026-06-19 | **Slice 2 — safety-gated lock (κολώνα).** NEW `isColumnSectionAdequate` + ΕΝΑ SSoT `resolveColumnSectionLock` (de-dup boy-scout: `rectangularSectionFits`/`columnDimensionFloorMm`). Wired σε panel (`useColumnParamsDispatcher`) + grip (`commitColumnGripDrag`): manual ≥ επαρκές → lock· < επαρκές → ΜΠΛΟΚ (clamp στο ελάχιστο επαρκές, μένει AUTO) + toast (event `bim:column-section-rejected`, stable id, i18n el+en). +8 jest (28/28). UNCOMMITTED. |
| 2026-06-19 | **Slice 3 — organism-wide lock (δοκός/πλάκα/πέδιλο).** Οι sizers ήταν ήδη two-way → προστέθηκε ΜΟΝΟ το lock-gate per-member. Δοκός: `isBeamSectionAdequate`+`resolveBeamSectionLock` (`beam-size-patch`, depth-driven, topology-aware support/torsion) wired σε grip+panel. Πλάκα: `isSlabSectionAdequate`+`resolveSlabSectionLock` (`slab-size-patch`, dna pass-through, cantilever-only gate) wired σε `useSlabParamsDispatcher` (που **δεν κλείδωνε** → pre-existing α-gap fix). Πέδιλο: NEW `pad-size-patch` (lock-flag = **reuse `autoDesigned`**, μηδέν νέο field· `buildPadSizingInput` από στηρίζουσα κολώνα+φορτίο+σ· adequate→`autoDesigned:false`, inadequate→clamp+keep flag) wired σε grip + `useRibbonFoundationBridge`. 3 per-member toast events + i18n el+en. +22 jest (88/88 sizing· 834 structural pass / 6 pre-existing raft fails ADR-476). UNCOMMITTED. |
