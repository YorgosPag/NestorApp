# ADR-580 — Προτεραιότητα έλξης στις λαβές της επιλεγμένης οντότητας (Selected-Grip Snap Precedence)

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED) — 🔴 browser-verify εκκρεμεί
**Date:** 2026-07-07
**Domain:** DXF Viewer / Snapping & Grips / 2D canvas
**Related:** ADR-397 (rotation pivot/grip contextual snap — το template), ADR-532 B4 (`AllGripsStore` SSoT), ADR-559 (grip-object-limit), ADR-370 (γενικό snap priority), ADR-507 (hatch grips), ADR-515/ADR-542 (snap marker visual SSoT), ADR-149 (`SNAP_ENGINE_PRIORITIES`)

---

## 1. Πρόβλημα (Giorgio 2026-07-07)

Όταν μια οντότητα είναι **επιλεγμένη** και εμφανίζονται οι λαβές της (π.χ. γραμμοσκίαση με πολλές κορυφές περιγράμματος), κάνοντας **hover σε μια λαβή για να την πιάσεις**, η **έλξη (snap) των υποκείμενων DXF οντοτήτων** (τόξα/γραμμές/πολυγραμμές πάνω στις οποίες είχε σχεδιαστεί η γραμμοσκίαση) **υπερίσχυε** έναντι της λαβής της επιλεγμένης — και στην **εμφάνιση του marker** και στην **έλξη του κέρσορα**. Αποτέλεσμα: η λαβή ήταν δύσκολο να «κουμπωθεί».

**Ρίζα (ίχνευση όλου του hover pipeline `mouse-handler-move → findSnapPoint → SnapOrchestrator → SnapCandidateProcessor`):** οι κορυφές της επιλεγμένης οντότητας παράγονταν ως **απλές `ENDPOINT`** έλξεις (μέσω `GeometricCalculations`), **ίδιας προτεραιότητας** με τα endpoints των υποκείμενων. Ο `SnapCandidateProcessor` ταξινομεί κατά **(priority, μετά distance)**· με ίδια priority αποφασίζει η απόσταση → σε σύμπτωση σημείων νικούσε **αυθαίρετα** η υποκείμενη. Καμία έννοια «η επιλεγμένη οντότητα προηγείται».

## 2. Απόφαση

Γενίκευση του **υπάρχοντος** contextual-grip-snap pattern του ADR-397 (`ROTATION_GRIP`: οι λαβές της περιστρεφόμενης οντότητας γίνονται snap candidates υψηλής προτεραιότητας κατά την περιστροφή) → για **ΚΑΘΕ επιλεγμένη οντότητα** (Revit-grade· λύνει το ίδιο σε πολυγραμμές/slab/κ.λπ., όχι μόνο hatch — εντολή Giorgio).

**Νέος snap type `SELECTED_GRIP` + `SelectedGripSnapEngine`** που:
- Διαβάζει τις λαβές της επιλογής από το **υπάρχον** `systems/grip/AllGripsStore` (event-time singleton, ADR-532 B4· τροφοδοτείται από το `GripRegistryPublisher` leaf) — **μηδέν νέο store**. Κενή επιλογή → κενό store → μηδέν candidates, μηδέν κόστος.
- Τις εκπέμπει με προτεραιότητα **`SNAP_ENGINE_PRIORITIES.SELECTED_GRIP = -3`** — ισχυρότερη από κάθε στατική υποκείμενη έλξη (`ENDPOINT` 0, `NODE` 1, `BIM_CORNER` -2). Επειδή ο processor ταξινομεί **priority-first**, στη σύμπτωση **νικά πάντα** η λαβή της επιλεγμένης (marker + έλξη). Κάτω από το `ROTATION_PIVOT` (-2.5) — η περιστροφή είναι διακριτό contextual op.
- Τρέχει **ΠΡΩΤΟ** στη `priority` λίστα του orchestrator ώστε τα candidates να μαζεύονται πριν γεμίσει το `maxCandidates` (8) budget (no starvation).
- **Εξαιρεί** τις λαβές της οντότητας που **σέρνεται** (baked `GripDragStore.getActiveDragGrip().entityId` + `context.excludeEntityId`) → κατά το drag η κορυφή κουμπώνει σε **ΑΛΛΗ** γεωμετρία (για να διορθωθεί το περίγραμμα), **ποτέ** self-snap πίσω στις δικές της λαβές.

