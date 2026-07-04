# HANDOFF — Υλοποίηση γενικής εντολής «Διάλυση» (EXPLODE): πολυγραμμή/ορθογώνιο/πολύγωνο → γραμμές (+τόξα)

**Ημερομηνία:** 2026-07-04
**ADRs:** ADR-510 (line creation) · ADR-353 (array/modify commands — πρότυπο) · νέα φάση EXPLODE (πρότεινε αριθμό ADR ή §Φ σε ADR-510)
**Τύπος:** Νέα modify command (entity-level) + ribbon wiring. **Domain:** dxf-viewer core commands + ribbon. **Εκτίμηση:** 4–7 αρχεία (νέα command + index export + ribbon action wiring + flip comingSoon + i18n αν χρειαστεί + tests + ADR).

---

## 0. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- 🗣️ Απαντάς **Ελληνικά** πάντα.
- 🚫 **ΟΧΙ commit / ΟΧΙ push** — τα κάνει ο Giorgio. **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → μόνο `git add <specific>`, verify με `git diff --cached`, **ΠΟΤΕ** `git add -A` / `git restore .` / `reset --hard` / checkout άλλων αρχείων.
- 🚫 **ΟΧΙ tsc** (N.17)· **jest OK** (στοχευμένα).
- 🧩 **ΞΕΚΙΝΑ ΣΕ PLAN MODE** μετά το SSoT audit. Πρότεινε μοντέλο (N.14 — μάλλον **Opus**: νέα command + cross-cutting wiring + γεωμετρία) και περίμενε «ok».
- 🏆 **Big-player fidelity: Revit / Maxon (Cinema 4D) / Figma / AutoCAD-level.** FULL enterprise + FULL SSoT. **ΑΝ οι μεγάλοι δεν το προτείνουν → ακολουθείς ΤΗ ΔΙΚΗ ΤΟΥΣ πρακτική.**
- 🧱 **ADR-driven (N.0.1):** διάβασε ΠΡΩΤΑ κώδικα, ενημέρωσε ADR στο ίδιο πλαίσιο (Phase 3).

---

## 1. 🔴 ΤΟ ΑΙΤΗΜΑ ΤΟΥ GIORGIO
Να υλοποιηθεί η **γενική εντολή «Διάλυση» (EXPLODE)** — σήμερα είναι `comingSoon: true` (δεν λειτουργεί). Σπάει σύνθετες οντότητες σε απλούστερα δομικά στοιχεία. Ρητό παράδειγμα Giorgio: **πολυγραμμή → γραμμές**.

**Είναι ΓΕΝΙΚΟ modify εργαλείο** (όχι line-specific): μένει στην **αρχική → Τροποποίηση**, **ΔΕΝ** μεταφέρεται σε contextual γραμμών (επιβεβαιωμένη απόφαση Giorgio αυτής της συνεδρίας — ίδιο σκεπτικό με τον «Πίνακα»/Array).

---

## 2. 🔴 PHASE-1 (ΠΡΙΝ γράψεις κώδικα): ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) + big-player verify

**Ο Giorgio ζητά ρητά πραγματικό SSoT audit για να ΜΗΝ φτιάξεις διπλότυπα.** Τα building blocks ΥΠΑΡΧΟΥΝ — grep/read για επιβεβαίωση & reuse:

| Ανάγκη | Υπάρχον SSoT (reuse, ΜΗΝ ξαναγράψεις) |
|---|---|
| **Πρότυπο command** | `core/commands/entity-commands/ExplodeArrayCommand.ts` — ΤΟ πρότυπο: `ICommand` + `ISceneManager` (`getEntity`/`addEntity`/`removeEntity`) + `generateEntityId` + `deepClone` + undo/redo/serialize/validate/getAffectedEntityIds. Μια νέα `ExplodeEntityCommand` το καθρεφτίζει. |
| **Αντίστροφη πράξη (μεγάλο reference)** | `core/commands/entity-commands/JoinEntityCommand.ts` — κάνει το ΑΝΤΙΘΕΤΟ (γραμμές/τόξα → πολυγραμμή, AutoCAD JOIN). Η explode είναι ο αντίστροφος· η ίδια σχέση polyline↔segments. |
| **Command index (export)** | `core/commands/entity-commands/index.ts` — εδώ ζουν Create/Delete/Join/Trim/Offset/Corner/WallSplit… Πρόσθεσε εδώ την `ExplodeEntityCommand` (+ type). |
| **Scene-entity id** | `systems/entity-creation/utils.ts` → `generateEntityId()` (ίδιο που χρησιμοποιεί το ExplodeArrayCommand· scene id, όχι Firestore — N.6 δεν εφαρμόζεται σε scene entities). |
| **Polyline γεωμετρία** | `types/entities.ts` — polyline/lwpolyline: `vertices: Point2D[]`, `bulges?: number[]` (DXF 42, τόξο ανά segment), `startWidths/endWidths`, `closed`. **ΠΡΟΣΟΧΗ:** bulged segment → **τόξο** (arc), όχι γραμμή. Geometry SSoT: `rendering/entities/shared/geometry-bulge-utils.ts` (bulge → arc params). |
| **Command execution** | `core/commands` → `useCommandHistory().execute(cmd)` (undoable). Scene adapter: `createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId)` (systems/entity-creation/LevelSceneManagerAdapter). |
| **Ribbon action wiring (πρότυπο)** | `ui/ribbon/hooks/useArrayRibbonActions.ts` — δείχνει πώς μια modify ACTION (`array-explode`) διαβάζει selection → φτιάχνει command → execute → switch tool 'select'. Το γενικό explode είναι ΑΚΡΙΒΩΣ τέτοιο: **immediate action στην τρέχουσα επιλογή**, ΟΧΙ persistent tool. |
| **Routing** | `ui/ribbon/hooks/useRibbonCommands.ts` (`routeRibbonAction`, `useRibbonCommands-action.ts`) — πώς φτάνει το commandKey/action στον handler. Σήμερα το 'explode' βγάζει comingSoon toast. |
| **Selection** | `useUniversalSelection` (`getPrimaryId`, selected ids) — τα explodable sources. |

