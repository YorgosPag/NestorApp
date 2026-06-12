# HANDOFF — ADR-448 Phase 3: Wizard «Φόρτωσε ΟΛΟΥΣ τους ορόφους»

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΙ agents δουλεύουν ταυτόχρονα — **icon-agent** σε `ui/ribbon/data/*.ts`· **ADR-449 finish-skin agent** σε `bim-3d/converters/bim-three-structural-converters.ts`. **git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio — ΠΟΤΕ ο agent** (CLAUDE.md N.(-1)). Ο agent ετοιμάζει & σταματά.
> ⚠️ **ΚΑΝΟΝΕΣ:** N.14 (δήλωσε μοντέλο). N.17 (ΕΝΑ tsc τη φορά — ή IDE `mcp__ide__getDiagnostics` που ΔΕΝ spawn-άρει tsc). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}`, **κλειδιά ΠΡΩΤΑ στα locale JSON μετά στον κώδικα** (N.11). N.0.1 ADR-driven (code=SoT). N.15 (ενημέρωσε ADR-448 §6/§7/§8 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY μετά υλοποίηση). N.8 (~3-5 αρχεία → Plan Mode).

---

## 0. ΣΤΟΧΟΣ PHASE 3

Όταν ο χρήστης επιλέγει **κτίριο** στο «Εισαγωγή Κάτοψης» wizard, να δημιουργούνται viewer **Levels για ΟΛΟΥΣ τους ορόφους** του κτιρίου (όχι μόνο για τον ενεργό/επιλεγμένο), καθένα **linked στο `floorId`** του με σωστό order/label/elevation — ώστε ο μηχανικός να ανοίγει ολόκληρη οικοδομή (θεμελίωση→υπόγειο→ισόγειο→όροφοι) με ένα βήμα, Revit-true.

- **Toggle** «Φόρτωσε όλο το κτίριο» (**default ON** — απόφαση Giorgio, ADR-448 §7) vs «μόνο επιλεγμένο όροφο».
- Κάθε νέο level: link `floorId`+`buildingId`, σωστό όνομα (floor label), σωστή σειρά (floor.number), elevation (floor.elevation).
- **Idempotent:** όροφος με υπάρχον level → δεν διπλασιάζεται (reuse `findOrCreateLevelForFloor`).

**Γιατί τώρα έχει νόημα:** Phase 1 (storey datum + ceiling render) + Phase 2 (per-storey creation defaults) DONE. Με όλα τα levels ανοιχτά + σωστές στάθμες, η ανέγερση πολυώροφου γίνεται πλήρης («Όλοι οι όροφοι» = πλήρες κτίριο).

---

## 1. PHASE 1+2 — DONE & UNCOMMITTED (ΜΗΝ revert)

**Phase 1** (1a datum SSoT + 1b storey-ceiling render) + **Phase 2** (per-storey creation defaults + foundation gating) ολοκληρώθηκαν, **uncommitted**. Ο Giorgio κάνει commit. **ΜΗΝ τα revert.**

Phase 2 αρχεία (context): NEW `systems/levels/storey-creation-defaults.ts` (+test)· MOD `hooks/drawing/{wall,column,slab}-completion.ts`, `bim/columns/{column-anchor-ghosts,column-from-grid}.ts`, `systems/events/drawing-event-map-bim.ts`, `hooks/drawing/useFoundationTool.ts`, `ui/ribbon/hooks/useRibbonSlabBridge.ts`, `hooks/useDxfViewerNotifications.ts`, `i18n/locales/{el,en}/dxf-viewer-shell.json`. 13+ jest + 378 touched PASS + IDE clean. (Λεπτομέρειες: MEMORY `project_adr448_storey_aware_dxf.md` + ADR-448 §8.)

### SSoT που ΗΔΗ υπάρχει & θα καταναλώσει η Phase 3:
- **`systems/levels/level-floor-resolution.ts`** → `findOrCreateLevelForFloor(resolver, { floorId, buildingId, entityLabel, currentLevelId })`: βρίσκει το Level με matching `floorId`, αλλιώς `addLevel` + `linkLevelToFloor`. **Per-floor SSoT — η Phase 3 το ΚΑΛΕΙ ΣΕ LOOP, δεν το ξαναγράφει.** `resolver = { levels, addLevel, linkLevelToFloor }` (από `useLevels`).
- **`components/properties/shared/useFloorsByBuilding.ts`** → `FloorOption[]` (id, number, elevation, height, finishThickness, kind, label). **Η λίστα ορόφων του κτιρίου** (Phase 1 πρόσθεσε height/finishThickness).
- **`systems/levels/active-storey-context.ts`** / **`active-storey-store.ts`** — Phase 1 SSoT (πιθανώς δεν χρειάζεται άμεσα στη Φ3, αλλά σχετικό).

---

## 2. SEAMS PHASE 3 (code=SoT — επαλήθευσέ τα, γραμμές ίσως μετακινήθηκαν, shared tree)

| Σημείο | Αρχείο:γραμμή | Τι κάνει σήμερα | Φ3 |
|---|---|---|---|
| **Wizard onComplete** | `ui/components/LevelPanel.tsx:~417` (`onComplete={async (file, meta) => …}`) | καλεί `findOrCreateLevelForFloor` για **ΕΝΑΝ** όροφο (`saveContext.floorId`) → `setCurrentLevel(targetLevelId)` | αν toggle ON & υπάρχει `buildingId`: **loop** όλους τους ορόφους (`useFloorsByBuilding`) → `findOrCreateLevelForFloor` καθένα· `setCurrentLevel` στον επιλεγμένο/κατώτατο. **Pure helper** NEW (π.χ. `ensureLevelsForBuilding(resolver, floors, buildingId)`) ώστε να είναι unit-testable + SSoT (όχι inline loop στο component). |
| **Toggle UI** | `src/features/floorplan-import/FloorplanImportWizard.tsx` (building step) | δεν υπάρχει | checkbox «Φόρτωσε όλο το κτίριο» (default **ON**)· περνά flag στο `meta`/`onComplete`. i18n key (`dxf-viewer-shell` ή wizard namespace). |
| **Level order/elevation** | `systems/levels` (`addLevel`/`linkLevelToFloor` + level config) | level παίρνει `floorId` link | **ΕΠΑΛΗΘΕΥΣΕ** πώς προκύπτει σειρά/elevation του level: αν αντλούνται από το linked floor (μέσω `useFloorsByBuilding`/floor-stack) → reuse· αλλιώς πέρασέ τα στο create. ΜΗΝ ξαναγράψεις elevation math (reuse `floor-stack-elevation.ts`). |

### ⚠️ Προσοχές:
- **Idempotent ΥΠΟΧΡΕΩΤΙΚΟ:** ξανα-import ίδιου κτιρίου → ΟΧΙ διπλά levels. Το `findOrCreateLevelForFloor` ήδη το εγγυάται per-floor — ο loop απλώς το καλεί για όλους.
- **`addLevel` είναι async + πιθανόν Firestore write (N.6 enterprise-id).** Πολλοί όροφοι → **σειριακά await** (ή controlled `Promise.all` αν ασφαλές) — πρόσεξε race conditions στο level store (N.7.2 #2). Προτίμησε σειριακό loop για ντετερμινιστική σειρά/order.
- **`setCurrentLevel`** μία φορά στο τέλος (στον επιλεγμένο όροφο, ή στον κατώτατο αν building-level import χωρίς συγκεκριμένο floor).
- **floor-less imports (project/building canvas χωρίς floorId):** το toggle αφορά building selection· κράτα το υπάρχον fallback (`currentLevelId`) όταν δεν υπάρχει building/floors.
- **Shared tree:** ο wizard (`src/features/floorplan-import/`) είναι ΕΚΤΟΣ `dxf-viewer` subapp — έλεγξε ότι δεν τον αγγίζει άλλος agent.

---

## 3. ΣΕΙΡΑ ΕΡΓΑΣΙΑΣ (N.0.1 ADR-driven)

1. **Recognition (code=SoT):** διάβασε `level-floor-resolution.ts` (✅ στο handoff), `LevelPanel.tsx onComplete` (~417), `FloorplanImportWizard.tsx` (building step + `onComplete`/`meta` shape), `useFloorsByBuilding.ts`, `useLevels` (`addLevel`/`linkLevelToFloor` signatures + πώς ορίζεται order/elevation level). Επιβεβαίωσε τα 3 seams §2.
2. **Δήλωσε μοντέλο (N.14)** = Opus.
3. **Mode (N.8):** ~3-5 αρχεία → Plan Mode. Μπες μόνος, δικαιολόγησε.
4. **ADR-448 ΠΡΩΤΑ:** §6 Phase 3 → DONE· §7 decision (toggle default ON — ήδη γραμμένο)· §8 changelog.
5. **Υλοποίηση:** NEW pure `ensureLevelsForBuilding` (loop reuse `findOrCreateLevelForFloor`) + jest (idempotent, σωστή σειρά, all-floors vs single)· wire στο `LevelPanel.onComplete` πίσω από toggle· toggle UI στο wizard + i18n.
6. **Verify:** jest + IDE diagnostics (N.17). MCP firestore read-only baseline (project `pagonis-87766`, floorplan `file_32a7a4fb…`) → query ορόφων κτιρίου → επιβεβαίωση count. Browser (Giorgio): επίλεξε κτίριο με toggle ON → δημιουργούνται levels για ΟΛΟΥΣ τους ορόφους, σωστό order/elevation, idempotent στο re-import.
7. **N.15:** ADR-448 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`project_adr448_storey_aware_dxf.md`).
8. **COMMIT ο Giorgio** — shared tree → `git add` ΜΟΝΟ δικά σου hunks. ΟΧΙ `bim-three-structural-converters.ts` (ADR-449), ΟΧΙ `ui/ribbon/data/*` (icon-agent).

---

## 4. REFERENCE
- **SSoT να reuse:** `systems/levels/level-floor-resolution.ts` (`findOrCreateLevelForFloor`)· `components/properties/shared/useFloorsByBuilding.ts`· `bim-3d/scene/floor-stack-elevation.ts` (elevation math)· `systems/levels` (`useLevels`).
- **Entry points:** `ui/components/LevelPanel.tsx` (~417 onComplete)· `src/features/floorplan-import/FloorplanImportWizard.tsx` (toggle).
- **ADRs:** ADR-448 (αυτό, §6 Phase 3)· ADR-399/ADR-420 (level↔floor resolution)· ADR-369 (z-chain elevation)· ADR-340 (import context).
- **MEMORY:** `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr448_storey_aware_dxf.md` (πλήρες ιστορικό Φ1+Φ2).
- **DEFER μετά τη Φ3:** Φ4 = building structure awareness + κατακόρυφη συνέχεια + height **cascade σε ΥΠΑΡΧΟΝΤΑ** entities (`floor-height-cascade.service.ts`· νέα entities ήδη καλύφθηκαν στη Φ2).
