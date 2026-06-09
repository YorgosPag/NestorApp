# 🧠 HANDOFF — Slice 2: Αφαίρεση κεντρικού «σημαδιού μετακίνησης» (declutter) — ADR-363 Φ1G.5

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας: υλοποίηση (μικρό Plan Mode → κώδικας).** Καθαρό context.

---

## ⚠️ ΚΑΝΟΝΕΣ (πάγιοι)
- **Ελληνικά** όλες οι απαντήσεις.
- **FULL ENTERPRISE + FULL SSOT, «όπως AutoCAD/Revit»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **Πάρε ΕΣΥ τις Revit/AutoCAD αποφάσεις** + ζήτα μόνο έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]).
- **SHARED tree** με concurrent agent (κάνει commits μόνος του). `git add` ΜΟΝΟ δικά σου· **ΠΟΤΕ** `git add -A`. Έλεγχε `git log`/`git status` συχνά.
- **COMMIT/PUSH μόνο ο Giorgio (ή ο commit agent)** — N.(-1). **ΜΗΝ** adr-index.
- **N.17:** ΕΝΑΣ tsc τη φορά (έλεγξε process πρώτα).
- **«Confirm repro before re-implementing»** ([[feedback_confirm_repro_before_reimplementing]]) — αν κάτι «δεν δουλεύει», ζήτα ακριβές gesture ΠΡΙΝ ξαναγράψεις.

---

## 0) ΠΟΥ ΕΙΜΑΣΤΕ — Slice 1 DONE + COMMITTED ✅

Το feature **«2Δ Move-from-Characteristic-Point»** (Alt+σύρσιμο από γωνία/μέσο = μετακίνηση ΟΛΟΚΛΗΡΗΣ οντότητας) **ολοκληρώθηκε, επαληθεύτηκε από τον Giorgio στον browser, και έγινε commit** από τον concurrent agent:
- `cb0c33d2` feat: Alt-key move from characteristic point (v1)
- `6f4ece60` refactor: Alt-move via **GripAltMoveStore** (v2 — η τελική, σωστή αρχιτεκτονική)
- `dfb2d994` / `41c65cbb` docs(ADR-363)

**Πώς δουλεύει (v2, για context):** Alt at grip-mousedown → `GripAltMoveStore` (πιάνει `e.altKey` από window mousedown capture, αξιόπιστο) → skip hot-grip → press-drag whole-entity move· το live ghost (`buildDxfDragPreview` altMove → `applyEntityPreview` `movesEntity && !gripKind` → `calculateBimMovedGeometry`) + το commit μοιράζονται ΜΙΑ SSoT. Δες ADR-363 §12 changelog (entry 2026-06-09 Φ1G.5).

**ΕΠΟΜΕΝΟ ΑΙΤΗΜΑ GIORGIO:** «Τώρα που δουλεύει το Alt+drag, το κεντρικό σημάδι μετακίνησης δεν χρειάζεται πλέον → **αφαιρέστε το**.»

---

## 1) ΤΟ TASK — αφαίρεση κεντρικού move marker (render + interaction)

Όταν επιλέγεις οντότητα, εμφανίζονται: **4 γωνίες + 1 σημάδι μετακίνησης (4-way arrow, κέντρο) + 1 σημάδι περιστροφής**. Ο Giorgio θέλει **να φύγει το σημάδι μετακίνησης** (το Alt+drag το υπερκαλύπτει). **ΚΡΑΤΑ γωνίες + περιστροφή + endpoints/thickness.**

### 🔴 ΚΡΙΣΙΜΗ ΕΞΑΙΡΕΣΗ — ΑΝΟΙΓΜΑΤΑ (πόρτες/παράθυρα) ΚΡΑΤΟΥΝ το move σημάδι
Τα openings είναι **hosted**: κινούνται ΚΑΤΑ ΜΗΚΟΣ του τοίχου (`offsetFromStart`), όχι ελεύθερα. Το Alt+drag **ΔΕΝ** τα μετακινεί (`calculateBimMovedGeometry` επιστρέφει `{}` → ακολουθούν τον τοίχο). Άρα το `opening-move` grip **ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ**. **ΜΗΝ αγγίξεις το `bim/walls/opening-grips.ts`.**

**Αρχή (Revit-grade):** το κεντρικό move grip είναι πλεοναστικό **⟺ η οντότητα μετακινείται ελεύθερα** (= `calculateBimMovedGeometry` επιστρέφει μη-κενό patch). Όλες οι self-moving το χάνουν· τα hosted openings το κρατούν.

---

## 2) SSoT — πού γεννιέται το move grip (ακριβή σημεία)

Το move marker = grip kind που χαρτογραφείται σε glyph `'move'` στο **`bim/grips/grip-glyph-registry.ts`** (registry kind→glyph· `'move'` = 4-way arrow). Τα grips γεννιούνται στους per-entity generators (ΟΧΙ στο registry — εκεί ορίζεται μόνο το glyph). Αφαίρεση στους generators = φεύγει ΚΑΙ render ΚΑΙ interaction (οι renderers διαβάζουν τα ίδια getXxxGrips — **επιβεβαίωσέ το πρώτα**).

