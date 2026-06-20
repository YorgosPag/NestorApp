# HANDOFF — Smart beam ghost: framing σε ΥΦΙΣΤΑΜΕΝΟ δοκάρι (κάθετο Τ-junction + κατευθυντικό 🟢/🔴 status)

**Date:** 2026-06-20
**Owner επόμενης συνεδρίας:** fresh session (`/clear` πριν ξεκινήσεις)
**Status:** SPEC ΚΛΕΙΔΩΜΕΝΟ (όλες οι αποφάσεις πάρθηκαν με τον Giorgio). Κανένας κώδικας ΑΚΟΜΑ γι' αυτό το feature.

> Απάντα στον Giorgio στα **Ελληνικά**. **COMMIT/PUSH τα κάνει Ο GIORGIO**, όχι εσύ (N.(-1)).
> **Shared working tree με άλλον agent** — `git add` ΜΟΝΟ τα δικά σου beam-ghost/preview αρχεία.
> Ένα `tsc` τη φορά (N.17). **FULL ENTERPRISE + FULL SSoT (Revit-grade).** SSoT audit (grep) ΠΡΙΝ γράψεις (§5).
> **ΔΙΑΒΑΣΕ ΠΡΩΤΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (north-star: συνδεδεμένες οντότητες = ΕΝΑΣ ζωντανός οργανισμός· το beam→beam framing είναι ακριβώς αυτό).

---

## 0. ΤΟ FEATURE (μία παράγραφο)

Όταν το εργαλείο «Δοκάρι» είναι ενεργό και δείχνει το **smart ghost πριν το 1ο κλικ** (§3.3 ADR-398, ήδη committed για **κολόνες**), θέλουμε το ίδιο «κούμπωμα σε παρειά» να δουλεύει **και πάνω σε ΥΦΙΣΤΑΜΕΝΑ ΔΟΚΑΡΙΑ** — με **κατευθυντικό χρωματισμό** που λέει αν η σύνδεση είναι έγκυρη (🟢) ή παράλογη (🔴), όπως ακριβώς γίνεται κόκκινο το column ghost όταν κάνεις hover πάνω σε υπάρχουσα κολόνα. **Reuse τον υπάρχοντα κώδικα — ΜΗΔΕΝ διπλότυπα.**

---

## 1. ΚΛΕΙΔΩΜΕΝΗ ΠΡΟΔΙΑΓΡΑΦΗ (Revit-grade)

Νέο δοκάρι (ghost) κοντά σε **υφιστάμενο οριζόντιο δοκάρι**:

| Θέση κέρσορα vs υφιστάμενο δοκάρι | Status | Συμπεριφορά ghost |
|---|---|---|
| **Βόρεια / Νότια μακριά παρειά** | 🟢 πράσινο | κάθετο Τ-framing· **ΟΛΙΣΘΗΣΗ σε όλο το μήκος** + **μαγνήτες στα άκρα & μέσα** των λαβών του δοκαριού (endpoint/midpoint), όπως με τις κολόνες |
| **Κέντρο άξονα** (ανάμεσα στις δύο μακριές παρειές) | 🟢 πράσινο | **auto-snap στην ΠΛΗΣΙΕΣΤΕΡΗ παρειά** (Β ή Ν)· ο άξονας = απλώς γραμμή εναλλαγής (flip). ΟΧΙ κόκκινο (απόφαση Giorgio = «Α»: ομαλό UX, η σύγκρουση γίνεται αδύνατη γιατί ποτέ δεν τοποθετείς «καβάλα») |
| **Ανατολική / Δυτική κοντή άκρη** | 🔴 κόκκινο | collinear continuation — «θα ήταν παραλογισμός νέο δοκάρι εδώ· **καλύτερα extend** το υφιστάμενο». (Το πραγματικό extend = μελλοντικό, ΟΧΙ τώρα — τώρα μόνο 🔴 warning.) |
| **Παράλληλη επικάλυψη σώματος** (νέο δοκάρι ΣΥΓΓΡΑΜΜΙΚΟ πάνω στο σώμα του υφιστάμενου) | 🔴 κόκκινο | duplication |

