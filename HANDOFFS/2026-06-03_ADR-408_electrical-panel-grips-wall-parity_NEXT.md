# HANDOFF — 2026-06-03 — Ηλεκτρικός Πίνακας: πλήρες grip UX «wall-parity» (mirror φωτιστικού/κολώνας)

> Γλώσσα: ο Giorgio γράφει/διαβάζει **Ελληνικά** — απάντα ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> Μοντέλο: **Opus**. Κάνε RECOGNITION πρώτα (διάβασε τον τρέχοντα κώδικα — code = source of truth).
> **COMMIT/PUSH: ΜΟΝΟ ο Giorgio (N.(-1)).** Το **working tree μοιράζεται με άλλον agent** → ΠΟΤΕ `git add -A`,
> ΠΟΤΕ checkout/restore αρχείου άλλου agent, stage ΜΟΝΟ τα δικά σου αρχεία.

---

## 🎯 ΕΠΟΜΕΝΟ TASK

**Εφάρμοσε στον `electrical-panel` ΟΛΑ όσα έγιναν για το `mep-fixture` (φωτιστικό) + `column` (κολώνα):**
πλήρες 2D grip UX «όπως ο τοίχος» — **FULL SSOT, ΜΗΔΕΝ διπλότυπο, ΜΗΔΕΝ raw cos/sin.**

Συγκεκριμένα ο πίνακας πρέπει να αποκτήσει:
1. **Παραμετρικές λαβές** στην κάτοψη: move (κέντρο) + rotation (handle) + 4 γωνίες resize (opposite-corner-anchored).
2. **Hot-grip UX (AutoCAD)**: move 3-click (σημείο βάσης → προορισμός, Ctrl=copy)· rotation 6-click ROTATE→Reference
   (κέντρο → γραμμή αναφοράς 2σημ → γραμμή ευθυγράμμισης 2σημ)· γωνίες 2-click.
3. **Μηνύματα status bar** σε κάθε βήμα (έρχονται ΔΩΡΕΑΝ — generic).
4. **Οδηγητικές/rubber-band/ref-align γραμμές** (ΔΩΡΕΑΝ — generic).
5. **Live ghost** κατά το drag (footprint polygon) + toolbar Move tool ghost.
6. **Ctrl-copy** κατά τη μετακίνηση.

---

## 🔑 ΚΡΙΣΙΜΗ ΑΡΧΗ (μην την ξεχάσεις)

**ΔΕΝ υπάρχει «κώδικας τοίχου/φωτιστικού».** Το grip σύστημα είναι **ήδη entity-agnostic SSoT**· κάθε entity
συμμετέχει με **ΕΓΓΡΑΦΗ σε κοινούς πίνακες**, ΟΧΙ με δικό κώδικα. Άρα «εφάρμοσε τον ίδιο κώδικα» =
**κατέγραψε τον πίνακα στις ΙΔΙΕΣ πύλες** (μηδέν fork, μηδέν copy-paste λογικής).

**SSoT helpers που ΠΡΕΠΕΙ να χρησιμοποιήσεις (δημιουργήθηκαν 2026-06-02, NEVER raw cos/sin):**
- `bim/grips/grip-math.ts`:
  - `sweptAngleDegAboutPivot(pivot, anchor, current)` — anchor-relative swept angle (6-click rotate) + degenerate guard.
  - `rotateVector(v, deg)` — local-frame → world (offset vectors / handle positions).
  - `projectToLocalFrame(v, deg)` — world → local axes (corner resize projection).
  - (όλα delegate στο canonical `rotatePoint`, `utils/rotation-math.ts`, ADR-188 — ΜΙΑ cos/sin σε όλο το repo.)

---

## 🧭 ΤΡΕΧΟΝ STATE ΠΙΝΑΚΑ (RECOGNITION — επιβεβαιωμένο 2026-06-03)

