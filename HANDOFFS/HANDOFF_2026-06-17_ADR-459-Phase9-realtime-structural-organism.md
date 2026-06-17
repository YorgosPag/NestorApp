# HANDOFF — ADR-459 Φ9: Real-time Στατικός Οργανισμός (full proactive re-study)

**Ημ/νία:** 2026-06-17 · **Από:** Opus session (μετά το Φ8) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά στις απαντήσεις.

---

## 0. ΤΟ ΟΡΑΜΑ (επιβεβαιωμένο από Giorgio, αυτολεξεί ιδέα)

Ο μηχανικός — **συχνά αρχιτέκτονας που ΔΕΝ ξέρει στατικά** — σχεδιάζει **σταδιακά**. Η εφαρμογή είναι
ο **στατικός του βοηθός σε ΠΡΑΓΜΑΤΙΚΟ ΧΡΟΝΟ**: σε κάθε βήμα, ο στατικός φορέας που έχει σχηματιστεί
μέχρι εκείνη τη στιγμή πρέπει να είναι **πλήρης & ορθός** — έτοιμος να κατασκευαστεί.

**Σενάριο-ορόσημο (verification target):**
1. Κενός καμβάς. Σχεδιάζει **1 κολόνα** → το σύστημα **αυτόματα** δημιουργεί πέδιλο + κάνει **μίνι στατική
   μελέτη** (φορτία→τάση εδάφους→διαστασιολόγηση→οπλισμός). Αν σταματήσει εδώ, η κολόνα στέκεται για χρόνια.
2. Σχεδιάζει **2η κολόνα** σε απόσταση → 2ο πέδιλο + 2η μίνι μελέτη → **δύο απομονωμένοι οργανισμοί**,
   ο καθένας στατικά αυτάρκης.
3. **Ενώνει τις 2 κολόνες με δοκάρι** → οι δύο οργανισμοί γίνονται **ΕΝΑΣ ενιαίος στατικός φορέας**
   (2 πέδιλα + 2 κολόνες + 1 δοκάρι). Το σύστημα **ξαναϋπολογίζει ΟΛΟΚΛΗΡΟ τον οργανισμό από την αρχή**:
   φορτία → τάσεις εδάφους → διαστασιολόγηση πεδίλων → **οπλισμός όλων** (κολόνες + δοκάρι + θεμελίωση,
   **re-design** αν χρειάζεται) → **ματίσεις/αγκυρώσεις/συνδέσεις** στους κόμβους.

**Όλα ΑΥΤΟΜΑΤΑ, σε πραγματικό χρόνο, ΧΩΡΙΣ κουμπιά.** Revit-grade, **Full Enterprise + Full SSoT**.

---

## 1. 🚨 SSOT AUDIT — ΠΟΥ ΕΙΜΑΣΤΕ ΣΗΜΕΡΑ (grep done· **ξανα-επιβεβαίωσέ το**)

Ο **σκελετός υπάρχει**. Πολλά είναι ήδη proactive· λείπει το **proactive κλείσιμο** σε 3 σημεία.

