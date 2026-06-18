# ADR-492 — Associative beam re-frame όταν μετακινείται η κολώνα (το άκρο ξανα-κόβεται στην παρειά)

**Status:** ✅ Implemented (UNCOMMITTED 2026-06-18) — browser-verify pending
**Date:** 2026-06-18
**Σχετικά:** ADR-441 (frame-into trim SSoT — `columnSupportAlong`) · ADR-458 (beam-column cutback — DERIVED display, complementary) · ADR-363 §1E (`useWallRetrimEffect` — το πατέρν on-move) · ADR-467/471/472/481 (αναλυτικό μήκος μέλους — γιατί stored re-frame, όχι display-only) · ADR-040 (debounced low-freq)

---

## 1. Πρόβλημα (στιγμιότυπο-απόδειξη `Στιγμιότυπο οθόνης 2026-06-18 212609.jpg`)

2 κολώνες με πέδιλα, ένα δοκάρι που τις ενώνει (frame-into, clear span). Ο χρήστης μετακινεί **μεμονωμένα** τη δεξιά κολώνα προς τα αριστερά → το δοκάρι **περνά ΜΕΣΑ από την κολώνα και προεξέχει από τη δεξιά της παρειά** (stub).

**Root cause (από τον κώδικα):** το stored `BeamParams.endPoint` **δεν ακολουθεί** την κολώνα όταν αυτή κινείται μόνη της. Το frame-into εφαρμόζεται μόνο:
- στο **placement** (`trimSegmentEndpointsToColumns` → pull-back στην παρειά), και
- **grid-coupled** (`GuideBinding.extend` — σταθερό σχετικά με τον άξονα, δουλεύει μόνο όταν ο κάναβος κινεί ΚΑΙ κολώνα ΚΑΙ άκρο μαζί).

Μεμονωμένη μετακίνηση κολώνας → το stored άκρο μένει στο **παλιό** κέντρο → το δοκάρι εκτείνεται πέρα από τη νέα θέση. Ο ADR-458 cutback αφαιρεί σωστά τον όγκο της κολώνας στο render, **αλλά αφήνει το stub** πέρα από τη μακρινή παρειά — γιατί το δοκάρι όντως εκτείνεται ως εκεί (δεν είναι bug του cutback).

## 2. Απόφαση (Revit-canonical — **stored re-frame**, επιλογή Giorgio 2026-06-18)

Το δοκάρι είναι **associatively attached** στις κολώνες που frame-into. Όταν μετακινείται μια κολώνα, το αντίστοιχο **άκρο του δοκαριού επανα-υπολογίζεται στην κοντινή παρειά** της — και το stored `startPoint`/`endPoint` ακολουθεί.

**Α (stored) ΟΧΙ Β (display-only):** το αναλυτικό μήκος μέλους πρέπει να ακολουθεί — τροφοδοτεί load-path/οπλισμό/FEM (ADR-467/471/472/481). Display-only θα έδειχνε σωστά αλλά οι στατικοί υπολογισμοί θα έβλεπαν το παλιό (μακρύ) δοκάρι.

**Idempotent — υπολογισμός από τη ΘΕΣΗ της κολώνας, ΟΧΙ από το τρέχον endpoint:** νέο άκρο = προβολή του κέντρου της κολώνας στην ευθεία του άξονα, τραβηγμένη πίσω κατά `columnSupportAlong` (μισό πλάτος κολώνας προς το άνοιγμα). Τα νέα άκρα μένουν ΠΑΝΩ στην αρχική ευθεία → η διεύθυνση `u` δεν αλλάζει → re-run δίνει το ίδιο αποτέλεσμα (δεν «μαζεύεται», επιμηκύνεται όταν η κολώνα γυρίζει). Διατηρεί την perpendicular justification (edge-beam flush) γιατί κινεί μόνο κατά μήκος του άξονα.

## 3. SSoT — μηδέν νέα face-offset/cutback math

