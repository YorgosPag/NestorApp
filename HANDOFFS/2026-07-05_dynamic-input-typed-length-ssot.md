# HANDOFF — Πληκτρολόγηση μήκους κατά τη σχεδίαση (Dynamic Input) ως ΕΝΑ SSoT για DXF+BIM

**Ημερομηνία:** 2026-07-05
**Σχετικά ADR:** ADR-357 (Object Snap Tracking + **Dynamic Input**, το κύριο), ADR-510 Φ1 (math στα πεδία), ADR-098 (timing), ADR-462/units (mm↔display), ADR-040 (CHECK 6D αν αγγίξεις canvas/preview)

---

## 🎯 ΣΤΟΧΟΣ (τα λόγια του Giorgio)

Στο εργαλείο **Γραμμή**: 1ο κλικ στον καμβά → κινώ κέρσορα → αντί για 2ο κλικ, **σταθεροποιώ τον κέρσορα και πληκτρολογώ μία τιμή** → αυτό = **το μήκος της γραμμής**. Η πληκτρολόγηση να δέχεται **και `2,5` και `2.5`** (κόμμα ή τελεία). Η λογική να γίνει **ΜΙΑ και μοναδική πηγή αλήθειας (ξεχωριστό αρχείο)** που να καλύπτει **ΟΛΕΣ** τις αντίστοιχες περιπτώσεις οντοτήτων **DXF και BIM** (γραμμή, τοίχος, δοκός, κ.λπ.).

## 🚨 ΚΡΙΣΙΜΟ — ΤΟ FEATURE ΜΑΛΛΟΝ ΥΠΑΡΧΕΙ ΗΔΗ (μη το ξαναφτιάξεις)

Προκαταρκτικό recon (2026-07-05) βρήκε **ολόκληρο υπάρχον subsystem** `src/subapps/dxf-viewer/systems/dynamic-input/` (ADR-357). Ειδικά το:

- **`systems/dynamic-input/keyboard-handlers/line-keyboard-handler.ts`** — κάνει **ΑΚΡΙΒΩΣ** το ζητούμενο: μετά το 1ο κλικ (`firstClickPoint`), πληκτρολογείς **Μήκος** (+ Angle, Tab cycle Length→Angle), Enter → υπολογίζει `worldPoint = firstClickPoint + lengthMm·(cos,sin)` και κάνει `dispatchDynamicSubmit({action:'add-point', coordinates, length, angle})` μέσω του **κανονικού** drawing pipeline (`onDrawingPoint` — snap/ortho/polar/persistence). ΟΧΙ direct entity creation.
- Comma/dot: γίνεται μέσω `normalizeNumber(...)` (context) + **`fromDisplay(value, displayUnit)`** (`config/units.ts`) → display→mm. Math expressions: `evalExpr` (ADR-510). Coordinate syntax (`100,50`, `@100<45`): `coordinate-parser.ts`.
- Άλλα σχετικά: `line-ring-config.ts`, `wall-ring-config.ts`, `length-angle-lock.ts`, `useDynamicInputRealtime.ts`, `DynamicInputField(s).tsx`, `DynamicInputLockStore.ts`, `radial-ring-logic.ts`, `numeric-expression.ts`.

**➡️ Άρα ΔΕΝ είναι green-field.** Πιθανές αιτίες που ο Giorgio «δεν το βλέπει να δουλεύει»:
1. Το **ΔΥΝ toggle** (Dynamic Input, F-key στο status bar — φαινόταν **OFF/γκρι** στο screenshot 145244) πρέπει να είναι **ON** για να εμφανιστούν τα πεδία.
2. Ίσως λείπει το **AutoCAD «heads-up» auto-focus**: να αρχίσεις να πληκτρολογείς **αριθμό** και να πηγαίνει **αυτόματα** στο πεδίο Μήκος **χωρίς** να κάνεις Tab/κλικ στο πεδίο. Αυτό είναι το πιθανότερο πραγματικό κενό.
3. Ίσως δουλεύει για `line` αλλά **όχι** ενοποιημένα για BIM tools (wall/beam) → ο ανά-tool handler = πιθανό διπλότυπο.

