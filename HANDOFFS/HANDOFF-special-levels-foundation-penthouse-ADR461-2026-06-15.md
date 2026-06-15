# HANDOFF — Ειδικές Στάθμες: Θεμελίωση + Απόληξη Κλιμακοστασίου (νέο ADR-461)

**Ημερομηνία:** 2026-06-15
**Συντάκτης:** Opus 4.8 (συνεδρία ADR-459 Φ4e/4f — μετά το verification ο Giorgio άλλαξε θέμα)
**Θέμα νέας συνεδρίας:** Νέο feature οικογένειας **ADR-448/451** (storey-aware levels). Η **θεμελίωση** και η **απόληξη κλιμακοστασίου** να γίνονται **αυτόματες ειδικές στάθμες** (drawable DXF levels) — ορατές στον πίνακα ορόφων & στον καμβά, αλλά **ΟΧΙ μετρημένοι όροφοι**. **FULL ENTERPRISE + FULL SSoT + Revit-grade** (πρότυπο Revit Levels: foundation/roof = Levels με «Building Story» OFF).

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT:** Ο Giorgio κάνει τα commit/push, ΟΧΙ εσύ. Ποτέ `git commit`/`push` χωρίς ρητή εντολή (N.(-1)).
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent ταυτόχρονα (ADR-460 multishape — αγγίζει `bim/structural/codes/*`, `column-*`). `git add` ΜΟΝΟ τα δικά σου αρχεία — **ΠΟΤΕ** `git add -A`. Το ADR-461 αγγίζει **building-management + dxf-viewer/systems/levels** → πιθανότατα ΔΕΝ συγκρούεται με τον ADR-460 agent, αλλά πρόσεξε.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`). Ένα tsc τη φορά, σειριακά.
> ⚠️ **MODEL (N.14):** cross-cutting (types + server + UI + dxf levels) → **Opus**. Δήλωσέ το.
> ⚠️ **i18n (N.11):** ΚΑΘΕ νέο `t('key')` → πρώτα keys σε `el` ΚΑΙ `en`, ΜΕΤΑ κώδικας. ICU single-brace `{x}`.
> ⚠️ **ADR-driven (N.0.1):** PHASE 1 (διάβασε CURRENT CODE) → plan → ΕΓΚΡΙΣΗ ΠΡΙΝ κώδικα → υλοποίηση → ADR update.

---

## ΜΕΡΟΣ 0 — ΑΠΟΦΑΣΕΙΣ ΗΔΗ ΚΛΕΙΔΩΜΕΝΕΣ (ο Giorgio τις ενέκρινε ρητά)

1. **Φύση:** Θεμελίωση & Απόληξη = **ειδικές στάθμες** (special levels), ΟΧΙ μετρημένοι όροφοι. Έχουν δικό τους **DXF Level** (σχεδιάζεις πάνω τους) + γραμμή στον πίνακα «Όροφοι», αλλά το «Όροφοι: N» **δεν** τις μετράει. (Revit-true.)
2. **Απόληξη = toggle:** «Έχει απόληξη κλιμακοστασίου» checkbox + ύψος (καθρέφτης του «Έχει θεμελίωση»). **Default ON** όταν υπάρχει ≥1 όροφος (ο μηχανικός το βγάζει σε μονοκατοικία).
3. **Ύψος απόληξης default = 2.40 m**.
4. **Παράδειγμα Giorgio:** 0 υπόγεια + ισόγειο + 2 όροφοι → **5 στάθμες**: `Θεμελίωση · Ισόγειο · 1ος · 2ος · Απόληξη`. (Με 1 υπόγειο → 6 στάθμες: `Θεμελίωση · Υπόγειο · Ισόγειο · 1ος · 2ος · Απόληξη`.) Θεμελίωση **κάτω** από τη χαμηλότερη, Απόληξη **πάνω** από την ψηλότερη.

---

## ΜΕΡΟΣ 1 — GROUND TRUTH (PHASE 1 — έγινε ήδη· επιβεβαίωσε με re-read)

### Τρέχουσα κατάσταση (κώδικας = αλήθεια)
- **Θεμελίωση = datum / flag, ΟΧΙ στάθμη.** `src/types/building/contracts.ts:144-148` → `hasFoundation?: boolean` + `foundationDepth?: number` (building-level). Το `building-vertical-setup.ts` **ρητά δεν** βάζει τη θεμελίωση στη στοίβα (docstring: «auto-derived datum — NOT a counted storey», ADR-451 §3).
- **Απόληξη = ΔΕΝ ΥΠΑΡΧΕΙ ΠΟΥΘΕΝΑ** (ούτε flag, ούτε τύπος, ούτε στάθμη).
- **Πώς γίνονται στάθμες οι όροφοι:** `src/subapps/dxf-viewer/systems/levels/ensure-levels-for-building.ts` → `ensureLevelsForBuilding(resolver, floors, buildingId)` κάνει **loop μόνο στις γραμμές ορόφων** → `findOrCreateLevelForFloor` (1 DXF Level ανά floor, keyed `floorId`, idempotent). **Foundation & απόληξη ΔΕΝ παίρνουν Level** (δεν είναι floors). ⚠️ Το docstring λέει ψευδώς «foundation → basement → …» — η θεμελίωση **δεν** φτάνει ποτέ εδώ.

### Αρχεία-κλειδιά (διάβασέ τα ΠΡΙΝ κώδικα)
| Αρχείο | Τι έχει |
|---|---|
| `src/components/building-management/tabs/building-vertical-setup.ts` | `generateFloorStack(config)` SSoT. `VerticalSetupConfig{basementCount, upperCount, typicalHeightM}` · `GeneratedFloorSpec{number, elevation, height}` · `DEFAULT_TYPICAL_STOREY_HEIGHT_M=3.0`. Loop `-basements..+uppers`, ground=0, `elevation=number*h`. |
| `src/components/building-management/tabs/__tests__/building-vertical-setup.test.ts` | Τα tests του generator — επέκτεινέ τα. |
| `src/components/building-management/tabs/BuildingVerticalSetupForm.tsx` | Το UI «Γρήγορη ρύθμιση»: Υπόγεια/Όροφοι/Τυπικό ύψος + **«Έχει θεμελίωση» + Βάθος** (καθρέφτισέ το για απόληξη). |
| `src/types/building/contracts.ts` | Building type (`hasFoundation`/`foundationDepth` @144-148) + Floor type (number/elevation/name/height). |
| `src/types/building/elevation.schemas.ts` | Zod: `hasFoundation`/`foundationDepth` @75-77 (πρόσθεσε penthouse + floor `role`). |
| `src/subapps/dxf-viewer/systems/levels/ensure-levels-for-building.ts` | Ο loop floors→levels (REUSE — μην τον ξαναγράψεις). `BuildingFloorInput{id, number?, label?}`. |
| `src/subapps/dxf-viewer/systems/levels/level-floor-resolution.ts` | `findOrCreateLevelForFloor` (ο per-floor SSoT). |
| `src/subapps/dxf-viewer/systems/levels/storey-creation-defaults.ts` | Per-level creation defaults (foundation→πέδιλα, απόληξη→σκάλα/δώμα στο Phase C). |
| `src/subapps/dxf-viewer/bim/foundations/foundation-level.ts` | Σχετικό με foundation level (διάβασέ το για Phase C). |
| `src/app/api/floors/**` + `building-services.ts` | Server floors handlers (persistence — Phase B). |

### Η αρχιτεκτονική απόφαση (SSoT, εγκεκριμένη)
- **Floor model:** πρόσθεσε `role?: 'foundation' | 'storey' | 'stair-penthouse'` (**default `'storey'`** → back-compat). **Μόνο `'storey'`** μετράει στο «Όροφοι: N».
- **Building-level:** πρόσθεσε `hasStairPenthouse?: boolean` + `stairPenthouseHeight?: number` (default 2.40) — καθρέφτης foundation. (Κράτα `hasFoundation`/`foundationDepth`.)
- **`generateFloorStack`:** εκπέμπει foundation spec (role='foundation', `elevation = lowestStoreyElevation − foundationDepth`) ΚΑΙ penthouse spec (role='stair-penthouse', `elevation = topStoreyElevation + topStoreyHeight`, `height = stairPenthouseHeight`) όταν τα toggles είναι ON. Επέκτεινε το `VerticalSetupConfig` με `hasFoundation/foundationDepth/hasStairPenthouse/stairPenthouseHeight`.
- **REUSE `ensureLevelsForBuilding`:** αφού foundation/penthouse γίνουν role-tagged floor records, παίρνουν **αυτόματα** DXF Level μέσω του ΥΠΑΡΧΟΝΤΟΣ loop — **μηδέν νέος μηχανισμός** (N.0.2). Φρόντισε το ordering (foundation χαμηλότερη `number`, penthouse ψηλότερη).

---

## ΜΕΡΟΣ 2 — ΟΙ ΦΑΣΕΙΣ

| Phase | Τι | Domain | Risk |
|---|---|---|---|
| **A** ✅ ΞΕΚΙΝΑ ΕΔΩ | Model & generation: floor `role` + building penthouse fields (contracts+Zod) · `generateFloorStack` foundation+penthouse · tests. **Pure, unit-testable, μηδέν UI/render.** | building types | 🟢 χαμηλό |
| **B** | «Όροφοι» UI + server: toggle «Έχει απόληξη» + ύψος στο `BuildingVerticalSetupForm` · ο πίνακας δείχνει foundation/απόληξη rows (special styling, **εκτός count**) · server persistence του `role` + των special floors. | building-management | 🟡 μεσαίο |
| **C** | DXF levels: foundation/penthouse → Levels μέσω `ensureLevelsForBuilding` · per-level creation defaults (`storey-creation-defaults`: foundation→πέδιλα, απόληξη→σκάλα/δώμα) · level switcher + «Εισαγωγή Κάτοψης» δείχνουν τις 5-6 στάθμες. | dxf-viewer levels | 🟡 μεσαίο |
| **D** | Elevation cascade: ένταξη στο ADR-448/450 cascade ώστε edits υψομέτρων/υψών να κρατούν τις special levels συνεπείς (foundation κάτω, penthouse πάνω). | dxf + server | 🟠 υψηλό |

### Phase A — αναλυτικό scope (η παράδοση αυτής της 1ης συνεδρίας)
1. **`contracts.ts`**: floor `role?: 'foundation'|'storey'|'stair-penthouse'` (default 'storey') + building `hasStairPenthouse?` / `stairPenthouseHeight?`.
2. **`elevation.schemas.ts`**: Zod για τα παραπάνω (penthouse mirror foundation· `stairPenthouseHeight` `.min(0).max(...)`· floor role enum optional).
3. **`building-vertical-setup.ts`**: `GeneratedFloorSpec += role` · `VerticalSetupConfig += hasFoundation/foundationDepth/hasStairPenthouse/stairPenthouseHeight` · `generateFloorStack` εκπέμπει τα 2 special specs (foundation κάτω, penthouse πάνω) με σωστά `number`/`elevation`/`height`. Κράτα back-compat (χωρίς toggles → ίδια έξοδος όπως σήμερα).
4. **`building-vertical-setup.test.ts`**: νέα tests (foundation spec, penthouse spec, ordering low→high, default 2.40, toggles OFF = αμετάβλητο, count «storey-only»).
5. **(προαιρετικά Phase A)** helper `countBuildingStoreys(floors)` (μετράει μόνο role==='storey') ως SSoT για το «Όροφοι: N» — θα το καταναλώσει το Phase B.

**ΟΧΙ στο Phase A:** UI, server persistence, DXF levels, rendering. Μόνο pure model + generation + tests.

---

## ΜΕΡΟΣ 3 — ENTERPRISE/SSoT ΑΡΧΕΣ (ΑΠΑΡΑΒΑΤΕΣ)
- **ΕΝΑ SSoT για τη στοίβα σταθμών** = `generateFloorStack`. Το «Όροφοι: N» = παράγωγο (count μόνο role==='storey'). Τα DXF Levels = παράγωγο μέσω `ensureLevelsForBuilding` (μην το διπλασιάσεις).
- **Back-compat:** `role` default 'storey'· υπάρχοντα κτήρια/floors χωρίς role = storeys. Penthouse absent = κανένα penthouse level.
- **N.2:** no `any`/`as any`. **N.7.1:** αρχεία ≤500 / functions ≤40. **N.6:** Firestore IDs μέσω enterprise-id service (Phase B server).
- **Revit-grade:** foundation/penthouse = Levels με «Building Story» OFF (όπως Revit). Elevation = SSoT· height = παράγωγο όπου ισχύει (ADR-451 σύμβαση).
- **i18n el+en ΠΡΩΤΑ** για κάθε νέο label (Phase B: «Απόληξη Κλιμακοστασίου», «Έχει απόληξη», «Ύψος απόληξης»).

---

## ΜΕΡΟΣ 4 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff + **ADR-451** (building vertical setup — η φιλοσοφία foundation-datum που επεκτείνεις) + ADR-448 (storey-aware) + ADR-450 (floor cascade) + ΜΕΡΟΣ 1 ground-truth αρχεία.
2. **Δήλωσε μοντέλο** (Opus).
3. **PHASE 1 (N.0.1):** επιβεβαίωσε ground truth (foundation=datum όχι level· καμία απόληξη· `ensureLevelsForBuilding` loop μόνο floors). Compare ADR-451 vs code.
4. **Νέο ADR-461** «Special Levels (Foundation + Stair Penthouse)» — βρες τον επόμενο ελεύθερο αριθμό (ήταν ADR-460 ο τελευταίος· **επιβεβαίωσε** στο `adr-index.md` ότι 461 ελεύθερο). Γράψε context/decision/model/phases.
5. **Πρότεινε plan για Phase A + ζήτα έγκριση** ΠΡΙΝ γράψεις κώδικα (ο Giorgio είπε «σταδιακά, από τη θεμελίωση προς τα πάνω»). Μετά υλοποίησε **ΜΟΝΟ Phase A**.
6. Μετά: ADR-461 changelog + `adr-index.md` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15). commit = Giorgio.

**ADR αναφορές:** ADR-451 (building vertical setup — master), ADR-448 (storey-aware DXF), ADR-450 (floor-elevation cascade), ADR-369 (elevation convention/Revit alignment), ADR-436/441 (foundation discipline/grid).

**Κατάσταση ADR-459 (προηγούμενη συνεδρία, ΜΗΝ το πιάσεις):** Phase 4e (E1+E3) + 4f DONE, UNCOMMITTED (290 jest, tsc clean). E1 browser-verify εκκρεμεί (καλύπτεται από tests). Όλα στο `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
