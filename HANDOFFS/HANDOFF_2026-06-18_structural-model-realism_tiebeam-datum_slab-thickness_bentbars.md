# HANDOFF — Structural Model Realism (Revit-grade): Tie-Beam Datum → Auto Slab Thickness → Bent-up «Ζ» Bars

**Ημερομηνία:** 2026-06-18 (Opus) · **Αφορμή:** Giorgio review μετά το ADR-476 S5 — εντόπισε **3 πραγματικά όρια του δομικού μοντέλου** (όχι του φύλλου σχεδίου). · **Status εισόδου:** ADR-476 (Slab Reinforcement) **ΟΛΟΚΛΗΡΩΘΗΚΕ** Slices 0-5, UNCOMMITTED.

> ⚠️ **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree μοιράζεται με άλλον agent** → `git add` ΜΟΝΟ τα δικά σου αρχεία, **ΠΟΤΕ** `git add -A`.
> 🎯 Εντολή Giorgio (αυτολεξεί): **«όπως το κάνουν οι μεγάλοι παίχτες όπως η Revit. Υλοποίηση με σύστημα FULL ENTERPRISE + FULL SSOT.»**
> 🧱 **GOL + SSOT**: 40-line functions, 500-line files, μηδέν `any`/`as any`/`@ts-ignore`/inline-styles, i18n keys ΠΡΩΤΑ (N.11), **Plan Mode πρώτα** (N.8), δήλωσε μοντέλο πριν κωδικοποιήσεις (N.14).
> 🔧 **N.17**: ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος πριν ξεκινήσεις (ο άλλος agent δουλεύει ταυτόχρονα).
> 🐞 Υπάρχουν **4 προϋπάρχοντα tsc errors σε beam αρχεία** (`beam-command-keys.ts` broken import· `beam-structural-bridge.ts` `concreteGrade` ×2· `beam-structural-param.ts` `BeamSectionContext` export) — **WIP άλλου agent (ADR-471), ΟΧΙ δικά σου. ΜΗΝ τα αγγίξεις.** Είναι ο μόνος «θόρυβος» στο tsc.

---

## 0. Πρώτα: το προηγούμενο (ADR-476 S5) — ΜΗΝ το ξαναγγίξεις

Ο **οπλισμός πλακών** ολοκληρώθηκε end-to-end (data + auto re-study + 2Δ + 3Δ + Properties panel + ribbon + **PDF detail sheet**). UNCOMMITTED, tsc-clean (δικά μας), 9+8 jest GREEN. 🔴 Μένει: browser-verify + commit (ο Giorgio).
**Κρίσιμο:** το φύλλο σχεδίου είναι **πιστό** — ζωγραφίζει ΑΚΡΙΒΩΣ ό,τι παράγει το μοντέλο (ίδιο SSoT: `resolveActiveSlabReinforcementForEntity` / `computeSlabFoundationReinforcementQuantities` / `buildSlabRebarCage`). **Όταν βελτιωθεί το μοντέλο (αυτό το handoff), το PDF θα τα δείξει αυτόματα — μηδέν αλλαγή στο φύλλο.**

---

## 1. Τι ζητάει ο Giorgio — 3 model gaps (εγκεκριμένα, με σειρά)

Όλα είναι **όρια του μοντέλου**, Revit-grade αναβάθμιση. Σειρά υλοποίησης (δική μου σύσταση, εγκεκριμένη):

| Σειρά | Gap | Μέγεθος | Γιατί εδώ |
|---|---|---|---|
| **1ο (Β)** | Στάθμη συνδετήριας δοκού **datum-derived** | Μικρό/στοχευμένο | Το είδε live, χαμηλό ρίσκο, ανεξάρτητο. Ξεκινά read-only (διερεύνηση σκηνής). |
| **2ο (Α)** | **Auto πάχος πλάκας** (serviceability) | Μεσαίο | Θεμελιώδες· infra ADR-475 υπάρχει. **Πριν** το Γ (ο οπλισμός εξαρτάται από `d = πάχος − cover`). |
| **3ο (Γ)** | **Κεκαμμένες «Ζ»/bent-up + curtailment** | Μεγάλο (νέο ADR) | Νέα τοπολογία οπλισμού (suggester+2Δ+3Δ+PDF). Τελευταίο. |

