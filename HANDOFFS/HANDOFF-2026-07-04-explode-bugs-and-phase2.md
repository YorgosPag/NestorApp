# HANDOFF — EXPLODE bugfixes (ορθογώνιο εξαφανίζεται + hover δεν φωτίζει) → μετά EXPLODE Φ5.2

**Ημερομηνία:** 2026-07-04
**ADRs:** ADR-510 Φ5 (EXPLODE — μόλις υλοποιήθηκε) · ADR-040 (hover/canvas perf — για Bug 2)
**Τύπος:** 2 bugfixes (HIGH) → μετά feature Φ5.2. **Domain:** dxf-viewer explode + hover/rendering.

---

## 0. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- 🗣️ Απαντάς **Ελληνικά** πάντα.
- 🚫 **ΟΧΙ commit / ΟΧΙ push** — τα κάνει ο Giorgio. **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → μόνο `git add <specific>`, verify με `git diff --cached`, **ΠΟΤΕ** `git add -A` / `restore` / `reset` / checkout άλλων αρχείων.
- 🚫 **ΟΧΙ tsc** (N.17)· **jest OK** (στοχευμένα).
- 🏆 **Big-player fidelity (Revit/Maxon/Figma/AutoCAD).** FULL enterprise + FULL SSoT. Αν οι μεγάλοι δεν το προτείνουν → ακολούθα τη δική τους πρακτική.
- 🧩 **PLAN MODE** μετά το SSoT audit. Μοντέλο (N.14 — μάλλον **Opus**). ADR-driven (N.0.1): κώδικας πρώτα, ADR-510 Φ5 changelog update.

---

## 1. 🔴🔴 BUG 1 (HIGH) — Το ΟΡΘΟΓΩΝΙΟ εξαφανίζεται μετά τη «Διάλυση»
**Repro (Giorgio):** επιλογή ορθογωνίου → «Διάλυση» → το ορθογώνιο εξαφανίζεται από τον καμβά (δεν μένουν οι 4 γραμμές). **Η ΠΟΛΥΓΡΑΜΜΗ διαλύεται ΣΩΣΤΑ** σε γραμμές — άρα το πρόβλημα είναι ΕΙΔΙΚΑ στο rectangle path.

### ✅ ΡΙΖΑ ΕΝΤΟΠΙΣΜΕΝΗ (επιβεβαιωμένη με grep):
Ένα σχεδιασμένο ορθογώνιο αποθηκεύεται με **`corner1`/`corner2`**, ΟΧΙ `x/y/width/height`:
```
// hooks/drawing/drawing-entity-builders.ts:123
{ type: 'rectangle', corner1: p1, corner2: p2, ... }
```
Τα `x/y/width/height` στο `RectangleEntity` είναι **optional/computed** (σχόλιο interface: «computed from x,y»). Ο νέος `explodeRectangle` (`systems/explode/explode-entity.ts`) διαβάζει `source.x/y/width/height` → **`undefined`** → οι γωνίες γίνονται `NaN` → οι 4 line entities έχουν NaN coords → **δεν renderάρονται** → «εξαφανίστηκε».

