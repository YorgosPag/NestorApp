# HANDOFF — ADR-507 Φ6: DXF HATCH import round-trip (write → read → ίδιο)

> **Ημ/νία:** 2026-06-22 · **Origin:** ανάθεση Giorgio (επόμενη φάση μετά Φ7 material auto-hatch).
> **Ποιότητα:** FULL ENTERPRISE + FULL SSoT, Revit/AutoCAD-grade. ΟΧΙ forced abstraction, ΟΧΙ διπλότυπα.
> **Commit:** ΜΟΝΟ ο Giorgio. **Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — `git add` ΜΟΝΟ δικά σου.
> **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md` (§2.2-2.3 PAT codes, §6 Φ6).
> **Σχετικό memory:** `reference_hatch_patterns` (Φ2 catalog), `reference_material_auto_hatch` (Φ7 unify).

---

## 0. ⚠️ ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Το tree αλλάζει ζωντανά (πολλοί agents). Τρέξε ΠΡΩΤΑ — βρες τι ΥΠΑΡΧΕΙ ώστε να το ΕΠΕΚΤΕΙΝΕΙΣ:

```bash
# Α) Τι committed/uncommitted (Φ2 thumbnail/lineweight + Φ7 unify μπορεί να μπήκαν):
"C:/Program Files/Git/cmd/git.exe" status --short
"C:/Program Files/Git/cmd/git.exe" log --oneline -10

# Β) Ο READER (Φ1 — ΕΠΕΚΤΕΙΝΕ, ΜΗΝ ξαναγράψεις):
cat src/subapps/dxf-viewer/utils/dxf-hatch-converter.ts          # convertHatch — state machine 91/92/93/10/20
grep -n "convertHatch\|case 'HATCH'\|'HATCH'" src/subapps/dxf-viewer/utils/dxf-entity-converters.ts  # ο router

# Γ) Ο WRITER (τι group codes παράγει — το round-trip target):
grep -n "function emitHatch\|emitPredefinedPattern\|pair(2,\|pair(76\|pair(78\|pair(41\|pair(52\|pair(53" src/subapps/dxf-viewer/export/core/dxf-ascii-writer.ts

# Δ) Catalog SSoT (match by name + scale helpers — REUSE):
grep -n "getHatchPattern\|getSuggestedScale\|resolveEffectiveHatchScale\|PatternLine\|HatchPattern" src/subapps/dxf-viewer/data/hatch-pattern-catalog.ts

# Ε) Geometry SSoT (render consumer — επιβεβαίωσε πώς εφαρμόζεται το scale):
grep -n "resolveEffectiveHatchScale\|patternScale\|buildPredefinedHatchLines\|buildHatchEntitySegments" src/subapps/dxf-viewer/bim/geometry/shared/hatch-pattern-geometry.ts

