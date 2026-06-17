# ADR-477 — Foundation Tie-Beam Reinforcement: live auto re-study + ενοποίηση render (Revit-grade)

**Status:** 🟡 PARTIAL — **Slice 1 (live auto re-study) DONE 2026-06-18 (Opus), UNCOMMITTED & επαληθευμένο (7 jest)**. Slices 2-3 (ενοποίηση render / EC8 δύναμη σύνδεσης) ΠΡΟΔΙΑΓΕΓΡΑΜΜΕΝΑ — επόμενα. 🔴 tsc(Giorgio full) + browser-verify + commit.
**Discipline:** Δομοστατικά / Structural Engineering
**Scope:** Ανύψωση του οπλισμού των **συνδετήριων δοκαριών θεμελίωσης** (`FoundationEntity` kind `'tie-beam'`, πεδιλοδοκός) σε πλήρη Revit-grade ισοτιμία με κολόνα/δοκάρι: (1) **live auto re-study** της στατικής μελέτης σε κάθε αλλαγή διάστασης, (2) ενοποίηση στο member-reinforcement facade, (3) ενοποίηση render με το beam pipeline (διαγραφή διπλότυπων), (4) EC8 §5.4.1.2 σεισμική αξονική δύναμη σύνδεσης. Επεκτείνει ADR-463 (foundation reinforcement UX), ADR-471 (unified member reinforcement), ADR-472 (load-aware strength), ADR-476 (slab reinforcement).

---

## 1. Context & Problem

Ο μηχανικός ζήτησε Revit-grade οπλισμό συνδετήριων δοκαριών, **ενοποιημένο, χωρίς διπλότυπα**, ίδιας ποιότητας με κολόνα/δοκάρι — με έμφαση στο «η **στατική μελέτη** να ξανατρέχει **κάθε φορά που αλλάζει η διάσταση** (πλάτος/ύψος/μήκος)».

**Εύρημα έρευνας (100% ειλικρίνεια): ΔΕΝ ήταν greenfield.** Από ADR-463 / ADR-459 Φ4b προϋπήρχε: τύπος `TieBeamReinforcement extends BeamReinforcement`, υπολογισμός ποσοτήτων (delegate στο beam), code suggester (EC2+ΕΚΩΣ, delegate), 2Δ (`drawTieBeam`), 3Δ (`buildTieBeamCage`), καρτέλα Ιδιότητες, ribbon (Αυτόματος Οπλισμός + Λεπτομέρεια), PDF detail-sheet, BOQ, Firestore, placement, κάναβος.

**Τι έλειπε πραγματικά:**

| Κενό | Κολόνα/Δοκάρι έχει | Tie-beam (πριν) |
|---|---|---|
| **Live auto re-study σε resize** | `auto:true` → `resolveActive*` re-derive σε κάθε render | ❌ `resolveActiveFootingReinforcementForParams` = pure passthrough· οπλισμός **παγωμένος** |
| **Auto patch σε γεωμετρική αλλαγή** | `buildReinforcePatch` re-derive + convergence guard | ❌ `buildFoundationReinforcePatch` → `if (p.reinforcement) return null` (ποτέ re-derive)· δημιουργία **χωρίς** `auto:true` |
| **Ενοποίηση στο facade** | `resolveActiveMemberReinforcement` (column+beam+slab) | ❌ δεν καλυπτόταν → ρ-check διάβαζε raw stored |
| **Ενοποίηση render (no-dup) + EC8 ζώνες** | `beam-rebar-layout/2d/3d` (κρίσιμες ζώνες lcr≈h) | 🟡 ξεχωριστά `drawTieBeam`/`buildTieBeamCage` (ομοιόμορφο βήμα) |
| **EC8 σεισμική δύναμη σύνδεσης** | — | ❌ εκτός load-path· καμία δύναμη σύνδεσης |

**Αρχιτεκτονική θέση:** μια συνδετήρια δοκός **ΕΙΝΑΙ δοκός** → η «ενοποίηση με την κολόνα» = ενοποίηση με το **beam pipeline** (που ήδη μοιράζεται SSoT με την κολόνα: `rebar-catalog`, `concrete-grades`, `detail-sheet`, `suggest-reinforcement`). Ο suggester των tie-beam ήδη delegate-άρει στο beam (μηδέν duplicate στο backend).

---

## 2. Decision

Slice-driven ανύψωση σε parity, με τη **Slice 1 (live re-study)** ως πυρήνα (το headline ζητούμενο), και τις Slices 2-3 ως enhancements ποιότητας/βάθους.

### Slice 1 — Live auto re-study (✅ DONE)

Mirror του μηχανισμού κολόνας/δοκού/πλάκας (`auto:true` → render-time re-derive). Το `TieBeamReinforcement` κληρονομεί ήδη `auto?` από `BeamReinforcement` → μηδέν type change.