**Always-on (μηδέν toolbar button, μηδέν per-mode persistence):** force-enabled στο `SnapContext.enabledModes` μαζί με τον global OSNAP toggle — ακριβώς όπως `ROTATION_GRIP`/`BIM_*` (ADR-397/370). Ένα stored blob δεν μπορεί ποτέ να το απενεργοποιήσει (δεν ζει στο `ALL_MODES`). Ισχύει μόνο όταν OSNAP ενεργό — που είναι και η μόνη στιγμή που υπάρχει «ανταγωνισμός έλξης».

## 3. Υλοποίηση (αρχεία)

| Αρχείο | Αλλαγή |
|---|---|
| `snapping/engines/SelectedGripSnapEngine.ts` | **ΝΕΟ** engine (mirror `RotationGripSnapEngine`· πηγή `AllGripsStore`· exclude active-drag entity) |
| `snapping/extended-types.ts` | +`SELECTED_GRIP` enum· +`enabledTypes`· **+ΠΡΩΤΟ** στη `priority`· +`perModePxTolerance` 12 (ευρύτερο grab) |
| `config/tolerance-config.ts` | +`SNAP_ENGINE_PRIORITIES.SELECTED_GRIP = -3` |
| `snapping/orchestrator/SnapEngineRegistry.ts` | register `new SelectedGripSnapEngine()` |
| `snapping/context/SnapContext.tsx` | force-add `SELECTED_GRIP` στο `enabledModes` (always-on με OSNAP, mirror rotation) |
| `rendering/ui/snap/snap-visual-config.ts` | `SNAP_COLORS[SELECTED_GRIP] = NODE` (exhaustive record) |
| `canvas-v2/overlays/SnapIndicatorGlyph.tsx` | `case 'selected_grip'` → ■ τετράγωνο + κεντρική κουκκίδα (grip glyph, διακριτό από απλό endpoint) |
| `snapping/engines/__tests__/SelectedGripSnapEngine.test.ts` | **ΝΕΟ** — 6 tests |

**i18n:** δεν χρειάστηκε key — το 2D overlay label περνά από `resolveBimSnapLabelText` (null για non-BIM → glyph χωρίς κείμενο), ίδιο pattern με `ROTATION_GRIP`/`ROTATION_PIVOT`. Καμία static `t()` reference → μηδέν CHECK 3.8 impact.

## 4. Έλεγχος

`snapping/engines/__tests__/SelectedGripSnapEngine.test.ts` — 6 jest: κενό store→μηδέν candidates· candidates εντός radius (τύπος+priority+entityId)· cap 8· σεβασμός `excludeEntityId`· εξαίρεση active-drag entity (no self-snap)· **precedence** (SELECTED_GRIP νικά coincident ENDPOINT ακόμη κι όταν το endpoint είναι ΠΙΟ ΚΟΝΤΑ, μέσω `SnapCandidateProcessor`). **201/201 GREEN** σε όλο το `snapping` suite (μηδέν regression).

## 5. Συνέπειες

- ✅ Η λαβή της επιλεγμένης οντότητας νικά πάντα στον ανταγωνισμό έλξης έναντι υποκείμενων μη-επιλεγμένων (marker + attraction) — το ακριβές αίτημα.
- ✅ Full SSoT / reuse: ΕΝΑ pattern (ADR-397 contextual grip snap), reuse `AllGripsStore` + `SNAP_ENGINE_PRIORITIES` + όλη η snap-visual αλυσίδα· **μηδέν νέο store**, μηδέν αλλαγή στο grip render ή στο ADR-559 limit.
- ✅ Zero-cost όταν δεν υπάρχει επιλογή (κενό store)· always-on με OSNAP· μηδέν self-snap κατά το drag.
- ⚠️ Type-safety: `@swc/jest` δεν κάνει type-check (N.17)· ο exhaustive `SNAP_COLORS` record + οι projections επαληθεύτηκαν με 201 GREEN. Final type-check: Giorgio / pre-commit.
- 🔴 Εκκρεμεί browser-verify (επιλογή γραμμοσκίασης με υποκείμενα τόξα/γραμμές → hover λαβής → κουμπώνει η λαβή της γραμμοσκίασης, όχι το υποκείμενο).

## Changelog

- **2026-07-07** — Αρχική υλοποίηση: `SELECTED_GRIP` snap type + `SelectedGripSnapEngine` (πηγή `AllGripsStore`, priority -3, exclude active-drag) + registry + always-on στο `SnapContext` + snap-visual (χρώμα NODE + ■·κουκκίδα glyph) + 6 jest (201/201 GREEN). UNCOMMITTED. 🔴 browser-verify εκκρεμεί.