## 🔎 PHASE 1 — ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Ο Giorgio το απαιτεί ρητά. Κάνε **πραγματικό** audit — μην υποθέσεις:

1. `grep -rn "line-keyboard-handler\|handleLineKeyboard\|dispatchDynamicSubmit" src/subapps/dxf-viewer` — δες πώς δρομολογείται το typed input σήμερα (ποιος καλεί τον handler, ποιο store/hook).
2. `grep -rn "keyboard-handlers" src/subapps/dxf-viewer/systems/dynamic-input` — δες **πόσοι** per-tool handlers υπάρχουν (line/wall/…). Αν η λογική «typed length → point κατά τη διεύθυνση» είναι **αντιγραμμένη** ανά tool → **ΕΔΩ είναι η κεντρικοποίηση** (ένα SSoT resolver, τον καλούν όλοι).
3. `grep -rn "normalizeNumber\|fromDisplay\|evalExpr\|parseCoordInput" src/subapps/dxf-viewer/systems/dynamic-input` — επιβεβαίωσε το **υπάρχον** parse SSoT για κόμμα/τελεία + math + coords. **ΜΗΝ φτιάξεις νέο parser** — αυτά ήδη δέχονται `2,5`/`2.5`.
4. Βρες το **ΔΥΝ toggle** gating: `grep -rn "DynamicInputLock\|isDynOn\|dynamicInput.*enabled\|ΔΥΝ" src/subapps/dxf-viewer` (statusbar/CadStatusBar, cad-toggle-state, useCadToggles). Δες αν το typed-length απαιτεί ΔΥΝ ON και τι θέλει ο Giorgio (μάλλον: να δουλεύει με ΔΥΝ ON, AutoCAD-style).
5. Ψάξε αν υπάρχει ήδη **auto-focus-on-digit** (heads-up): `grep -rn "onKeyDown\|isDigit\|/^[0-9]/\|beginTyping\|autoFocus" systems/dynamic-input hooks/canvas/useCanvasKeyboardShortcuts.ts`. Αυτό είναι το πιθανό κενό.
6. **Big-player check (Revit/AutoCAD/C4D/Figma):** AutoCAD «Dynamic Input» = πληκτρολογείς και αμέσως γεμίζει το πεδίο Length· Tab αλλάζει σε Angle. Revit = temporary dimension text edit. Άρα η ζητούμενη συμπεριφορά είναι **industry-standard** → σωστή. Ακολούθησε το AutoCAD dynamic-input pattern.

## 🧩 ΤΙ ΝΑ ΠΑΡΑΔΩΣΕΙΣ (μετά το audit, με plan έγκριση Giorgio)

- **ΕΝΑ SSoT resolver** (νέο αρχείο, π.χ. `systems/dynamic-input/typed-length-to-point.ts`) που, δοθέντων `{ anchor, direction (ή cursor για διεύθυνση), typedLengthDisplay, displayUnit }`, επιστρέφει το `worldPoint` (μέσω `fromDisplay` → mm, κατά τη **ζωντανή διεύθυνση κέρσορα** ή το typed angle). Να τον καλούν **όλοι** οι draw handlers (line + BIM wall/beam/…), αντί να επαναλαμβάνουν το `anchor + len·(cos,sin)`.
  - ⚠️ Αν το `line-keyboard-handler` **ήδη** έχει αυτόν τον υπολογισμό (γρ. 149-155), **εξάγαγέ τον** στο SSoT και κάνε τον handler να τον καταναλώνει (μηδέν διπλότυπο — μοτίβο «extract & reuse», όχι νέα μηχανή).