- **Face offset** = `columnSupportAlong` (ADR-441 — το ίδιο μισό-πλάτος που χρησιμοποιεί το placement trim ΚΑΙ το graph `beamFramesColumn`). **Reuse, μηδέν διπλότυπο.**
- **Projection κέντρου κολώνας στον άξονα** (διαμήκης `along` + κάθετη `perp`) = NEW exported SSoT `projectColumnCenterOnAxis` στο `column-face-trim.ts` (δίπλα στο `columnSupportAlong`). **Boy-scout (N.0.2):** αυτή η geometry ήταν inline-θαμμένη στο private `beamFramesColumn` (framing detection)· εξήχθη ΚΑΙ καταναλώνεται από **τα δύο** (framing + reframe) → μηδέν διπλότυπη projection/collinearity math. Η συγγραμμικότητα (perp ≤ μισό πλάτος δοκαριού) είναι ίδιο κριτήριο με το `beamFramesColumn`· η διαφορά είναι μόνο ο span-clamp (βλ. κάτω).
- **Persistence** = το υπάρχον `bim:entities-moved` → `useBimEntityMovedPersistEffect` (carries entities). **Μηδέν νέα persistence.**
- **Cutback (ADR-458)** = παραμένει DERIVED, complementary: μετά το re-frame το άκρο κάθεται στην παρειά → μηδέν stub να κόψει· σε ενδιάμεσες θέσεις ο cutback καθαρίζει την επικάλυψη όπως πάντα.

**Γιατί ΟΧΙ `findColumnsFramedByBeamForGraph` για τη συσχέτιση:** εκείνο είναι **span-clamped** (t εντός [−support, L+support]) — σωστό για τον στατικό graph, αλλά χάνει την κολώνα μόλις αυτή ξεφύγει **έξω** από το (ήδη κομμένο) άκρο → το δοκάρι δεν θα **επιμηκυνόταν πίσω** όταν η κολώνα γυρίζει προς τα έξω. Η συσχέτιση εδώ γίνεται **ανά άκρο** (πλησιέστερη συγγραμμική κολώνα σε κάθε άκρο), ώστε το άκρο να ακολουθεί ΚΑΙ μέσα ΚΑΙ έξω. Η perp-guard καλύπτει το «η κολώνα φεύγει πλάγια → άκρο σταματά».

## 4. Αρχιτεκτονική — cascade ΜΕΣΑ στο move command (ΟΧΙ reactive effect)

**Cascade-στην-εντολή, ακριβής ανάλογος του `cascadeHostedOpeningsForWalls`:** το
`MoveEntityCommand`/`MoveMultipleEntitiesCommand` (execute/undo/redo), **αφού** εφαρμόσει
τη μετακίνηση + τον openings cascade, καλεί `cascadeBeamReframeForColumns(movedIds, sceneManager)`
→ reframe όλων των straight δοκαριών (idempotent → αλλάζουν μόνο τα επηρεασμένα) → `updateEntities`
batch → τα reframed δοκάρια ταξιδεύουν στο **ΙΔΙΟ** `bim:entities-moved` της εντολής (persist μέσω
`useBimEntityMovedPersistEffect` + ο οργανισμός βλέπει σωστή γεωμετρία σε ΕΝΑ pass).

**⚠️ Γιατί ΟΧΙ reactive effect (κρίσιμο — η ρίζα ενός freeze):** η πρώτη υλοποίηση ήταν
`useBeamReframeEffect` (mirror wall-retrim) που άκουγε `bim:entities-moved`/`bim:column-params-updated`
και **ξανα-εξέπεμπε** `bim:entities-moved`. Αυτό το emit τροφοδοτούσε τον **engaged proactive
στατικό κύκλο** (ADR-488): organism→reinforce(ADR-491 FEM-driven)/loads/sizing→params-updated→
ο effect ξανα-fire-άρει→emit→… → **storm με βαρύ LDLᵀ solve ανά iteration → η εφαρμογή κόλλαγε μόλις
πατούσες «Ανάλυση»** (που ενεργοποιεί τον engaged solver). **Μάθημα:** ποτέ reactive effect που
re-emit-άρει geometry event μέσα σε proactive analysis cascade. Το cascade-στην-εντολή τρέχει
συγχρονισμένα, μία φορά, χωρίς νέο reactive trigger. (Undo: το column emit μένει πρώτο για το
race-guard του· τα reframed beams πάνε σε ξεχωριστό, μη-loop emit.)