(Καταγεγραμμένα στο `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` → block «🟡 STRUCTURAL MODEL GAPS».)

**Ξεκίνα από το (Β). Κάθε gap = δικό του ADR + plan + go-ahead από τον Giorgio πριν κωδικοποιήσεις.**

---

## 2. 🟢 ΤΑΣΚ (Β) — Tie-Beam elevation datum-derived  ← ΞΕΚΙΝΑ ΕΔΩ

### Πρόβλημα (παρατήρηση Giorgio)
Οι **συνδετήριες δοκοί** εμφανίζονται «στη στάθμη του ισογείου» αντί της **στάθμης θεμελίωσης**.

### Τι βρήκα ήδη στον κώδικα (επαληθευμένο — μην ξανα-ψάχνεις)
- `bim/types/foundation-types.ts`:
  - `DEFAULT_FOUNDATION_TOP_ELEVATION_MM = -1000` (γρ.265) — footings (pad/strip).
  - `DEFAULT_TIE_BEAM_TOP_ELEVATION_MM = -500` (γρ.273) — **hardcoded** για tie-beam.
  - `defaultFoundationTopElevationMm(kind)` (γρ.344) → `kind==='tie-beam' ? -500 : -1000`.
- `bim/foundations/foundation-level.ts` → **SSoT στάθμης θεμελίωσης** `sceneFoundationTopMm(entities)` = `min` του `topElevationMm` των **φερόντων** footings (pad/strip)· **εξαιρεί ρητά** τις tie-beam («κάθονται ψηλότερα, EC8»). Καταναλωτές: εδαφόπλακα (`slab-grid-commit`), κολώνες (`column-from-grid`).
- `bim/foundations/tie-beam-grid-commit.ts` — η δημιουργία tie-beam από κάναβο.
- `hooks/drawing/foundation-completion.ts` — freehand completion (line-based kinds strip/tie-beam).

### Διάγνωση (honest)
Η **πρόθεση** του κώδικα είναι foundation-zone (`-500` < `0` = κάτω από το ισόγειο). **Πιθανός ένοχος:** το `-500` είναι **σταθερό default**, **ΟΧΙ datum-derived** από τα πραγματικά footings. Αν τα πέδιλα είναι στο `-1500`, η συνδετήρια μένει `-500` → χάσμα 1m → φαίνεται «ψηλά». EC8 §5.4.1.2: η συνδετήρια συνδέει τις **κεφαλές των πεδίλων** (στη/κοντά στη στάθμη θεμελίωσης).

### 🚦 ΒΗΜΑ 1 — ΔΙΕΡΕΥΝΗΣΗ (read-only, ΠΡΙΝ κώδικα)
1. Διάβασε `tie-beam-grid-commit.ts` + `foundation-completion.ts` → εντόπισε **πού ορίζεται το `topElevationMm`** της tie-beam (πιθανότατα `defaultFoundationTopElevationMm('tie-beam')` = -500).
2. Διάβασε πώς γίνεται το **storey/level-assignment** των foundation entities (μήπως μπαίνουν στον όροφο «ισόγειο» αντί σε «θεμελίωση»; δες `systems/levels` + foundation level resolution).
3. **Ρώτησε τον Giorgio** να περιγράψει/δείξει τη συγκεκριμένη σκηνή (πόσα footings, σε ποια στάθμη, πού φαίνονται οι tie-beams) — repro πριν fix (feedback: confirm-repro-before-reimplementing).

