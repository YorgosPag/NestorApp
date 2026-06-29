# HANDOFF — Λαβές κειμένου (text) με ΠΛΗΡΗ parity ορθογώνιου τοίχου (SSoT)

**Ημερομηνία:** 2026-06-29 (για νέα/καθαρή συνεδρία)
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer`)
**Status:** 🔵 NOT STARTED — ξεκίνα με **Plan Mode** + **SSoT audit (grep)** ΠΡΙΝ γράψεις κώδικα.

---

## 0. Πλαίσιο εκτέλεσης (ΚΡΙΣΙΜΟ)

- ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία του δικού σου task. Πριν από κάθε Edit, ξαναδιάβασε το αρχείο (μπορεί να έχει αλλάξει).
- ⚠️ **COMMIT τον κάνει ο Giorgio, ΟΧΙ εσύ.** Ετοίμασε τη δουλειά, σταμάτα, ανέφερε. Ποτέ `git commit`/`push`.
- ⚠️ **ΕΝΑ tsc τη φορά (N.17).** Πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος. Προτίμησε targeted jest.
- 🌐 **Απαντάς ΠΑΝΤΑ στα Ελληνικά** στον Giorgio.
- 🏛️ **Full enterprise + FULL SSoT + «μεγάλοι παίκτες»** (Revit / Cinema 4D-Maxon / Figma). Αν οι μεγάλοι παίκτες δεν προτείνουν κάτι, ακολούθησε τη δική τους πρακτική. **Πριν την υλοποίηση κάνε ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep)** για να βρεις υπάρχοντα κώδικα και να ΜΗΝ φτιάξεις διπλότυπα. Αν βρεις προϋπάρχον διπλότυπο → κεντρικοποίησέ το (διαταγή Giorgio).

---

## 1. ΑΙΤΗΜΑ (λόγια Giorgio)

> Όταν επιλέγω έναν **ορθογώνιο τοίχο**, εμφανίζει **8 λαβές** (4 στις γωνίες/άκρα + 4 στα μέσα των πλευρών) + **1 λαβή μετακίνησης** + **1 λαβή περιστροφής**. Θέλω **τον ΙΔΙΟ ΑΚΡΙΒΩΣ κώδικα** να εφαρμοστεί στα **ΚΕΙΜΕΝΑ (text)**: όταν επιλέγω ένα κείμενο να συμπεριφέρεται **ακριβώς όπως ορθογώνιος τοίχος** — ίδιες λαβές, ίδια **αλλαγή μεγέθους (resize), μετακίνηση (move), περιστροφή (rotate)**. **ΜΙΑ και μοναδική πηγή αλήθειας** — όχι διπλότυπο.

Στόχος UX: ένα κείμενο «DDD» στον 2D καμβά, όταν επιλέγεται, αποκτά bounding-box λαβές (4 γωνίες + 4 μέσα-πλευράς) + move + rotation και τραβώντας τες κάνει resize/move/rotate — Figma/AutoCAD-grade text box.

---

## 2. ΤΙ ΙΣΧΥΕΙ ΤΩΡΑ (επιβεβαιωμένο με grep, code = source of truth)

**ΕΝΑ SSoT για όλα τα grips:** `src/subapps/dxf-viewer/hooks/grip-computation.ts` →
`export function computeDxfEntityGrips(entity): GripInfo[]` (γρ. 82) — ένα `switch (entity.type)` με case ανά τύπο. ΟΛΑ τα entities (2D & BIM) παίρνουν grips από εδώ.

- **`case 'text'`** (γρ. 201-207): δίνει **ΜΟΝΟ 1 grip** → `{ gripIndex:0, type:'center', position: entity.position, movesEntity:true }`. Δηλαδή το κείμενο έχει **μόνο** λαβή μετακίνησης. **ΟΧΙ** corners, **ΟΧΙ** midpoints, **ΟΧΙ** rotation, **ΟΧΙ** resize. → ΑΥΤΟ είναι το κενό.
- **`case 'wall'`** (γρ. 254-257): `grips.push(...getWallGrips(entity as WallEntity))`.

**Πηγές των rect/structural grips (candidates για reuse — audit ποιο δίνει ΑΚΡΙΒΩΣ 4 corner + 4 midpoint + move + rotation):**
- `src/subapps/dxf-viewer/bim/walls/wall-grips.ts` → `getWallGrips` (⚠️ ο wall είναι **γραμμικός** start/end/midpoint/thickness — μπορεί να ΜΗΝ είναι ακριβώς «4 corner + 4 midpoint ορθογωνίου». Επιβεβαίωσέ το.)
- `src/subapps/dxf-viewer/bim/columns/column-rect-adapter.ts` → `rectColumnGrips` (ορθογώνια κολόνα = bounding box· **πιθανότατα πιο κοντά** στο «4 corner + 4 midpoint + center move + rotation» που ζητά ο Giorgio).
- `src/subapps/dxf-viewer/bim/columns/column-grips.ts`, `column-grip-utils.ts` → `getColumnGrips`, `perVertexAndEdgeGrips`, `columnCenterMoveGrip` (SSoT building blocks: corner+edge-midpoint grips, center move 4-βελάκια, rotation handle — από ADR-397/518).

**Text entity shape:** `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts` — το text έχει `text: string` (γρ.173), `height: number` (γρ.174), `rotation?: number` (degrees, γρ.175), `position`. ⚠️ Το bounding box του κειμένου χρειάζεται **πλάτος** — δες αν υπάρχει μετρημένο width (measureText / cached metrics) ή πρέπει να υπολογιστεί. Αυτό είναι το πιο πιθανό «hard part».

**Render + interaction pipeline (ίδιο για όλους — δες CLAUDE.md «DXF VIEWER ARCHITECTURE» + ADR-040):**
- Terminal painter: `rendering/grips/UnifiedGripRenderer.ts` (ΕΝΑΣ ζωγράφος 2D+3D).
- Phase orchestrator: `systems/phase-manager/renderers/GripPhaseRenderer.ts`.
- Entry από entity renderers: `rendering/entities/BaseEntityRenderer.ts` (`finalizeRendering` → `renderGrips`).
- Event-time hit-test SSoT: `systems/grip/AllGripsStore.ts` ← `components/dxf-layout/GripRegistryPublisher.tsx` ← `hooks/grips/grip-registry.ts` (`useGripRegistry` καλεί `computeDxfEntityGrips`).
- **Άρα: αν το `case 'text'` αρχίσει να επιστρέφει τα σωστά grips, ΚΑΙ το rendering ΚΑΙ το hit-test τα παίρνουν δωρεάν** (ένα SSoT). Το «δύσκολο» είναι (α) τα grip positions από το text bounding box, (β) τα **commands** resize/move/rotate για text.

**Commands (resize/move/rotate) — audit:** βρες πώς ο wall/rect-column μεταφράζει ένα grip drag σε command (π.χ. `StretchEntityCommand`, `MoveEntityCommand`, `RotateEntityCommand`, ή grip-drag handlers στο `hooks/grips/`). Το text θα χρειαστεί: move (υπάρχει ήδη — center grip), **rotate** (νέο — γράψε σε `rotation`), **resize** (νέο — γράψε σε `height` + ίσως scale του πλάτους / fontSize). Δες αν υπάρχει ήδη text transform command πριν φτιάξεις νέο.

---

## 3. SSoT AUDIT — τι να τρέξεις ΠΡΩΤΑ (grep) στη νέα συνεδρία

1. `getWallGrips` vs `rectColumnGrips` vs `perVertexAndEdgeGrips` — **διάβασε και τα 3** και αποφάσισε ποιο δίνει ΑΚΡΙΒΩΣ «4 corner + 4 midpoint + center-move + rotation». Διάλεξε/γενίκευσε ΕΝΑ SSoT για «ορθογώνιο bounding-box grips» που να το καλεί ΚΑΙ ο τοίχος/κολόνα ΚΑΙ το κείμενο. **Μην αντιγράψεις — κάλεσε/extract.**
2. Text bounding box / width: grep `measureText`, `textMetrics`, `textWidth`, `text-bounds`, `computeTextBBox` — υπάρχει ήδη; (το rendering μετράει το κείμενο κάπου).
3. Text transform commands: grep `text` μέσα στο `core/commands/`, `RotateEntityCommand`, `ScaleEntityCommand`, `StretchEntityCommand` — υποστηρίζουν text;
4. Πώς το rect-column grip-drag handler κάνει resize/rotate (το pattern να μιμηθείς για text): `hooks/grips/` + ό,τι handler καλεί τα column/wall commands.

---

## 4. ΣΧΕΔΙΟ (Plan Mode — επικύρωσε με τα ευρήματα)

Πιθανή κατεύθυνση (ΕΠΙΒΕΒΑΙΩΣΕ με audit, μην την πάρεις δεδομένη):
1. **Bounding-box grips SSoT:** extract/γενίκευσε ένα `rectBoundingBoxGrips(center, halfW, halfH, rotationDeg)` (ή reuse το `rectColumnGrips` core) → 4 corner + 4 edge-midpoint + center-move + rotation handle. Το καλούν ΚΑΙ rect-column/τοίχος ΚΑΙ text.
2. **`case 'text'`** στο `computeDxfEntityGrips`: αντί 1 center grip → υπολόγισε το text bounding box (position + height + measured width + rotation) και κάλεσε το SSoT #1.
3. **Commands:** σύνδεσε τα grip drags του text με move (υπάρχει) + rotate (→ `rotation`) + resize (→ `height`/scale) μέσω των ΥΠΑΡΧΟΝΤΩΝ view-agnostic commands (reuse, όχι νέα). Ghost === commit.
4. **Tests:** grip count/positions για text (pure), + command behavior.

«Μεγάλοι παίκτες»: Figma/AutoCAD text = bounding-box με 8 handles + rotation, resize = scale του box (διατήρηση aspect ή ελεύθερο), rotate γύρω από center. Επιβεβαίωσε τη σύμβαση με τον Giorgio αν διφορούμενο (lead with concrete example — δες memory `feedback_lead_with_concrete_example`).

---

## 5. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ

- ❌ Μη γράψεις δεύτερο grip renderer / δεύτερο grip store — όλα περνούν από `computeDxfEntityGrips` + `UnifiedGripRenderer` + `AllGripsStore`.
- ❌ Μην αντιγράψεις το rect-grip math στο text case — **κάλεσε** το SSoT.
- ❌ Μη φτιάξεις νέο rotate/resize command αν υπάρχει view-agnostic που δέχεται text.
- ❌ Μην αγγίξεις αρχεία εκτός scope (shared tree με άλλον agent).
- ❌ Μην κάνεις commit.

---

## 6. ΣΧΕΤΙΚΟ ΠΛΑΙΣΙΟ — uncommitted δουλειά ΑΥΤΗΣ της συνεδρίας (μην μπερδευτείς)

Στο ίδιο working tree υπάρχουν **uncommitted** αλλαγές 3D grips (ADR-535/516) από προηγούμενη συνεδρία — **ΑΣΧΕΤΕΣ** με αυτό το task (3D, όχι 2D text):
- **ADR-535 Φ10** (3D grips ακολουθούν gizmo move), **Φ11** (top grips κεκλιμένου τοίχου), **Φ-endpoint-SSoT** (ενοποίηση endpoint rings, διαγραφή `linear-endpoint-world.ts`).
- Νέα SSoT: `bim-3d/grips/grip-3d-screen-project.ts` (`liftGripPlanToWorld`, `addGripWorldOffsets`).
- ⚠️ 3 marker tests στο `bim-3d/gizmo/__tests__/bim-gizmo-overlay.test.ts` σπάνε λόγω **ADR-537** (markers via post-FX, `.visible`→false) — **δουλειά άλλου agent**, ΟΧΙ αυτού του task.

Το ΔΙΚΟ σου task είναι **2D text grips** — διαφορετικό domain (`hooks/grip-computation.ts` + `bim/columns` ή `bim/walls` + `rendering/grips`).

---

## 7. Πρώτη κίνηση στη νέα συνεδρία

1. Δήλωσε μοντέλο (Opus — cross-cutting + αρχιτεκτονική) + μπες **Plan Mode**.
2. Τρέξε το SSoT audit της §3.
3. Παρουσίασε πλάνο στον Giorgio (με συγκεκριμένο αριθμητικό/οπτικό παράδειγμα του text box) πριν υλοποιήσεις.
