# HANDOFF — «Δαχτυλίδι Εντολών» (Radial Command Ring) — in-canvas dynamic input κατά τη σχεδίαση τοίχου

**Ημ/νία:** 2026-06-22
**Τύπος:** NEW feature (Revit/AutoCAD-grade, FULL ENTERPRISE + FULL SSoT) — radial in-canvas parameter input
**Μοντέλο:** Opus (UI + dynamic-input wiring + wall-tool· ~6-8 αρχεία, 2 domains)
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.

---

## 0. ΖΗΤΟΥΜΕΝΟ (Giorgio, verbatim πνεύμα)

Όταν ο χρήστης σχεδιάζει οντότητα (πρώτο target: **τοίχος**), να εμφανίζεται **κοντά στον κέρσορα** ένα
**ραδιακό «δαχτυλίδι εντολών»** (αισθητική σαν τον κύκλο της AutoCAD από το στιγμιότυπο), πάνω στο οποίο
ο χρήστης μπορεί **την ίδια στιγμή, ΧΩΡΙΣ να πάει στο ribbon, να πληκτρολογεί** πάχος / ύψος / μήκος /
γωνία (και ό,τι άλλο είναι χρήσιμο). Δηλαδή in-canvas, live, επεξεργάσιμα πεδία γύρω από τον κέρσορα.

**Revit/AutoCAD-grade, FULL ENTERPRISE + FULL SSoT, μηδέν διπλότυπα.**

### Σχηματικό (στυλ που έχει ήδη επιλέξει ο Giorgio = «Αρχιτεκτονικό HUD» + ring inputs):
```
              ┌ Μήκος ┐   ┌ Γωνία ┐
              │ 3.24 m│   │ 30.0° │
                  ╲    ●    ╱            ● = κέρσορας / τοίχος
              ┌ Πάχος ┐   ┌ Ύψος ┐
              │ 0.20 m│   │ 3.00 m│
   TAB = επόμενο πεδίο · πληκτρολόγησε + Enter = κλείδωμα · ESC = κλείσιμο
```

---

## 1. ΚΡΙΣΙΜΗ ΔΙΕΥΚΡΙΝΙΣΗ (μη χαθείς)

Ο κύκλος στο στιγμιότυπο της AutoCAD είναι το **NavWheel / SteeringWheels** = εργαλείο **ΠΛΟΗΓΗΣΗΣ
κάμερας** (ZOOM/ORBIT/PAN/WALK/REWIND/CENTER/LOOK/UP-DOWN). **ΔΕΝ** είναι εργαλείο δημιουργίας. Δανείσου
ΜΟΝΟ το **οπτικό μοτίβο** (ραδιακό δαχτυλίδι γύρω από τον κέρσορα), ΟΧΙ τη λειτουργία του.

Το πραγματικό AutoCAD feature «πληκτρολογώ τιμές ενώ σχεδιάζω» = **Dynamic Input**. **ΤΟ ΕΧΟΥΜΕ ΗΔΗ**
(βλ. §2). Άρα το ζητούμενο = **ραδιακή παραλλαγή του υπάρχοντος Dynamic Input + BIM παράμετροι**.

---

## 2. SSoT AUDIT — ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ ΚΩΔΙΚΑ (εντολή Giorgio — reuse, ΜΗΝ διπλασιάσεις)

```
# (A) ΥΠΑΡΧΟΝ Dynamic Input system — fields/parser/lock/overlay. REUSE, ΜΗΝ ξαναγράψεις πεδία/parser.
ls src/subapps/dxf-viewer/systems/dynamic-input/
grep -rn "fieldType\|'coordinate'\|'angle'\|'length'\|'radius'\|'diameter'" src/subapps/dxf-viewer/systems/dynamic-input/types.ts src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputField.tsx

# (B) Lock store (length/angle) — REUSE για το κλείδωμα μήκους/γωνίας από το ring.
grep -n "LockedField\|lockLength\|lockAngle\|toggle\|unlock" src/subapps/dxf-viewer/systems/dynamic-input/DynamicInputLockStore.ts

# (C) Parser αριθμών/συντεταγμένων/εκφράσεων — REUSE για validation/parse εισόδου.
sed -n '1,60p' src/subapps/dxf-viewer/systems/dynamic-input/coordinate-parser.ts
sed -n '1,40p' src/subapps/dxf-viewer/systems/dynamic-input/numeric-expression.ts

# (D) ΠΟΥ mount-άρεται + ΠΩΣ τοποθετείται (cursor-follow, ADR-040) το dynamic input σήμερα.
sed -n '1,80p' src/subapps/dxf-viewer/components/dxf-layout/DynamicInputSubscriber.tsx
sed -n '1,120p' src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx

# (E) Ο WRITER των wall overrides (πάχος/ύψος) — το ring ΓΡΑΦΕΙ ΕΔΩ (ΟΧΙ νέο store).
grep -n "setParamOverrides\|WallParamOverrides\|overrides" src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts
grep -n "overrides\|wallPreviewStore.set\|resolveWallThicknessMm" src/subapps/dxf-viewer/hooks/drawing/useWallTool.ts src/subapps/dxf-viewer/hooks/drawing/wall-completion.ts

# (F) Το ΖΩΝΤΑΝΟ HUD (μόλις φτιάχτηκε) — μήκος/γωνία/πάχος/ύψος ΗΔΗ υπολογίζονται· το ring τα κάνει επεξεργάσιμα.
sed -n '1,90p' src/subapps/dxf-viewer/canvas-v2/preview-canvas/wall-hud-paint.ts
grep -n "wallHud\|WallHudMeta\|drawWallHud" src/subapps/dxf-viewer/hooks/drawing/drawing-hover-handler.ts src/subapps/dxf-viewer/hooks/drawing/wall-preview-helpers.ts

# (G) ΥΠΑΡΧΕΙ ΗΔΗ radial/pie/marking menu; (αποφυγή διπλότυπου UI)
grep -rniE "RadialMenu|pie-?menu|marking-?menu|command-?ring|wheel-?menu" src/subapps/dxf-viewer --include=*.tsx
```

