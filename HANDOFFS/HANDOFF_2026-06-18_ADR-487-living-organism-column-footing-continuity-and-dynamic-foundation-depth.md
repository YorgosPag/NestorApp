# HANDOFF — ADR-487 Living Structural Organism: §6.1 στατική συνέχεια κολώνα→πέδιλο + §6.2 δυναμικό βάθος θεμελίωσης

**Ημ/νία:** 2026-06-18 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλον agent (ADR-483). `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = ένας τη φορά (N.17 — έλεγξε running tsc πρώτα).

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ (north-star)
`docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — το ΟΡΑΜΑ.
Η εφαρμογή = «ο επιβλέπων στατικός πάνω από τον ώμο του αρχιτέκτονα». Σε ΚΑΘΕ κίνηση (add/connect/remove) ανα-συνθέτει τον **ενιαίο οργανισμό** + επανα-διαστασιολογεί + ελέγχει επάρκεια + ενημερώνει. **Κρίνε κάθε αλλαγή με βάση το όραμα, όχι μόνο το τοπικό task.**

---

## 1. ΤΟ TASK — τα 2 ανοιχτά κενά του ADR-487 §6 (με στιγμιότυπα-απόδειξη)

### §6.1 — Κολώνα ↔ πέδιλο ΔΕΝ «πατούν» (στατική συνέχεια)  🔴 concrete bug
Στα στιγμιότυπα (`Στιγμιότυπο 2026-06-18 193120.jpg` + `193145.jpg`) οι **κολώνες αιωρούνται** πάνω από τη θεμελίωση — ορατό κενό βάση κολώνας ↔ άνω παρειά πεδίλου, και ένα pad (καφέ) δεν είναι κάτω από καμία κολώνα.
- **Δεδομένα:** κολώνες `baseBinding: "storey-floor"` με βάση `z = 0` (ισόγειο)· πέδιλα `topElevationMm ≈ −1000` (ADR-484 Slice 4, FFL θεμελίωσης). Άρα κενό ~1 m.
- **Ζητούμενο:** η στατική συνέχεια κολώνα→πέδιλο→έδαφος να είναι **εγγυημένη από τον οργανισμό** (όχι τυχαία). Είτε η κολώνα «κατεβαίνει» στο πέδιλο, είτε το πέδιλο σηκώνεται στη βάση — **Revit-canonical**: η κολώνα εδράζεται στην άνω παρειά του πεδίλου, με στατικό κόμβο συνέχειας.

### §6.2 — Το «Βάθος θεμελίωσης» είναι ΧΕΙΡΟΚΙΝΗΤΟ (πρέπει να γίνει derived)  🟡 χρειάζεται μελέτη+απόφαση
Στιγμιότυπο `193256.jpg` (κυκλωμένο): δίαλογος «Όροφοι Κτιρίου» → «Γρήγορη ρύθμιση» → checkbox «Έχει θεμελίωση» + πεδίο **«Βάθος θεμελίωσης (μ) = 1,00»** χειροκίνητο.
- ADR-487 §6.2: η εφαρμογή ΔΕΝ ξέρει το μέγεθος/φορτία εκ των προτέρων → ΔΕΝ μπορεί να ξέρει το βάθος από την αρχή. Είναι **δυναμικό** (αλλάζει με φορτία/πέδιλα).
- **Πρόταση ADR-487 (προς μελέτη, ΟΧΙ ακόμη απόφαση):** ο μηχανικός δηλώνει ΜΟΝΟ «υπάρχει θεμελίωση» — το **βάθος παράγεται δυναμικά** (derived) από τον οργανισμό (μεγέθη/βάθη πεδίλων + συνδετήριες + εδαφόπλακα).
- ⚠️ Επειδή §6.2 = «να μελετηθεί», **ΠΡΩΤΑ κάνε plan + ρώτα τον Giorgio για έγκριση προσέγγισης** πριν αλλάξεις το dialog (feedback: Revit-grade απόφαση μόνος σου + plan approval).

**Σχέση των δύο:** το §6.1 (συνέχεια) και §6.2 (δυναμικό βάθος) είναι ο ίδιος μηχανισμός — το υψόμετρο/βάθος της θεμελίωσης πρέπει να είναι **derived** από τον οργανισμό, και η κολώνα να το ακολουθεί. Πιθανώς ΕΝΑ νέο ADR (ADR-488+) όταν αποφασιστεί η προσέγγιση.

---

## 2. 🚨 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ: ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
Εντολή Giorgio: **full enterprise + full SSoT, μηδέν διπλότυπα.** Πριν υλοποιήσεις, κάνε grep για υπάρχοντα συστήματα και **επέκτεινέ τα** — μην φτιάξεις παράλληλο. Έτοιμα anchors (ήδη audited 2026-06-18):

