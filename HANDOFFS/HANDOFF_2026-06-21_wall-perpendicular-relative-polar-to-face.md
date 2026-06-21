# HANDOFF — Wall 2nd-click: relative-polar snap ως προς παρειά υφιστάμενου τοίχου (Revit-grade)

**Ημ/νία:** 2026-06-21
**Από:** προηγούμενη συνεδρία (SSoT audit ολοκληρωμένο, ΚΑΜΙΑ υλοποίηση ακόμη)
**Κατάσταση:** 🔵 READY TO IMPLEMENT — audit done, plan locked, μηδέν κώδικας γραμμένος
**Μοντέλο:** Opus 4.8 (σύνθετο: snap pipeline + wall tool + νέο relative-polar SSoT)
**⚠️ Working tree SHARED με άλλον agent** — stage ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `git add -A`. **COMMIT τον κάνει ο Giorgio, ΟΧΙ εσύ.**

---

## 0. ΠΡΙΝ ΞΕΚΙΝΗΣΕΙΣ — διάβασε
- `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (north-star: ο τοίχος είναι μέλος του ζωντανού οργανισμού· η σύνδεση κάθετα σε υφιστάμενο τοίχο εξυπηρετεί σωστή τοπολογία).
- `ADR-508-unified-linear-member-framing.md` (το `bim/framing/` SSoT· «2ο κλικ ΕΛΕΥΘΕΡΟ» — αυτό αλλάζουμε ελεγχόμενα).
- `ADR-398-column-placement-snap.md` §3.x (το **preview ≡ commit dual-path** pattern: ΙΔΙΟΣ resolver σε move/scheduler ΚΑΙ σε mouse-handler-up/commit).
- **Κανόνας SSoT (Giorgio, ισχυρός):** πριν γράψεις, ξανα-grep. Μη φτιάξεις διπλότυπο. Επέκτεινε υπάρχον.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (από Giorgio + screenshot `Στιγμιότυπο οθόνης 2026-06-21 204029.jpg`)

Υφιστάμενος **λοξός** τοίχος. Ο χρήστης: εργαλείο «Τοίχος» → τρέχει κέρσορα στη **ΒΑ παρειά** του λοξού → εμφανίζεται ghost (smart ghost-before-click, ADR-508) → **1ο κλικ** κουμπώνει το start στη ΒΑ παρειά → τραβάει για **2ο κλικ**.

Στο 2ο κλικ το ghost **περιστρέφεται γύρω από το start** (σημείο «3», στον άξονα, πάνω στη ΒΑ παρειά). Οι 2 γωνίες της **ΝΔ βάσης** (πλάτος στο start): γωνία «1» χώνεται **μέσα** στον υφιστάμενο τοίχο, γωνία «2» **απομακρύνεται** (ανοίγει κενό). Τίποτα δεν κλειδώνει τη σωστή γωνία.

```
        υφιστάμενος λοξός τοίχος (ΒΔ + ΒΑ παρειές)
                 ╱╱
   νέος ghost   ╱╱  ← ΒΑ παρειά (reference)
   ┌──────┐   ╱╱
   │      │  ╱╱
 (1)└──────┘(2)   ← ΝΔ βάση νέου τοίχου = 2 γωνίες
        ╳ (3)      ← start = 1ο κλικ, στον άξονα, flush στη ΒΑ παρειά
