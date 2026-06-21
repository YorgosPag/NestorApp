# HANDOFF — ADR-507 Hatch Φ2 (συνέχεια): Thumbnail preview + Pattern search + Hatch lineweight

> **Ημ/νία:** 2026-06-21 · **Origin:** ανάθεση Giorgio (συνέχεια του Φ2 predefined patterns).
> **Ποιότητα:** FULL ENTERPRISE + FULL SSoT, Revit/AutoCAD-grade. ΟΧΙ forced abstraction, ΟΧΙ διπλότυπα.
> **Commit:** ΜΟΝΟ ο Giorgio. **Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — `git add` ΜΟΝΟ δικά σου.
> **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md` (§5β.6-7 thumbnail, §5γ.5 pattern search, §5γ.6 lineweight).
> **Σχετικό memory:** `reference_hatch_patterns` (Φ2 core + fixes), `reference_hatch_persistence` (S2-persist).

---

## 0. ⚠️ ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Το tree αλλάζει ζωντανά. Τρέξε ΠΡΩΤΑ — βρες τι ΥΠΑΡΧΕΙ ώστε να το ΕΠΕΚΤΕΙΝΕΙΣ, ΟΧΙ να ξαναγράψεις:

```bash
# Α) Τι committed/uncommitted (το Φ2 core μπορεί να είναι ήδη committed από Giorgio):
"C:/Program Files/Git/cmd/git.exe" status --short
"C:/Program Files/Git/cmd/git.exe" log --oneline -8

# Β) Η ΚΑΡΔΙΑ — το SSoT geometry που τροφοδοτεί ΚΑΙ τα 3 deliverables:
sed -n '1,60p' src/subapps/dxf-viewer/data/hatch-pattern-catalog.ts          # PatternLine/HatchPattern + getSuggestedScale + resolveEffectiveHatchScale
grep -n "buildPredefinedHatchLines\|buildHatchEntitySegments\|hatchMinWorldSpacing" src/subapps/dxf-viewer/bim/geometry/shared/hatch-pattern-geometry.ts

# Γ) THUMBNAIL — πώς render-άρεται το combobox + αν υποστηρίζει custom option/icon:
cat src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonCombobox.tsx     # ΑΠΛΟ (μόνο label)· δεν έχει thumbnail/search ακόμα
grep -n "options\|labelKey\|isLiteralLabel" src/subapps/dxf-viewer/ui/ribbon/types/ribbon-types.ts | head

# Δ) SEARCH — το in-app searchable combobox precedent (μίμησέ το, ΜΗΝ φτιάξεις νέο):
cat src/subapps/dxf-viewer/ui/text-toolbar/controls/FontFamilyCombobox.tsx     # search + filter + κουμπωτό dropdown

# Ε) LINEWEIGHT — ΥΠΑΡΧΕΙ ΗΔΗ SSoT· ΜΗΝ προσθέσεις νέο field:
grep -n "lineweightMm\|linetypeName" src/subapps/dxf-viewer/types/entities.ts  # BaseEntity.lineweightMm (ADR-363) → το HatchEntity το κληρονομεί ΗΔΗ
cat src/subapps/dxf-viewer/config/bim-line-weight-resolver.ts                   # mm→px resolver SSoT (zoom-independent, AutoCAD LWT)
sed -n '1,40p' src/subapps/dxf-viewer/rendering/entities/base-entity-style-helpers.ts
grep -n "HATCH_LINE_WIDTH\|lineWidth =" src/subapps/dxf-viewer/rendering/entities/HatchRenderer.ts  # γρ.208 hardcoded 0.5 → αντικατάσταση με resolver