### Δομικό σκεπτικό (γιατί έτσι — επιβεβαιωμένο με Giorgio, πολιτικό μηχανικό):
- **Τ-junction** (δευτερεύον δοκάρι καρφώνει κάθετα στην μακριά παρειά κυρίου) = standard **beam-to-beam framing**, η Revit το κάνει καθημερινά (το άκρο κόβεται/ενώνεται στην παρειά). → 🟢
- **Συγγραμμικά δοκάρια άκρη-με-άκρη ή σώμα-πάνω-σε-σώμα** = θα έπρεπε να είναι ΕΝΑ δοκάρι → 🔴 (αποθάρρυνση· extend).
- **Κέντρο άξονα:** η Revit *επιτρέπει* framing στον reference-line (άξονα) με physical cutback στην παρειά — ΔΕΝ το κοκκινίζει. Γι' αυτό επιλέξαμε auto-snap-στην-παρειά + 🟢 (καλύτερο από flicker κόκκινου σε λεπτή ζώνη).

### ⚠️ Προσοχή στη γεωμετρία «μακριά vs κοντή παρειά»:
Το δοκάρι είναι **μακρόστενο**. Για οριζόντιο δοκάρι: Β/Ν = **μακριές** παρειές (μήκος = span), Α/Δ = **κοντές** άκρες (μήκος = πλάτος δοκού). Ο διαχωρισμός 🟢/🔴 = **κάθετο** framing (νέος άξονας ⊥ υφιστάμενου άξονα → μακριά παρειά → 🟢) vs **παράλληλο/συγγραμμικό** (νέος άξονας ∥ υφιστάμενου → κοντή άκρη ή overlap → 🔴). Χρησιμοποίησε τον **άξονα του υφιστάμενου δοκαριού** (ΟΧΙ bbox) για να κρίνεις ⊥/∥ — δοκάρια μπορεί να είναι υπό γωνία.

---

## 2. ΠΑΡΑΔΕΙΓΜΑ ΑΝΑΦΟΡΑΣ (από Giorgio)

Κολόνα με δοκάρι κολλημένο στην **ανατολική** της πλευρά, **ίδιο πάχος** δοκού & κολόνας. Νέο δοκάρι:
- κέρσορας στη **βόρεια** παρειά υφιστάμενου → 🟢 κάθετο, με τις έλξεις (slide + άκρα/μέσα).
- κέρσορας στη **νότια** → 🟢 κάθετο στη νότια παρειά.
- κέρσορας στο **κέντρο άξονα** → 🟢 auto-snap στην πλησιέστερη (Β ή Ν).
- κέρσορας στην **ανατολική κοντή άκρη** → 🔴 (extend instead).

---

## 3. SLICED PLAN (~8-10 αρχεία, Opus· κάθε slice browser-verifiable)

**Slice 1 — face-snap δέχεται BEAM footprints (κάθετο framing σε δοκάρι):**
- Επέκτεινε `resolveBeamColumnFaceSnap` (`bim/beams/beam-column-face-snap.ts`) ώστε να δέχεται **και** beam footprints ως στόχους παρειάς (σήμερα: μόνο columnFootprints).
- Κέντρο → πλησιέστερη παρειά (αντί 3-thirds ambiguity).
- Beam footprints πρέπει να φτάσουν στο `makeBeamGhostBeforeClick`: mirror του υπάρχοντος `columnFootprints` στο `beam-preview-store.ts` (+`setBeams`) + sync στο `useBeamTool.ts` (όπως `syncColumnsToStore`).

**Slice 2 — slide + endpoint/midpoint μαγνήτες στη μακριά παρειά:**
- Για δοκάρια (μακρόστενα) το 3-thirds είναι πολύ χονδρό. Θέλουμε **συνεχή ολίσθηση** + OSNAP μαγνήτες στα **άκρα/μέσα** του υφιστάμενου δοκαριού.
- **ΨΑΞΕ ΠΡΩΤΑ** αν το υπάρχον BIM characteristic snap (`BimCharacteristicSnapEngine` / `bim-characteristic-points` — `BIM_CORNER`/`BIM_MIDPOINT`) ήδη δίνει τα endpoint/midpoint των δοκαριών → reuse, ΜΗΝ ξαναγράψεις μαγνήτες.