# ΣΤ) Υπάρχον round-trip test (αν υπάρχει DXF reader test για hatch):
grep -rln "convertHatch\|HATCH" src/subapps/dxf-viewer/utils/__tests__ src/subapps/dxf-viewer/export/core/__tests__ 2>/dev/null
```

**Κανόνας:** αν το grep δείξει υπάρχον SSoT → ΧΡΗΣΙΜΟΠΟΙΗΣΕ το. (Ο Giorgio κάνει σκληρό SSoT audit «δημιούργησες διπλότυπο;».)

---

## 1. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ

**Reader (`utils/dxf-hatch-converter.ts`, `convertHatch`)** — Φ1, ΔΙΑΒΑΖΕΙ ΗΔΗ:
- group `2` → `patternName`, `70` → solid, `76` → `fillType` (`0`=user-defined / `≠0`=predefined), `75` → islandStyle, `52` → angle, `41` → scale, `62` → color, boundary paths (`91/92/93/10/20`), seed points (`98`).
- Δηλαδή το round-trip **ΜΕΣΩ ΟΝΟΜΑΤΟΣ** σχεδόν δουλεύει ήδη: writer γράφει `2='ANSI31'` + `76=1` → reader βγάζει `patternName='ANSI31'`, `fillType='predefined'`.

**Writer (`export/core/dxf-ascii-writer.ts`, `emitHatch`/`emitPredefinedPattern`)** — γράφει: `2`=patternName, `76`=1, `52`=angle, **`41`=effective scale**, `78`=N pattern lines, ανά line `53/43/44/45/46/79/49`.

---

## 2. 🔴 ΤΑ 3 ΠΡΑΓΜΑΤΙΚΑ ΚΕΝΑ ΤΟΥ ROUND-TRIP (deliverables)

### 2.1 🐞 SCALE IDEMPOTENCY (η κύρια ορθότητα — ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
**Bug:** ο writer γράφει `41 = resolveEffectiveHatchScale(name, userScale)` = **suggested × user**. Ο reader το διαβάζει ως `patternScale`. Ο renderer (`buildHatchEntitySegments`) ξανα-καλεί `resolveEffectiveHatchScale(name, patternScale)` = **suggested × (suggested × user)** → **ΔΙΠΛΟ scaling** → λάθος πυκνότητα μετά από write→read.
**Fix (διάλεξε με SSoT λογική):**
- (α) Reader: όταν `fillType==='predefined'` & το `patternName` υπάρχει στο catalog → `patternScale = group41 / getSuggestedScale(patternName)` (αντιστροφή → recover user scale· idempotent). **Προτιμότερο** (ο writer μένει WYSIWYG για external CAD).
- (β) Ή writer: γράψε `41 = e.patternScale` (raw user) — αλλά τότε external AutoCAD δείχνει αραιό. (α) είναι Revit-faithful.
- Γράψε **round-trip test**: entity(ANSI31, scale=2) → emit → parse → convert → **ίδιο effective render density** (σύγκρινε `hatchMinWorldSpacing` ή segment μήκος, ΟΧΙ raw scale).

### 2.2 Άγνωστο pattern name → inline pattern parse ή graceful fallback
**Πρόβλημα:** αν το `group 2` όνομα ΔΕΝ είναι στο catalog (π.χ. third-party DXF), ο renderer `getHatchPattern` → `undefined` → `buildPredefinedHatchLines` → `[]` → **αόρατη γραμμοσκίαση**.
**Fix:** ο reader να διαβάζει τις **inline pattern definition lines** (`78` = N, ανά line `53/43/44/45/46/79/49`) → χτίσε ad-hoc `HatchPattern` (reuse τύπων `PatternLine`/`HatchPattern` από το catalog) → αποθήκευσέ το στο entity (π.χ. NEW optional `inlinePattern?: HatchPattern` στο `HatchEntity`) ΚΑΙ κάν' το να το καταναλώνει το `buildHatchEntitySegments` (branch: catalog match → `getHatchPattern`· αλλιώς → `inlinePattern`). **SSoT:** ΕΝΑ geometry path (`buildPredefinedHatchLines`) είτε catalog είτε inline pattern. Εναλλακτικά (mini scope): unknown name → fallback `ANSI31` + `dwarn` (λιγότερο πιστό αλλά απλό· ρώτα Giorgio αν το inline parse είναι overkill για τώρα).

### 2.3 Round-trip verification (write → read → write → ίδιο)
- Unit: predefined (ANSI31/BRICK), user-defined (angle+spacing), solid → emit→parse→convert→ σύγκρινε `fillType/patternName/patternAngle/effective-scale/boundaryPaths/islandStyle`.
- Επιβεβαίωσε angle: writer `53 = pl.angle + patternAngle`, reader `52 → patternAngle`· user-defined writer `52=angle` ↔ reader `52→lineAngle/patternAngle`.

---

## 3. SSoT προς REUSE (μην ξαναγράψεις)
- **Reader engine:** `convertHatch` (`utils/dxf-hatch-converter.ts`) — extend το switch + boundary state machine.
- **Catalog:** `getHatchPattern` (case-insensitive), `getSuggestedScale`, `resolveEffectiveHatchScale`, types `PatternLine`/`HatchPattern` (`data/hatch-pattern-catalog.ts`).
- **Geometry:** `buildHatchEntitySegments` / `buildPredefinedHatchLines` (`bim/geometry/shared/hatch-pattern-geometry.ts`) — ο ΕΝΑΣ render+DXF engine (Φ7 unified).
- **Island mapping:** `dxf75ToIslandStyle` / `islandStyleToDxf75` (`bim/hatch/hatch-properties.ts`).
- **Color:** `extractEntityColor` (`utils/dxf-converter-helpers.ts`).

## 4. ΚΑΝΟΝΕΣ
- **N.8 mode:** ~3-6 αρχεία (converter + catalog helper + ίσως entity type + writer tweak + tests) / 1-2 domains → πιθανότατα **Plan Mode**. Πρότεινε mode + **N.14 μοντέλο** (Sonnet ή Opus) ΠΡΙΝ υλοποιήσεις, περίμενε «ok».
- **N.17 ΕΝΑ tsc:** έλεγξε process ΠΡΙΝ· ΠΟΤΕ 2 παράλληλα (μοιραζόμενος υπολογιστής, πολλοί agents).
- **COMMIT = Giorgio.** `git add` ΜΟΝΟ δικά σου (shared tree· άλλος agent δουλεύει `bim-body-fill.ts` + ίσως hatch).
- **N.15 docs ίδιο commit:** ADR-507 changelog (Φ6) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY.
- **CHECK 6D:** αν αγγίξεις HatchRenderer/canvas → stage ADR-040. (Ο reader/writer δεν είναι canvas — μάλλον όχι 6D, αλλά έλεγξε.)

## 5. ΕΚΤΟΣ SCOPE (ξεχωριστές συνεδρίες)
- **Φ5 Gradient fill** (`fillType:'gradient'`, DXF codes 450-470).
- **Φ7 FloorFinish auto-hatch** + material colors poché (το structural Φ7 ΕΓΙΝΕ).
- DXF group 370 lineweight στο HATCH (κανένας emitter δεν το γράφει σήμερα).

## 6. ΠΡΟΣΟΧΗ (shared tree, 2026-06-22)
Uncommitted εκκρεμούν: Φ2 follow-up (thumbnail/search/lineweight) + Φ7 unify (4 poché engines διαγράφηκαν → PAT catalog). Αν ο Giorgio τα έκανε commit, ο reader/writer/catalog είναι στη νέα κατάσταση. **Επιβεβαίωσε με `git log` (§0.Α) ποια μπήκαν.**
