# HANDOFF — Δυναμική εισαγωγή στη ΓΡΑΜΜΗ (μήκος / γωνία / τύπος γραμμής) — parity με τον τοίχο

| | |
|---|---|
| **Ημερομηνία** | 2026-06-30 |
| **Author** | Opus 4.8 (session: wall ghost dim-colors + SNAP-MODE step για γραμμή/τοίχο + 3 κύκλοι SSoT κεντρικοποίησης) |
| **Status** | 🟡 ΝΕΟ ΘΕΜΑ — μελέτη + σχεδίαση· ΚΑΜΙΑ υλοποίηση ακόμη |
| **Domain** | DXF Viewer 2D / dynamic input / line tool |
| **Working tree** | ⚠️ SHARED με άλλον agent (αγγίζει `wall-preview-helpers.ts` + ADR-508 §line-hud) — touch ΜΟΝΟ ό,τι χρειάζεται, μηδέν `git add -A` |
| **Commit** | ❌ ΠΟΤΕ από agent — ο **Giorgio** κάνει commit/push (N.-1). ❌ ΠΟΤΕ `--no-verify`. |
| **tsc** | ❌ ΠΟΤΕ (N.17) — μόνο jest |

---

## 🎯 ΤΟ ΖΗΤΟΥΜΕΝΟ (Giorgio)

«Μελέτησε **πάρα πολύ καλά** τη **δυναμική εισαγωγή του τοίχου** και εφάρμοσέ την στις **γραμμές**.»

Στη **γραμμή** θέλουμε **3 πεδία** δυναμικής εισαγωγής:
1. **Μήκος γραμμής** (length)
2. **Γωνία γραμμής** (angle)
3. **Τύπος γραμμής** (line type)

> Ο τοίχος έχει μήκος/γωνία/πάχος/ύψος. Η γραμμή: **μήκος / γωνία / τύπος** (ΟΧΙ πάχος, ΟΧΙ ύψος — απόφαση Giorgio).

---

## 🔍 PRELIMINARY SSoT AUDIT (ΕΓΙΝΕ ΗΔΗ — grep· επιβεβαίωσέ το, ΜΗΝ ξεκινήσεις από μηδέν)

**ΚΡΙΣΙΜΟ:** Μεγάλο μέρος υπάρχει ΗΔΗ. Η γραμμή έχει **ήδη** δυναμική εισαγωγή μήκους/γωνίας — το ζητούμενο είναι **parity με την εμπειρία του τοίχου + 3ο πεδίο (τύπος)**, ΟΧΙ from-scratch.

### Σύστημα δυναμικής εισαγωγής (SSoT): `src/subapps/dxf-viewer/systems/dynamic-input/`
| Αρχείο | Ρόλος |
|---|---|
| `DynamicInputLockStore.ts` | **Zero-React SSoT** για locks **μήκους & γωνίας ΑΝΕΞΑΡΤΗΤΑ** (`lockLength`/`lockAngle`/`toggle`/`unlock`). ADR-357 Φ13 + ADR-513. |
| `length-angle-lock.ts` | `applyLengthAngleLock(previewPt, ref)` — εφαρμόζει το lock στη γεωμετρία. **ΗΔΗ καλείται για `'line'` ΚΑΙ `'wall'`** (βλ. κάτω). |
| `components/RadialCommandRing.tsx` | **«Δαχτυλίδι Εντολών»** (ADR-513) — in-canvas NavWheel του **τοίχου** (wedges→popup→Enter→lock). |
| `radial-ring-logic.ts` | pure logic του ring. |
| `components/DynamicInputOverlay.tsx` / `DynamicInputFields.tsx` / `DynamicInputField.tsx` | **DOM dynamic-input πεδία** (το «κλασικό» AutoCAD-style overlay). |
| `coordinate-parser.ts` / `numeric-expression.ts` | parsing τιμών/εκφράσεων (`evalExpr`). |
| `DynamicInputSystem.tsx` / `useDynamicInput.ts` / `keyboard-handlers/` | orchestration + Ctrl+L/Ctrl+A + Tab cycle. |