## 5. Αρχεία (NEW/MOD — δικά μου)

- **NEW** `bim/beams/beam-column-reframe.ts` — pure `reframeBeamEndpointsToColumns(beam, columns)` (per-end συσχέτιση + face offset). **+ test** (10 jest).
- **NEW** `bim/beams/beam-column-reframe-cascade.ts` — `cascadeBeamReframeForColumns(movedIds, sceneManager)` (command-time orchestration, mirror `wall-opening-coordinator`). **+ test** (4 jest).
- **MOD** `core/commands/entity-commands/MoveEntityCommand.ts` — `MoveEntityCommand` + `MoveMultipleEntitiesCommand` (execute/undo/redo) καλούν τον cascade + συμπεριλαμβάνουν τα reframed beams στο `bim:entities-moved`.
- **MOD** `bim/columns/column-face-trim.ts` — NEW exported SSoT `projectColumnCenterOnAxis` (+ `AxisColumnProjection`).
- **MOD** `bim/columns/column-structural-attach-coordinator.ts` — `beamFramesColumn` καταναλώνει το νέο SSoT (boy-scout de-dup, μηδέν αλλαγή συμπεριφοράς· 22 jest GREEN).

**Αρχικά γραμμένα & αφαιρέθηκαν** (causing freeze, βλ. §4): `hooks/tools/useSpecialTools-beam-reframe.ts` (reactive effect) + το wiring του στο `useSpecialTools.ts`.

## 6. Επαλήθευση

2 κολώνες + δοκάρι (frame-into) → μετακίνησε τη δεξιά κολώνα προς τα μέσα → το **stub εξαφανίζεται**, το άκρο κάθεται στην εσωτερική παρειά. Μετακίνησε την κολώνα πίσω → το δοκάρι **επιμηκύνεται** και ακολουθεί. Μετακίνησε την κολώνα πλάγια εκτός δοκαριού → το άκρο **σταματά να ακολουθεί**. Edge beam (justified) → η perpendicular θέση διατηρείται.

## 7. DEFER

- **Curved / split** δοκάρια (μεσαίο column που χωρίζει το δοκάρι) — identity, parity με ADR-458 DEFER.
- **Undo** ως ξεχωριστό atomic βήμα μαζί με τη μετακίνηση κολώνας (τώρα: το re-frame persist-άρεται σαν entity-move· συνεπές με wall-retrim).
- Outward-follow όταν η κολώνα **τηλεμεταφέρεται** πολύ μακριά κατά μήκος του ίδιου άξονα πάνω σε άλλο δοκάρι (η ανά-άκρο πλησιέστερη συγγραμμική κολώνα είναι το πρακτικό όριο).
- **Column grip-resize** (αλλαγή πλάτους κολώνας → μετακίνηση παρειάς) δεν re-frame-άρει ακόμη — ο cascade τρέχει μόνο στα move commands. Το resize περνά από `bim:column-params-updated` (dispatcher)· μελλοντικά hook στην αντίστοιχη εντολή (ΟΧΙ reactive listener — βλ. §4 μάθημα).

## 8. Changelog

| Ημ/νία | Αλλαγή |
|--------|--------|
| 2026-06-18 | Αρχική υλοποίηση (Α stored re-frame). NEW pure `beam-column-reframe` (per-end συσχέτιση, reuse `columnSupportAlong`· idempotent· διατηρεί justification). 10 jest GREEN. |
| 2026-06-18 | **Freeze fix + αρχιτεκτονική αλλαγή:** ο αρχικός reactive `useBeamReframeEffect` έμπαινε σε βρόχο με τον engaged proactive στατικό κύκλο (storm στο «Ανάλυση»). Αντικαταστάθηκε με cascade-στην-εντολή `cascadeBeamReframeForColumns` (mirror `cascadeHostedOpeningsForWalls`, μηδέν reactive emit). + boy-scout de-dup `projectColumnCenterOnAxis` SSoT. 36 jest GREEN. UNCOMMITTED. |