**Slice 3 — κατευθυντικό 🟢/🔴 status + κόκκινος χρωματισμός WYSIWYG ghost:**
- Κατευθυντικό overlap: 🔴 ΜΟΝΟ όταν ο άξονας ghost ~∥ με τον άξονα υφιστάμενου δοκαριού ΚΑΙ προβολές επικαλύπτονται (collinear), Ή κοντή-άκρη framing. Αλλιώς (⊥ μακριά παρειά) → 🟢. Reuse `projectPointOnBeamAxis`/`projectPolygonOnAxis` (axis-projection SSoT) για ⊥/∥ + επικάλυψη.
- Χρωμάτισε το **WYSIWYG** beam ghost κόκκινο όταν 🔴 (το column ghost είναι schematic· το beam είναι WYSIWYG amber μέσω BeamRenderer). Συνιστώμενη προσέγγιση: όταν 🔴, ζωγράφισε **κόκκινο schematic** (outline+30% fill) του outline polygon αντί WYSIWYG, μέσω **κοινού** polygon-status-drawer (βλ. §4).

---

## 4. SSoT REUSE MAP (τι να επαναχρησιμοποιήσεις — ΜΗΔΕΝ διπλότυπα)

| Χρειάζεσαι | Υπάρχον SSoT | Ενέργεια |
|---|---|---|
| 🔴/🟢 χρώμα | `GHOST_STATUS_COLORS` + `resolveGhostStatusColor` + `GhostStatusColor` (στο `bim/columns/ColumnAnchorGhostRenderer.ts`) | **EXTRACT** σε neutral `bim/ghosts/ghost-status-color.ts`· re-export από ColumnAnchorGhostRenderer (back-compat). Beam ΚΑΙ Column import από εκεί (αποφυγή beam→column-renderer coupling). |
| polygon outline+fill σε status-color | `drawGhostOutline`/`drawGhostFill` (private στο `ColumnAnchorGhostRenderer`) | **EXTRACT** σε `bim/ghosts/ghost-status-polygon-draw.ts` (`drawStatusGhostPolygon(ctx,vertices,transform,viewport,color,opts)`)· column ΚΑΙ beam το χρησιμοποιούν. |
| overlap detection (point-in-footprint τύπου Χ) | `findColumnOverlap` (στο `bim/columns/column-placement-snap-context.ts`) | **GENERALIZE** → `findEntityOverlap(pos,entities,isType)` (neutral)· `findColumnOverlap` delegate· beam reuse με `isBeamEntity`. |
| status type | `ColumnGhostStatus` = `'beam'\|'overlap'\|'neutral'` (`ColumnPlacementGhostStatusStore`) | reuse ο τύπος (ή generalize όνομα αν θες· ΟΧΙ νέο type). |
| ⊥/∥ + collinear-overlap check | `projectPointOnBeamAxis` (`bim/beams/beam-axis-projection.ts`), `projectPolygonOnAxis` (`bim/geometry/shared/polygon-axis-projection.ts`) | reuse — ΜΗΝ γράψεις νέο projection. |
| base face-snap | `resolveBeamColumnFaceSnap` / `resolveBeamGhostSnapFromStore` (`bim/beams/beam-column-face-snap.ts`) | **EXTEND** (δέξου beam footprints + status + nearest-face). |
| endpoint/midpoint μαγνήτες | `BimCharacteristicSnapEngine` / `bim-characteristic-points` (`BIM_CORNER`/`BIM_MIDPOINT`), `getBeamGrips`/`beam-grips` | reuse αν καλύπτει· αλλιώς thin wrapper. |
| WYSIWYG ghost build/render | `makeBeamGhostBeforeClick` (`hooks/drawing/beam-preview-helpers.ts`), `BimPreviewRenderer` (`canvas-v2/preview-canvas/bim-preview-render.ts`), PreviewRenderer BIM path | flag `ghostStatusColor` στο entity· κόκκινο render στο PreviewRenderer BIM path. |

### SSoT AUDIT — τρέξε ΠΡΙΝ γράψεις (πραγματικό grep):
```
# base smart-beam-ghost (το extend-άρεις):
rg -n "resolveBeamColumnFaceSnap|resolveBeamGhostSnapFromStore|beam-column-face-snap|pickThird" src/subapps/dxf-viewer
# column ghost status/color SSoT (το reuse-άρεις/extract):
rg -n "GHOST_STATUS_COLORS|resolveGhostStatusColor|GhostStatusColor|drawGhostOutline|drawGhostFill" src/subapps/dxf-viewer
rg -n "findColumnOverlap|resolveColumnGhostStatusFromSnap|ColumnGhostStatus|ColumnPlacementGhostStatusStore" src/subapps/dxf-viewer
# axis projection (∥/⊥ + collinear overlap):
rg -n "projectPointOnBeamAxis|projectPolygonOnAxis|beam-axis-projection|projectPointOn" src/subapps/dxf-viewer/bim
# endpoint/midpoint μαγνήτες (ΜΗΝ ξαναγράψεις):
rg -n "BimCharacteristicSnapEngine|bim-characteristic-points|BIM_MIDPOINT|BIM_CORNER|getBeamGrips" src/subapps/dxf-viewer
# beam footprints στο preview store + sync:
rg -n "columnFootprints|setColumns|syncColumnsToStore|beamPreviewStore" src/subapps/dxf-viewer
# WYSIWYG ghost render path:
rg -n "makeBeamGhostBeforeClick|wysiwygPreview|BimPreviewRenderer" src/subapps/dxf-viewer
```

