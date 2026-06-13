# HANDOFF — ADR-450: Floor-height cascade + SSoT-unify «οροφή ορόφου» (PLAN MODE → υλοποίηση)

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΣ agent: ADR-449 finish-skin — `structural-finish-scene.ts`, `polygon-dilate.ts` uncommitted στο tree· **ΜΗΝ τα αγγίξεις**).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι παίκτες, όπως η Revit. **FULL ENTERPRISE + FULL SSoT**.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio.** Ο agent ετοιμάζει & σταματά (N.(-1)).
> ⚠️ **Shared tree:** `git add` ΜΟΝΟ δικά μου hunks, **ΠΟΤΕ `git add -A`**.
> ⚠️ **N.17:** ένας tsc/IDE τη φορά.
> 🟢 **ΠΡΩΤΟ ΒΗΜΑ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ: PLAN MODE.** Διάβασε τον κώδικα (§4), φτιάξε αναλυτικό σχέδιο, παρουσίασέ το στον Giorgio για έγκριση **ΠΡΙΝ** γράψεις κώδικα (N.8: 5+ αρχεία, νέο domain στα floors).

---

## 0. ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ADR — η «ρίζα» που αποκαλύφθηκε σε verify

Το ADR-441/401 (storey-aware beams + framing column→beam attach) είναι **✅ DONE, committed `93a95d08`, browser-verified**. Κατά το verify, τα δοκάρια «από κάναβο» έβγαιναν `topElevation=3000` αντί 5000. **Δεν ήταν bug κώδικα** — ήταν **ασύμβατα δεδομένα ορόφων** + **dual-source** για την «οροφή ορόφου»:

- Όροφος 1ος (`flr_161aa890`): `elevation=3`, `height=5` (ο χρήστης άλλαξε το height σε 5).
- Όροφος 2ος (`flr_528ca26e`): `elevation=6` (stale — έπρεπε 3+5=**8**, αλλά δεν cascade-άρισε όταν άλλαξε το height του 1ου).
- **Κολώνα** διαβάζει `resolveStoreyHeightMm` → `storeyHeightMm` = floor.height = **5000** ✓
- **Δοκάρι** διαβάζει `resolveStoreyCeilingElevationMm` → `nextFloorElevationMm − floorElevationMm` = (6−3)·1000 = **3000** ✗
- → αποκλίνουν· οι κολώνες (top 5000) attach-άρουν στα δοκάρια (top 3000) και τραβιούνται κάτω.

**Προσωρινή χειροκίνητη διόρθωση που έγινε ΗΔΗ (Firestore):** `floors/flr_528ca26e... elevation: 6→8`. Μετά απ' αυτό το verify πέρασε (δοκάρια 5000, κολώνες attached 5000). **Αυτό δεν είναι λύση ρίζας** — την επόμενη φορά που θα αλλάξει ύψος ορόφου, θα ξανασπάσει.

---

## 1. SCOPE ADR-450 (3 κομμάτια — «και τα δύο» + cosmetic, εγκρίθηκε από Giorgio)

### (1) Floor-height cascade — Revit level-driven (ΚΥΡΙΟ)
Revit: τα Levels είναι το SSoT της κατακόρυφης θέσης· αλλάζεις ύψος/elevation ενός level → τα από πάνω μετατοπίζονται. Εδώ λείπει αυτό στο **επίπεδο δεδομένων ορόφων (`floors` collection)**.
- Αλλαγή `height` (ή `elevation`) ορόφου → **auto-shift `elevation` ΟΛΩΝ των επάνω ορόφων** κατά την αλυσίδα `elev_next = elev_prev + height_prev`.
- **Persisted** στο Firestore + **undoable** (command pattern, mirror ADR-448 Φ4/Φ4b).
- Idempotent· να συνεργάζεται με το **ΥΠΑΡΧΟΝ** `floor-height-cascade.service.ts` (ADR-448 Φ4b = cascade των **entities μέσα** στον όροφο). Το νέο = cascade των **elevations των ίδιων των ορόφων**. Αυτό είναι ακριβώς το ADR-448 DEFER «vertical-continuity → νέο ADR».

### (2) SSoT-unify «οροφή ορόφου» (κρίσιμο για FULL SSoT)
Κολώνες & δοκάρια **πρέπει** να διαβάζουν **ΜΙΑ** πηγή για την οροφή. Σήμερα:
- κολώνα → `resolveStoreyHeightMm` (floor.height)
- δοκάρι → `resolveStoreyCeilingElevationMm` (next-floor gap)

Παράγουν ίδιο αποτέλεσμα **μόνο** όταν τα δεδομένα είναι συνεπή. Απόφαση σχεδίασης (πάρε Revit-grade θέση, ζήτα έγκριση): μετά το cascade (1), `floor.elevation` & `floor.height` θα είναι **πάντα συνεπή** (gap == height), οπότε οι δύο τύποι ταυτίζονται. Πρότεινε: **ΕΝΑ resolver `resolveStoreyCeilingRelativeMm`** που να χρησιμοποιούν ΚΑΙ οι δύο (κολώνα top & δοκάρι top), ώστε να μην ξαναποκλίνουν δομικά. Πρόσεξε regression στα ADR-448 Φ2 tests.

