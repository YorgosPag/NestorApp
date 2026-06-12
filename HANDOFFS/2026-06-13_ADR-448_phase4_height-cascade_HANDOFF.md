# HANDOFF — ADR-448 Phase 4: Building-structure awareness + height cascade σε ΥΠΑΡΧΟΝΤΑ entities

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΙ agents δουλεύουν ταυτόχρονα — **icon-agent** σε `ui/ribbon/data/*.ts`· **ADR-449 finish-skin agent** σε `bim-3d/converters/bim-three-structural-converters.ts` / `columnToMesh`. **git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι παίκτες, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio — ΠΟΤΕ ο agent** (CLAUDE.md N.(-1)). Ο agent ετοιμάζει & σταματά.
> ⚠️ **ΚΑΝΟΝΕΣ:** N.14 (δήλωσε μοντέλο). N.17 (ΕΝΑ tsc τη φορά — ή IDE `mcp__ide__getDiagnostics` που ΔΕΝ spawn-άρει tsc). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}` + **κλειδιά ΠΡΩΤΑ στα locale JSON** (N.11). N.6 (enterprise-id σε κάθε Firestore write). N.0.1 ADR-driven (**code = SoT**). N.15 (ενημέρωσε ADR-448 §6/§8 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY μετά υλοποίηση). N.8 (~3-5 αρχεία → Plan Mode· >5 αρχεία/2+ domains → **ρώτησε** orchestrator).

---

## 0. ⛔ ΠΡΟΑΠΑΙΤΟΥΜΕΝΟ ΠΡΙΝ ΞΕΚΙΝΗΣΕΙΣ

**Phase 1 + Phase 2 + Phase 3 της ADR-448 είναι ΟΛΟΚΛΗΡΩΜΕΝΑ αλλά UNCOMMITTED & un-verified στον browser.** Ο Giorgio θα κάνει commit + browser-verify ΠΡΙΝ τη Φ4. **ΜΗΝ τα revert.** Αν ξεκινήσεις Φ4 και ο Giorgio δεν έχει ακόμη committ-άρει, **ρώτησέ τον** αν να περιμένεις — η Φ4 αγγίζει την ΙΔΙΑ περιοχή (storey defaults → existing entities) και τα hunks μπερδεύονται στο shared tree.

Uncommitted αρχεία Φ1+Φ2+Φ3 (context, ΜΗΝ revert): `systems/levels/{active-storey-context,active-storey-store,useActiveStoreySync,storey-creation-defaults,ensure-levels-for-building}.ts` (+tests)· `bim3d-resync.ts`· `useFloorsByBuilding.ts`· seams wall/column/slab-completion, column-anchor-ghosts, column-from-grid, useFoundationTool, useRibbonSlabBridge, drawing-event-map-bim, useDxfViewerNotifications· `ui/components/LevelPanel.tsx`· `features/floorplan-import/FloorplanImportWizard.tsx`· locale `dxf-viewer-shell` + `files-media`. (Λεπτομέρειες: MEMORY `project_adr448_storey_aware_dxf.md` + ADR-448 §8.)

---

## 1. 🔴 CODE = SoT — Η ΦΑΣΗ 4 ΧΡΕΙΑΖΕΤΑΙ RE-SCOPE (ΜΗΝ ακολουθήσεις τυφλά το ADR §6)

Ο ADR-448 §6 Phase 4 γράφει 3 bullets. **Έλεγξα τον κώδικα — τα 2 από τα 3 ΗΔΗ ΥΠΑΡΧΟΥΝ:**

| ADR §6 Phase 4 bullet | Κατάσταση στον κώδικα (2026-06-13) |
|---|---|
| Foundation/εδαφόπλακα κλειδώνουν στον lowest όροφο + warning άνω | ✅ **DONE στη Φ2** — `shouldWarnFoundationOnStorey` + EventBus `bim:foundation-on-upper-storey` + toast. |
| Cascade: `floor.height` αλλάζει → **υπάρχοντες** τοίχοι/κολώνες re-stretch | ✅ **ΗΔΗ ΥΠΑΡΧΕΙ** (προ-ADR-448, ADR-369 §9 Q5): `src/app/api/floors/floor-height-cascade.service.ts` → `cascadeFloorHeightToEntities` cascade-άρει `params.height` σε `FLOORPLAN_WALLS` + `FLOORPLAN_COLUMNS` με `topBinding='storey-ceiling'`. **Wired** στο `floors.handlers.ts` PUT (γραμμές ~270-282, trigger όταν `updates.height` αλλάζει· idempotent· EntityAudit ανά entity). |
| Multi-storey stacking (κολώνες/δάπεδα/οροφές σωστό FFL· «όλοι οι όροφοι»=πλήρες κτίριο) | ⚠️ **Σε μεγάλο βαθμό καλυμμένο** από Φ1 (storey-ceiling render) + Φ3 (all-floors levels). Απομένει verify, όχι νέα μηχανή. |

### ➡️ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΚΕΝΟ της Φ4 (το βρήκα στον κώδικα):

**Ο cascade service καλύπτει walls + columns αλλά ΟΧΙ slabs.** Η Φ2 όρισε ότι τα **ceiling/roof slabs** παίρνουν FFL = **floor-relative storey height** (`resolveStoreyCeilingElevationMm` → `params.levelElevation`). Άρα όταν αλλάζει το `floor.height`:
- ✅ υπάρχοντες τοίχοι/κολώνες → re-stretch (cascade service)
- ❌ **υπάρχοντα ceiling/roof slabs → ΜΕΝΟΥΝ στο παλιό levelElevation** (ο cascade τα αγνοεί τελείως) → **inconsistency**: νέα ceiling slabs χρησιμοποιούν το νέο storey height (Φ2), τα παλιά όχι.

**Αυτό είναι το Revit-grade κενό:** «άλλαξε το ύψος ορόφου → ΟΛΟΚΛΗΡΟΣ ο όροφος (τοίχοι + κολώνες + **η οροφή/πλάκα**) ξανα-τεντώνεται».

---

## 2. ΣΤΟΧΟΣ PHASE 4 (re-scoped, code-true)

**Primary deliverable — Slab cascade:** Επέκταση του `floor-height-cascade.service.ts` ώστε όταν αλλάζει το `floor.height`, να ξανα-υπολογίζει το `params.levelElevation` των **υπαρχόντων ceiling/roof slabs** του ορόφου (μόνο `kind === 'ceiling' || 'roof'`· τα `floor`/`ground`/`foundation` slabs ΔΕΝ είναι storey-height-driven → skip, όπως ο service ήδη κάνει skip για `topBinding!=='storey-ceiling'`).

**Secondary (verify-only, όχι νέα μηχανή):**
- **Live-viewer reactivity:** με τα levels ανοιχτά (Φ3), όταν τρέξει ο cascade server-side, ο ανοιχτός DXF Viewer πρέπει να ανανεώσει τα entities μέσω Firestore subscription. *Πιθανότατα ήδη δουλεύει* (οι BIM persistence hooks subscribe-άρουν)· επιβεβαίωσέ το, μην το ξαναχτίσεις. ΣΗΜ: για τον **ενεργό** όροφο το storey-ceiling **render** (Φ1b) ακολουθεί ήδη δυναμικά το ταβάνι από το `ActiveStoreyContext` — άρα η οπτική ενημέρωση του ενεργού ορόφου δεν εξαρτάται από τον persisted cascade· ο cascade αφορά την **persisted αλήθεια** για κλειστές/μη-ενεργές όψεις + BOQ.

**Decision να πάρεις (Revit-grade, δική σου — N.14 feedback «μην ρωτάς standard options»):**
- Formula ceiling-slab cascade: το floor-relative ceiling FFL = storey height. Όταν `floor.height = H` (μέτρα), το νέο `levelElevation = H * 1000` (mm). Αν θες πλήρη συμβατότητα με το `resolveStoreyCeilingElevationMm` (`nextFloorElevationMm − floorElevationMm`), χρειάζεσαι το floor stack στον server (ο service σήμερα ΔΕΝ το έχει). **Πρόταση:** χρησιμοποίησε `floor.height * 1000` απευθείας (= ορισμός storey height = ό,τι άλλαξε ο χρήστης) → ντετερμινιστικό, μηδέν extra read. Τεκμηρίωσέ το στο ADR ως απόφαση.

**Building structure awareness / vertical continuity (το 3ο bullet):** Αξιολόγησε **code = SoT** αν απομένει πραγματικό deliverable ή αν καλύφθηκε από Φ1-3. Αν είναι μόνο validation/warnings (π.χ. «λείπει ενδιάμεσος όροφος», «κολώνα δεν στοιχίζεται με κάτω») → πιθανόν **DEFER ως ξεχωριστό ADR** (risk isolation), μην το χώσεις στη Φ4. Ρώτησε τον Giorgio αν το θέλει τώρα.

---

## 3. SEAMS PHASE 4 (code = SoT — επαλήθευσέ τα, γραμμές ίσως μετακινήθηκαν)

| Σημείο | Αρχείο | Τι κάνει σήμερα | Φ4 |
|---|---|---|---|
| **Cascade service** | `src/app/api/floors/floor-height-cascade.service.ts` | walls+columns: `params.height = newHeightMm + topOffset − baseOffset` για `topBinding='storey-ceiling'`· EntityAudit· batch· idempotent | **ADD** 3ο query `FLOORPLAN_SLABS` (companyId+floorId)· για `kind==='ceiling'||'roof'` set `params.levelElevation = newHeightMm`· push σε νέο `slabEntries`· EntityAudit `entityType:'slab'`· extend `CascadeResult` με `slabsUpdated`. ≤40γρ/func → βγάλε helper αν χρειαστεί (ο βρόχος walls/columns είναι ήδη duplicate-ish → SSoT helper `cascadeEntity(snap, deriveFn, entries)` Boy-Scout). |
| **Handler** | `src/app/api/floors/floors.handlers.ts` (~270-290) | καλεί `cascadeFloorHeightToEntities`· επιστρέφει `cascadeWarning` | Αμετάβλητο interface· ίσως log `slabsUpdated`. Έλεγξε ότι το `CascadeResult` consumer δεν σπάει. |
| **Slab field** | `hooks/drawing/slab-completion.ts` (~101-115) | ceiling/roof FFL = `resolveStoreyCeilingElevationMm(...)` → `params.levelElevation` | Read-only reference: επιβεβαιώνει field name `params.levelElevation` + kind discrimination `'ceiling'/'roof'`. |
| **Collection** | `src/config/firestore-collections` | `FLOORPLAN_SLABS = 'floorplan_slabs'` | χρησιμοποίησε `COLLECTIONS.FLOORPLAN_SLABS`. |
| **Audit type** | `EntityAuditService.recordChange` | δέχεται `entityType:'wall'|'column'|...` | Έλεγξε ότι `'slab'` είναι valid `AuditEntityType`· αν όχι → πρόσθεσέ το (mirror wall/column· N.6/ADR-195). |

### ⚠️ Προσοχές:
- **Server-side, Firestore Admin** (όχι client). N.6 enterprise-id ΔΕΝ αφορά (update, όχι create). Firestore rules CHECK 3.10: queries με `where` ΠΡΕΠΕΙ να έχουν `companyId` — ο service ήδη το κάνει· κράτα το για το slab query.
- **Idempotent:** ίδιο `floor.height` → ίδιο `levelElevation` → no-op diff. Belt-and-suspenders: μηδέν ceiling/roof slabs → καθόλου slab στο batch.
- **Tests:** ο service έχει tests? Ψάξε `floor-height-cascade*.test.ts`. Αν ΝΑΙ → extend (slab cascade, skip floor/ground, idempotent). Αν ΟΧΙ → γράψε καινούριο (mock Firestore batch, mirror υπάρχον pattern).
- **EntityAudit baseline (CHECK 3.17):** ο cascade ΗΔΗ καλεί `recordChange` → αν προσθέσεις slab writes, βεβαιώσου ότι καλύπτονται (μην αυξήσεις baseline violations).

---

## 4. ΣΕΙΡΑ ΕΡΓΑΣΙΑΣ (N.0.1 ADR-driven)

1. **Recognition (code = SoT):** ξανα-διάβασε `floor-height-cascade.service.ts` + `floors.handlers.ts` PUT + `slab-completion.ts` ceiling branch + `AuditEntityType` union + τυχόν υπάρχον cascade test. Επιβεβαίωσε το slab gap.
2. **Δήλωσε μοντέλο (N.14)** = Opus. **Περίμενε «ok».**
3. **Mode (N.8):** ~2-4 αρχεία (service + handler-log + audit-type + test) → Plan Mode. Αν αποφασίσεις να πιάσεις και «vertical continuity» → 5+ αρχεία → **ρώτησε** Giorgio (orchestrator vs split).
4. **ADR-448 ΠΡΩΤΑ (code = SoT reconciliation):** §6 Phase 4 → **ξαναγράψ' το** ώστε να λέει την αλήθεια: foundation gating ✅Φ2· wall/column cascade ✅ADR-369 pre-existing· **ΝΕΟ deliverable = slab cascade**· vertical-continuity = scoped/deferred. §8 changelog.
5. **Υλοποίηση:** slab cascade στο service (Boy-Scout SSoT helper για το κοινό loop) + audit + `CascadeResult.slabsUpdated` + tests. Verify live-viewer reactivity (read-only).
6. **Verify:** jest (`npm run test:ai-pipeline:all` ΔΕΝ αφορά — αυτό είναι floors API, τρέξε το cascade suite) + IDE diagnostics (N.17). MCP firestore read-only: project `pagonis-87766`, άλλαξε `floor.height` ενός ορόφου με ceiling slab → επιβεβαίωσε `params.levelElevation` update. Browser (Giorgio): άλλαξε ύψος ορόφου → οροφή/πλάκα ξανα-τεντώνεται μαζί με τοίχους/κολώνες.
7. **N.15:** ADR-448 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`project_adr448_storey_aware_dxf.md`).
8. **COMMIT ο Giorgio** — shared tree → `git add` ΜΟΝΟ δικά σου hunks. ΟΧΙ `bim-three-structural-converters.ts` (ADR-449), ΟΧΙ `ui/ribbon/data/*` (icon-agent).

---

## 5. REFERENCE
- **SSoT προς extend:** `src/app/api/floors/floor-height-cascade.service.ts` (`cascadeFloorHeightToEntities`)· `EntityAuditService` (`@/services/entity-audit.service`)· `COLLECTIONS.FLOORPLAN_SLABS`.
- **Read-only refs:** `hooks/drawing/slab-completion.ts` (ceiling FFL = `params.levelElevation`)· `systems/levels/storey-creation-defaults.ts` (`resolveStoreyCeilingElevationMm` — η Φ2 λογική που πρέπει να καθρεφτίσει ο cascade)· `floor-stack-elevation.ts`.
- **ADRs:** ADR-448 (αυτό, §6 Phase 4)· **ADR-369 §9 Q5** (ο υπάρχων cascade — auto-stretch)· ADR-195 (EntityAudit).
- **MEMORY:** `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr448_storey_aware_dxf.md` (πλήρες ιστορικό Φ1+Φ2+Φ3).
- **Μετά τη Φ4:** ADR-448 CLOSE (όλες οι φάσεις done). Vertical-continuity validation = πιθανό νέο ADR αν ο Giorgio το θέλει.
