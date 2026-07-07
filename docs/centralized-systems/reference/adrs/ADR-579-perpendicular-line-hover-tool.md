# ADR-579 — «Κάθετη γραμμή» hover-driven (Revit-grade 2-click, full SSoT reuse του line hover)

**Status:** ✅ IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-07-06
**Domain:** DXF Viewer · Drawing tools · Ribbon «Στυλ Γραμμής» contextual tab · Snap/Preview/Tracking SSoT
**Related:** ADR-508 (line-cyan flush/κάθετο κούμπωμα — ο κοινός εγκέφαλος έλξης που επεκτείνεται εδώ), ADR-570 (Line Style system — το contextual tab που φιλοξενεί την εντολή), ADR-574 (Ghost preview SSoT), ADR-572 (Alignment traces SSoT), ADR-513 (Radial Command Ring typed-length), ADR-040 (canvas orchestration)
**Supersedes:** την παλιά 2-click-**pick** σχεδίαση της «κάθετης γραμμής» (`useLinePerpendicular`, ιστορικά mislabel «ADR-060» στον κώδικα — το πραγματικό ADR-060 αφορά floorplan storage).

---

## Context

Το εργαλείο **«γραμμή»** (`line`), όταν ο κέρσορας περνά πάνω σε υφιστάμενη οντότητα (DXF γραμμή, BIM κολόνα/δοκός/τοίχος), δείχνει ήδη ένα πλήρες hover experience: **κάθετο φάντασμα-stub** flush στην παρειά (`generateLinePreview` → `line-preview-helpers.ts`), **κυανές listening-διαστάσεις**, **κυανές ενδείξεις OSNAP** (`ProSnapEngineV2` + `SnapIndicatorOverlay`) και **λευκά ίχνη ευθυγράμμισης** (`resolveAlignmentTracking`). Όλα σε ΕΝΑ pipeline: `useDrawingHandlers → processDrawingHover → generatePreviewEntity('line') → generateLinePreview`.

Η **«κάθετη γραμμή»** (`line-perpendicular`) ήταν εντελώς ξεχωριστό μονοπάτι: 2 κλικ με «διάλεξε γραμμή αναφοράς → κλικ σημείο διέλευσης» (`useLinePerpendicular`), **χωρίς** hover-φάντασμα / κυανά / λευκά ίχνη. Παρέκαμπτε το drawing pipeline μέσω entity-pick interception (`entity-pick-handlers.ts` → `handleLinePerpendicularPick`).

Ζητούμενο (Giorgio): η «κάθετη γραμμή» να δείχνει **αυτούσιο** το hover experience της γραμμής πάνω σε **οποιαδήποτε** οντότητα (δομικές/ΗΜ/DXF), και να διαφέρει μόνο στο ότι η γραμμή μένει **κλειδωμένη κάθετη** στον άξονα της οντότητας.

## Decision

Δρομολόγηση του `line-perpendicular` μέσα από το **ΙΔΙΟ** hover pipeline της γραμμής (full SSoT reuse), με **hard κάθετο κλείδωμα** μετά το 1ο κλικ. Το παλιό pick tool (`useLinePerpendicular`) **αποσύρθηκε**.

Επιλεγμένο UX (Revit-grade, 2 κλικ):
1. **Hover** πάνω σε οντότητα → κάθετο φάντασμα-stub + κυανές διαστάσεις + κυανά OSNAP + λευκά ίχνη (state-0, ίδιο `generateLinePreview`).
2. **Κλικ 1** → η βάση κλειδώνει flush στην παρειά (κάθετο πόδι) + καταγράφεται ο κάθετος άξονας.
3. **Μετά** → η γραμμή μένει ΚΛΕΙΔΩΜΕΝΗ κάθετη· μήκος/πλευρά ακολουθούν τον κέρσορα (typed-length μέσω Radial Command Ring).
4. **Κλικ 2** → commit `LineEntity`· το εργαλείο μένει ενεργό (επαναλαμβανόμενο).

### Κεντρική ιδέα — μηδέν νέα γεωμετρία
Το `resolveLineFaceSnapAt` (ADR-508) επιστρέφει ήδη `faceFrame.perpDir` = **μοναδιαίο κάθετο διάνυσμα** στον άξονα αναφοράς. Το κλικ-2 = καθαρή προβολή dot-product πάνω σε αυτόν τον κλειδωμένο άξονα. Δύο pure helpers (`resolvePerpendicularAxisLock` + `projectOntoPerpendicularAxis`) μοιράζονται σε **preview ΚΑΙ commit** → preview ≡ commit by construction.

### SSoT που ξαναχρησιμοποιείται αυτούσιο
- Ghost + κυανές διαστάσεις → `generateLinePreview` (tool-agnostic).
- Κυανά OSNAP → `ProSnapEngineV2` + `SnapIndicatorOverlay` (τρέχουν ανεξάρτητα από το εργαλείο).
- Λευκά ίχνη → `resolveAlignmentTracking` + `paintDrawingHoverOverlays`.
- Κάθετος άξονας → `faceFrame.perpDir` (κανένα νέο `getNearestPointOnLine` κ.λπ.).
- Lock store pattern → καθρέφτης `polygon-vertex-lock-store.ts`.
- Commit-time transform → κοινός `resolveLineFamilyCommitPoint` για `line` + `line-perpendicular`.