### (3) Cosmetic — λάθος toast
Όταν δημιουργείς **κολώνες/δοκάρια από κάναβο**, βγαίνει toast «**Οι τοίχοι** κόλλησαν αυτόματα την κορυφή τους…» ενώ δεν υπάρχουν τοίχοι. Το column-attach εκπέμπει `bim:columns-auto-attached` (βλ. `hooks/useStructuralAutoAttach.ts:137`) αλλά ο listener/toast δείχνει το **wall i18n key**. Βρες τον listener του `bim:columns-auto-attached` και δώσε σωστό key (κολώνες). Ίδιο για beams αν χρειάζεται.

---

## 2. ΕΡΓΟΣΤΑΣΙΑΚΑ ΔΕΔΟΜΕΝΑ VERIFY (project pagonis-87766)
- Building `bldg_1fa41c6d-a4a6-4bb0-8da9-c5509deef9a3` («Κτήριο Α1»), 2 όροφοι:
  - `flr_161aa890-fda3-47bf-95b5-4d76d53b79b9` — number 1, elevation **3**, height **5** (ενεργός όροφος editing)
  - `flr_528ca26e-a7f7-44fc-af69-2eb715ace5ff` — number 2, elevation **8** (διορθωμένο), height 3
- Floorplan `file_32a7a4fb-a2df-4b82-a391-761241152478`· level `lvl_b997c956…`
- Verify cascade: άλλαξε `height` του 1ου → ο 2ος elevation πρέπει να ακολουθήσει αυτόματα (8 αν height=5· 7 αν height=4· κ.ο.κ.).

---

## 3. ΚΑΝΟΝΕΣ COMMIT (ο Giorgio)
- `git add` **ΜΟΝΟ δικά μου** αρχεία, explicit paths. **ΠΟΤΕ `git add -A`** (shared tree: ADR-449 agent έχει uncommitted `structural-finish-scene.ts`, `polygon-dilate.ts`).
- ADR-driven (N.0.1): νέο `ADR-450-*.md` + entry στο `adr-index.md` (ΑΝ δεν το απαγορεύει shared tree) + ενημέρωση `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY, **ίδιο commit** με τον κώδικα.
- ADR-450 = **επόμενο ελεύθερο** (highest = 449).

## 4. ΚΩΔΙΚΑΣ-ΚΛΕΙΔΙΑ (διάβασέ τα στο plan phase)
- `src/subapps/dxf-viewer/systems/levels/storey-creation-defaults.ts` — **dual source**: `resolveStoreyHeightMm` (κολώνα) vs `resolveStoreyCeilingElevationMm` (δοκάρι). Εδώ γίνεται το SSoT-unify (2).
- `src/subapps/dxf-viewer/systems/levels/active-storey-context.ts` — `buildActiveStoreyContext` (πώς βγαίνει `nextFloorElevationMm`, `storeyHeightMm`).
- `src/subapps/dxf-viewer/systems/levels/active-storey-store.ts` + `useActiveStoreySync.ts` — writer/reader του storey store.
- `src/subapps/dxf-viewer/bim-3d/scene/floor-stack-elevation.ts` — datum + datum-relative elevation math (SSoT, reuse).
- **ADR-448 Φ4b**: `floor-height-cascade.service.ts` (entity cascade — το νέο floor-elevation cascade πρέπει να συνυπάρξει/τροφοδοτήσει αυτό). ⚠️ **shared domain με ADR-448 agent — συντόνισε, μην πατήσεις πάνω του.**
- `src/components/properties/shared/useFloorsByBuilding.ts` — `FLOORS` subscription (collection «floors»· fields elevation/height/finishThickness).
- **Writer ορόφων** (όπου γίνεται edit του floor.height/elevation): ΨΑΞΕ το στο plan phase (LevelPanel / floors edit UI / floors service) — εκεί μπαίνει το cascade trigger.
- `src/subapps/dxf-viewer/hooks/useStructuralAutoAttach.ts:135-138` — `bim:columns-auto-attached` emit (για το cosmetic 3· βρες τον toast listener).

## 5. ΣΗΜΑΝΤΙΚΟ ΜΑΘΗΜΑ (μην το ξαναπάθεις)
Όταν ένα verify δείχνει «λάθος νούμερο», **έλεγξε πρώτα τα δεδομένα-είσοδο** (εδώ: floors elevations) πριν υποθέσεις bug κώδικα. Το 3000 ήταν σωστή storey-aware τιμή για stale data, όχι fallback. Επιβεβαίωσε με δύο ανεξάρτητα μονοπάτια (κολώνα 5000 vs δοκάρι 3000 = dual-source signal).

## 6. REFERENCE
- ADR-441 §9 + ADR-401 §8 (2026-06-13) — το committed framing work.
- ADR-448 §6 Φ2/Φ4/Φ4b — storey datum + cascades (γειτονικό domain).
- MEMORY: `project_adr450_floor_cascade_ssot_unify` (γράψε το αρχείο αν χρειαστεί) + index lines ADR-441/401 (DONE) & ADR-450 (PLANNED).