**Big-player verify (γράψε 3-4 γραμμές στον Giorgio):**
- **AutoCAD EXPLODE** = ο κανόνας αναφοράς: polyline→lines+arcs, rectangle/polygon→lines, block→members, dimension→lines+text, hatch→lines. Είναι **γενικό Modify command** στο Modify panel (όχι per-object). Το πάχος/χρώμα/layer κληρονομούνται στα παράγωγα.
- **Revit:** δεν έχει «explode» για native geometry (parametric)· έχει explode ΜΟΝΟ για imported CAD (partial/full). Δηλ. οι μεγάλοι το κρατούν ως γενική εντολή, όχι per-family.
- **Cinema 4D (Maxon):** «Connect Objects + Delete» / «Current State to Object» = ισοδύναμο flatten. **Figma:** «Flatten» / «Detach instance».
- **Συμπέρασμα:** γενικό Modify command, στην αρχική. ✅ Σωστά ΔΕΝ πάει στις γραμμές.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΟ SCOPE (τελικοποίησε στο plan με τον Giorgio)

**Φάση 1 (MVP enterprise) — «line-like» compound entities → primitives:**
- **polyline / lwpolyline** → N `line` entities (ένα ανά segment)· **bulged segment → `arc`** (μέσω geometry-bulge-utils). Κληρονόμησε layer/color/lineweight/linetype σε κάθε παράγωγο. Σεβασμός `closed` (κλείσιμο τελευταίου segment).
- **rectangle** → 4 lines.
- **polygon** → N lines.

**Φάση 2+ (χωριστά, αν το θελήσει ο Giorgio):** block/insert → members· dimension → lines+text· hatch → lines (υπάρχει ήδη hatch→lines geometry SSoT: `bim/geometry/shared/hatch-pattern-geometry.ts`).

**Εκτός/όχι explode:** ήδη-primitives (line/circle/arc/point/text) → no-op + tool hint «τίποτα να διαλυθεί».

---

## 4. ΤΙ ΝΑ ΚΑΝΕΙΣ (μετά το plan approval)
1. **Νέα `ExplodeEntityCommand`** (`core/commands/entity-commands/ExplodeEntityCommand.ts`) — mirror του `ExplodeArrayCommand`: για κάθε επιλεγμένο explodable entity, υπολόγισε τα παράγωγα primitives (reuse geometry-bulge-utils για τόξα), `addEntity` × N, `removeEntity(original)`· undo αντιστρέφει. Multi-select: υποστήριξε λίστα (mirror DeleteMultipleEntitiesCommand pattern).
2. **Export** στο `entity-commands/index.ts` (+ τυχόν type).
3. **Ribbon wiring:** flip `comingSoon: false` στο `home-tab-modify.ts` (γραμμές ~257 & ~334) και σύνδεσε το commandKey/action 'explode' σε handler (mirror `useArrayRibbonActions` → διάβασε selection → `ExplodeEntityCommand` → `execute` → επίλεξε τα νέα ids). Immediate action, ΟΧΙ persistent tool.
4. **i18n:** το `ribbon.commands.explode` ΥΠΑΡΧΕΙ («Διάλυση»/«Explode»). Αν χρειαστεί tool-hint key (π.χ. «Επίλεξε οντότητες προς διάλυση») → πρόσθεσέ το ΠΡΩΤΑ σε el+en (N.11).
5. **ADR:** ενημέρωσε το σχετικό ADR (πρότεινε §Φ σε ADR-510 ή νέο ADR) + changelog (Phase 3, ίδιο πλαίσιο).

---

## 5. VERIFICATION
- **jest** (πρότυπο: `core/commands/entity-commands/__tests__/ExplodeArrayCommand.test.ts`): polyline→lines (count/coords), bulged→arc, rectangle→4 lines, closed handling, inherited style, undo/redo round-trip, no-op σε primitive. **ΟΧΙ tsc.**
- **Browser-verify (Giorgio):** σχεδίασε πολυγραμμή → επίλεξε → «Διάλυση» → γίνεται N ξεχωριστές γραμμές (επιλέξιμες μεμονωμένα)· Undo την επαναφέρει.

## 6. ΣΧΕΤΙΚΟ ΠΛΑΙΣΙΟ (μην μπερδευτείς)
- Στο ίδιο (uncommitted, shared) tree υπάρχει **πρόσφατη δουλειά ADR-510 Φ4g/Φ4h/Φ4i + ADR-570 Φ1b** (line-style ribbon reorg: μεγάλα modify icons + χρωματισμός σημείων αλλαγής + μεταφορά draw υπο-λειτουργιών γραμμής στο contextual + tab-neutral fix + thumbnails). **ΑΣΧΕΤΗ** με το EXPLODE — μην την αγγίξεις.
- `.claude-rules/pending-ratchet-work.md`: pending ratchets — άσχετα, μην τα πιάσεις.
- Το `array-explode` (contextual tab Πίνακα) είναι ΗΔΗ υλοποιημένο & δουλεύει — μην το πειράξεις· είναι απλώς το πρότυπο.