### ✅ FIX (SSoT reuse, small):
Ο `explodeRectangle` να διαβάζει τις γωνίες με το **υπάρχον SSoT** `rectangleVertices(e)` (`hooks/drawing/overlay-persistence-utils.ts:72`):
```
const c1 = e.corner1 ?? { x: e.x, y: e.y };
const c2 = e.corner2 ?? { x: e.x + e.width, y: e.y + e.height };
// → [c1, {c2.x,c1.y}, c2, {c1.x,c2.y}]
```
- **SSoT audit πρώτα:** grep `rectangleVertices` / `corner1` — δες αν το `rectangleVertices` είναι reusable (ίσως export από overlay-persistence-utils ή προαγωγή σε κοινό rect-geometry SSoT). ΜΗΝ ξαναγράψεις corner math.
- Πρόσεξε **rotation:** το corner-based drawn rect δεν έχει `rotation`· κράτα το `rotatePoint` fallback μόνο αν υπάρχει `rotation` (defensive). Επιβεβαίωσε ότι δεν υπάρχει διπλό μοντέλο (corner-based vs x/y/w/h) που να χρειάζεται και τα δύο.
- **Test:** πρόσθεσε case στο `explode-entity.test.ts` — rectangle με `corner1/corner2` (ΟΧΙ x/y/w/h) → 4 lines με σωστές (μη-NaN) γωνίες. (Το υπάρχον test χρησιμοποιεί x/y/w/h — γι' αυτό ΠΕΡΑΣΕ ενώ το πραγματικό έσπασε· **πρόσθεσε corner-based fixture**.)

---

## 2. 🔴🔴 BUG 2 (HIGH) — Το HOVER δεν φωτίζει τις οντότητες
**Repro (Giorgio):** μετά τη διάλυση + hard refresh, hover πάνω σε οντότητες → **δεν φωτίζονται** (χάθηκε το hover highlight).

### Υπόθεση (ισχυρή) — ΠΙΘΑΝΩΣ downstream του Bug 1:
Οι **NaN-coordinate line entities** από το σπασμένο rectangle explode **persistάρονται** στη σκηνή· στο reload, ένα entity με NaN bbox/coords **δηλητηριάζει το hover hit-test** (NaN comparisons σε distance/bbox → όλα τα hit-tests αποτυγχάνουν). → Διόρθωση Bug 1 (μηδέν NaN) + **καθάρισμα** των poisoned entities ίσως λύσει το Bug 2.

### ΤΙ ΝΑ ΚΑΝΕΙΣ (repro-first, ΜΗΝ υποθέσεις):
1. **Απομόνωσε:** σε ΚΑΘΑΡΗ σκηνή (κανένα exploded rect, WIPE TEST DB αν χρειαστεί) — φωτίζει το hover; 
   - **Αν ΝΑΙ** → Bug 2 = downstream του Bug 1 (NaN poisoning). Πρόσθεσε **NaN guard** στο hover hit-test + στο `explodeEntity`/`addEntity` (reject NaN geometry, defensive). 
   - **Αν ΟΧΙ (σπασμένο και σε καθαρή)** → ανεξάρτητο regression. Grep το hover subsystem: `systems/hover/HoverStore.ts` (SSoT, ADR-040) + το hover hit-test/pick module + `dxf-bitmap-cache` invalidation. Πιθανό shared-tree regression άλλου agent (**όχι** από τη δουλειά μας — δεν αγγίξαμε hover/hit-test: μόνο ribbon data, explode command, contextual-config).
2. **SSoT:** hover = `systems/hover/HoverStore.ts` (zero React state)· cursor/hit-test· ADR-040 cardinal rules (μην βάλεις hoveredEntityId στο bitmap cache key).
3. **ΜΗΝ** συγχέεις με το memory gotcha [reference_invisible_hoverable_entity_is_cull_not_reactivity] — εκεί ήταν render-gate, εδώ είναι «κανένα highlight».

---

## 3. SSoT AUDIT (grep) ΠΡΙΝ κώδικα
- `rectangleVertices` / `corner1`/`corner2` — rect corner SSoT (Bug 1).
- `systems/hover/HoverStore.ts` + hover hit-test module (Bug 2).
- `systems/explode/explode-entity.ts` + `ExplodeEntityCommand.ts` (μόλις γραμμένα — δικά μας, δες §5).
- NaN guards: υπάρχει helper `Number.isFinite` pattern σε entity validation; grep.

---

## 4. ΜΕΤΑ ΤΑ BUGS → EXPLODE Φ5.2 (block/dimension/hatch)
Επέκταση της «Διάλυσης» στα υπόλοιπα σύνθετα:
- **block/insert** → constituent entities (member entities του block).
- **dimension** → γραμμές + κείμενο + βέλη.
- **hatch** → γραμμές (**υπάρχει ήδη SSoT** `bim/geometry/shared/hatch-pattern-geometry.ts` = HATCH→exploded LINEs, ίδιο που τρέφει τον renderer + DXF writer).
Πρόσθεσε τους τύπους στο `EXPLODABLE_TYPES` + branches στο `explodeEntity` + tests. **SSoT audit** για καθένα (block members, dim parts, hatch lines) ΠΡΙΝ γράψεις.

---

## 5. ΤΙ ΜΟΛΙΣ ΥΛΟΠΟΙΗΘΗΚΕ (ADR-510 Φ5 — δικό μας, αυτή η συνεδρία)
Γενική «Διάλυση» (EXPLODE), polyline/rectangle → primitives, undoable. Αρχεία:
- `systems/explode/explode-entity.ts` (pure helper· **Bug 1 εδώ**: `explodeRectangle` διαβάζει x/y/w/h αντί corner1/corner2)
- `systems/entity-creation/inherit-entity-style.ts` (νέο SSoT style-inherit)
- `core/commands/entity-commands/ExplodeEntityCommand.ts` (+ export στο index.ts)
- `ui/ribbon/hooks/useExplodeRibbonAction.ts` (+ wiring `app/useDxfViewerRibbon.ts`)
- `ui/ribbon/data/home-tab-modify.ts` (comingSoon→false + action:'explode')
- i18n `tool-hints:explode.selectEntities` (el+en)
- tests: `explode-entity.test.ts` + `ExplodeEntityCommand.test.ts` (15 GREEN — ΑΛΛΑ το rect test χρησιμοποιεί x/y/w/h, γι' αυτό δεν έπιασε το Bug 1)
- ADR-510 Φ5 changelog · pending-ratchet (fillet→inheritEntityStyle SSoT migration)

## 6. ΣΧΕΤΙΚΟ ΠΛΑΙΣΙΟ (μην μπερδευτείς)
- Uncommitted shared tree: ADR-510 **Φ4g/Φ4h/Φ4i** + ADR-570 **Φ1b** (line-style ribbon reorg — icons/thumbnails/tab-neutral) + **Φ5** (EXPLODE). Αν ο Giorgio τα έκανε commit πριν τη νέα συνεδρία, θα είναι στο git log.
- `.claude-rules/pending-ratchet-work.md`: πρώτη εγγραφή = fillet→inheritEntityStyle (δικό μας)· υπόλοιπα άσχετα.
- Το `array-explode` δουλεύει ήδη — πρότυπο, μην το πειράξεις.