| Αλλαγή | Αρχείο | Τι κάνει |
|---|---|---|
| `resolveActiveTieBeamReinforcement(params, provider)` + tie-beam branch στο facade `resolveActiveMemberReinforcement` | `bim/structural/section-context.ts` | auto → φρέσκο code-suggested από ΤΡΕΧΟΥΣΑ γεωμετρία (άνοιγμα = axis start→end), διατηρεί detailing prefs (stirrup type/legs)· επιστρέφει `TieBeamReinforcement` (⊂ BeamReinforcement) |
| `buildFootingSectionContextFromParams(params)` (refactor· entity-version delegate-άρει) | `bim/structural/section-context.ts` | params-based context (render path δεν κρατά entity) |
| `buildTieBeamReinforcePatch` (tie-beam kind-aware στο `buildFoundationReinforcePatch`) | `bim/structural/section-context.ts` | absent → νέα πρόταση **auto:true**· manual (!auto) → null· auto → re-derive + `beamReinforcementMateriallyDiffers` convergence guard (anti-oscillation). pad/strip αμετάβλητα (σχεδιασμός ADR-464) |
| `resolveActiveFootingReinforcementForParams` → **auto-aware** για tie-beam (store-coupled, fast-path passthrough για pad/strip & non-auto) | `bim/structural/active-footing-reinforcement.ts` | οι ΥΠΑΡΧΟΝΤΕΣ 2Δ (`drawFootingRebar2D`) + 3Δ (`buildFootingRebarCage`) renderers + panel διαβάζουν αυτό → **ζωντανό re-study σε resize, μηδέν αλλαγή renderer** |
| `effectiveReinforcement` → active resolver· manual edit → `auto:false` (lock) | `ui/ribbon/hooks/bridge/foundation-structural-bridge.ts` | ο πίνακας δείχνει live auto· χειροκίνητη επεξεργασία κλειδώνει την υπέρβαση (parity κολόνας) |

**Trigger plumbing προϋπήρχε:** `useProactiveOrganismReinforce` ήδη ακούει `bim:foundation-params-updated` → `runOrganismAutoReinforce` → `buildReinforcePatch`· το μόνο που έλειπε ήταν το tie-beam re-derive μέσα στο patch builder.

### Slice 2 — Ενοποίηση render (no-duplicates) [ΠΡΟΔΙΑΓΡΑΦΗ]

Αντικατάσταση των `drawTieBeam` (`footing-rebar-2d.ts`) / `buildTieBeamCage` (`footing-rebar-3d.ts`) με delegation στο beam pipeline μέσω ΕΝΟΣ adapter `TieBeamParams → Pick<BeamEntity,'params'|'geometry'>` (width=`width`, depth=`thicknessMm`, axis=`start`/`end`, `geometry.length`=span). Κέρδος: EC8 κρίσιμες ζώνες συνδετήρων (lcr≈h), layered bars, διαγραφή διπλότυπου κώδικα. PDF: `footing-detail-sheet.ts` για `kind==='tie-beam'` → delegate στους `beam-detail-*` builders. Reuse: `resolveBeamRebarLayout`, `drawBeamRebar2D`, `buildBeamRebarCage`, `samplePolylineFrame`, `REBAR_COLOR_HEX/INT`.

### Slice 3 — EC8 σεισμική αξονική δύναμη σύνδεσης [ΠΡΟΔΙΑΓΡΑΦΗ]

EC8 §5.4.1.2(7): οι συνδετήριες δοκοί σχεδιάζονται για αξονική δύναμη `N_tie = ±0.3·a_g·S·N_Ed,mean` (ground B-E) από τα συνδεόμενα υποστυλώματα. Νέο `bim/structural/loads/tie-beam-tie-force.ts` (scene-level: εύρεση συνδεόμενων columns στα άκρα → N_Ed,mean) → αποθήκευση στα params (όπως column `appliedLoad`) → `buildFootingSectionContextFromParams` περνά `designAxialTieKn` → suggester `As,tie = N_tie/f_yd`, `max(min-detailing, tie-force)`. Σεισμικά settings (a_g·S) building-level στο `StructuralSettings`. Readout `N_tie`/`As,req` στην καρτέλα Ιδιότητες.

---

## 3. Consequences

- ✅ Οι νέες συνδετήριες δοκοί (auto:true) ξανα-μελετώνται **ζωντανά** σε κάθε resize (2Δ+3Δ+panel), parity κολόνας/δοκού — το headline ζητούμενο.
- ✅ Ο ρ-check διαβάζει πλέον ACTIVE design ομοιόμορφα (facade).
- ✅ Μηδέν regression σε pad/strip (passthrough/idempotent αμετάβλητα — 63/63 structural jest GREEN).
- ⚠️ Υπάρχουσες tie-beams στη ΒΔ (χωρίς `auto` flag) μένουν manual/locked — δεν αλλάζουν αυτόματα (Revit-grade: σεβασμός υπάρχοντος design)· νέο «Αυτόματος Οπλισμός» τις κάνει auto.
- ⚠️ Slices 2-3 εκκρεμούν: το render παραμένει προσωρινά στους υπάρχοντες footing renderers (λειτουργικό, αλλά χωρίς EC8 ζώνες / χωρίς de-dup / χωρίς σεισμική δύναμη).

**Google-level: ✅ Slice 1 — YES** (proactive render-time re-derive, idempotent convergence guard, manual lock, SSoT facade, zero-React pure core + store-coupled wrapper, 7 νέα + 63 συνολικά jest GREEN).

---

## 4. Changelog

- **2026-06-18 (Opus)** — Slice 1 DONE (UNCOMMITTED). `section-context.ts` (+`resolveActiveTieBeamReinforcement`, +facade tie-beam branch, +`buildFootingSectionContextFromParams`, +`buildTieBeamReinforcePatch`), `active-footing-reinforcement.ts` (auto-aware), `foundation-structural-bridge.ts` (active effective + manual lock). Test `active-tie-beam-reinforcement.test.ts` (7/7). Shared tree ADR-476 (slab agent ταυτόχρονα) → ο αριθμός μετακινήθηκε 476→477.
