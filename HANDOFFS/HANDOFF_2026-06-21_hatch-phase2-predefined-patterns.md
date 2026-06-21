# HANDOFF — ADR-507 Hatch Φ2: Predefined Patterns (τα «στυλ γραμμοσκίασης»)

> **Ημ/νία:** 2026-06-21 · **Origin:** ανάθεση Giorgio (μετά το κλείσιμο του ADR-507 §8 transform-commands).
> **Ποιότητα:** FULL ENTERPRISE + FULL SSoT, Revit/AutoCAD-grade. ΟΧΙ forced abstraction, ΟΧΙ διπλότυπα.
> **Commit:** ΜΟΝΟ ο Giorgio. **Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent (structural-finish/preview) — `git add` ΜΟΝΟ δικά σου.
> **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md` (§2 PAT format, §4.2 HatchEntity, §4.3 modules table).
> ⚠️ Ο Giorgio ανέφερε και το `ADR-487-living-structural-organism-vision.md` — **δεν φαίνεται σχετικό με hatch** (αφορά structural organism)· πιθανό paste artifact. Επιβεβαίωσε μαζί του αν εννοούσε κάτι συγκεκριμένο πριν το λάβεις υπόψη.

---

## 0. ⚠️ ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Το tree αλλάζει ζωντανά. Τρέξε ΠΡΩΤΑ — βρες τι ΥΠΑΡΧΕΙ ώστε να το ΕΠΕΚΤΕΙΝΕΙΣ, ΟΧΙ να ξαναγράψεις:

```bash
# Α) Τι committed/uncommitted (ο άλλος agent + τυχόν hatch uncommitted):
"C:/Program Files/Git/cmd/git.exe" status --short
"C:/Program Files/Git/cmd/git.exe" log --oneline -8

# Β) Η ΚΑΡΔΙΑ του Φ2 — ΥΠΑΡΧΕΙ catalog/PatternLine; (μην ξαναφτιάξεις):
grep -rn "hatch-pattern-catalog\|PatternLine\|patternName\|ANSI31\|AR-CONC" src/subapps/dxf-viewer --include="*.ts" | grep -v "__tests__"
ls -1 src/subapps/dxf-viewer/data/hatch-pattern-catalog.ts 2>&1   # ΔΕΝ υπήρχε 2026-06-21 → NEW

# Γ) Το SSoT geometry «μία γεωμετρία→canvas+DXF» — ΤΙ ΧΕΙΡΙΖΕΤΑΙ ΗΔΗ;
sed -n '1,80p' src/subapps/dxf-viewer/bim/geometry/shared/hatch-pattern-geometry.ts   # solid/user-defined μόνο; ή ήδη pattern;
cat src/subapps/dxf-viewer/bim/geometry/shared/polygon-hatch-utils.ts                  # buildAxisAlignedHatch (reuse base)
grep -n "patternName\|patternScale\|patternAngle\|fillType" src/subapps/dxf-viewer/rendering/entities/HatchRenderer.ts

# Δ) DXF writer/converter — πού μπαίνουν τα PAT lines (group 78 + 53/43/44/45/46/79/49):
grep -rn "emitHatch\|case 'hatch'\|emit3DFace\|AcDbHatch\|HATCH" src/subapps/dxf-viewer/utils/dxf-hatch-converter.ts src/subapps/dxf-viewer/export --include="*.ts" | head
grep -rn "78\|pattern" src/subapps/dxf-viewer/utils/dxf-hatch-converter.ts | head

# Ε) UI: contextual panel + bridge + draw-defaults (πού μπαίνει το pattern dropdown):
grep -n "fillType\|patternName\|solid\|user-defined" src/subapps/dxf-viewer/ui/ribbon/data/contextual-hatch-tab.ts src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonHatchBridge.ts src/subapps/dxf-viewer/bim/hatch/hatch-draw-defaults-store.ts