```

## 2. ΤΙ ΘΕΛΕΙ Ο GIORGIO (locked)
Κατά την περιστροφή (2ο κλικ), **έλξεις/μαγνήτες** ώστε ο νέος τοίχος να κουμπώνει σε γωνίες **ΣΧΕΤΙΚΕΣ ως προς τη ΒΑ παρειά**:
- **Επιλογή Giorgio:** «**Κάθετα (90°) + πολλαπλά 15°/30°/45°**» = **relative-polar** ως προς την παρειά (πλήρες Revit «angle relative to face»).
- Στις **90°** (το κύριο use-case της εικόνας): ο νέος τοίχος κάθετος στην παρειά → οι **2 γωνίες της ΝΔ βάσης κάθονται flush** στη ΒΑ παρειά (καμία μέσα, καμία κενό). Αυτό προκύπτει **αυτόματα** από το 90° + το ότι το start είναι ήδη flush.
- Στις 15/30/45 (και τα 180° mirrors): απλώς relative-angle snap (μόνο το start μένει στην παρειά).

---

## 3. SSoT AUDIT — ΕΥΡΗΜΑΤΑ (γίνε ξανά grep για επιβεβαίωση, shared tree)

### Υπάρχει ήδη (REUSE — ΜΗ διπλότυπο):
| Σύστημα | Αρχείο | Τι κάνει |
|---|---|---|
| **POLAR (world)** | `systems/constraints/polar-utils.ts` `applyPolar(point, ref, config)` | snap σε `incrementAngle` multiples + `additionalAngles`, world-frame. **ΧΩΡΙΣ baseAngle.** |
| **Polar config** | `systems/constraints/polar-tracking-store.ts` | SSoT increment (default 15°) + additionalAngles, persisted. |
| **Angle step** | `systems/constraints/constraints-geometry.ts` `AngleUtils.snapAngleToStep(angle, step, tol)` | core snap-to-increment· returns null εκτός tol. |
| **Relative frame math** | `constraints-geometry.ts` `CoordinateUtils.cartesianToPolar/polarToCartesian(p, base, baseAngle)` | **ΗΔΗ δέχονται `baseAngle`** — τα building blocks για relative-polar. |
| **ORTHO** | `hooks/drawing/drawing-handler-utils.ts` `hardOrtho(point, ref)` | H/V constraint, hot-path SSoT. |
| **Member face snap (ghost)** | `bim/framing/member-ghost-snap.ts` `resolveMemberGhostSnapFromStore(...)` → `{start, end, status}` | click-1 resolver. **`end - start` = perpendicular-to-face direction** (από `linear-member-face-snap.ts` `end = start + outwardSign*len*p`, p=face normal). status `'beam'` = long-face. |
| **Frame normal math** | `bim/geometry/shared/polygon-axis-projection.ts` `projectPointOnAxis(px,py,ax,ay,ux,uy)→{along,perp}` | dot-product projection SSoT. |
| **BIM drawing constraint SSoT (preview≡commit)** | `hooks/drawing/bim-ortho-reference.ts` `getBimOrthoReference(tool)` (preview) + `applyBimDrawingConstraint(tool, point)` (commit) | το ΕΝΑ σημείο που πρέπει να εφαρμόζει ΚΑΙ τη νέα constraint, ώστε preview===commit. |
| **Hover pipeline** | `hooks/drawing/drawing-hover-handler.ts` `processDrawingHover` (~74-317) | σειρά: ortho(131) → polar(134-141) → snap-override(147) → tracking → adaptive → dynamic-lock → updatePreview. **Hook-in: μετά το polar (γρ.~141).** |

### ΔΕΝ υπάρχει (πρέπει να φτιαχτεί — ελάχιστο, ως επέκταση):
1. **Relative-polar hot-path.** Το `applyPolar` είναι world-only. → **Επέκτεινε το `applyPolar` με optional `baseAngle` param (default 0 = backward-compat world).** ΕΝΑ function καλύπτει world ΚΑΙ relative — μηδέν διπλότυπο. (Reuse `AngleUtils.snapAngleToStep` εσωτερικά με `rawAngle - baseAngle`.) **ΜΗ φτιάξεις νέο `applyPolarRelative` αν το baseAngle param αρκεί.**
2. **Αποθήκευση της reference-face direction από το click-1.** Σήμερα `resolveWallStartAnchor` (`useWallTool.ts`) κρατά ΜΟΝΟ `{start, anchored}` — η `snap.end - snap.start` (face normal) **πετιέται**.

---

## 4. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (FULL SSoT, Revit-grade)

> ⚠️ Όλες οι γραμμές παρακάτω είναι από audit της 2026-06-21 — **re-grep πριν edit** (shared tree).

### Step A — Capture & store τη face direction στο click-1
- `hooks/drawing/wall-tool-types.ts`: πρόσθεσε `startFaceAngle: number | null` (ή `startFaceNormal: Point2D | null`) στο `WallToolState` + `INITIAL_STATE = null`.
- `bim/walls/wall-preview-store.ts`: πρόσθεσε ίδιο field στο `WallPreviewState` + `WallPreviewSet`, **preserve στο `set()`** (mirror `startAnchored`), init `null`.
- `hooks/drawing/useWallTool.ts` `resolveWallStartAnchor` (~106-117): όταν `snap && snap.status === 'beam'` → `faceNormal = normalize(snap.end - snap.start)` (reuse vector util· **grep για normalize SSoT** πριν γράψεις δικό σου). Επέστρεψέ το· store στο click-1 handler (~301-316) σε `setState` + `wallPreviewStore.set`.
- Για **κολώνα-target** (`resolveMemberColumnFaceSnap` → `face: E/W/N/S`): η normal είναι axis-aligned· κάλυψέ το αν θες, αλλιώς prioritize wall-face (το use-case της εικόνας).

### Step B — Relative-polar SSoT (επέκταση, ΟΧΙ διπλότυπο)
- `systems/constraints/polar-utils.ts` `applyPolar`: πρόσθεσε optional `config.baseAngle = 0`. Στον υπολογισμό: snap το `rawAngle` σε `baseAngle + k*increment` (+ additionalAngles ομοίως offset). Reuse `AngleUtils.snapAngleToStep(rawAngle - baseAngle, increment, tol)` + add back. **Backward-compat:** baseAngle=0 → ταυτόσημο με σήμερα (κλείδωσέ το με test).
- Το `baseAngle` = η γωνία της παρειάς = `atan2(faceNormal.y, faceNormal.x)` (ή της face direction). Έτσι 90° relative = κάθετο στην παρειά.

### Step C — Εφάρμοσε σε preview ΚΑΙ commit (preview≡commit, ADR-398/508)
- **Preview:** `drawing-hover-handler.ts` μετά το `applyPolar` (~141): αν `activeTool==='wall'` && phase `awaitingEnd` && `startFaceAngle != null` → εφάρμοσε relative-polar (call `applyPolar` με `baseAngle=startFaceAngle`) στο `previewPt`. (Ή κάν' το μέσα στο `bim-ortho-reference` ώστε να μοιραστεί με commit.)
- **Commit:** `hooks/drawing/use-wall-commit.ts` `commitStraightFromState` (~104-149) **Ή** `bim-ortho-reference.ts` `applyBimDrawingConstraint('wall', point)`: ΙΔΙΑ projection πριν χτιστούν τα params. **ΑΥΤΟ είναι κρίσιμο** — αλλιώς ghost ≠ τελικός τοίχος.
- **Προτίμησε** να μπει η constraint σε ΕΝΑ helper που καλείται από αμφότερα τα paths (mirror `applyBimDrawingConstraint`), όχι copy-paste.

### Step D — (προαιρετικό, αν θες πλήρες Revit) οπτική ένδειξη
- Δείξε perpendicular/relative tick + tooltip (reuse `drawPolarTrackingLine` στο `PreviewCanvas`/`PreviewRenderer` που ήδη ζωγραφίζει `"45.0° / 125.3"`). Μαγνήτες στις 2 base γωνίες = συνέπεια του 90° snap (δεν χρειάζεται ξεχωριστό marker subsystem· επιβεβαίωσε με Giorgio αν θέλει ρητό glyph).

### Step E — Tests (Google presubmit)
- `polar-utils` baseAngle: world (baseAngle=0) αμετάβλητο· relative (baseAngle=θ) snap σε θ+{0,15,30,45,90}±180· εκτός tol → δεν αλλάζει.
- click-1 capture: status 'beam' → αποθηκεύεται faceAngle· status overlap/short-end → null.
- preview≡commit parity: ίδιο projected endPoint από preview path και commit path.
- regression: ADR-508 wall/beam ghost GREEN, drawing-hover ortho/polar GREEN.

---

## 5. ADR + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY (N.15 — ίδιο commit με κώδικα)
- **ADR:** επέκτεινε **ADR-508** (νέα §: «wall 2nd-click relative-polar-to-face») + σημείωσε στο **ADR-398** §3.x αν αγγίξεις τον dual-path. Αν το relative-polar γίνει γενικό SSoT, σημείωσέ το στο polar-utils header. (Μη δημιουργήσεις νέο ADR αν χωράει στο 508.)
- **ΕΚΚΡΕΜΟΤΗΤΕΣ** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`: 1-2 γραμμές (τι εκκρεμεί: browser-verify + commit).
- **MEMORY.md**: reference entry (relative-polar-to-face) + link [[reference_transform_redraw_dirty_scheduler_ssot]] στυλ.