| Βήμα κύκλου | Σήμερα | Πού ζει |
|---|---|---|
| Κολόνα → αυτόματο πέδιλο | ✅ **Proactive** | `hooks/useAutoFoundationDesign.tsx` (Φ7· `AUTO_DESIGN_EVENTS`→`planFoundationLayout`/`reconcileFoundationLayout`/`ApplyFoundationLayoutCommand`) |
| Οπλισμός κολόνας/πεδίλου/δοκαριού (**data**) | ✅ **Proactive** | Φ7 `useStructuralOrganismNotification.tsx` (κολόνα↔πέδιλο cross-level) + **Φ8 `useProactiveOrganismReinforce.ts`** (level-wide growth)· πυρήνας `structural-auto-reinforce-core.ts`→`AutoReinforceOrganismCommand`→`buildReinforcePatch` (SSoT `bim/structural/section-context.ts`) |
| Ματίσεις/αγκυρώσεις/συνέχεια κόμβων (dowels/lap) | ✅ **Proactive DERIVED** | `hooks/useStructuralOrganism.ts` (`ORGANISM_EVENTS`→`buildStructuralGraph`+`runReinforcementChecks`+`reinforcement-continuity.ts`· Φ4c) |
| Τάση εδάφους / sizing πεδίλου | ✅ **Proactive** (diagnostics + auto-design) | `useAutoFoundationDesign` (sizing) + `useStructuralOrganism`→`runFootingDesignChecks` (ADR-464· **αδρανές χωρίς φορτίο**) |
| **Υπολογισμός φορτίων (load path / takedown)** | ❌ **BUTTON** | `hooks/useStructuralLoadTakedown.ts` ακούει `bim:compute-loads-requested` (ribbon «Υπολογισμός Φορτίων») → `ComputeLoadPathCommand` (ADR-467· `bim/structural/loads/load-path-takedown.ts`) → emit `bim:structural-loads-computed`. **Ο πυρήνας υπάρχει ολόκληρος — λείπει ΜΟΝΟ ο proactive trigger.** |
| **Re-design ήδη-οπλισμένων όταν αλλάζει η τοπολογία** | ❌ **DEFER** | `buildReinforcePatch` επιστρέφει `null` αν `params.reinforcement` υπάρχει ήδη (idempotent) → νέο δοκάρι ΔΕΝ προκαλεί επανα-διαστασιολόγηση των υπαρχουσών κολόνων/πεδίλων. |
| **Render οπλισμού ΔΟΚΑΡΙΟΥ (2Δ/3Δ)** | ❌ **ΛΕΙΠΕΙ** | model υπάρχει (`bim/structural/reinforcement/beam-rebar-layout.ts` + `beam-reinforcement-compute` Φ4a) αλλά **κανένας renderer δεν το ζωγραφίζει** (το `beam-rebar-layout` χρησιμοποιείται ΜΟΝΟ από το test του). Κολόνα: `bim/renderers/column-rebar-2d.ts` + `bim-3d/converters/column-rebar-3d.ts`. Πέδιλο: `canvas-v2/dxf-canvas/dxf-foundation-reinforcement-overlay.ts`. **Δοκάρι: τίποτα.** Gate: διακόπτης «Προβολή→Οπλισμός» = `showReinforcement` (`ShowReinforcementToggle.tsx` + `bim-render-settings-store`). |

**Grep keywords:** `useStructuralLoadTakedown|bim:compute-loads-requested|ComputeLoadPathCommand|load-path-takedown|
bim:structural-loads-computed|useAutoFoundationDesign|useProactiveOrganismReinforce|structural-auto-reinforce-core|
useStructuralOrganism|ORGANISM_EVENTS|AUTO_DESIGN_EVENTS|buildReinforcePatch|beam-rebar-layout|column-rebar-2d|
column-rebar-3d|dxf-foundation-reinforcement-overlay|showReinforcement|drawColumnRebar2D|buildColumnRebarCage|
attachColumnRebar|beamToMesh`.

---

## 2. ΤΑ 3 ΚΟΜΜΑΤΙΑ ΠΟΥ ΛΕΙΠΟΥΝ (το scope του Φ9)

**(A) Proactive φορτία** — να τρέχει ο load-path engine **αυτόματα** σε κάθε δομική μεταβολή (mirror Φ7/Φ8):
   εξαγωγή core από `useStructuralLoadTakedown` (resolve scope + `ComputeLoadPathCommand` + emit) → NEW proactive
   hook (ή επέκταση) που ακούει geometry-growth events → coalesced microtask. **Loop guard:** να ΜΗΝ ακούει
   `bim:structural-loads-computed`. Το ribbon κουμπί παραμένει (manual re-run).
   ⚠️ **Σειρά αλυσίδας (κρίσιμο):** φορτία → (emit `loads-computed`) → auto-foundation re-sizing → οπλισμός.
   Σήμερα `bim:structural-loads-computed` ∈ `AUTO_DESIGN_EVENTS` ∈ `ORGANISM_EVENTS` → το pipeline ήδη
   αλυσιδώνεται· απλά λείπει το **proactive ΠΡΩΤΟ σκαλί** (φορτία). Πρόσεξε **infinite loop** (φορτία→organism→
   φορτία) και **microtask coalescing** ώστε ΕΝΑ recompute ανά tick.