## Changes

| Αρχείο | Αλλαγή |
|---|---|
| `bim/placement/perpendicular-axis-lock-store.ts` | **ΝΕΟ** — zero-React lock store `{ base, dir }` (mirror `polygon-vertex-lock-store`). |
| `hooks/drawing/line-perpendicular-preview-helpers.ts` | **ΝΕΟ** — `resolvePerpendicularAxisLock` + `projectOntoPerpendicularAxis` (pure, κοινά preview/commit). |
| `hooks/drawing/line-preview-helpers.ts` | `export` σε `resolveLineFaceSnapAt` + `LineFaceSnap` (μηδέν αλλαγή συμπεριφοράς). |
| `core/state-machine/interfaces.ts` | `line-perpendicular`: `minPoints/maxPoints` `0/0 → 2/2`. |
| `hooks/drawing/drawing-types.ts` | `'line-perpendicular'` στο `DrawingTool` union. |
| `hooks/drawing/useUnifiedDrawing.tsx` | `'line-perpendicular'` στο `ENTITY_TOOLS`. |
| `hooks/drawing/drawing-entity-builders.ts` | merge `case 'line-perpendicular'` σε `createEntityFromTool` + `isEntityComplete` (ίδιο branch με `line`). |
| `hooks/drawing/drawing-preview-generator.ts` | state-0 branch (reuse `generateLinePreview`) + `needsStartDot`. |
| `hooks/drawing/drawing-hover-handler.ts` | ανάγνωση `perpLock` + hard-axis-lock κλάδος (ortho/polar/tracking τυλίχτηκαν σε `else` → κανένα stray overlay). |
| `hooks/drawing/drawing-handler-utils.ts` | **ΝΕΟ** `resolveLineFamilyCommitPoint` (consolidates + relocates τη commit-time line λογική). |
| `hooks/drawing/useDrawingHandlers.ts` | κλήση του κοινού helper· διεύρυνση snap-target refresh σε `line-perpendicular`· reset του lock σε tool-change + cancel. |
| `hooks/drawing/drawing-preview-partial.ts` | `'line-perpendicular'` σε `isStylableTool`, HUD/cyan gate, `FINAL_STEP`. |
| `hooks/canvas/useCanvasClickHandler.ts`, `canvas-click-types.ts`, `entity-pick-handlers.ts` | αφαίρεση του entity-pick interception (`handleLinePerpendicularPick`) — τα κλικ πάνε στο drawing pipeline (PRIORITY 6). |
| `hooks/drawing/useLinePerpendicular.ts` | **ΔΙΑΓΡΑΦΗ** (παλιό pick tool). |
| `hooks/tools/useSpecialTools-selection-tools.ts`, `useSpecialTools.ts`, `components/dxf-layout/CanvasSection.tsx`, `systems/events/drawing-event-map.ts` | αφαίρεση wiring/return/event του `linePerpendicular`. |
| `hooks/drawing/__tests__/line-perpendicular-preview-helpers.test.ts` | **ΝΕΟ** — 6 tests (projection + axis capture). |
| `systems/dynamic-input/perpendicular-line-ring-config.ts` | **ΝΕΟ** (2026-07-07) — length-only `PERPENDICULAR_LINE_RING_CONFIG` (1 πεδίο «Μήκος», reuse `lengthRingField` → ΙΔΙΟ `DynamicInputLockStore`). Direction ήδη κλειδωμένη μετά το click-1 → angle περιττό (AutoCAD DDE). |
| `components/dxf-layout/DynamicInputSubscriber.tsx` | (2026-07-07) νέο branch: mount `RadialCommandRing` για `line-perpendicular` **μόνο** μετά το click-1 (`tempPoints.length >= 1`), early-return πριν το legacy `DynamicInputSystem` (μηδέν διπλό UI). |
| `systems/dynamic-input/__tests__/perpendicular-line-ring-config.test.ts` | **ΝΕΟ** (2026-07-07) — 8 tests (single length field, no angle/linetype, lock/clear/subscribe SSoT). |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | (2026-07-07) νέο key `tools.ring.perpendicularLabel` (aria-label δαχτυλιδιού). |
| `systems/dynamic-input/components/RadialCommandRing.tsx` | (2026-07-07 fix) **fresh-mount seed** — mount-effect που seed-άρει `cursor`/`center` από τον SSoT `getClientPosition()` ΧΩΡΙΣ να περιμένει mousemove. Χωρίς αυτό, ένα δαχτυλίδι που εμφανίζεται ΜΟΝΟ μετά το 1ο κλικ (perpendicular) ξεκινούσε `cursor=null` → render null → popup input δεν mount-άριζε → στη ροή DDE (πληκτρολόγηση χωρίς μετακίνηση) το Enter διέφευγε και το commit αγνοούσε το μήκος. Ωφελεί ΟΛΑ τα rings (parity). |