### ΒΗΜΑ 2 — FIX (Revit-grade, full SSoT) — αφού επιβεβαιωθεί η αιτία
- **Datum-derive:** η tie-beam top πρέπει να προκύπτει από τη **στάθμη θεμελίωσης** (reuse/επέκταση `sceneFoundationTopMm` — π.χ. νέα `sceneTieBeamTopMm` = footing top + offset, ή απευθείας από τα footings που συνδέει), **ΟΧΙ** hardcoded `-500`. Κράτα fallback default όταν δεν υπάρχουν footings.
- **SSoT:** ΕΝΑΣ resolver στάθμης tie-beam (μην σκορπίσεις τη λογική σε commit + completion + grips). Reuse το υπάρχον `foundation-level.ts` module.
- **Heal υπαρχόντων:** σκέψου migration/heal για ήδη δημιουργημένες tie-beams με stale `-500` (ίδιο pattern με προηγούμενα heal migrations — δες MEMORY `reference_bim_persistence_scope_ssot`).
- **ADR:** ενημέρωσε το σχετικό foundation ADR (πιθανότατα **ADR-441** grid hosting / foundation, ή το tie-beam ADR) + changelog. Δες `adr-index.md`.

### Verification (browser)
Footings στο -1500 → tie-beam ακολουθεί στη σωστή στάθμη θεμελίωσης (όχι -500/ισόγειο)· 3Δ + 2Δ + section consistent· εδαφόπλακα/κολώνες αμετάβλητες.

---

## 3. 🟡 ΤΑΣΚ (Α) — Auto πάχος πλάκας (serviceability-driven) — 2ο

### Πρόβλημα
Πάχος πλάκας **σταθερό** ανεξαρτήτως ανοίγματος (10×10 == 2×2 → ίδιο πάχος). Μη Revit-grade.

### Τι υπάρχει ήδη (reuse, full SSoT)
- **ADR-475 Auto Member Sizing** = ο ακριβής δίδυμος για **δοκάρια**:
  - `bim/structural/sizing/member-sizing.ts` → `suggestBeamSection` (pure core, depth-only v1).
  - `bim/structural/sizing/beam-size-patch.ts` → patch builder (σπάει τον κύκλο).
  - `structural-code-types.ts` → provider method `beamSpanDepthLimit(ctx)` (serviceability L/d).
  - `useProactiveMemberSizing.ts` → ακούει `loads-computed`, mount ΠΡΙΝ reinforce.
  - `autoSized` lock pattern (χειροκίνητο depth/width → κλειδώνει)· validator d-based.
  - eurocode/greek-legacy providers υλοποιούν το όριο.

### Σχέδιο (mirror ADR-475 για slab — full SSoT, μηδέν duplicate)
- Νέο provider method `slabThicknessLimit(ctx)` (EC2 §7.4.2 Table 7.4N: basic L/d ~20 αμφιέρειστη / 26 ακραίο συνεχές / 30 εσωτερικό / 8 πρόβολος· slab factor· modified by ρ + steel stress). Eurocode + greek-legacy.
- Επέκταση `member-sizing.ts` (ή `slab-size-patch.ts`) → `suggestSlabThickness(ctx)` reuse helpers.
- `autoSized` flag στο `SlabParams` (mirror beam· χειροκίνητο πάχος → lock).
- Proactive: `useProactiveMemberSizing` (ή slab variant) ακούει `bim:slab-params-updated` + `loads-computed` → re-derive πάχος **ΠΡΙΝ** τον οπλισμό (ο οπλισμός εξαρτάται από `d`).
- Validator: belt-and-suspenders (πάχος < όριο → code violation badge).
- **ADR:** επέκτεινε **ADR-475** (slab slice) + adr-index.

### Verification
Πλάκα 10m άνοιγμα → πάχος αυτο-μεγαλώνει (~300-350mm)· 2m → ~120-150mm· χειροκίνητο πάχος → lock· ο οπλισμός ακολουθεί το νέο `d`.

---

## 4. 🔴 ΤΑΣΚ (Γ) — Κεκαμμένες «Ζ»/bent-up bars + curtailment — 3ο (μεγάλο, νέο ADR)

