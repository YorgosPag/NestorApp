# HANDOFF — ADR-398: Τα snap indicators (γλυφές + ετικέτες) εξαφανίζονται κατά την τοποθέτηση κολώνας

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ (με τη σειρά):**
> 1. `docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md` — **ΟΛΟ** (το feature που προκάλεσε το regression· §3.1 SSoT beam-axis projection, §3.1b/§3.2 column snap + ghost coloring).
> 2. `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — **§8.4 + §9** (φιλοσοφία: Revit-grade, ο άνθρωπος αποφασίζει).
> 3. Αυτό το handoff ΟΛΟΚΛΗΡΟ.

**Ημ/νία:** 2026-06-19 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **Μοντέλο:** Opus · **PLAN-FIRST** (plan σε sub-slices → «προχώρα» → κώδικας).
**🚨 commit + tsc = ο GIORGIO (ΟΧΙ εσύ).** jest = repo ROOT. Επαλήθευση: live browser, Firestore MCP `proj_12788b6a`.
**⚠️ SHARED TREE (μοιράζεται με άλλον agent):** `git add` **ΜΟΝΟ** τα δικά σου (λίστα §6). ΜΗΝ αγγίξεις κώδικα/ADR άλλου agent.
**🎯 ΑΠΑΙΤΗΣΗ GIORGIO:** «όπως οι μεγάλοι (Revit), FULL ENTERPRISE + FULL SSOT». **ΠΡΙΝ τον κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT (grep)**: ψάξε υπάρχοντα κώδικα ώστε να τον χρησιμοποιήσεις, μηδέν διπλότυπα.

---

## 1. ΤΟ ΣΥΜΠΤΩΜΑ (Giorgio)

Με **εργαλείο «Κολώνα» ενεργό** + **έλξεις (snaps) ON**, όταν ο cursor πλησιάζει/περνά πάνω από **δοκάρι ή κολώνα**:
- **ΔΕΝ εμφανίζονται** οι γλυφές των snaps (■ endpoint, △ midpoint, ○ center, κ.λπ.) ούτε **τα κείμενα/ετικέτες**: «Γωνία στήλης / Κέντρο στήλης / Μέσο στήλης / Γωνία δοκαριού / Μέσο δοκαριού / Κέντρο δοκαριού».
- Δηλαδή τα **χαρακτηριστικά σημεία** (corner/mid/center) των BIM μελών δεν φωτίζονται κατά την τοποθέτηση κολώνας.

## 2. ΡΙΖΑ — REGRESSION από το ADR-398 (επιβεβαιωμένη με ανάγνωση κώδικα)

Το rendering των snap γλυφών+ετικετών γίνεται από το **`SnapIndicatorOverlay`**, που τροφοδοτείται από **`getFullSnapResult()`** (ImmediateSnapStore) μέσω `useSyncExternalStore(subscribeSnapResult, getFullSnapResult)` στο `components/dxf-layout/canvas-layer-stack-leaves.tsx:99`. Η ετικέτα προκύπτει από το `description` του snap candidate (SSoT `snapping/snap-description-keys.ts` → `resolveBimSnapLabelText`).

Στο ADR-398 πρόσθεσα στο **`systems/cursor/snap-scheduler.ts`** (στη `runSnapDetection`) ένα **short-circuit** όταν το εργαλείο κολώνας είναι ενεργό και ο cursor είναι πάνω σε δοκάρι (`applyColumnPlacementContext` → `writeBeamAxisSnap` → `return`). Το `writeBeamAxisSnap`:
```ts
input.setSnapResults([{ point, type: 'nearest', entityId: beamId, distance: 0, priority: 0 }]);
setFullSnapResult(null);   // ⛔ ΕΔΩ είναι το bug: μηδενίζει το SSoT που διαβάζει το SnapIndicatorOverlay
setImmediateSnap({ found: true, point, mode: 'nearest', entityId: beamId });
```
**Αποτέλεσμα:** πάνω σε δοκάρι, το `getFullSnapResult()` γίνεται `null` → ο SnapIndicatorOverlay δεν δείχνει **τίποτα** (ούτε γλυφή ούτε ετικέτα), αντί για το πλούσιο χαρακτηριστικό snap (γωνία/μέσο/κέντρο δοκαριού). Επιπλέον το `return` παρακάμπτει εντελώς το κανονικό `findSnapPoint` (που θα παρήγαγε τα χαρακτηριστικά snaps του δοκαριού).

**Γιατί και στις κολώνες:** στο frame του Giorgio οι κολώνες κάθονται πάνω/δίπλα στα δοκάρια· όταν ο cursor είναι πάνω στο σώμα του δοκαριού, ο short-circuit νικά → χάνονται ΚΑΙ τα column χαρακτηριστικά snaps της περιοχής. (Πάνω σε υπάρχουσα κολώνα η τρέχουσα precedence `overlap > beam` επιστρέφει `overlap` → `return false` → το κανονικό snap τρέχει· αλλά πάνω στο **κενό** δοκάρι ανάμεσα στις κολώνες ο short-circuit κρύβει τα πάντα.)

## 3. ΓΙΑΤΙ Ο SHORT-CIRCUIT ΕΙΝΑΙ ΠΕΡΙΤΤΟΣ (SSoT — η σωστή κατεύθυνση)

Στο **ίδιο** ADR-398 έγινε ήδη το σωστό SSoT βήμα: **τα δοκάρια μπήκαν στο `NearestSnapEngine`** (NEW `bim/beams/beam-axis-projection.ts` `projectPointOnBeamAxis`, + `isBeamEntity` branch, + description `bim-beam` → `snapModes.labels.bim.beamAxis`). Άρα το **`findSnapPoint` (global snap engine) ΗΔΗ επιστρέφει** beam-axis snap **με σωστή ετικέτα**, και το `BimCharacteristicSnapEngine` ΗΔΗ παράγει corner/mid/center για **όλα** τα BIM μέλη (κολώνα ΚΑΙ δοκάρι — `bim/utils/bim-characteristic-points.ts`).

**Συνέπεια:** δεν χρειάζεται καθόλου παράλληλη ανίχνευση beam στον scheduler που μηδενίζει το `fullSnapResult`. Το column tool πρέπει να **ΚΑΤΑΝΑΛΩΝΕΙ** το αποτέλεσμα του ενιαίου snap pipeline (ΕΝΑ SSoT), όχι να το αντικαθιστά.

## 4. 🔍 SSOT AUDIT (ΞΑΝΑ-grep πριν τον κώδικα — υποχρεωτικό)

| Concern | SSoT (reuse) | Πού |
|---|---|---|
| Snap result store (γλυφή+ετικέτα) | `getFullSnapResult`/`setFullSnapResult` + `setSnapResults` | `systems/cursor/ImmediateSnapStore.ts` |
| Snap indicator render | `SnapIndicatorOverlay` (διαβάζει fullSnapResult) | `canvas-v2/overlays/SnapIndicatorOverlay.tsx` · leaf `canvas-layer-stack-leaves.tsx:99` |
| Ετικέτα από description | `resolveBimSnapLabelText` / `BIM_SNAP_DESCRIPTION_KEY` | `snapping/snap-description-keys.ts` |
| Χαρακτηριστικά σημεία (corner/mid/center) | `BimCharacteristicSnapEngine` + `bim-characteristic-points` | `snapping/engines/BimCharacteristicSnapEngine.ts` · `bim/utils/bim-characteristic-points.ts` |
| Beam axis nearest snap (ΗΔΗ wired) | `projectPointOnBeamAxis` + `NearestSnapEngine` (`bim-beam`) | `bim/beams/beam-axis-projection.ts` · `snapping/engines/NearestSnapEngine.ts` |
| Decoupled draw-snap scheduler | `runSnapDetection` / `requestSnapDetection` | `systems/cursor/snap-scheduler.ts` |
| Column ghost χρωματισμός | `ColumnPlacementGhostStatusStore` + `resolveGhostStatusColor` | `systems/cursor/ColumnPlacementGhostStatusStore.ts` · `bim/columns/ColumnAnchorGhostRenderer.ts` |
| Column→beam context (πιθανή απλοποίηση) | `resolveColumnPlacementContext` / `findColumnBeamAxisSnap` | `bim/columns/column-placement-snap-context.ts` |
| Commit snap (κέντρο στον άξονα) | `mouse-handler-up` (column branch) | `systems/cursor/mouse-handler-up.ts` |

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΛΥΣΗ (PLAN-FIRST — δώσε plan, περίμενε «προχώρα»)

**Στόχος:** να ΜΗΝ καταπνίγεται το ενιαίο snap pipeline κατά την τοποθέτηση κολώνας· τα χαρακτηριστικά snaps (κολώνα ΚΑΙ δοκάρι, γλυφή+ετικέτα) να φαίνονται· ΚΑΙ να διατηρηθούν τα κεκτημένα του ADR-398 (🟢 ghost πάνω σε δοκάρι + snap κέντρου στον άξονα, 🔴 πάνω σε κολώνα, center-anchor enforcement).

**Κατεύθυνση (αξιολόγησέ την — μην την πάρεις τυφλά):**
1. **Σταμάτα το `setFullSnapResult(null)` + το short-circuit.** Άσε το κανονικό `findSnapPoint` να τρέχει ΠΑΝΤΑ (παράγει beam-axis snap + χαρακτηριστικά snaps με ετικέτες, ήδη SSoT).
2. **Παράγαγε το ghost status από το ΑΠΟΤΕΛΕΣΜΑ του snap** (single source): διάβασε `snapResult.snapPoint.entityId` → εντόπισε τον τύπο (isBeamEntity → 🟢 / isColumnEntity → 🔴) και θέσε `ColumnPlacementGhostStatusStore`. Έτσι ο χρωματισμός γίνεται **thin reader** του ενιαίου snap, ΟΧΙ παράλληλος ανιχνευτής.
3. **Center-anchor + «κέντρο στον άξονα»:** το NearestSnapEngine beam snap ΗΔΗ δίνει σημείο πάνω στον centerline· η κολώνα κουμπώνει εκεί μέσω του υπάρχοντος commit-snap. Κράτα το `anchor='center'` enforcement όταν το snapped entity είναι δοκάρι.
4. **Precedence «δοκάρι/overlap»:** επανέλεγξε αν χρειάζεται καθόλου το `resolveColumnPlacementContext` ή αν αρκεί η ανάγνωση του snap result + ένας light overlap έλεγχος για το 🔴 (όταν ο cursor είναι μέσα σε footprint κολώνας **χωρίς** ενεργό snap). Στόχος: **λιγότερος** κώδικας, ΕΝΑ pipeline.
5. **Μην προσθέσεις νέο διπλότυπο.** Αν κάτι λείπει από το snap pipeline (π.χ. το ghost δεν ξέρει τον τύπο entity), πρόσθεσέ το στο pipeline, μην φτιάξεις παράκαμψη.

**Προσοχή (ADR-040 / CHECK 6C/6D):** τα `systems/cursor/*` + snap + ghost είναι architecture-critical. Κράτα zero-React stores (imperative reads μέσα σε RAF), μηδέν `useSyncExternalStore` σε CanvasSection/CanvasLayerStack. **Χρειάζεται staged ADR** (ενημέρωσε το **ADR-398**, μην φτιάξεις νέο).

## 6. ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (git add ΜΟΝΟ αυτά — shared tree)

**Πιθανά MOD:** `systems/cursor/snap-scheduler.ts` *(η ρίζα — αφαίρεση `setFullSnapResult(null)`/short-circuit)* · `bim/columns/column-placement-snap-context.ts` *(πιθανή απλοποίηση)* · `systems/cursor/mouse-handler-up.ts` *(commit beam snap — ίσως αχρείαστο αν περνά από findSnapPoint)* · `systems/cursor/mouse-handler-move.ts` · `hooks/tools/useColumnGhostPreview.ts` · `hooks/drawing/useColumnTool.ts` *(⚠️ split από linter — δες `column-tool-ghost-overrides.ts`/`use-column-anchor-tab-cycle.ts`)*.
**DOCS:** `ADR-398-column-placement-snap.md` (changelog) · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`reference_column_beam_axis_snap.md`).
**ΜΗΝ αγγίξεις:** `NearestSnapEngine.ts`/`beam-axis-projection.ts` (ήδη σωστά SSoT)· κώδικα/ADR άλλου agent.

## 7. TESTS (από repo ROOT)
- Υπάρχοντα (να μείνουν GREEN): `column-placement-snap-context` (10) · `beam-axis-projection` (6) · `snap-description-keys` · `snapping/` (169).
- Νέα: αν αλλάξει η λογική ghost-status, γράψε jest για το «status από snap result» (beam→beam, column→overlap).
- **Browser-verify (Giorgio, `proj_12788b6a`):** εργαλείο Κολώνα + snaps ON → πέρνα πάνω/κοντά σε δοκάρι & κολώνα → ΠΡΕΠΕΙ να φαίνονται γλυφές + ετικέτες (Γωνία/Μέσο/Κέντρο στήλης & δοκαριού)· ghost 🟢 σε κενό δοκάρι (κέντρο στον άξονα)· 🔴 πάνω σε υπάρχουσα κολώνα.

## 8. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.15 — ίδιο commit, COMMIT = GIORGIO)
Ενημέρωσε: **ADR-398** (changelog: bugfix snap suppression) · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί) · MEMORY. **ΜΗΝ** commit/push. tsc = Giorgio (N.17: ΕΝΑ tsc τη φορά — έλεγξε πρώτα ότι δεν τρέχει άλλος).

---

### Σημείωση κατάστασης (UNCOMMITTED 2026-06-19)
Το ADR-398 (Column→Beam axis snap + ghost coloring + beam-axis-projection SSoT + NearestSnapEngine wiring + precedence `overlap>beam` bugfix) είναι **υλοποιημένο & tested (jest GREEN) αλλά UNCOMMITTED**, μαζί με πολλά άλλα features άλλων agents στο ίδιο working tree. Το παρόν είναι **follow-up bugfix** πάνω σε αυτό.
