# ADR-477 — Foundation Tie-Beam Reinforcement: live auto re-study + ενοποίηση render (Revit-grade)

**Status:** 🟡 PARTIAL — **Slice 1 (live auto re-study) COMMITTED (9fef2a8b)**· **Slice 2 (ενοποίηση render, no-dup + EC8 ζώνες) DONE 2026-06-18 (Opus), UNCOMMITTED & jest-verified (adapter parity + EC8)**. Slice 3 (EC8 δύναμη σύνδεσης) ΠΡΟΔΙΑΓΕΓΡΑΜΜΕΝΟ — επόμενο. 🔴 tsc(Giorgio full) + browser-verify + commit. DEFER (Slice 2b): πλήρης longitudinal-elevation delegation στο PDF (απαιτεί beam-style labels στον host).
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

### Slice 2 — Ενοποίηση render (no-duplicates) [✅ DONE]

**Αρχιτεκτονική: SSoT core-extraction** (όχι fake-BeamEntity — θα ξανα-resolve-άρε λάθος cover· βλ. gotcha). Το beam render body εξήχθη σε καθαρά γεωμετρικό core που δέχεται **έτοιμο** `layout` + `stirrupType`· καλείται ΚΑΙ από δοκό ΚΑΙ από συνδετήρια (που περνά τον footing-resolved οπλισμό — μεγαλύτερο cover EC2 §4.4.1).

| Αλλαγή | Αρχείο | Τι κάνει |
|---|---|---|
| **NEW** `drawLinearMemberRebar2D(ctx, {axisPts, sceneUnits, layout, stirrupType}, pxPerMm, worldToScreen)` | `bim/renderers/linear-member-rebar-2d.ts` | 2Δ core (το πρώην σώμα του `drawBeamRebar2D` μετά το resolve) — path-relative projection μέσω `samplePolylineFrame` |
| **NEW** `buildLinearMemberRebarCage({axisPts, sceneUnits, layout, stirrupType, bottomFaceY})` | `bim-3d/converters/linear-member-rebar-3d.ts` | 3Δ core (πρώην σώμα `buildBeamRebarCage`)· επιστρέφει `THREE.Group` χωρίς userData (ο caller βάζει `bimType`) |
| **NEW** `tieBeamRebarLayout(p, r)` + `tieBeamAxisPoints(p)` | `bim/structural/reinforcement/tie-beam-linear-member.ts` | pure adapter: REUSE `buildFootingSectionContextFromParams` (tie-beam ctx ⊂ BeamSectionContext) + `resolveBeamRebarLayout`· justified άξονας μέσω `stripJustifiedAxis` |
| `drawBeamRebar2D` / `buildBeamRebarCage` → **thin wrappers** (resolve → core) | `beam-rebar-2d.ts` / `beam-rebar-3d.ts` | μηδέν συμπεριφορική αλλαγή στη δοκό· public signatures αμετάβλητα |
| `drawTieBeam` / `buildTieBeamCage` → **delegate στο core** (διαγραφή bespoke ομοιόμορφου βήματος) | `footing-rebar-2d.ts` / `footing-rebar-3d.ts` | tie-beam 2Δ/3Δ → **EC8 κρίσιμες ζώνες συνδετήρων + layered διαμήκεις**· 3Δ cage child στο foundation group (absolute world metres, ίδιο datum) |
| PDF plan: `pushTieBeamRebar` → συνδετήρες στις **EC8 στάθμες** (`tieBeamRebarLayout().stirrupLevelsMm`) | `detail-sheet/footing-detail-plan.ts` | η κάτοψη του PDF δείχνει πύκνωση άκρων (ίδιο SSoT)· fallback uniform μόνο σε degenerate |

**3Δ PDF capture:** το `footing-detail-3d-capture` καλεί ήδη `buildFootingRebarCage` → ο tie-beam κλωβός στο PDF κερδίζει αυτόματα τις EC8 ζώνες (μηδέν αλλαγή στο capture).

**DEFER (Slice 2b):** πλήρης longitudinal-elevation delegation στους `beam-detail-elevation/section` (αντί footing cross-section/plan) απαιτεί **beam-style labels** στον `FoundationDetailHost` (οι footing labels «Κάτοψη/Τομή» δεν ταιριάζουν σε longitudinal όψη) — καθαρό follow-up. Η τρέχουσα κατάσταση δίνει ήδη EC8 στο live 2Δ/3Δ + 3Δ PDF capture + PDF κάτοψη.

Reuse: `resolveBeamRebarLayout` (EC8 ζώνες) · `samplePolylineFrame` · `buildFootingSectionContextFromParams`/`resolveActiveFootingReinforcementForParams` (Slice 1) · `stripJustifiedAxis` · `REBAR_COLOR_HEX/INT`/`REBAR_MATERIAL` · `buildRods`.

### Slice 3 — EC8 σεισμική αξονική δύναμη σύνδεσης [ΠΡΟΔΙΑΓΡΑΦΗ]