## Consequences

- **Full parity** με το `line` hover πάνω σε δομικές/ΗΜ/DXF — μηδέν διπλότυπο, μία πηγή αλήθειας.
- **Ένας κυρίαρχος περιορισμός τη φορά**: στο state-1 ο κάθετος κλειδώνεται σκληρά, παρακάμπτοντας ortho/polar/tracking magnetism (mirror του wall face-relative) ώστε τα λευκά ίχνη να μη «παλεύουν» με το κλείδωμα (εμφανίζονται κανονικά στο state-0 hover).
- **Preview ≡ commit** by construction (ίδιοι pure helpers).

## Known limitations (out of scope)

- **MEP οντότητες** δεν συλλέγονται ως face-snap targets σήμερα — για **κανένα** εργαλείο, ούτε το `line`. Η «κάθετη γραμμή» κληρονομεί την ΙΔΙΑ κάλυψη με το `line` (τοίχοι/δοκοί/πλάκες/κολόνες/θεμέλια/γραμμές/polylines/rectangles/circles/arcs). Πλήρης MEP = ξεχωριστό task (collectors σε `member-snap-targets.ts` + `scene-snap-targets.ts`).
- **Linear Dynamic Input overlay** (X/Y/Length/Angle κουτιά, legacy DOM): out of scope — δεν χρειάζεται. Το **Radial Command Ring** typed-length (ADR-513) καλύπτει τη ρητή εισαγωγή μήκους (βλ. 2026-07-07 changelog: το ring **δεν** ήταν mounted για το `line-perpendicular` πριν — τώρα mount-άρεται length-only μετά το click-1).

## Changelog

- **2026-07-06** — Αρχική υλοποίηση: hover-driven «κάθετη γραμμή» με full SSoT reuse του line hover + hard κάθετο κλείδωμα (2-click Revit-grade). Απόσυρση του παλιού pick tool.
- **2026-07-07** — **Typed-length (Radial Command Ring, ADR-513).** Μετά το click-1 (σημείο εισαγωγής), ο χρήστης πληκτρολογεί το ΜΗΚΟΣ και με Enter ολοκληρώνει την τοποθέτηση κάθετα. Το geometry ήταν ήδη καλωδιωμένο (`applyLengthAngleLock` σε preview + commit)· έλειπε **μόνο** το mount του `RadialCommandRing` για το `line-perpendicular` στο `DynamicInputSubscriber`. Νέο **length-only** `PERPENDICULAR_LINE_RING_CONFIG` (design decision AutoCAD direct-distance-entry: η διεύθυνση/κάθετος άξονας είναι ήδη κλειδωμένη μετά το click-1, οπότε το πεδίο «Γωνία» είναι περιττό — 1 πεδίο «Μήκος» = όλος ο δίσκος, ίδιο idiom με το single-field `ROTATION_RING_CONFIG`). Gated στο `tempPoints.length >= 1` ώστε πριν το click-1 (hover/ghost + κυανά) να μην εμφανίζεται δαχτυλίδι. Μηδέν νέα geometry/store/commit path (reuse `lengthRingField` / `DynamicInputLockStore` / `CreateEntityCommand`). 2D-only (το 3D `DynamicInput3DLeaf` δεν χειρίζεται το εργαλείο). 8 νέα jest tests. (+ pointer ADR-513 typed-length SSoT).
- **2026-07-07 (fix)** — **Fresh-mount seed του δαχτυλιδιού.** Πρώτη δοκιμή Giorgio: πληκτρολόγηση + Enter δημιουργούσε γραμμή με το μήκος του κέρσορα (θέση ghost), αγνοώντας την πληκτρολογημένη τιμή. Root cause (static-analysis· το geometry commit επιβεβαιώθηκε σωστό με isolated test — `resolveLineFamilyCommitPoint` εφαρμόζει το locked length): το `RadialCommandRing` που εμφανίζεται ΜΟΝΟ μετά το click-1 ξεκινούσε με `cursorRef=null` και περίμενε window mousemove για να γίνει ορατό. Στη ροή direct-distance-entry (η διεύθυνση κλειδωμένη μετά το click-1 → ο χρήστης πληκτρολογεί ΑΜΕΣΩΣ χωρίς να κουνήσει το ποντίκι) το δαχτυλίδι έμενε `render null`, το popup input δεν mount-άριζε, το Enter διέφευγε από το `onPopupKeyDown` και το σημείο commit-αριζε στον κέρσορα (χωρίς lock). Fix: mount-effect seed-άρει `cursor`/`center` από τον SSoT `getClientPosition()` (ΕΝΑ global window listener, ήδη έγκυρο πριν το mount). Το `line`/`wall`/`beam` δεν το έπαθαν γιατί είναι πάντα mounted & «ζεστά». Ωφελεί ΟΛΑ τα rings (parity). Επιβεβαίωση από Giorgio εκκρεμεί.