### Επιβεβαιωμένα ευρήματα έρευνας (2026-06-22 — μην τα ξανα-ανακαλύψεις από το μηδέν):
- **ΥΠΑΡΧΕΙ πλήρες Dynamic Input system** στο `systems/dynamic-input/`: `DynamicInputSystem.tsx`,
  `components/{DynamicInputOverlay,DynamicInputContainer,DynamicInputField,DynamicInputFields,DynamicInputHeader,DynamicInputFooter}.tsx`,
  `coordinate-parser.ts`, `numeric-expression.ts`, `DynamicInputLockStore.ts`, `useDynamicInput.ts`,
  `keyboard-handlers/`, `hooks/`, `utils/`, `types.ts`.
- **`DynamicInputField` fieldType** = `'coordinate' | 'angle' | 'length' | 'radius' | 'diameter'`. **REUSE το field**
  (focus/parse/commit) — πρόσθεσε `'thickness'`/`'height'` αν χρειαστεί (ή generic numeric field).
- **`DynamicInputLockStore`** = `LockedField 'length'|'angle'` + `lockLength/lockAngle/toggle/unlock`.
  Το ring κλειδώνει μήκος/γωνία μέσω ΑΥΤΟΥ (μηδέν νέο lock μηχανισμό).
- **Mount:** `components/dxf-layout/DynamicInputSubscriber.tsx` (cursor-follow positioning, ADR-040-safe).
  Το ring είτε επεκτείνει αυτό είτε mount-άρεται με τον ίδιο τρόπο.
- **Wall overrides writer (SSoT):** `ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts` →
  **`setParamOverrides(overrides: WallParamOverrides)`** + `wallPreviewStore.set({overrides})` στο `useWallTool`.
  Το ring γράφει πάχος/ύψος **ΕΚΕΙ** → το φάντασμα + το commit αντιδρούν (preview≡commit). **ΟΧΙ νέο store.**
- **Live HUD (μόλις committed-pending):** `canvas-v2/preview-canvas/wall-hud-paint.ts` (`WallHudMeta`:
  start/end/lengthMm/angleDeg/thicknessMm/heightMm/sceneUnits) + `drawing-hover-handler` διαβάζει `wallHud`.
  Μήκος/γωνία/πάχος/ύψος **ΗΔΗ υπολογίζονται** — το ring απλώς τα κάνει **επεξεργάσιμα**.
- **ΔΕΝ υπάρχει** radial/pie/marking-menu component (τα grep hits «radial» είναι ακτινικά **μαθηματικά**
  σε geometry, ΟΧΙ UI). Άρα η ραδιακή διάταξη είναι νέα — αλλά τα **πεδία/parser/lock** είναι reuse.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΥΛΟΠΟΙΗΣΗ (FULL SSoT — κλείδωσε σε Plan Mode πριν τον κώδικα)

1. **NEW radial layout component** (π.χ. `systems/dynamic-input/components/RadialCommandRing.tsx`):
   - Ραδιακή διάταξη N slots γύρω από κέντρο· κάθε slot = **υπάρχον `DynamicInputField`** (reuse focus/parse/commit).
   - Slots για τοίχο: **Μήκος, Γωνία, Πάχος, Ύψος** (επεκτάσιμο: κατηγορία/flip).
   - **TAB** = επόμενο slot· **πληκτρολόγηση + Enter** = lock/commit τιμής· **ESC** = κλείσιμο.
2. **Wiring (SSoT writers — ΜΗΝ φτιάξεις νέους):**
   - Μήκος/Γωνία → **`DynamicInputLockStore`** (lockLength/lockAngle) → το ghost ακολουθεί (ήδη wired στο `drawing-hover-handler`).
   - Πάχος/Ύψος → **`wall-tool-bridge-store.setParamOverrides`** (ή το ισοδύναμο overrides path του `useWallTool`) → ghost reactive.
   - Αρχικές τιμές πεδίων ← από το **`WallHudMeta`** (live) + `wallPreviewStore.overrides`.