---

## 5. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ TREE (UNCOMMITTED αυτής της συνεδρίας — μην τα σπάσεις, είναι ίδιο ADR-398)

Αυτή η συνεδρία άφησε **uncommitted** (ο Giorgio θα κάνει commit· λίστα αρχείων στο `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`):
1. **ADR-398 §3.4 — beam ghost +Y offset fix** (browser-verified ✅): NEW `setViewportOverride` σε `BaseEntityRenderer`+`EntityRendererComposite`· `BimPreviewRenderer`/`PreviewRenderer` εγχέουν canonical viewport.
2. **ADR-398 §3.5 — preview-render unification** (tsc clean, 9 jest): NEW `systems/preview/ghost-preview-frame.ts` + `hooks/tools/useCanvasGhostPreview.ts`· **19 ghost hooks migrated** στο harness· +transform-lag fix. 🔴 browser-verify ΟΛΩΝ των ghost tools + pan/zoom με ενεργό ghost.
3. **`clearCanvasDpr` SSoT** στο `rendering/canvas/withCanvasState.ts` (DPR-clear idiom).

➡️ Το feature αυτού του handoff **ΧΤΙΖΕΙ ΠΑΝΩ** στο §3.3 smart beam ghost (committed `465d48c7`). Δεν συγκρούεται με τα παραπάνω, αλλά πρόσεξε: το `makeBeamGhostBeforeClick` ίσως το άγγιξε το §3.4. Διάβασε το current state πριν edit.

---

## 6. ΚΑΝΟΝΕΣ + ADR/DOC

- **FULL ENTERPRISE + FULL SSoT.** Πραγματικό SSoT audit (grep §5) ΠΡΙΝ τον κώδικα. ΜΗΝ δημιουργήσεις διπλότυπα — extract/generalize/reuse.
- N.7.1: <500 γρ/αρχείο, <40 γρ/συνάρτηση. N.2/N.3: όχι `any`/inline styles.
- ADR-040: αγγίζεις critical files (`ColumnAnchorGhostRenderer`, `PreviewRenderer`, ίσως BeamRenderer) → stage `ADR-398`/`ADR-040` (CHECK 6B/6D).
- Ενημέρωσε **ADR-398** (§3.3 extension + νέο §για beam framing + changelog + tests) + `adr-index.md` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ, N.15) στο ΙΔΙΟ commit (που κάνει ο Giorgio).
- **Shared tree:** `git add` ΜΟΝΟ δικά σου beam-ghost/preview/ghosts αρχεία· ΟΧΙ `bim/structural/**`, `bim/foundations/**`, i18n.
- Jest: tests για `findEntityOverlap`, το κατευθυντικό status (⊥→beam/green, ∥-collinear→overlap/red, κοντή-άκρη→red), nearest-face στο κέντρο.
- **North-star (ADR-487):** beam→beam framing = μέρος του ζωντανού οργανισμού. Όταν ενώνεις δοκάρι σε δοκάρι, σκέψου ότι αργότερα ο οργανισμός θα ξαναϋπολογίζει φορτία/διατομές/οπλισμό για το νέο Τ — κράτα το geometry/topology καθαρό (reuse associative reframe/cutback SSoT).

---

## 7. ΣΧΕΤΙΚΑ ARCHIVE
- `HANDOFFS/HANDOFF_2026-06-20_smart-beam-ghost-on-column-faces.md` (το αρχικό §3.3 spec).
- ADRs: **ADR-398** §3.3 (smart beam ghost — το base), §3.4/§3.5 (preview render fixes — current session), **ADR-487** (organism north-star), ADR-458 (beam cutback/framing), ADR-040 (preview canvas).
- Memory: `reference_column_beam_axis_snap.md` (column→beam green/red status pattern — ΤΟ MIRROR), `reference_preview_ghost_must_read_immediate_snap.md`.