**(B) Re-study on topology change** — όταν αλλάζει η τοπολογία (νέο δοκάρι ενώνει 2 οργανισμούς), τα
   **ήδη-οπλισμένα** μέλη να **ξανα-διαστασιολογούνται** (όχι μόνο τα νέα). Σήμερα `buildReinforcePatch`
   είναι idempotent (skip ήδη-οπλισμένα). Χρειάζεται **«stale reinforcement intent»**: ανίχνευση ότι η
   κατάσταση του οργανισμού άλλαξε (π.χ. βαθμός σύνδεσης/φορτία/συνέχεια) → invalidate + recompute οπλισμού
   των επηρεαζόμενων μελών. **Προσοχή:** μη χαλάσεις χειροκίνητες υπερβάσεις του μηχανικού (Revit: user override
   wins)· διάκρινε `auto:true` (re-derivable) από manual. Δες `column-reinforcement` `auto` flag στο
   `buildReinforcePatch` (κολόνα: `reinforcement.auto=true`).

**(C) Render οπλισμού δοκαριού (2Δ + 3Δ)** — mirror κολόνας, reuse `beam-rebar-layout.ts`:
   NEW `bim/renderers/beam-rebar-2d.ts` (mirror `column-rebar-2d`) + wire σε `dxf-renderer-structural-overlays.ts`·
   NEW `bim-3d/converters/beam-rebar-3d.ts` (`buildBeamRebarCage`, mirror `column-rebar-3d`) + wire σε
   `beamToMesh` (`attachBeamRebar`, mirror `attachColumnRebar`)· **ίδιο gate** `showReinforcement` /
   `isStructuralComponentVisible('reinforcement', beam)`. **ADR-040:** ο οπλισμός δοκαριού ΔΕΝ μπαίνει στο
   bitmap-cache key (όπως κολόνα).

---

## 3. ΚΑΤΕΥΘΥΝΣΗ (Revit-grade + Full SSoT) — προς επικύρωση σε PLAN MODE

**Αρχή (Revit):** η στατική μελέτη είναι **παράγωγο της τοπολογίας** → ξανα-τρέχει **proactively, μία φορά,
από ΕΝΑ συντονισμένο pipeline**, σε κάθε δομική μεταβολή. Η σειρά είναι **ντετερμινιστική**:
`φορτία → τάσεις/sizing πεδίλων → οπλισμός (re-design) → συνέχεια/συνδέσεις`.

- **Μηδέν διπλότυπα:** όλοι οι πυρήνες υπάρχουν (load-path, auto-foundation, auto-reinforce, organism graph).
  Η δουλειά είναι κυρίως **proactive triggers + ορθή ενορχήστρωση σειράς + re-design invalidation + 1 renderer**.
- **Coalescing + loop-guards** σε ΚΑΘΕ proactive hook (mirror Φ7/Φ8: `queueMicrotask`, δεν ακούς το δικό σου
  «-computed» event).
- **Atomic undo** (mirror Φ7/Φ8 `executeGrouped`): η ενέργεια του χρήστη + όλες οι παράγωγες (πέδιλο+φορτία+
  οπλισμός) = ΕΝΑ Ctrl+Z.
- **Πιθανή ανάγκη: ΕΝΑΣ orchestrator hook** «`useRealtimeStructuralStudy`» που σειριοποιεί τα στάδια αντί 4
  ανεξάρτητα microtasks που μπορεί να τρέχουν εκτός σειράς. **Αυτό αποφασίζεται στο Plan** (πρώτα μέτρα αν τα
  υπάρχοντα events ήδη δίνουν σωστή σειρά).

---

## 4. ΟΡΙΑ / ΠΡΟΣΟΧΗ (100% ΕΙΛΙΚΡΙΝΕΙΑ)

- Το **(B) re-design on topology change** είναι το **πιο δύσκολο & επικίνδυνο** κομμάτι (μπορεί να προκαλέσει
  ταλαντώσεις/loops αν ο οπλισμός αλλάζει φορτία που αλλάζουν οπλισμό). Σκέψου **convergence guard** /
  fixed-point με max-iterations, ή recompute μόνο όταν αλλάζει η **τοπολογία** (όχι σε κάθε φορτίο-tick).
- Τα φορτία χρειάζονται **building-level παραμέτρους** (G/Q area loads, αριθμός ορόφων) — ήδη υπάρχουν
  (`structural-settings-store`, `useBuildingStoreyCount`). Χωρίς αυτά, ο load-path δίνει 0.