### Πώς ΕΙΝΑΙ ΗΔΗ συνδεδεμένη η ΓΡΑΜΜΗ (μην το ξαναφτιάξεις):
- `components/dxf-layout/DynamicInputSubscriber.tsx` — σχόλια: **«Phase 2a scope is `line` only»**, «line tool is the only consumer and uses `onDrawingPoint`». Gating: `dynInput.on && isInteractiveTool(activeTool)`. Άρα τα **DOM πεδία στοχεύουν ΗΔΗ τη γραμμή**.
- `hooks/drawing/drawing-hover-handler.ts:267` — `if (lastRefPt && (activeTool === 'line' || activeTool === 'wall')) previewPt = applyLengthAngleLock(...)` → **η γραμμή ΗΔΗ κλειδώνει μήκος/γωνία** (preview). Συμμετρικό commit στο `useDrawingHandlers.onDrawingPoint`.
- **Ο άλλος agent (shared tree) πρόσθεσε ΗΔΗ το live HUD readout στη γραμμή** — ADR-508 **§line-hud** (2026-06-30): η γραμμή δείχνει μήκος+γωνία με τον ΙΔΙΟ painter όπως ο τοίχος (`paintWallHudCore`/`buildSegmentHudMeta` tool-agnostic). **Συντονίσου με αυτό — μην το διπλασιάσεις.**

### Τοίχος (η «εμπειρία» που θέλουμε parity):
- `canvas-v2/preview-canvas/wall-hud-paint.ts` — `paintWallHudCore` (read-only HUD), `WallHudMeta`, `buildSegmentHudMeta` (**ήδη tool-agnostic**).
- `hooks/drawing/wall-preview-helpers.ts` — `buildWallHudMeta` (`wantHud`, straight only). ⚠️ **το αγγίζει ο άλλος agent.**
- ADR-513 (Radial Command Ring) + ADR-508 §wall-hud / §line-hud.

### Τύπος γραμμής (line type) — ΤΟ ΝΕΟ ΚΟΜΜΑΤΙ, χρειάζεται έρευνα:
- Πιθανές πηγές: `types/lineSettings.tsx`, `types/entities.ts`, `types/base-entity.ts`, `types/style-editable-primitives.ts`. **Grep `lineType|linetype|lineStyle|dashPattern|LTSCALE`** — βρες τον υπάρχοντα SSoT των linetypes (συνεχής/διακεκομμένη/κέντρου κ.λπ.) ΠΡΙΝ φτιάξεις νέο. Υπάρχει `LTSCALE` στο status bar (screenshot) → υπάρχει linetype σύστημα.
- ΕΡΩΤΗΜΑ: «τύπος γραμμής» = DXF linetype (CONTINUOUS/DASHED/…) ή σημασιολογικός τύπος; **Ρώτησε τον Giorgio με concrete παράδειγμα** (lead-with-example).

---

## ❓ ΑΝΟΙΧΤΑ ΕΡΩΤΗΜΑΤΑ ΣΧΕΔΙΑΣΗΣ (λύσε ΠΡΙΝ τον κώδικα — με concrete παράδειγμα στον Giorgio)

1. **Ποια UI;** Το **Δαχτυλίδι Εντολών** (radial ring, όπως ο τοίχος) ή τα **DOM πεδία** (Phase 2a που ήδη έχει η γραμμή); Ο τοίχος χρησιμοποιεί ring. Ο Giorgio είπε «όπως ο τοίχος» → πιθανόν **ring**. Επιβεβαίωσε.
2. **Πεδίο «τύπος γραμμής» σε αριθμητικό dynamic input;** Μήκος/γωνία είναι αριθμοί· ο «τύπος» είναι **επιλογή** (dropdown/cycle). Πώς μπαίνει στο ring/overlay; (π.χ. wedge που κυκλώνει τύπους, ή Radix Select — ADR-001 canonical `@/components/ui/select`).
3. **Big-player parity:** AutoCAD dynamic input (Tab μεταξύ length/angle, πεδία στον κέρσορα) · Revit (temporary dims editable + Properties) · Figma. Ο «τύπος» συνήθως είναι σε panel/dropdown, ΟΧΙ στο inline length/angle. **Ερεύνησε & πρότεινε.**

---