- Αν λείπει το **heads-up auto-focus** (άρχισε να πληκτρολογείς → πάει στο Length χωρίς Tab): πρόσθεσέ το στο **ΕΝΑ** κοινό σημείο (κοινός keyboard entry point), όχι per-tool.
- **Κόμμα/τελεία**: επιβεβαίωσε ότι το υπάρχον `normalizeNumber`/parse SSoT δέχεται **και** τα δύο· αν όχι, διόρθωσε **στο SSoT** (όχι νέος parser).

## ⚠️ CONSTRAINTS (ΚΡΙΣΙΜΑ)

- **FULL ENTERPRISE + FULL SSoT, Revit/Maxon(C4D)/Figma-level.** ΜΗΝ δημιουργήσεις διπλότυπο parser/resolver — reuse `fromDisplay`/`normalizeNumber`/`evalExpr`/`coordinate-parser`. Αν κάτι είναι αντιγραμμένο ανά tool → κεντρικοποίησέ το (ΔΙΑΤΑΓΗ Giorgio: κεντρικοποιείς και προϋπάρχοντα διπλότυπα που δεν έφτιαξες εσύ).
- **ΠΡΙΝ «τελείωσα»: grep το ΔΙΚΟ σου diff** για SSoT (midpoint/normal/dot/scale/parse) — μη ξαναφτιάξεις κάτι που υπάρχει (μάθημα από 2026-07-05: είχα φτιάξει `calculateMidpoint`/`canvasToMmScaleFor` inline διπλότυπα).
- **ΟΧΙ `tsc`** από agent (N.17). **jest επιτρέπεται** (υπάρχουν ήδη `line-keyboard-handler.test.ts`, `coordinate-parser.test.ts`, `length-angle-lock.test.ts` — τρέξε/επέκτεινέ τα).
- **ADR-040 CHECK 6D/6B (BLOCKING):** αν αγγίξεις canvas/preview/cursor αρχεία → stage ADR-040 στο ίδιο commit. Το ADR owner εδώ = **ADR-357** (Dynamic Input) — ενημέρωσε το changelog του (Phase 3).
- **Commit ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΟΧΙ ο agent.** Ετοίμασε → σταμάτα → ανάφερε.
- **SHARED WORKING TREE με άλλον agent** (τρέχουν WAVE 2.x sessions: createExternalStore/store-alias). **ΠΟΤΕ** `git add -A` / bulk reset/restore / checkout άλλων αρχείων. Μόνο specific `git add <file>` + verify `git diff --cached`. Στο τελευταίο status υπήρχε ξένο `systems/mep-design/water/water-proposal-store.ts` (M) — **ΜΗΝ το αγγίξεις**.

## ✅ VERIFICATION

- **jest** στοχευμένα: `line-keyboard-handler.test.ts` + νέα tests για το SSoT resolver (typed `2,5` και `2.5` → ίδιο mm· length κατά τη διεύθυνση κέρσορα· BIM tool parity).
- **browser (τοπικά, ΟΧΙ push):** Γραμμή → 1ο κλικ → **ΔΥΝ ON** → πληκτρολόγησε `2,5` (και ξανά `2.5`) → Enter → γραμμή 2,5 (display unit) κατά τη διεύθυνση κέρσορα. Έλεγξε και ένα BIM tool (τοίχος) για parity.
- **verify skill** στο τέλος.

## 📌 ΞΕΚΙΝΑ ΕΤΣΙ

1. Διάβασε **ADR-357** (Dynamic Input section) + `line-keyboard-handler.ts` (ήδη ξέρεις το περιεχόμενο από αυτό το handoff).
2. Κάνε το **Phase 1 audit (grep)** παραπάνω — βρες **τι ακριβώς λείπει** (auto-focus-on-digit; ΔΥΝ gating; BIM parity; διπλότυπο ανά tool).
3. Παρουσίασε **plan** στον Giorgio (τι υπάρχει / ποιο το πραγματικό κενό / πού το ΕΝΑ SSoT) **πριν** γράψεις κώδικα.