- **N.8 execution mode:** 2+ domains (loads + foundation + reinforcement + rendering), 5+ αρχεία →
  **πιθανώς Orchestrator** ή τουλάχιστον **Plan Mode με slices**. **ΡΩΤΑ τον Giorgio** πριν orchestrator (~τόκενς).
- Σπάσε το σε **slices** (π.χ. S1 proactive φορτία· S2 re-study/re-design· S3 beam-rebar render) — κάθε slice
  ανεξάρτητα verifiable.

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)

- **COMMIT/PUSH = Giorgio**, ΟΧΙ ο agent. **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα) →
  `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **tsc = Giorgio** (PowerShell denied για agent). **jest** τρέχει κανονικά (`npx jest <path> --silent`).
  ⚠️ Κράτα νέα tests **light** (μην εισάγεις heavy firebase chains — π.χ. inject `provider`, όπως στο Φ8
  `structural-auto-reinforce-core`).
- **PLAN MODE / SSOT AUDIT ΠΡΩΤΑ:** πραγματικό grep (§1 keywords) → επιβεβαίωσε reuse → plan → έγκριση Giorgio →
  υλοποίηση → jest → docs (ADR-459 §Φ9 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `MEMORY.md`). Απαντάς **Ελληνικά**.
- **Full Enterprise + Full SSoT, Revit-grade.** Μηδέν `any`/`as any`/`@ts-ignore`. Μηδέν διπλότυπα — επέκτεινε
  τους υπάρχοντες πυρήνες.

---

## 6. STATE Φ8 (η αμέσως προηγούμενη δουλειά — UNCOMMITTED, ΚΑΘΑΡΟ)

ADR-459 **Φ8 (Proactive Αυτόματος Οπλισμός Οργανισμού)** = **DONE, επιβεβαιωμένο ότι δουλεύει** (console:
`reinforced 1` στη δημιουργία δοκαριού· το ribbon κουμπί μετά → «κανένα μέλος δεν χρειαζόταν» = όλα ήδη
οπλισμένα proactively). **Diagnostic logs αφαιρέθηκαν** — καθαρό για commit. Ο Giorgio θα κάνει commit.

**Αρχεία Φ8 (git add ΜΟΝΟ αυτά):** NEW `hooks/structural-auto-reinforce-core.ts` · NEW
`hooks/useProactiveOrganismReinforce.ts` · NEW `hooks/__tests__/structural-auto-reinforce-core.test.ts` (7 jest) ·
MOD `hooks/useStructuralAutoReinforce.ts` · MOD `app/DxfViewerContent.tsx` · MOD `ADR-459` doc ·
MOD `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. ⚠️ **ΜΗΝ** αγγίξεις: `useSmartDelete.ts` / `smart-delete-bim-events.ts` /
`foundation-cross-level-writer.ts` / uncommitted v8.4 (3Δ rotate→footing emit) — άλλος agent.

**ΜΑΘΗΜΑ Φ8 (ισχύει & για Φ9):** ο οπλισμός/μελέτη = **παράγωγο τοπολογίας** → proactive, μία φορά, ΕΝΑ SSoT.
Ο οπλισμός είναι **data** (`params.reinforcement`), **αόρατος** χωρίς τον διακόπτη «Προβολή→Οπλισμός» ON —
και (για δοκάρι) **χωρίς renderer δεν φαίνεται καθόλου** (κομμάτι C).

---

## 7. ΠΡΩΤΟ ΒΗΜΑ

1. Διάβασε αυτό το handoff + κάνε **SSOT audit (grep §1)** — επιβεβαίωσε τους πυρήνες (load-path button trigger,
   auto-foundation/organism proactive pattern, beam-rebar-layout χωρίς renderer).
2. **PLAN MODE** → πλάνο σε **slices** (S1 proactive φορτία · S2 re-study/re-design on topology change ·
   S3 beam-rebar render 2Δ+3Δ) → **έγκριση Giorgio** (+ ρώτα execution mode αν χρειάζεται orchestrator).
3. Υλοποίηση ανά slice → jest → docs. **ΟΧΙ commit** (ο Giorgio).