3. **Mount + θέση (ADR-040):** mirror `DynamicInputSubscriber`/`DynamicInputOverlay` (cursor-follow μέσω refs,
   ΟΧΙ React state per-frame). Εμφάνιση **on-demand** (π.χ. μετά το 1ο κλικ / με πλήκτρο) ώστε να μην κρύβει το σχέδιο.
4. **Focus management (κρίσιμο, AutoCAD-grade):** ενώ ένα field έχει focus, η πληκτρολόγηση πάει στο field·
   το mouse-move εξακολουθεί να ενημερώνει το ghost (μη-locked πεδία). Δες πώς το λύνει το υπάρχον
   `DynamicInputOverlay`/`keyboard-handlers` και **reuse** το ίδιο pattern.
5. **i18n (N.11):** labels (Μήκος/Γωνία/Πάχος/Ύψος) → `tools.wall.*` στο `dxf-viewer-shell.json` (el+en).
6. **Tests:** parser/format reuse → unit tests στη ραδιακή γεωμετρία (slot angles) + commit-wiring (lock/overrides).

---

## 4. ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (εκτίμηση — όλα UNCOMMITTED, shared tree)
- `systems/dynamic-input/components/RadialCommandRing.tsx` **[NEW]** (+ test) — δικό σου, ασφαλές.
- `systems/dynamic-input/components/DynamicInputField.tsx` — αν χρειαστεί `'thickness'/'height'` fieldType (behavior-preserving).
- `components/dxf-layout/DynamicInputSubscriber.tsx` — mount του ring (⚠️ ADR-040 CHECK 6B/6D).
- `ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts` ή `useWallTool.ts` — κατανάλωση `setParamOverrides` (μηδέν νέο store).
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — labels (⚠️ shared).
- ADR: **έλεγξε για υπάρχον dynamic-input ADR** (grep `dynamic input` στο adr-index)· αλλιώς ΝΕΟ ADR
  (επόμενο ελεύθερο μετά το ADR-512 → πιθανώς **ADR-513**) «Radial Command Ring / in-canvas dynamic input».
  Stage ADR-040 (overlay) μαζί.

---

## 5. ⚠️ ΜΗΝ ΣΠΑΣΕΙΣ
1. **Υπάρχον (γραμμικό) Dynamic Input** — το ring είναι ΕΠΙΠΛΕΟΝ/εναλλακτική διάταξη, ΟΧΙ αντικατάσταση· reuse τα fields.
2. **Τοίχος 2-click + ghost HUD (§wall-hud) + opening-conflict (§opening-conflict)** — μόλις φτιάχτηκαν, μην τα χαλάσεις.
3. **ADR-040** — HTML overlay ΔΕΝ re-render-άρει ανά frame (refs, on-demand). CHECK 6B/6D αν αγγίξεις overlay/hover.
4. **wallPreviewStore.overrides** = ο μόνος δρόμος αλλαγής πάχους/ύψους του ghost — γράψε εκεί, μη φτιάξεις παράλληλο.

---

## 6. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **SSoT audit (grep §2) ΠΡΙΝ κώδικα** — εντολή Giorgio. Reuse Dynamic Input fields/parser/lock + wall overrides writer + WallHudMeta. **ΜΗΝ φτιάξεις νέο input/parser/lock/overrides store.**
- **Plan Mode πρώτα** (6-8 αρχεία) — κλείδωσε με Giorgio: slots/layout, focus model, πότε εμφανίζεται (on-demand vs always), TAB-order.
- **N.17:** ΕΝΑΣ tsc τη φορά (έλεγξε process πριν). **N.(-1.1):** ΟΧΙ `--no-verify`. **N.11:** ΟΧΙ hardcoded strings (labels → i18n).
- **Shared tree:** `git add` ΜΟΝΟ δικά σου. **COMMIT ο Giorgio.**
- jest + tsc + browser-verify.

## 7. DEFINITION OF DONE
- Κατά τη σχεδίαση τοίχου, ραδιακό δαχτυλίδι κοντά στον κέρσορα με επεξεργάσιμα Μήκος/Γωνία/Πάχος/Ύψος· TAB cycle· type+Enter lock/commit· ESC κλείσιμο· χωρίς ribbon.
- Reuse Dynamic Input (fields/parser/lock) + wall overrides writer (`setParamOverrides`) + WallHudMeta — μηδέν διπλότυπο (Giorgio SSoT audit).
- i18n el+en· jest GREEN· tsc clean· browser-verified. ADR (νέο ή υπάρχον) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15). **Commit: Giorgio.**

---

## 8. ΣΧΕΤΙΚΑ (context)
- `[[reference_wall_live_hud]]` — το ζωντανό HUD (μήκος/γωνία/πάχος/ύψος ήδη υπολογισμένα).
- `[[reference_wall_ghost_blocks_opening]]` — opening-conflict (ίδιο meta-overlay pattern).
- ADR-508 §wall-hud + §opening-conflict — το wall ghost drawing subsystem.