| Τι | Κατάσταση |
|----|-----------|
| `bim/types/electrical-panel-types.ts` | params: `shape` (**μόνο 'rectangular'** — ΟΧΙ circular), `position`, `rotation`, `width`, `length`, `bodyHeightMm`, `mountingElevationMm`. Ίδια δομή με fixture **εκτός** circular. |
| `bim/electrical-panels/electrical-panel-geometry.ts` | `computeElectricalPanelGeometry` + `validateElectricalPanelParams` (geometry.footprint.vertices) — έτοιμα. |
| `bim/renderers/ElectricalPanelRenderer.ts` `getGrips()` (~γρ.106) | **Επιστρέφει ΜΙΑ hard-coded κεντρική grip** (gripIndex 0, ΧΩΡΙΣ gripKind) — όπως το φωτιστικό προ-v0.6.1. ΠΡΕΠΕΙ rewrite. |
| `core/commands/.../UpdateElectricalPanelParamsCommand.ts` | ✅ Υπάρχει (merge window για drag). |
| `hooks/drawing/electrical-panel-completion.ts` `buildElectricalPanelEntity` (~γρ.111) | ✅ Υπάρχει (για copy). |
| `bim/electrical-panels/add-electrical-panel-to-scene.ts` | ✅ Υπάρχει (για copy, fresh enterprise id N.6). |
| EventBus `bim:electrical-panel-params-updated` / `-delete-requested` | ✅ Υπάρχουν (drawing-event-map.ts γρ.222-223). |
| `isElectricalPanelEntity` (types/entities.ts) | ✅ Υπάρχει. |
| `DxfEntityUnion` περιέχει `'electrical-panel'` | ✅ (ADR-408 Φ3). |
| `ElectricalPanelGripKind` / electrical-panel-grips.ts / commit / glyphs / FSM registry | ❌ **ΔΕΝ υπάρχουν** — όλα NEW. |
| marquee `selection-duplicate-utils.ts` | ✅ έχει ήδη `electrical-panel` case (ADR-408 marquee MEP fix). |

**Διαφορά από φωτιστικό:** ο πίνακας έχει **μόνο rectangular** → ΟΧΙ `electrical-panel-diameter` grip, ΟΧΙ
circular fallback. Κατά τα άλλα 1:1 mirror του `mep-fixture-grips.ts`.

---

## 📋 ΑΡΧΕΙΑ-ΠΡΟΤΥΠΑ (το φωτιστικό = ο ΑΚΡΙΒΗΣ ανάλογος, μόλις ολοκληρώθηκε)

Δες το ολοκληρωμένο φωτιστικό ως blueprint (ADR-406 v0.8 + memory `project_adr406_mep_fixture.md`):

| Ρόλος | Αρχείο-πρότυπο (φωτιστικό) | Τι φτιάχνεις για panel |
|------|---------------------------|------------------------|
| Grip kind union + GripInfo field | `hooks/grip-types.ts` (`MepFixtureGripKind`, `mepFixtureGripKind?`) | +`ElectricalPanelGripKind` + `electricalPanelGripKind?` |
| UnifiedGripInfo field | `hooks/grips/unified-grip-types.ts` (`mepFixtureGripKind?`) | +`electricalPanelGripKind?` |
| Grips SSoT (pure) | NEW `bim/mep-fixtures/mep-fixture-grips.ts` | NEW `bim/electrical-panels/electrical-panel-grips.ts` (`getElectricalPanelGrips`+`applyElectricalPanelGripDrag`)· **reuse grip-math** rotateVector/projectToLocalFrame/sweptAngleDegAboutPivot+rotatePoint· move+rotation+4 corners (ΟΧΙ diameter) |
| Renderer getGrips | `MepFixtureRenderer.getGrips()` | `ElectricalPanelRenderer.getGrips()` → call getElectricalPanelGrips + `gripGlyphShape(g.electricalPanelGripKind)` |
| Computation switch | `hooks/grip-computation.ts` `case 'mep-fixture'` (+`DxfGripDragPreview` field) | +`case 'electrical-panel'` (+ `electricalPanelGripKind?` στο `DxfGripDragPreview`) |
| wrapDxfGrip forward | `hooks/grips/grip-registry.ts` | +forward `electricalPanelGripKind` |
| Drag preview forward | `hooks/grips/grip-projections.ts` `buildDxfDragPreview` + `buildRotateReferencePreview` | +forward `electricalPanelGripKind` (και στα δύο) |
| Ghost transform forward | `hooks/tools/useGripGhostPreview.ts` (γρ.~126-145 EntityPreviewTransform) | +forward `electricalPanelGripKind` |
| Ghost apply | `rendering/ghost/apply-entity-preview.ts` (grip branch με currentPos+rotatePivot· `movesEntity` case· `EntityPreviewTransform` interface field) | +grip branch + movesEntity `case 'electrical-panel'` + interface field |
| Ghost draw | `rendering/ghost/draw-ghost-entity.ts` `case 'mep-fixture'` (footprint polygon) | +`case 'electrical-panel'` (footprint polygon, ίδιο) |
| Glyph registry | `bim/grips/grip-glyph-registry.ts` (mep-fixture-move/rotation rows) | +`electrical-panel-move:'move'`, `electrical-panel-rotation:'rotation'` |
| Commit adapter branch | `hooks/grips/grip-commit-adapters.ts` `commitDxfGripDragModeAware` (`if(grip.mepFixtureGripKind)`) | +`if(grip.electricalPanelGripKind)` branch |
| Commit fn | `hooks/grips/grip-parametric-commits.ts` `commitMepFixtureGripDrag` (διαβάζει BimRotateHotGripStore για pivot) | NEW `commitElectricalPanelGripDrag` (mirror, `UpdateElectricalPanelParamsCommand`, emit `bim:electrical-panel-params-updated`) |
| Hot-grip registry | `hooks/grips/wall-hot-grip-fsm.ts` `HOT_GRIP_OP_REGISTRY` + `hotGripKindOf` | +`electrical-panel-move:'move'`/`-rotation:'rotate'`/4×`-corner-*:'corner'` + `?? grip.electricalPanelGripKind` |
| Ctrl-copy | `hooks/grips/grip-parametric-copy.ts` `commitMepFixtureCopy` + `commitHotGripCopy` | NEW `commitElectricalPanelCopy` (buildElectricalPanelEntity+addElectricalPanelToScene) + register |
| Tests | `bim/mep-fixtures/__tests__/mep-fixture-grips.test.ts` + `wall-hot-grip-fsm.test.ts` (panel rows) | NEW `electrical-panel-grips.test.ts` + +panel cases στο wall-hot-grip-fsm.test |