| Generator | move grip | Σημείο |
|---|---|---|
| `bim/grips/centred-box-grips.ts` | `role: 'move'` grip[0] | **γρ.169** `grips.push({ gripIndex: 0, role: 'move', type: 'center', … movesEntity: true })` — **καλύπτει 8 οντότητες** (fixture/panel/manifold/radiator/boiler/water-heater/furniture/floorplan-symbol) |
| `bim/walls/wall-grips.ts` | `wall-midpoint` | γρ.~129-133 (gripIndex 2, movesEntity:true) |
| `bim/columns/column-grips.ts` | `column-center` | γρ.~138 |
| `bim/beams/beam-grips.ts` | `beam-midpoint` | γρ.~153 |
| `bim/mep-segments/mep-segment-grips.ts` | `mep-segment-midpoint` | γρ.~84 **ΚΑΙ ~121** (2 variants: horizontal + vertical/riser — και τα δύο) |
| `bim/stairs/stair-grips.ts` | `stair-base` | γρ.~100 |
| ~~`bim/walls/opening-grips.ts`~~ | `opening-move` | **ΜΗΝ ΑΓΓΙΞΕΙΣ** (hosted) |

**Σύνολο ~6 αρχεία** (centred-box = 8-for-1).

---

## 3) ΠΡΟΤΕΙΝΟΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ (Plan Mode → επιβεβαίωσε)

**Option B (per-generator, ΣΥΝΙΣΤΑΤΑΙ):** αφαίρεσε/μην-σπρώχνεις το move grip σε κάθε generator. Explicit, SSoT-per-entity, openings φυσικά εξαιρούνται (δεν τα αγγίζεις), reversible.

**Option A (central filter):** ένα φίλτρο στο `hooks/grip-computation.ts` `computeDxfEntityGrips` που κόβει grips με glyph `'move'` ΕΚΤΟΣ `entity.type==='opening'`. 1 αρχείο, αλλά χρειάζεται resolve του kind + την opening-εξαίρεση (πιο εύθραυστο). **Προτίμησε B.**

### Πρέπει να ΕΠΙΒΕΒΑΙΩΣΕΙΣ στο Recognition (ΠΡΙΝ κώδικα):
1. **Οι renderers διαβάζουν getXxxGrips;** (BeamRenderer/ColumnRenderer/MepFixtureRenderer/… καλούν `gripGlyphShape` — επιβεβαίωσε ότι παίρνουν τα grips από τους ίδιους generators, ώστε η αφαίρεση να καλύπτει render+interaction. Αν render-path ανεξάρτητο → αφαίρεσε και εκεί.)
2. **gripIndex assumptions:** αφαιρώντας το grip, ΜΗΝ κάνεις reindex — κράτα σταθερά τα υπόλοιπα gripIndex (κάποια code δείχνει σε kind, όχι index — επιβεβαίωσε).
3. **Hot-grip 'move' FSM** (`wall-hot-grip-fsm.ts` op='move', 3-click move): γίνεται **unreachable** (κανένα move grip να το trigger-άρει). Αβλαβές dead path — **ΜΗΝ** το σβήσεις (existing· dead-code ratchet δεν θέλει νέες αλλαγές εκτός scope). Απλώς σημείωσέ το.
4. **Space grip-mode 'Move'**: ήδη σπασμένο για BIM (handoff Slice 1 §1) — δεν επηρεάζεται.

---

## 4) ΤΕΣΤ
- Update τα getXxxGrips tests (πιθανώς ελέγχουν τον αριθμό/σειρά grips· αφαίρεσε το move από τα expectations).
- `centred-box-grips` test: 6→5 grips (rotation + 4 corners), μηδέν `role:'move'`.
- Regression: openings ΑΚΟΜΑ έχουν `opening-move`· γωνίες/rotation ΑΜΕΤΑΒΛΗΤΑ· Alt+drag ακόμα δουλεύει (commit path ανέγγιχτο).
- tsc background (N.17).
- **Browser-verify Giorgio:** επίλεξε τοίχο/fixture → ΚΑΝΕΝΑ κεντρικό 4-arrow· γωνίες+περιστροφή ναι· Alt+drag μετακινεί· επίλεξε πόρτα → move σημάδι ΑΚΟΜΑ εκεί.

## 5) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ αφαιρέσεις το **rotation** marker (ο Giorgio ζήτησε μόνο το move).
- ΜΗΝ αγγίξεις **openings** (κρατούν move).
- ΜΗΝ αφαιρέσεις move από **DXF primitives** (circle/text center) — δεν είναι στο registry, δεν σε αφορούν.
- ΜΗΝ σβήσεις το hot-grip 'move' FSM / commit code (existing· γίνεται απλώς dead).
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc.

## 6) DOCS (N.15) μαζί με τον κώδικα
- **ADR-363 §12 changelog:** νέο entry «Φ1G.5 Slice 2 — αφαίρεση κεντρικού move marker (declutter)». (Το Slice 1 entry υπάρχει ήδη, committed.)
- Memory: update [[project_adr363_2d_move_from_point]] (πρόσθεσε Slice 2 DONE).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`: δεν υπήρχε tracked item (ήρθε από handoff) — ρώτα τον Giorgio αν θέλει entry.

## 7) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (Slice 1, committed)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].

## 8) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό + `git log -4` (επιβεβαίωσε Slice 1 committed) + grep τα 6 generators (offsets αλλάζουν, shared tree).
2. Recognition: επιβεβαίωσε §3 σημεία 1-4 (renderers↔generators, gripIndex, hot-grip dead path).
3. Μικρό Plan Mode → file-level σχέδιο (Option B) + έγκριση.
4. Υλοποίηση + tests + tsc + ADR-363 changelog + memory.
