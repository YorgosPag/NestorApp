# HANDOFF — Γραμμή Τομής: δυναμικό preview + ίχνη ευθυγράμμισης + Polar

**Ημ/νία:** 2026-07-04
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer/`)
**ADRs:** ADR-563 (cut-line dimension tool) · ADR-562 Φ9 + ADR-357 (alignment tracking SSoT) · ADR-040 (preview canvas RAF)
**Κατάσταση working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** — `git add <specific files>` ΜΟΝΟ, verify `git diff --cached`, ΠΟΤΕ `git restore .` / `reset --hard` / checkout άλλων αρχείων. **Commit τον κάνει ΜΟΝΟ ο Giorgio.**

---

## 🎯 Στόχος (τι ζήτησε ο Giorgio)

Εργαλείο **«Γραμμή τομής»** (Διαστάσεις tab → Γραμμή τομής). Όταν είναι ενεργό:

1. **Δυναμική γραμμή (rubber-band):** μετά το **1ο κλικ**, να εμφανίζεται δυναμική γραμμή από το 1ο σημείο μέχρι το κέντρο του σταυρονήματος (cursor), ώστε ο χρήστης να βλέπει σε προεπισκόπηση την πορεία της γραμμής τομής πριν το 2ο κλικ.
2. **Ίχνη ευθυγράμμισης (alignment tracking):** να ενεργοποιούνται οι γραμμές ιχνηλάτησης — τα ίδια οπτικά «βοηθήματα» (κόκκινα/πράσινα dashed paths + intersection halos + tooltips) που εμφανίζονται σε άλλες ενέργειες. Ο Giorgio τα περιέγραψε ως «τόξα κόκκινα/πράσινα με βέλη, όπως όταν περιστρέφουμε τοίχο». ⚠️ **OPEN QUESTION** — δες §Ανοιχτά ερωτήματα.
3. **Polar:** όταν το POLAR (F10) είναι ON, να φαίνονται και οι γραμμές + οι ενδείξεις Polar κατά τη χάραξη της γραμμής τομής.

**Ποιότητα:** Full Enterprise + Full SSoT, Revit / Maxon (C4D) / Figma-level. Αν οι μεγάλοι δεν το προτείνουν → ακολουθούμε την πρακτική τους.

---

## 🔍 SSoT AUDIT — ήδη έγινε (grep) στην προηγούμενη συνεδρία

### ✅ Το rubber-band ΗΔΗ ΥΠΑΡΧΕΙ
`hooks/dimensions/useAutoDimCutlineTool.ts` → `paintCutlinePreview()` (γρ. ~62-84):
```ts
if (s.phase === 'awaitingEnd' && s.cutStart && cursor) {
  canvas.drawPreview(cutlinePreviewLine(s.cutStart, cursor));   // ← γραμμή 1ο κλικ → cursor ΗΔΗ εδώ
  return;
}
```
➡️ Το αίτημα #1 **πιθανότατα λειτουργεί ήδη**. **ΠΡΩΤΟ ΒΗΜΑ: browser-verify** αν όντως εμφανίζεται η δυναμική γραμμή μετά το 1ο κλικ. Αν ΟΧΙ → εκεί είναι το bug (RAF callback `auto-dim-cutline-preview` / `getRealtimeWorldCursor` / phase transition). Αν ΝΑΙ → η δουλειά είναι ΜΟΝΟ #2 + #3.

### ✅ Το σύστημα alignment + Polar tracking ΗΔΗ ΥΠΑΡΧΕΙ ως SSoT — ΜΗΝ φτιάξεις νέο
`hooks/dimensions/dim-alignment-tracking.ts` (ADR-562 Φ9 / ADR-357). Ένα brain για ΟΛΑ τα dim tools:
- **`resolveActionAlignmentTracking(cursor, refPoints, scale, sceneEntities)`** → `ComposedTracking | null`. Wrapper που **διαβάζει μόνος του** POLAR/ORTHO (`cadToggleState`) + AutoAlign (`ambientAlignmentConfigStore`). Συνθέτει: refPoints ⊕ acquired (`TrackingPointStore`) ⊕ ambient anchors ⊕ **Polar increments** (`polarTrackingStore`). **← ιδανικό για το cutline** (δεν χρειάζεται να ξαναδιαβάσει toggles).
- **`paintGripAlignmentTracking(ctx, tracking, transform, viewport, toMm)`** → ζωγραφίζει τα ΙΔΙΑ traces (paths + intersections + tooltip) με το drawing flow — ίδιο χρώμα/dash/label-slot.
- Χαμηλότερα: `resolveDimAlignmentTracking(...)` (explicit toggles), `composeTrackingSnap` (`systems/tracking/ambient-tracking-compose.ts`), `TrackingPointStore`, `collectAmbientAlignmentAnchors` (`systems/tracking/ambient-alignment-source.ts`), `polarTrackingStore` (`systems/constraints/polar-tracking-store.ts`).

### Πρότυπα consumers (μίμησέ τα — ΜΗΝ αντιγράψεις):
- `hooks/drawing/drawing-hover-handler.ts` (γρ. ~124-128) — creation-time hover: `resolveDimAlignmentTracking` + paint.
- `hooks/tools/rotation-tracking-overlay.ts` — grip-drag paint sibling (`paintRotationTracking`).
- `hooks/drawing/useDrawingHandlers.ts` (γρ. ~219 hover / ~349 commit) — WYSIWYG parity: το commit εφαρμόζει το ΙΔΙΟ alignment override με το preview.

### Χάρτης αρχείων cut-line tool:
| Αρχείο | Ρόλος |
|---|---|
| `hooks/dimensions/useAutoDimCutlineTool.ts` | Tool lifecycle + `paintCutlinePreview` (RAF, ADR-040). **ΕΔΩ η κύρια δουλειά.** |
| `systems/dimensions/auto/auto-dimension-cutline-store.ts` | Session SSoT: `getCutlineSession()` → `{phase, cutStart, cutEnd, options}`· `armCutline`/`resetCutline`. |
| `systems/dimensions/auto/run-cutline-dimension.ts` | Click FSM (`advanceCutlineClick`) + `buildCutlinePreviewMeta`. **Commit-time alignment override εδώ** (WYSIWYG). |
| `hooks/canvas/useCanvasClickHandler.ts` | Dispatch του click → `advanceCutlineClick`. |
| `systems/dimensions/auto/cut-axis-projection.ts` | Προβολή faces στον άξονα τομής. |

---

## 🛠️ Προτεινόμενη προσέγγιση (FULL SSoT — μηδέν νέος μηχανισμός)

Στο `paintCutlinePreview` (φάση `awaitingEnd`), αντί για raw `cursor`:
1. `const composed = resolveActionAlignmentTracking(cursor, [s.cutStart], scale, sceneEntities)` (sceneEntities από `getScene()?.entities`· scale από `canvasOps.getTransform().scale`).
2. `const end = composed?.point ?? cursor;` → η rubber-band γραμμή κουμπώνει σε alignment/Polar.
3. `canvas.drawPreview(cutlinePreviewLine(s.cutStart, end))`.
4. Αν `composed` → `paintGripAlignmentTracking(ctx, composed, transform, viewport, toMm)` για τα traces + Polar ενδείξεις. **⚠️ Χρειάζεσαι `ctx` του preview canvas** — δες πώς το παίρνει το `rotation-tracking-overlay` / τι εκθέτει το `PreviewCanvasHandle` (πιθανό νέο handle method τύπου `drawActionTracking`, όπως το υπάρχον `drawTrackingAlignment`/`drawGhostFaceDimensions`). Reuse, μη νέο paint.
5. **Commit parity (ADR-562 Φ9):** στο `run-cutline-dimension.advanceCutlineClick`, στο 2ο κλικ εφάρμοσε το ΙΔΙΟ `resolveActionAlignmentTracking` override στο `cutEnd` ώστε η αποθηκευμένη γραμμή τομής == το preview.

`toMm`: από τα scene units του ενεργού level (δες πώς το κάνουν οι άλλοι paint consumers).

---

## ❓ Ανοιχτά ερωτήματα (ρώτησε τον Giorgio ΠΡΙΝ κώδικα, απλά Ελληνικά + παραδείγματα)

1. **«Κόκκινα/πράσινα τόξα με βέλη όπως στην περιστροφή τοίχου»**: τα rotation arcs (`rotation-tracking-overlay`) είναι για **περιστροφή**. Η γραμμή τομής είναι **ευθεία 2 σημείων**, οπότε τα φυσικά της ίχνη είναι οι **ευθείες γραμμές ευθυγράμμισης** (dashed H/V/Polar paths + tooltips), ΟΧΙ τόξα. Επιβεβαίωσε: εννοεί «τα ίχνη ευθυγράμμισης γενικά» (dashed lines) και απλά περιέγραψε τα rotation arcs ως το οπτικό που ξέρει; (Πιθανότατα ΝΑΙ.)
2. Θέλει τα ίχνη **και στη φάση `awaitingPlacement`** (μετά το 2ο κλικ, όσο τοποθετεί το offset της αλυσίδας διαστάσεων) ή μόνο στο `awaitingEnd`;

---

## 📐 Πρωτόκολλο εργασίας
- **ADR-driven (N.0.1):** Plan mode πρώτα → διάβασε ADR-563 + ADR-562 Φ9 + ADR-357, σύγκρινε με κώδικα (code = truth), μετά υλοποίηση, μετά ADR update (ίδιο commit που θα κάνει ο Giorgio).
- **ΟΧΙ tsc** (N.17) — μόνο jest όπου έχει νόημα.
- **Enterprise TS:** μηδέν `any`/`as any`/`@ts-ignore`. Semantic HTML.
- **i18n (N.11):** τυχόν νέα labels → `dxf-viewer-*.json` el+en πρώτα (μηδέν hardcoded).
- **Commit:** ΜΟΝΟ ο Giorgio. Working tree κοινό → `git add <specific>` + verify.
- **Model:** πιθανό Sonnet (εστιασμένο wiring 2-4 αρχεία, 1 domain) — αλλά ΠΡΩΤΑ browser-verify #1 + απάντηση στα ανοιχτά ερωτήματα· αν προκύψει και commit-parity + handle method, ίσως Opus.

## ✅ Πρώτα βήματα
1. Browser-verify: ενεργοποίησε «Γραμμή τομής», κάνε 1ο κλικ — εμφανίζεται η δυναμική γραμμή; (Καθορίζει αν το #1 είναι έτοιμο.)
2. Ρώτησε τον Giorgio τα 2 ανοιχτά ερωτήματα.
3. Plan mode → wiring `resolveActionAlignmentTracking` + `paintGripAlignmentTracking` στο `paintCutlinePreview` + commit parity.

## 🚫 Μην κάνεις
- ΜΗΝ φτιάξεις νέο tracking/polar/alignment store ή paint — **όλα υπάρχουν** στο `dim-alignment-tracking.ts` + `systems/tracking/*`.
- ΜΗΝ αγγίξεις αρχεία άλλου agent· ΜΗΝ κάνεις bulk git reset/restore.
- ΜΗΝ κάνεις commit.