**Πιθανότατα ΗΔΗ ΟΚ (verify):** το `electrical-panel` στο `selection-duplicate-utils.ts` (marquee).

---

## ✅ ΚΑΝΟΝΕΣ / NON FARE

- **FULL SSOT:** ΠΟΤΕ raw `Math.cos`/`Math.sin` — χρησιμοποίησε `rotateVector`/`projectToLocalFrame`/
  `sweptAngleDegAboutPivot` (grip-math) + `rotatePoint` (ADR-188). Επιβεβαίωσε με `grep -r "Math.cos\|Math.sin"`
  στα grip modules στο τέλος (πρέπει: 0).
- **ΠΟΤΕ νέο grip pipeline** — επέκτεινε τις ΙΔΙΕΣ κοινές πύλες (μην φτιάξεις παράλληλο σύστημα).
- Μην πειράξεις params/geometry/command/firestore του πίνακα (έτοιμα). Μην αλλάξεις το `mep-fixture`/`column`.
- **Shared working tree** (άλλος agent): τα grip-core αρχεία (`grip-types`, `grip-computation`, `wall-hot-grip-fsm`,
  `apply-entity-preview`, `draw-ghost-entity`, `grip-projections`, `grip-registry`, `grip-commit-adapters`,
  `grip-parametric-commits`, `grip-parametric-copy`, `useGripGhostPreview`, `grip-glyph-registry`,
  `unified-grip-types`) ήδη έχουν εγγραφές fixture/column/wall — **ΠΡΟΣΘΕΣΕ** γραμμή panel, μη σβήσεις άλλες.
  Stage ΜΟΝΟ δικά σου αρχεία. ΠΟΤΕ `git add -A`/checkout/restore.
- **Μην commit/push** (N.(-1)) — ο Giorgio commit-άρει.
- ⚠️ **CHECK 6D (pre-commit):** τα ghost renderers (`apply-entity-preview.ts`, `draw-ghost-entity.ts`) απαιτούν
  staged ADR/doc → stage το ADR-408 (ή ADR-397) στο ίδιο commit.

---

## 📝 ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 Phase 3 + N.15)

1. tsc 0 + όλα τα grip/ghost tests PASS + grep cos/sin = 0.
2. Update **ADR-408** (νέα φάση changelog: «panel grips wall-parity») + **ADR-397** (grip glyph/registry SSoT —
   νέες rows panel). ΟΧΙ adr-index χωρίς συντονισμό (multi-agent guard).
3. Update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ομάδα ADR-408) + memory (`project_adr408_*` + MEMORY.md index).
4. Δήλωσε Google-level (N.7.2) + context health (N.9). Δήλωσε 🔴 pending browser verify + commit.

---

## 📚 ΑΝΑΦΟΡΕΣ
- Ολοκληρωμένο φωτιστικό (blueprint): `docs/.../ADR-406-point-based-mep-fixture.md` §Changelog v0.6→v0.8 +
  memory `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr406_mep_fixture.md` (ΜΑΘΗΜΑ #1/#2/#3).
- Grip glyph/FSM SSoT: `ADR-397-bim-grip-glyph-behavior-ssot.md` (§12 D2/D3).
- Πίνακας: `ADR-408-mep-connectors-and-systems.md` (Φ3) + memory `project_adr408_electrical_panel.md`.
