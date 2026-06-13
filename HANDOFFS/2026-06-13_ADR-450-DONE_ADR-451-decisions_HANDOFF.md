# HANDOFF — ADR-450 DONE (pending commit) + ADR-451 decisions locked (Building Vertical Setup & Floor SSoT)

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΣ agent ADR-449 finish-skin: `structural-finish-scene.ts`, `polygon-dilate.ts`, `ADR-449-*.md` uncommitted — **ΜΗΝ τα αγγίξεις**).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι παίκτες, όπως η Revit. **FULL ENTERPRISE + FULL SSoT**.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH μόνο ο Giorgio.** `git add` ΜΟΝΟ δικά μου αρχεία, **ΠΟΤΕ `git add -A`**. **N.17:** ένας tsc τη φορά.

---

## ΜΕΡΟΣ Α — ADR-450 ✅ DONE + BROWSER-VERIFIED, ΕΚΚΡΕΜΕΙ ΜΟΝΟ COMMIT

ADR-450 «Floor-elevation cascade + SSoT-unify οροφής» — **υλοποιημένο, browser-verified ζωντανά από Giorgio**, 34+28 jest, tsc καθαρό. **Δεν έγινε commit** (περιμένει εντολή Giorgio).

### Τι έγινε (3 κομμάτια)
1. **Floor-elevation cascade (§1)** — NEW `src/app/api/floors/floor-elevation-cascade.service.ts` (+`__tests__/…test.ts`, 7 tests): αλλαγή `floor.height` → server cascade `elev[i+1]=elev[i]+height[i]` στους επάνω ορόφους (self-healing/idempotent/audit). Wired στο `floors.handlers.ts` `handleUpdateFloor` **μετά** τον entity-cascade.
2. **SSoT-unify οροφής (§2)** — MOD `systems/levels/storey-creation-defaults.ts`: NEW `resolveStoreyCeilingRelativeMm` = `floor.height` (canonical, ΟΧΙ gap)· κολώνα+δοκάρι/πλάκα delegate → ΕΝΑ ceiling. +4 tests στο `__tests__/storey-creation-defaults.test.ts`.
3. **Cosmetic toasts (§3)** — MOD `hooks/notifications/structural-attach-notifications.ts` + `i18n/locales/{el,en}/dxf-viewer-shell.json`: NEW keys `attachToStructural.autoAttachedColumns` / `.autoAttachedStairs` (πριν έβγαινε λάθος «τοίχοι» σε κολώνες/σκάλες από κάναβο).

### Browser-verify (project pagonis-87766, building bldg_1fa41c6d) — ΟΛΑ ΠΕΡΑΣΑΝ
- §1: floor1 h=3.5 → floor2 elevation auto→6.5 (3.0+3.5). Επιβεβαιώθηκε στο Firestore (updatedAt 1ms μετά).
- §2: δοκάρια `topElevation=3500` == κορυφή κολώνας (+3500, = baseOffset −1000 + height 4500). Διαβάζουν ίδια πηγή = `floor.height` 3.5m.
- §3: «Δοκάρια από κάναβο» → «Οι **κολώνες** κόλλησαν…» ✅· «Τοίχοι από κάναβο» → «Οι **τοίχοι**…» ✅.
- Τελικό cascade: αλλαγή ύψους → όλο το πλαίσιο (entities + επάνω όροφοι) πήρε σωστό νέο υψόμετρο.
- ΜΑΘΗΜΑ (honesty): αρχικά ανησύχησα για «stale storey context 3500 vs 4000» — **ήταν δικό μου λάθος**, σύγκρινα με παλιό Firestore read· ο χρήστης είχε αλλάξει height→3.5· όλα συνεπή. Πάντα re-read τα live data πριν υποθέσεις staleness.

### COMMIT — δικά μου αρχεία ΜΟΝΟ (όταν πει ο Giorgio)
Κώδικας/tests: `floor-elevation-cascade.service.ts`(+test)· `floors.handlers.ts`· `storey-creation-defaults.ts`(+test)· `structural-attach-notifications.ts`· `i18n/locales/el/dxf-viewer-shell.json`· `i18n/locales/en/dxf-viewer-shell.json`.
Docs: `docs/centralized-systems/reference/adrs/ADR-450-floor-elevation-cascade-ssot-unify.md`· `adr-index.md` (ΜΟΝΟ η γραμμή ADR-450)· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-450)· MEMORY.
⚠️ **ΜΗΝ** `git add`: `structural-finish-scene.ts`, `polygon-dilate.ts`, `ADR-449-*.md`, και τη γραμμή ADR-449 στο adr-index (άλλος agent).

---

## ΜΕΡΟΣ Β — ADR-451 (ΝΕΟ, PLANNED) «Building Vertical Setup & Floor SSoT (Revit level-driven)»

Συζητήθηκε & **κλειδώθηκαν 6 αποφάσεις με τον Giorgio**. Επόμενο βήμα νέας session: **PLAN MODE → ADR-451 plan** (χωρίς κώδικα), παρουσίαση για έγκριση.