## ✅ ΑΠΑΙΤΗΣΕΙΣ (εντολή Giorgio)
1. **Big-player level** (Revit / Maxon-Cinema4D / Figma). FULL ENTERPRISE + FULL SSoT. Αν οι μεγάλοι δεν προτείνουν enterprise pattern → ακολούθα την πρακτική των μεγάλων.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ τον κώδικα** — reuse `DynamicInputLockStore` + `length-angle-lock` + `RadialCommandRing` + τον linetype SSoT. **ΜΗΝ** φτιάξεις 2ο dynamic-input μηχανισμό/store/πεδία.
3. **Lead with concrete example** (ASCII/νούμερα/πεδία) στο design choice ΠΡΙΝ υλοποιήσεις.
4. **Απαντάς ΠΑΝΤΑ στα Ελληνικά.**
5. **N.17:** ❌ ΠΟΤΕ tsc/typecheck. ✅ jest: `npx jest src/subapps/dxf-viewer/systems/dynamic-input/`
6. **N.-1:** ❌ commit/push μόνο ο Giorgio. ❌ `--no-verify`.
7. **Shared tree** με άλλον agent (`wall-preview-helpers.ts`, ADR-508). Touch ΜΟΝΟ τα απαραίτητα.
8. **ADR-driven (N.0.1):** code = source of truth. Ενημέρωσε **ADR-513** (Radial Command Ring) + **ADR-508** (§line-hud, συντονισμός) + νέο ADR αν χρειαστεί για το line-type (έλεγξε `adr-index.md` για το επόμενο ελεύθερο νούμερο). **Stage ADR-040** αν αγγίξεις canvas leaf (CHECK 6B/6D).

## 📂 ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (ξεκίνα από εδώ)
- `systems/dynamic-input/DynamicInputLockStore.ts` · `length-angle-lock.ts` · `components/RadialCommandRing.tsx` · `radial-ring-logic.ts`
- `components/dxf-layout/DynamicInputSubscriber.tsx` (line gating, Phase 2a)
- `hooks/drawing/drawing-hover-handler.ts:267` (line lock ήδη) · `hooks/drawing/useDrawingHandlers.ts` (commit γραμμής)
- `canvas-v2/preview-canvas/wall-hud-paint.ts` (HUD SSoT, tool-agnostic) ⚠️ shared
- `types/lineSettings.tsx` + grep linetype SSoT (3ο πεδίο)
- ADRs: `ADR-513-*` (radial ring), `ADR-508-*` (§wall-hud/§line-hud), `ADR-357` (dynamic input Phase 2a)

## ✅ DEFINITION OF DONE
1. Big-player έρευνα + τεκμηριωμένη απόφαση UI (ring vs DOM· πώς μπαίνει ο «τύπος») — concrete παράδειγμα στον Giorgio ΠΡΙΝ τον κώδικα.
2. Η γραμμή έχει δυναμική εισαγωγή **μήκος / γωνία / τύπος** με reuse των υπαρχόντων SSoT (μηδέν διπλότυπο μηχανισμός/store/πεδία).
3. preview ≡ commit (το lock εφαρμόζεται και στα δύο, όπως ήδη το `applyLengthAngleLock`).
4. jest GREEN· ADR-513/508 (+ τυχόν νέο) ενημερωμένα + changelog.
5. ❌ commit/push από Giorgio.

---

## 📌 ΠΡΟΗΓΟΥΜΕΝΗ ΔΟΥΛΕΙΑ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ (uncommitted — ίδιο working tree, μην το χαλάσεις)
Ολοκληρώθηκε & jest-GREEN, εκκρεμεί **browser-verify + commit (Giorgio)**:
- **Χρώμα διαστάσεων wall-ghost** (ADR-508 decision-record): λευκό=δικό σου / σιελ=σχεσιακό = ΣΩΣΤΟ (big-player), καμία αλλαγή κώδικα.
- **SNAP-MODE (F9+Q) βηματισμός** σε **γραμμή + τοίχο** (ADR-363): βήμα **κατά μήκος** (length-based, angle-aware — διόρθωση «το Q υπολόγιζε Χ/Υ»).
- **3 κύκλοι SSoT κεντρικοποίησης** (ADR-363): NEW `resolveOrthoPolarStep`+`worldPolarSnapConfig` (`drawing-handler-utils.ts`), NEW `applyPointStepSnap`(rect)/`applyAlongAxisStepSnap`(along-axis) (`grip-step-quantize.ts`), NEW `quantizePointFromAnchor` (`adaptive-distance-snap.ts`). 3 inline ακολουθίες + 4 config αντίγραφα + 2 idiom αντίγραφα → ενοποιήθηκαν.
- Αρχεία: `drawing-handler-utils.ts`, `bim-ortho-reference.ts`, `useDrawingHandlers.ts`, `drawing-hover-handler.ts`, `grip-step-quantize.ts`, `mouse-handler-move.ts`, `adaptive-distance-snap.ts` + tests + ADR-363/508.