## 6. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **CHECK 6B/6D:** `drawing-hover-handler.ts` / preview path = canvas-drawing-adjacent → αν μπλοκάρει, **stage ADR-508 (+ADR-398/ADR-040 αν χρειαστεί)**.
- **N.17 single-tsc:** πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος (shared machine). ΕΝΑ tsc τη φορά.
- **Shared tree:** `git add` ΜΟΝΟ τα δικά σου αρχεία (λίστα: wall-tool-types, wall-preview-store, useWallTool, polar-utils, drawing-hover-handler/bim-ortho-reference, use-wall-commit, + NEW tests, + ADR-508). **ΟΧΙ commit — ο Giorgio.**
- **i18n (N.11):** αν προσθέσεις tooltip/label → keys σε `el` + `en` JSON πρώτα, μηδέν hardcoded.
- **Μην `any`/`as any`.**

## 7. ΠΡΩΤΟ ΒΗΜΑ ΣΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ
1. Re-grep: `applyPolar`, `resolveWallStartAnchor`, `wall-preview-store`, `bim-ortho-reference`, `commitStraightFromState` (επιβεβαίωση γραμμών — shared tree).
2. Επιβεβαίωσε με Giorgio ότι το «flush και οι 2 γωνίες» αφορά κυρίως το 90° (τα 15/30/45 = απλό relative-angle).
3. Υλοποίησε Step A→E. Plan Mode (≈6-8 αρχεία, 1-2 domains: drawing + constraints).