### Πρόβλημα
Η καρτέλα «Όροφοι» (σελίδα Κτιρίων) επιτρέπει δημιουργία ορόφου χωρίς συνέχεια (π.χ. όροφος 2 χωρίς 0/1, χωρίς θεμελίωση). Λείπει vertical-continuity + Revit-grade building setup. Επίσης ο DXF Viewer δεν επεξεργάζεται ορόφους (μονόδρομη). Είναι το ADR-448 DEFER «vertical-continuity → νέο ADR».

### 6 ΚΛΕΙΔΩΜΕΝΕΣ ΑΠΟΦΑΣΕΙΣ (Giorgio «συμφωνώ με όλα», 2026-06-13)
1. **Continuity = Warning (soft), ΟΧΙ hard block.** Revit way· ο χρήστης κύριος· warning σε κενά αρίθμησης / λείπει ισόγειο / μεμονωμένος όροφος. (Υπάρχει ήδη `floorGaps` στο `useFloorsTabState` + `shouldWarnFoundationOnStorey` — να γίνουν ορατά warnings με override.)
2. **Υπόγειο = count (0,1,2…), ΟΧΙ checkbox.** Υποστηρίζει -1/-2 (διπλό υπόγειο, πιλοτή+υπόγειο).
3. **Θεμελίωση = auto-derived datum, ΟΧΙ «όροφος».** Setup δηλώνει «έχει θεμελίωση; (default ΝΑΙ) + βάθος» → μπαίνει στο χαμηλότερο επίπεδο, ΔΕΝ μετριέται ως storey. **Ο ΤΥΠΟΣ θεμελίωσης (πεδιλοδοκοί/κοιτόστρωση/πέδιλα) ΠΑΕΙ ΣΤΟ DXF (per-element, `floorplan_foundations`), ΟΧΙ στο setup** — είναι geometry-driven απόφαση (μετά τον κάναβο/κολώνες). Προαιρετικό building-level «default τύπος» ως preference μόνο (αυθεντία = element). Συμβατό με ADR-436/441.
4. **⭐ ΘΕΜΕΛΙΟ: `elevation` = SSoT (απόλυτη αλήθεια Level), `height` = παράγωγο** (next.elevation − this.elevation). **ΕΝΑ ενοποιημένο cascade** — σήμερα συνυπάρχουν ΔΥΟ: (α) server-side height→elevation (ADR-450 §1, `floor-elevation-cascade.service.ts`)· (β) client-side elevation→uniform-delta-shift (`useFloorsTabState.handleSaveEdit` γρ. ~270-299). **ΠΡΕΠΕΙ ΝΑ ΕΝΟΠΟΙΗΘΟΥΝ σε ΕΝΑ μοντέλο** αλλιώς συγκρούονται. Revit: επεξεργασία elevation Ή height → το άλλο επανυπολογίζεται με ΕΝΑΝ κανόνα, server-authoritative.
5. **Setup entry = Quick Setup (υπόγεια/ισόγειο/όροφοι → παράγει στοίβα με σωστά elevations via cascade) + κράτα σταδιακή επεξεργασία στην καρτέλα.** Χτίζει στο ADR-448 Φ3 wizard «όλοι οι όροφοι».
6. **DXF Viewer = full CRUD ορόφων μέσω ΙΔΙΟΥ API** (`POST/PUT /api/floors`). Αφού το cascade είναι server-side, δουλεύει από όπου κι αν κληθεί· `useFloorsByBuilding` live subscription συγχρονίζει αμφίδρομα. **ΕΝΑ SSoT = συλλογή `floors`**· τα DXF «Levels» (`lvl_*`) = projection, ΟΧΙ αντίγραφο.

### Κρίσιμα tech σημεία για το plan
- **#4 είναι το θεμέλιο** — λύσε πρώτα την ενοποίηση των δύο cascades. Ο client uniform-delta (useFloorsTabState) πιθανότατα να αντικατασταθεί/μετακινηθεί server-side ώστε ΕΝΑΣ κανόνας να κυβερνά elevation↔height. Πρόσεξε ADR-450 §1 (μη σπάσεις το height→elevation που μόλις verify-άρισε).
- Reuse: `buildActiveStoreyContext`, `floor-stack-elevation.ts`, ADR-448 Φ3 `ensure-levels-for-building`, `floorGaps`, `shouldWarnFoundationOnStorey`.
- N.8: 5+ αρχεία/2+ domains (floors API + buildings UI + DXF viewer levels) → **PLAN MODE υποχρεωτικό**, παρουσίαση πριν κώδικα.
- ADR-451 = επόμενο ελεύθερο (highest=450 μετά το commit).

### Verify data
project pagonis-87766· building bldg_1fa41c6d· όροφοι flr_161aa890 (1ος, el=3, h=3.5) / flr_528ca26e (2ος, el=6.5, h=3)· floorplan file_32a7a4fb· level lvl_b997c956. Σκηνή 1ου ορόφου έχει ήδη: 24 foundations + 9 columns + δοκάρια + τοίχους από κάναβο (από το verify).

---

## REFERENCE
- ADR-450 doc (νέο)· ADR-448 §6 (storey datum + cascades)· ADR-441 (foundation grid)· ADR-436 (foundation discipline)· ADR-369 §9 (elevation convention).
- MEMORY: ενημερωμένο index line ADR-450 (DONE). Γράψε `project_adr451_building_vertical_setup` όταν ξεκινήσει το ADR-451.