# ΣΤ) i18n hatch keys (πού μπαίνουν νέα labels — N.11):
node -e "console.log(Object.keys(require('./src/i18n/locales/el/dxf-viewer-shell.json').ribbon.commands.hatchEditor))"
```

**Κανόνας:** αν το grep δείξει υπάρχον SSoT → ΧΡΗΣΙΜΟΠΟΙΗΣΕ το. Αν δείξει νέο διπλότυπο → ενοποίησε. (Ο Giorgio κάνει σκληρό SSoT audit — «δημιούργησες διπλότυπο;». Στο Φ2 βρέθηκαν & διορθώθηκαν 3 διπλότυπα· μην προσθέσεις νέα.)

---

## 1. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (2026-06-21)

**ADR-507 Φ2 (predefined patterns core) = DONE** (UNCOMMITTED ή μόλις committed — έλεγξε git log). 130 jest GREEN, tsc clean. Δες ADR-507 §8 changelog + memory `reference_hatch_patterns`.

**Υπάρχει ήδη (Φ2 — ΕΠΕΚΤΕΙΝΕ, μην ξαναγράψεις):**
- `data/hatch-pattern-catalog.ts` — **32 μοτίβα** `{name, labelKey, category, lines: PatternLine[]}` + `getHatchPattern`/`listHatchPatterns`/`getSuggestedScale`/`resolveEffectiveHatchScale`/`DEFAULT_HATCH_PATTERN_NAME`. **labelKey = i18n** (`ribbon.commands.hatchEditor.patterns.<key>`).
- `bim/geometry/shared/hatch-pattern-geometry.ts` — **SSoT γεωμετρία**: `buildPredefinedHatchLines(paths, pattern, {scale,angleDeg,origin,islandStyle})` + `buildHatchEntitySegments(hatch)` (entity→segments, renderer+writer το καλούν) + `hatchMinWorldSpacing(hatch)` (density-LOD).
- `rendering/entities/HatchRenderer.ts` — thin consumer· έχει ΗΔΗ: segment cache, density-LOD (solid tint σε zoom-out), viewport culling (reuse `aabbIntersectsRaw`). **Το `HATCH_LINE_WIDTH=0.5` (γρ.31/208) είναι hardcoded → εδώ μπαίνει το lineweight.**
- `export/core/dxf-ascii-writer.ts` — `emitHatch`/`emitPredefinedPattern` (native HATCH 76/78/53-49 + explode LINEs).
- UI: `ui/ribbon/data/contextual-hatch-tab.ts` + `ui/ribbon/hooks/bridge/hatch-command-keys.ts` + `ui/ribbon/hooks/useRibbonHatchBridge.ts` + `bim/hatch/hatch-draw-defaults-store.ts` + `bim/hatch/hatch-completion.ts`. **Pattern dropdown ήδη υπάρχει** (PATTERN_NAME_OPTIONS από `listHatchPatterns()`).

**Reusable SSoT για τα νέα deliverables (VERIFIED 2026-06-21):**
- **Lineweight:** `BaseEntity.lineweightMm` (ΥΠΑΡΧΕΙ — το HatchEntity το κληρονομεί) + `config/bim-line-weight-resolver.ts` (mm→px) + `rendering/entities/base-entity-style-helpers.ts`. Όλοι οι BIM renderers (Wall/Beam/Column/Slab…) το χρησιμοποιούν.
- **Thumbnail geometry:** `buildPredefinedHatchLines` (το ΙΔΙΟ SSoT) → render σε μικρό SVG/canvas. ΜΗΔΕΝ νέα pattern math.
- **Search precedent:** `ui/text-toolbar/controls/FontFamilyCombobox.tsx` (searchable + filter).

---

## 2. DELIVERABLES (με σειρά προτεραιότητας)

### 2.1 🖼️ Thumbnail preview των μοτίβων στο dropdown (Revit fill-pattern picker)
**Τι:** ο χρήστης βλέπει ένα μικρό σχέδιο του κάθε μοτίβου ΠΡΙΝ διαλέξει (Revit «Fill Patterns» / AutoCAD pattern preview).
**SSoT καρδιά:** το thumbnail παράγεται από το **ΙΔΙΟ `buildPredefinedHatchLines`** (μοναδιαίο boundary π.χ. 0..1 ή ένα μικρό τετράγωνο) → segments → μικρό inline **SVG** (ή offscreen canvas). ΜΗΔΕΝ δεύτερη pattern math.
**Enterprise approach:**
- NEW `data/hatch-pattern-thumbnail.ts` (ή `bim/hatch/`): pure `buildHatchPatternThumbnailSvg(pattern, sizePx): string` — καλεί `buildPredefinedHatchLines` σε unit-square, κανονικοποιεί στο sizePx, επιστρέφει SVG `<path>`/`<line>` string (cache-able· τα μοτίβα είναι σταθερά).
- Το `RibbonCombobox` είναι ΑΠΛΟ (μόνο label). Δύο επιλογές — **διάλεξε με SSoT audit**: (α) επέκτεινε το `RibbonCombobox` με optional `renderOption`/`optionThumbnail` (αν δεν σπάει τα υπόλοιπα), ή (β) NEW dedicated `HatchPatternPicker` popover (grid of thumbnails) — **προτίμησε (α)** αν το combobox επεκτείνεται καθαρά, για να μη διπλασιάσεις dropdown logic.
- Το thumbnail χρώμα = ουδέτερο (theme token), ΟΧΙ hardcoded (N.3/N.11).
**⚠️ SSoT audit:** ψάξε αν υπάρχει ήδη SVG/thumbnail generator (π.χ. icon system, ή το beam-section preview) πριν φτιάξεις νέο.

### 2.2 🔍 Pattern search / filter (32 μοτίβα)
**Τι:** πεδίο αναζήτησης στο pattern dropdown → φιλτράρει ανά όνομα/label/κατηγορία (AutoCAD pattern list filter).
**Enterprise approach:** μίμησε το `FontFamilyCombobox.tsx` (υπάρχον searchable combobox SSoT). Filter σε `listHatchPatterns()` με βάση `name` + i18n label (`t(labelKey)`) + `category`. Case/accent-insensitive.
**⚠️ SSoT audit:** ΜΗΝ φτιάξεις νέο fuzzy-search· αν το FontFamilyCombobox έχει reusable filter helper → extract/reuse. Αλλιώς απλό `includes` (32 items, δεν χρειάζεται fuzzy).

### 2.3 📏 Hatch lineweight (πάχος γραμμών μοτίβου)
**Τι:** ο χρήστης ορίζει το πάχος των γραμμών της γραμμοσκίασης (AutoCAD LWT / Revit line weight).
**SSoT — ΜΗΝ προσθέσεις νέο field:** το `HatchEntity` κληρονομεί ΗΔΗ `lineweightMm` από `BaseEntity` (ADR-363). 
**Enterprise approach:**
- `HatchRenderer`: αντικατέστησε το hardcoded `HATCH_LINE_WIDTH=0.5` (γρ.208) με τιμή από τον **`bim-line-weight-resolver.ts` SSoT** εφαρμοσμένη στο `hatch.lineweightMm` (fallback default όταν δεν οριστεί). Zoom-independent (AutoCAD LWT) — δες `base-entity-style-helpers.ts` για το πρότυπο.
- UI: combobox «Πάχος» στο `contextual-hatch-tab` (panel «Μοτίβο» ή «Γέμισμα») + key στο `hatch-command-keys` + read/write στο `useRibbonHatchBridge` (entity→`UpdateEntityCommand {lineweightMm}` / draw-defaults). Options = standard AutoCAD lineweights (0.13/0.18/0.25/0.35/0.50/0.70 mm…) — ψάξε αν υπάρχει ήδη lineweight options list SSoT (το χρησιμοποιεί ο layer/line editor).
- `hatch-draw-defaults-store`: +`lineweightMm` (ή reuse αν υπάρχει lineweight default αλλού).
- DXF: το `emitHatch` ίσως πρέπει να γράψει lineweight (group 370) — προαιρετικό, δες αν οι άλλοι emitters το κάνουν.
**⚠️ SSoT audit:** βρες πού ορίζονται τα standard lineweight options (layer panel / line tool) → reuse την ίδια λίστα.

### 2.4 ΕΠΟΜΕΝΕΣ ΦΑΣΕΙΣ (ξεχωριστές συνεδρίες — ΜΗΝ τις ξεκινήσεις μαζί)
- **Φ5 Gradient fill** — `fillType:'gradient'` (ADR-507 §2.3 group 450-470)· canvas `createLinearGradient`/`createRadialGradient`· DXF gradient codes. Ξεχωριστό spec.
- **Φ6 DXF import** — `case 'HATCH'` round-trip (write→read→ίδιο). Ο reader (`convertHatch`) υπάρχει για Φ1· επέκταση για predefined PAT (group 78/53-49 → catalog match ή inline pattern).
- **Φ7 Material auto-hatch** — `MATERIAL_HATCH_MAP` (surface+cut patterns ανά υλικό) + `resolveAutoHatch(entity, viewType)`· BIM auto-fill. «Η μαγεία» (ADR-507 §5β.5). Reuse το catalog.

---

## 3. ΚΑΝΟΝΕΣ
- **N.8 mode:** 2.1+2.2+2.3 = ~6-8 αρχεία / 2 domains (UI + render). Πρότεινε mode στον Giorgio ΠΡΙΝ υλοποιήσεις (μάλλον Plan).
- **N.17 ΕΝΑ tsc:** έλεγξε `Get-CimInstance ... '*tsc*'` ΠΡΙΝ· ΠΟΤΕ 2 παράλληλα (μοιραζόμενος υπολογιστής).
- **N.11:** μηδέν hardcoded strings — i18n keys (`ribbon.commands.hatchEditor.*`).
- **N.7.1:** code files ≤500 γρ.· catalog/thumbnail-data = data (χωρίς όριο).
- **COMMIT = Giorgio.** `git add` ΜΟΝΟ δικά σου (shared tree).
- **CHECK 6D:** αγγίζεις `HatchRenderer` (canvas) → **stage ADR-040 + ADR-507**.
- **N.15 docs ίδιο commit:** ADR-507 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY `reference_hatch_patterns`.
- **N.0.2 boy-scout:** αν βρεις διπλότυπο πάνω στη διαδρομή → κεντρικοποίησε επιτόπου.

## 4. TESTS / VERIFY
- **Unit:** thumbnail SVG generator (valid output ανά pattern, reuse geometry)· search filter (name/label/category match)· lineweight resolver εφαρμογή στον renderer (mock ctx → lineWidth = resolved).
- **Browser** (`/dxf/viewer`): Γραμμοσκίαση → dropdown δείχνει **thumbnails** → πληκτρολόγησε «brick» → **φιλτράρει** → διάλεξε → «Πάχος 0.50» → οι γραμμές **παχαίνουν** live· DXF export → AutoCAD σωστό lineweight· refresh → persist.

## 5. ΑΝΑΦΟΡΕΣ
- ADR-507 §5β.6-7 (thumbnail/ghost), §5γ.5 (pattern search), §5γ.6 (lineweight), §8 changelog (Φ2 core + 3 fixes).
- Memory: `reference_hatch_patterns` (πλήρες Φ2 + lessons), `reference_hatch_persistence`.
- Reusable SSoT: `buildPredefinedHatchLines`/`buildHatchEntitySegments` (geometry), `bim-line-weight-resolver.ts` (lineweight mm→px), `FontFamilyCombobox.tsx` (search), `aabbIntersectsRaw` (bounds).
- ⚠️ `bim/{beams,columns,foundations,walls}/*-hatch-patterns.ts` = BIM material poché (ΑΛΛΟ σύστημα) — ΟΧΙ ο PAT catalog. Μην τα μπερδέψεις.