EC8 §5.4.1.2(7): οι συνδετήριες δοκοί σχεδιάζονται για αξονική δύναμη `N_tie = ±0.3·a_g·S·N_Ed,mean` (ground B-E) από τα συνδεόμενα υποστυλώματα. Νέο `bim/structural/loads/tie-beam-tie-force.ts` (scene-level: εύρεση συνδεόμενων columns στα άκρα → N_Ed,mean) → αποθήκευση στα params (όπως column `appliedLoad`) → `buildFootingSectionContextFromParams` περνά `designAxialTieKn` → suggester `As,tie = N_tie/f_yd`, `max(min-detailing, tie-force)`. Σεισμικά settings (a_g·S) building-level στο `StructuralSettings`. Readout `N_tie`/`As,req` στην καρτέλα Ιδιότητες.

---

## 3. Consequences

- ✅ Οι νέες συνδετήριες δοκοί (auto:true) ξανα-μελετώνται **ζωντανά** σε κάθε resize (2Δ+3Δ+panel), parity κολόνας/δοκού — το headline ζητούμενο.
- ✅ Ο ρ-check διαβάζει πλέον ACTIVE design ομοιόμορφα (facade).
- ✅ Μηδέν regression σε pad/strip (passthrough/idempotent αμετάβλητα — 63/63 structural jest GREEN).
- ⚠️ Υπάρχουσες tie-beams στη ΒΔ (χωρίς `auto` flag) μένουν manual/locked — δεν αλλάζουν αυτόματα (Revit-grade: σεβασμός υπάρχοντος design)· νέο «Αυτόματος Οπλισμός» τις κάνει auto.
- ✅ **Slice 2:** το tie-beam 2Δ/3Δ τροφοδοτεί πλέον το ΙΔΙΟ beam rebar core → **EC8 κρίσιμες ζώνες συνδετήρων** + layered διαμήκεις· διαγράφηκαν τα bespoke `drawTieBeam`/`buildTieBeamCage` bodies (no-dup). 3Δ PDF capture + PDF κάτοψη επίσης EC8.
- ⚠️ **Slice 2b (DEFER):** πλήρης longitudinal-elevation στο PDF (beam-detail-elevation αντί footing plan/section) — χρειάζεται beam labels στον host.
- ⚠️ **Slice 3 εκκρεμεί:** καμία σεισμική αξονική δύναμη σύνδεσης ακόμη.

**Google-level: ✅ Slice 2 — YES** (SSoT core-extraction· μηδέν duplicate render body· cover-correct delegation [footing-resolved, ΟΧΙ beam re-resolve]· pure adapter unit-tested [parity με δοκό + EC8 densification]· public signatures αμετάβλητα).

**Google-level: ✅ Slice 1 — YES** (proactive render-time re-derive, idempotent convergence guard, manual lock, SSoT facade, zero-React pure core + store-coupled wrapper, 7 νέα + 63 συνολικά jest GREEN).

---

## 4. Changelog

- **2026-06-18 (Opus)** — **Slice 2 DONE (UNCOMMITTED)** — ενοποίηση render. SSoT core-extraction: NEW `linear-member-rebar-2d.ts` (`drawLinearMemberRebar2D`) + `linear-member-rebar-3d.ts` (`buildLinearMemberRebarCage`)· `beam-rebar-2d/3d` → thin wrappers· `footing-rebar-2d/3d` tie-beam → delegate στο core (διαγραφή bespoke `drawTieBeam`/`buildTieBeamCage` bodies)· NEW pure adapter `tie-beam-linear-member.ts` (`tieBeamRebarLayout`/`tieBeamAxisPoints`)· PDF `footing-detail-plan` tie-beam → EC8 stirrup levels. Test `tie-beam-linear-member.test.ts` (parity με δοκό + EC8 densification + justified axis). **ΠΡΟΫΠΑΡΧΟΝ (όχι Slice 2):** `footing-rebar-3d.test.ts` «failed to run» (`fetch is not defined`) λόγω store→firebase chain που μπήκε στο `active-footing-reinforcement` (Slice 1, committed 9fef2a8b)· η αλλαγή μου ΔΕΝ πρόσθεσε store import — pre-existing landmine. DEFER 2b: longitudinal-elevation στο PDF (beam labels στον host).
- **2026-06-18 (Opus)** — Slice 1 DONE (UNCOMMITTED). `section-context.ts` (+`resolveActiveTieBeamReinforcement`, +facade tie-beam branch, +`buildFootingSectionContextFromParams`, +`buildTieBeamReinforcePatch`), `active-footing-reinforcement.ts` (auto-aware), `foundation-structural-bridge.ts` (active effective + manual lock). Test `active-tie-beam-reinforcement.test.ts` (7/7). Shared tree ADR-476 (slab agent ταυτόχρονα) → ο αριθμός μετακινήθηκε 476→477.