# ΣΤ) Υπάρχοντα PAT/pattern systems ΑΛΛΟΥ στην εφαρμογή (μην διπλασιάσεις pattern-line math):
grep -rn "hatch-pattern\|HatchPattern\|PatternLine\|dash.*pattern\|linetype" src/subapps/dxf-viewer --include="*.ts" | grep -iv "__tests__\|bim-line\|linetype-iso" | head -20
# (⚠️ ΠΡΟΣΟΧΗ: bim/{beams,columns,foundations,walls}/*-hatch-patterns.ts είναι ΑΛΛΟ πράγμα — BIM material poché, ΟΧΙ ο PAT catalog. Μην τα μπερδέψεις.)
```

**Κανόνας:** αν το grep δείξει υπάρχον SSoT (π.χ. το `hatch-pattern-geometry.ts` ήδη παράγει pattern segments, ή υπάρχει PAT parser) → ΧΡΗΣΙΜΟΠΟΙΗΣΕ το. Αν δείξει νέο διπλότυπο → ενοποίησε.

---

## 1. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (2026-06-21)

**ADR-507 Φ1 (solid + user-defined fill) = DONE** (S1/Φ1a + S2/Φ1b + S2-persist + S2-fix-1/2/3). Δες changelog ADR-507 §8.
**ADR-507 §8 transform-commands = DONE 100%** (άσχετο thread, μόλις έκλεισε).

**Υπάρχει ήδη (Φ1 — ΕΠΕΚΤΕΙΝΕ, μην ξαναγράψεις):**
- `bim/geometry/shared/hatch-pattern-geometry.ts` — **SSoT «μία γεωμετρία→canvas+DXF»** (Φ1: solid/user-defined· Φ2 = επέκταση για predefined PAT).
- `bim/geometry/shared/polygon-hatch-utils.ts` — `buildAxisAlignedHatch()` (base: παράλληλες γραμμές σε bbox).
- `rendering/entities/HatchRenderer.ts` — canvas renderer (thin consumer).
- `utils/dxf-hatch-converter.ts` — DXF γέμισμα.
- `ui/ribbon/data/contextual-hatch-tab.ts` + `ui/ribbon/hooks/useRibbonHatchBridge.ts` + `bim/hatch/hatch-draw-defaults-store.ts` — UI/tool wiring.
- `bim/hatch/{hatch-completion,hatch-grips,hatch-properties,hatch-firestore-service}.ts` + `hooks/data/useHatchPersistence.ts` + `app/HatchPersistenceHost.tsx` — completion/grips/persistence.
- `HatchEntity` type (στο `types/entities.ts`) έχει ΗΔΗ τα `patternName?/patternScale?/patternAngle?` fields (§4.2) — απλώς δεν χρησιμοποιούνται ακόμη.

**ΔΕΝ υπάρχει (το κύριο deliverable Φ2):**
- `data/hatch-pattern-catalog.ts` — ο κατάλογος 30+ μοτίβων.

---

## 2. ΣΚΟΠΟΣ Φ2 — Predefined Patterns (Revit/AutoCAD-grade)

ADR Q5 (γρ.169): «**Πλήρης 30+ όπως AutoCAD**». ADR Q1/§2.1 (γρ.57): predefined = έτοιμο μοτίβο βιβλιοθήκης (`ANSI31`, `AR-CONC`, `BRICK`…).

### Deliverables (με σειρά):
1. **NEW `data/hatch-pattern-catalog.ts`** — 30+ PAT-derived patterns: `{ name, label_el, label_en, lines: PatternLine[] }`. Patterns: ANSI31-38, AR-CONC, AR-BRICK/AR-B816, BRICK, EARTH, GRAVEL, STEEL, CORK, SAND, HONEY, NET, κ.λπ. (config file → χωρίς όριο 500 γρ., N.7.1). PatternLine = PAT format (§2.2): `{ angle, origin:[x,y], delta:[dx,dy], dashes:number[] }`.
2. **EXTEND `hatch-pattern-geometry.ts`** — `fillType==='predefined'` → για κάθε `PatternLine` του catalog pattern, παρήγαγε τα line segments clipped στο boundary (reuse `buildAxisAlignedHatch` + `patternScale`/`patternAngle`/`patternOrigin`). **SSoT: η ίδια έξοδος τροφοδοτεί canvas + DXF.**
3. **EXTEND `HatchRenderer.ts`** — render predefined pattern segments (thin consumer του #2· μηδέν δική του pattern math).
4. **EXTEND DXF writer/converter** — emit PAT pattern definition lines (group 78 = count, μετά ανά line: 53 angle, 43/44 base, 45/46 offset, 79 dash count, 49 dash lengths). Round-trip (§2.3). Import case 'HATCH' = Φ6 (ΟΧΙ τώρα).
5. **EXTEND contextual panel + bridge + draw-defaults** — pattern dropdown (label_el/label_en) + scale + angle, ενεργά όταν `fillType==='predefined'`. Live preview.
6. **i18n** el+en: `hatch.patterns.<name>` labels (ή από το catalog label fields· N.11 — μην hardcode).

### SSoT καρδιά (ΜΗΝ την παραβιάσεις):
**«Μία γεωμετρία → canvas + DXF»** μέσω `hatch-pattern-geometry.ts`. Ο canvas renderer ΚΑΙ ο DXF writer καταναλώνουν την ΙΔΙΑ pattern-segment έξοδο. ΟΧΙ δεύτερη pattern math στον renderer ή στον writer.

---

## 3. ΚΑΝΟΝΕΣ
- **N.8 mode:** ~8-10 αρχεία / 3 domains (data+geometry/render+DXF+UI/i18n) = Orchestrator/Plan scale. Πρότεινε mode στον Giorgio ΠΡΙΝ υλοποιήσεις.
- **N.17 ΕΝΑ tsc:** έλεγξε `Get-CimInstance ... '*tsc*'` πρώτα· ΠΟΤΕ 2 παράλληλα.
- **N.7.1:** code files ≤500 γρ.· το catalog είναι data file (χωρίς όριο).
- **N.6:** αν χρειαστεί νέο Firestore doc → enterprise-id (ΟΧΙ addDoc). (Το hatch persistence υπάρχει ήδη — μάλλον δεν χρειάζεσαι νέο.)
- **N.11:** μηδέν hardcoded strings — i18n keys.
- **COMMIT = Giorgio.** `git add` ΜΟΝΟ δικά σου (shared tree — ο άλλος agent έχει uncommitted structural-finish/preview).
- **N.15 docs ίδιο commit:** ADR-507 changelog (Φ2 entry) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`reference_hatch_persistence` ή νέο `reference_hatch_patterns`).
- **CHECK 6B/6D:** αν αγγίξεις render/canvas hot files → stage ADR-040.

## 4. TESTS / VERIFY
- Unit: catalog integrity (κάθε pattern valid PatternLine[])· `hatch-pattern-geometry` predefined → σωστά segments· DXF PAT round-trip (write→read→ίδιο pattern).
- Browser (`/dxf/viewer`): «Γραμμοσκίαση» → κλικ σε περιοχή → contextual «Τύπος: Predefined» → διάλεξε ANSI31 → render· scale/angle live· DXF export → άνοιγμα σε AutoCAD δείχνει σωστό pattern· refresh → persist.

## 5. ΑΝΑΦΟΡΕΣ
- ADR-507 §2 (PAT format + DXF group codes), §4.2 (HatchEntity πλήρες type), §4.3 (modules table — Φάση column), Q&A (γρ.166-182).
- Memory: `reference_hatch_persistence` (S2-persist), `reference_snapshot_transform_command_base` (§8 done, άσχετο).
- ⚠️ `bim/{beams,columns,foundations,walls}/*-hatch-patterns.ts` = BIM material poché (ΑΛΛΟ σύστημα) — ΟΧΙ ο PAT catalog. Μην τα ενοποιήσεις λάθος.