### Πρόβλημα
Σήμερα **μόνο** ευθύγραμμη ορθογώνια δι-διευθυντική σχάρα, **σταθερό βήμα**, χωριστή κάτω+άνω. Καμία:
- **Κεκαμμένη/ανατομή «Ζ» (bent-up/cranked)**: κάτω ράβδος ανεβαίνει λοξά πάνω από τη στήριξη → άνω οπλισμός (κλασική ελληνική ΕΚΩΣ + EC2 detailing).
- **Curtailment** (διακοπή ράβδων όπου δεν χρειάζονται· shift rule `al` EC2 §9.2.1.3).
- **Πύκνωση στη στήριξη** / edge & corner reinforcement (two-way, EC2 §9.3.1).

> Σημείωση Revit-grade: η σύγχρονη πρακτική (straight loose bars / δομικό πλέγμα) **που ήδη κάνουμε ΕΙΝΑΙ valid** — το Revit/Tekla το λεπτομερειάζουν έτσι. Το (Γ) προσθέτει τη **δεύτερη σχολή** (bent-up/curtailment) ως επιλογή, δεν αντικαθιστά.

### Σχέδιο (high-level — θέλει δικό του ADR + planning)
- **Νέο μοντέλο γεωμετρίας ράβδου** που υποστηρίζει **polyline paths** (όχι μόνο straight rods) — bent-up segments, curtailment lengths.
- Suggester: επιλογή τοπολογίας (straight-mesh | bent-up) + curtailment positions (από moment envelope / EC2 detailing rules).
- Render: `slab-rebar-2d` (κάτοψη bent marks) + `slab-rebar-3d` (polyline cage· reuse `polyline-frame.ts` του ADR-471 αν ταιριάζει) + `slab-detail-plan/section` (PDF).
- **Νέο ADR** (επόμενο free number — δες `adr-index.md`, ήταν ADR-477 το τελευταίο· επιβεβαίωσε).

---

## 5. SSoT αρχεία-κλειδιά (reuse, μηδέν duplicate)
- Foundation datum: `bim/foundations/foundation-level.ts` (`sceneFoundationTopMm`).
- Foundation defaults: `bim/types/foundation-types.ts` (`defaultFoundationTopElevationMm`).
- Auto sizing infra: `bim/structural/sizing/{member-sizing,beam-size-patch}.ts` + `structural-code-types.ts` (provider) + `useProactiveMemberSizing.ts`.
- Slab structural SSoT: `bim/structural/section-context.ts` (`buildSlabFoundationSectionContext`, `resolveSlabReinforcementKind`), `reinforcement/suggest-reinforcement.ts` (kind-aware suggester), `active-reinforcement.ts`.
- Slab render: `bim/renderers/slab-rebar-2d.ts`, `bim-3d/converters/slab-rebar-3d.ts` (`buildSlabRebarCage`).
- Slab detail (πιστό στο μοντέλο — auto-follows): `bim/structural/detail-sheet/slab-detail-*`.

## 6. Υποχρεώσεις τέλους ανά task (N.0.1 / N.15)
Στο ίδιο πακέτο (ΟΧΙ commit — ο Giorgio): σχετικό **ADR** (changelog + status) + **adr-index** (status) + **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`** (διέγραψε/ενημέρωσε το αντίστοιχο gap στο block «STRUCTURAL MODEL GAPS») + **MEMORY** (topic file + index pointer). `git add` ΜΟΝΟ δικά σου. Αν αγγίξεις canvas-critical (slab-rebar-2d/3d, DxfRenderer) → **stage ADR-040** (CHECK 6B/6D).

## 7. Εκτίμηση
(Β) ~3-6 αρχεία, 1 domain (foundation) + investigation. (Α) ~10-12 αρχεία, 1-2 domains (sizing+slab). (Γ) ~15+ αρχεία, 2+ domains (νέα τοπολογία) → orchestrator-scale, ASK πρώτα (N.8).