| Concept | Υπάρχον SSoT (extend, ΜΗΝ διπλασιάσεις) |
|---|---|
| 3Δ κατακόρυφο datum όλων των BIM solids (floor-relative + foundation absolute) | `bim-3d/converters/bim-three-structural-converters.ts` + `bim-three-shape-helpers` (δες memory `reference_bim_3d_vertical_datum_ssot`· ADR-448 Φ4c) |
| Κολώνα base binding / baseZmm | `bim/structural/organism/structural-organism-types.ts`, `structural-graph.ts`, `bim/columns/column-structural-attach-coordinator.ts` |
| Foundation top elevation από FFL ορόφου (Slice 4) | `bim/types/foundation-types.ts → resolveFoundationTopElevationMm` + `bim/foundations/foundation-level-elevation.ts → resolveActiveFoundationLevelElevationMm` |
| Auto-design πεδίλων (top elevation, μεγέθη) | `bim/foundations/auto-foundation-layout.ts`, `hooks/useAutoFoundationDesign.tsx` |
| Storey elevations / floor datum | `bim-3d/scene/floor-stack-elevation.ts`, `systems/levels/active-storey-context.ts`, `systems/levels/building-foundation-level.ts` |
| Foundation-level cross-level SSoT (target + entities + writer) | `state/foundation-level-store.ts`, `bim/foundations/foundation-cross-level-writer.ts`, `bim/foundations/foundation-write-scope.ts` (NEW· scope+writer resolver) |
| Dialog «Βάθος θεμελίωσης» (§6.2 target UI) | `ui/components/FloorManagementDialog.tsx`, `stores/FloorManagementDialogStore.ts`, `bim/structural/structural-settings.ts`, `hooks/data/useBuildingById.ts` |
| Οργανισμός / load-path / takedown / topology support | ADR-459 (`structural-graph`), ADR-467 (load-path), ADR-464 (footing takedown), ADR-486 (topology support), ADR-475 (auto sizing), ADR-471/472/476/477 (οπλισμός) — βλ. ADR-487 §8 mapping |
| Proactive re-study «σε κάθε κίνηση» | υπάρχοντα hooks `*-params-updated` / `loads-computed` / `useProactiveStructuralAnalysis` (ADR-472/475/476/480) + memory `reference_bim_entity_params_updated_event_ssot` |

**Πρόσθεσε δικό σου grep** για κάθε νέα έννοια πριν δημιουργήσεις αρχείο. Αν βρεις duplicate → κεντρικοποίησε (N.0.2).

---

## 3. ΠΡΟΗΓΟΥΜΕΝΗ ΔΟΥΛΕΙΑ — ADR-484 (DONE, UNCOMMITTED) — ΜΗΝ ΤΗΝ ΞΑΝΑΓΓΙΞΕΙΣ, ο Giorgio θα κάνει commit
ADR-484 Slice 6 (grid+tie-beam routing στον foundation level) + Slice 5 completion (render isolation) + SSoT cleanup (foundation-write-scope) — **ολοκληρωμένο, 56 jest GREEN, tsc καθαρό**. Εκκρεμεί ΜΟΝΟ: browser-verify + in-app delete 4 legacy strips + **commit (Giorgio)**.
- git add λίστα (όταν κάνει commit ο Giorgio, ΜΟΝΟ αυτά): `bim/foundations/{foundation-write-scope[NEW+test],foundation-grid-commit,tie-beam-grid-commit,foundation-level-elevation}.ts`, `core/commands/entity-commands/ReconcileCrossLevelFoundationsCommand.ts[NEW+test]`, `ui/ribbon/hooks/useRibbonFoundationBridge.ts(+test)`, `hooks/data/useFloors3DAggregator.ts(+test)`, `hooks/drawing/foundation-completion.ts`, `hooks/{useAutoFoundationDesign.tsx,useStructuralOrganismNotification.tsx}`, `hooks/canvas/useSmartDelete.ts`, `hooks/tools/useSpecialTools.ts`, ADR-484, adr-index, ΕΚΚΡΕΜΟΤΗΤΕΣ. **ΟΧΙ ADR-483** (άλλος agent).
- Λεπτομέρειες: `docs/centralized-systems/reference/adrs/ADR-484-cross-level-foundation-properties.md` (changelog Slice 1-6) + memory `reference_cross_level_selection_resolver_ssot`.

> Το §6.1 χτίζει ΠΑΝΩ στο ADR-484: τα πέδιλα ζουν πλέον σωστά στον foundation level με `topElevationMm` από FFL. Το κενό κολώνας-πεδίλου είναι το **επόμενο** βήμα συνέχειας.

---

## 4. ΕΚΤΕΛΕΣΗ (Revit-grade, full enterprise + SSoT)
1. **Διάβασε** ADR-487 (όραμα) + ADR-459/467/486/484 (πυλώνες) + memory entries (vertical datum, organism, foundation).
2. **SSoT grep audit** (§2) — βρες & επέκτεινε υπάρχοντα.
3. **Plan mode** (N.8 — cross-cutting, 2+ domains): σχεδίασε §6.1 (συνέχεια) και §6.2 (derived depth). Για §6.2 **ζήτα έγκριση προσέγγισης** (το ADR-487 το αφήνει «προς μελέτη»).
4. Υλοποίηση + jest + tsc (background, N.17). **ΜΗΝ** κάνεις commit.
5. Update ADR (νέο ADR-488+ αν χρειαστεί ή ADR-487 §8 mapping) + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY (N.15).

## 5. ❌ ΜΗΝ
- ΜΗΝ commit/push (Giorgio μόνο).
- ΜΗΝ `git add -A` (shared tree με ADR-483).
- ΜΗΝ φτιάξεις νέο vertical-datum / organism / foundation-elevation σύστημα — **extend** τα υπάρχοντα (§2).
- ΜΗΝ αλλάξεις το χειροκίνητο «Βάθος θεμελίωσης» σε derived **χωρίς plan approval** (§6.2 = προς μελέτη).
- ΜΗΝ αγγίξεις τα ADR-484 (uncommitted) / ADR-483 αρχεία.
