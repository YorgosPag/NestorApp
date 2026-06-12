# HANDOFF — Καρτέλα «Δομικά» (ribbon): διακριτά εικονίδια ανά εργαλείο (Revit-grade, FULL SSoT)

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα — ADR-441 foundation/hosting, QKeyTracker, grip-step-quantize κ.λπ. — **ΜΗΝ τα αγγίξεις· `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`**)

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι παίκτες, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ:** **Ο Giorgio κάνει commit** — ΠΟΤΕ εσύ `git commit`/`push`. `git add` **ΜΟΝΟ δικά σου**, **ΠΟΤΕ `-A`** (shared tree). N.17 ένα tsc τη φορά. function ≤40γρ, file ≤500γρ, **no `any`/`as any`/`@ts-ignore`**, **N.3 no inline styles** (χρησιμοποίησε className), semantic HTML. i18n: ΚΑΜΙΑ νέα label εδώ — μόνο εικονίδια αλλάζουν.

---

## 0. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio)
Στο ribbon, καρτέλα **«Δομικά»** (permanent tab, ADR-443), υπάρχουν πολλά εργαλεία αλλά **πολλά κουμπιά έχουν ΤΟ ΙΔΙΟ εικονίδιο** → ο χρήστης χάνεται, δεν ξεχωρίζει τα variants.

**Ζητούμενο:** κατάλληλα, **διακριτά** εικονίδια ανά εργαλείο (μέθοδος δημιουργίας), Revit-grade.

---

## 1. ROOT CAUSE — icon-token collisions (επιβεβαιωμένο)
Πηγή: `src/subapps/dxf-viewer/ui/ribbon/data/structural-tab.ts`. Κάθε button δηλώνει ένα string `icon` token. Σήμερα **όλα τα variants μιας οικογένειας μοιράζονται ΕΝΑ token**:

| Token | Πλήθος | Εργαλεία που το μοιράζονται (ΟΛΑ ίδιο glyph) |
|---|---|---|
| `bim-wall` | **7** | wall, wall-on-entity, wall-region-lines, wall-region-inside, wall-region-box, wall-from-perimeter, walls-from-grid (action) |
| `bim-column` | **9** | column, column-region-lines, column-region-inside, column-region-box, column-discrete-from-perimeter, column-from-perimeter, column-discrete-from-perimeter-walls, columns-from-grid (action), **+ foundation-pad** (δανεικό!) |
| `bim-beam` | **6** | beam, beam-from-wall, **+ foundation-strip, foundation-tie-beam, foundation-strip-from-wall, foundation-from-grid** (όλα δανεικά bim-beam!) |
| `bim-slab` / `bim-slab-opening` / `bim-opening` / `bim-railing` / `stair` | 1 each | ✅ ήδη διακριτά — **ΜΗΝ τα πειράξεις** |

**Συμπέρασμα:** χρειάζονται διακριτά glyphs για **~22 εργαλεία** σε 3 οικογένειες (τοίχοι 7, κολώνες 8, δοκοί 2, θεμελίωση 5). Τα slab/opening/stair/railing μένουν ως έχουν.

---

## 2. ICON SYSTEM — SSoT (πού ζουν τα εικονίδια)
**Resolver (SSoT switch):** `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx`
- `icon: string` token → React node μέσω `switch`. Δύο patterns ήδη σε χρήση:
  1. **lucide-react** component (π.χ. `case 'bim-wall': return <Construction .../>`)
  2. **inline SVG** path data (`inlineSvg(size, PATH)`) με paths σε data files.
- **Variant components (ΤΟ PATTERN ΠΟΥ ΘΕΛΟΥΜΕ):** `LineIcon`/`CircleIcon`/`ArcIcon` με `variant` prop (βλ. `case 'circle-radius' → <CircleIcon variant="radius"/>`, `circle-2p`, `circle-3p`…). **Αυτό είναι το ακριβές Revit-grade SSoT μοντέλο: ΕΝΑ base component + variant prop → N διακριτά glyphs με 1 ορισμό base.**
- **Path data files (SRP split, ΟΧΙ logic):** `RibbonButtonIconPaths.tsx`, `stair-kind-icon-paths.ts` (`STAIR_PATH_STRAIGHT/SPIRAL/USHAPE`), `xline-ray-icon-paths.ts`. **Νέα paths → νέο sibling data file** (απαλλαγμένα από το 500-line limit: είναι data).

**Σημαντικό SSoT εύρημα:** το `home-tab-draw.ts` **ΔΕΝ** περιέχει αυτά τα structural variants (το structural-tab τα αντικατέστησε — βλ. doc-comment κορυφής structural-tab.ts). Άρα **μόνη πηγή token = `structural-tab.ts`**· αλλάζοντας tokens εκεί δεν σπας άλλο tab. Το `RibbonButtonIcon.tsx` είναι κοινό — νέα cases δεν πειράζουν υπάρχοντα tabs (additive).

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (Revit-grade + FULL SSoT) — «base glyph × method overlay»

Revit ξεχωρίζει τα variants με **ίδιο base σύμβολο** δομικού στοιχείου + ένα **διακριτικό «μεθόδου δημιουργίας»**. Αντί για 22 ανεξάρτητα icons (duplication), σύνθεσε:

**`<StructuralToolIcon base="…" method="…" size=… />`** — ΕΝΑ component (σαν `CircleIcon`):
- **base** (SSoT ανά δομικό, 1 path ο καθένας): `wall` · `column` · `beam` · `foundation-pad` · `foundation-strip`
- **method overlay** (SSoT ανά μέθοδο, **κοινό σε ΟΛΕΣ τις οικογένειες** — εδώ είναι το SSoT κέρδος): `single` (κανένα overlay, σκέτο base) · `on-entity` (γραμμή-οδηγός) · `region-lines` (polyline όριο) · `region-inside` (σταγόνα/σημείο μέσα) · `region-box` (dashed window) · `from-perimeter` (κλειστό περίγραμμα) · `discrete-from-perimeter` (κουκκίδες στις γωνίες) · `discrete-from-perimeter-walls` (περίγραμμα τοίχων + κουκκίδες) · `from-grid` (grid dots)

**Σύνθεση:** base ζωγραφίζεται κανονικά· το method overlay μπαίνει ως **μικρό badge κάτω-δεξιά** (≈10×10 στο 24-viewport) ώστε να διαβάζεται και στα 28px large + 16px small. Έτσι: **5 bases + 9 methods = 22 icons με 5+9=14 path ορισμούς** (όχι 22). Νέο base ή νέα μέθοδος = +1 ορισμός, ποτέ N×M.

> Εναλλακτική (πιο απλή αλλά λιγότερο SSoT): απλώς 22 νέα tokens + 22 inline paths στο RibbonButtonIcon switch. **ΑΠΟΦΥΓΕ το** — είναι το ίδιο duplication σε άλλη μορφή. Το composition είναι το enterprise σωστό.

### 3.1 Πλήρης χάρτης εργαλείο → (base, method)
**Τοίχοι (panel structural-walls):**
| Tool / commandKey | base | method |
|---|---|---|
| `wall` | wall | single |
| `wall-on-entity` | wall | on-entity |
| `wall-region-lines` | wall | region-lines |
| `wall-region-inside` | wall | region-inside |
| `wall-region-box` | wall | region-box |
| `wall-from-perimeter` | wall | from-perimeter |
| `wall.actions.fromGrid` (action) | wall | from-grid |

**Κολώνες (structural-columns):**
| Tool | base | method |
|---|---|---|
| `column` | column | single |
| `column-region-lines` | column | region-lines |
| `column-region-inside` | column | region-inside |
| `column-region-box` | column | region-box |
| `column-discrete-from-perimeter` | column | discrete-from-perimeter |
| `column-from-perimeter` | column | from-perimeter |
| `column-discrete-from-perimeter-walls` | column | discrete-from-perimeter-walls |
| `column.actions.fromGrid` (action) | column | from-grid |

**Δοκοί (structural-beams):**
| Tool | base | method |
|---|---|---|
| `beam` | beam | single |
| `beam-from-wall` | beam | on-entity *(δοκός πάνω σε τοίχο)* |

**Θεμελίωση (structural-foundation):**
| Tool | base | method |
|---|---|---|
| `foundation-pad` | foundation-pad | single |
| `foundation-strip` | foundation-strip | single |
| `foundation-tie-beam` | foundation-strip | on-entity *(ή ξεχωριστό «tie» modifier — δες §6 Q)* |
| `foundation-strip-from-wall` | foundation-strip | on-entity |
| `foundation.actions.fromGrid` (action) | foundation-strip | from-grid |

⚠️ `foundation-tie-beam` & `foundation-strip-from-wall` καταλήγουν και τα δύο σε (foundation-strip, on-entity) → **θα ξανα-συγκρουστούν**. Δες §6 Open Question: ίσως χρειάζεται distinct `tie` method (π.χ. δύο παράλληλες + δεσμός) για το tie-beam.

**Slab/Opening/Circulation:** ΑΜΕΤΑΒΛΗΤΑ (`bim-slab`, `bim-slab-opening`, `bim-opening`, `stair`, `bim-railing`).

---

## 4. ΑΡΧΕΙΑ (NEW/MOD) — όλα δικά σου, shared tree
**NEW**
- `ui/ribbon/components/buttons/structural-icon-bases.tsx` — 5 base path fragments (data· wall/column/beam/foundation-pad/foundation-strip).
- `ui/ribbon/components/buttons/structural-icon-methods.tsx` — 9 method-overlay path fragments (data).
- `ui/ribbon/components/buttons/StructuralToolIcon.tsx` — component που συνθέτει base+method (≤40γρ/function· καθαρό SVG, no inline style — className).
- `ui/ribbon/components/buttons/__tests__/StructuralToolIcon.test.tsx` — render όλων των (base,method) χωρίς throw + snapshot/role checks.

**MOD**
- `RibbonButtonIcon.tsx` — πρόσθεσε cases για τα νέα tokens (π.χ. `case 'struct-wall-region-box': return <StructuralToolIcon base="wall" method="region-box" size={size}/>`). **Additive**, μηδέν αλλαγή υπαρχόντων cases.
- `structural-tab.ts` — άλλαξε ΜΟΝΟ τα `icon:` strings στα 22 buttons (labels/commandKey/action ΑΜΕΤΑΒΛΗΤΑ). Πρότεινε token naming: `struct-<family>-<method>` (π.χ. `struct-wall-single`, `struct-wall-region-lines`, `struct-col-from-grid`, `struct-found-pad`).
- `structural-tab.test.ts` — ενημέρωσε/πρόσθεσε assertions ότι **κάθε button έχει ΜΟΝΑΔΙΚΟ icon token** (anti-collision regression: `new Set(icons).size === icons.length` ανά panel/tab).
- `docs/centralized-systems/reference/adrs/ADR-443-structural-permanent-ribbon-tab.md` — changelog entry (icon-distinction pass· base×method SSoT· token map).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15) — 1-2 γραμμές «τι εκκρεμεί» (browser-verify + commit).

**ΕΚΤΟΣ ADR-040** (καθαρά ribbon/UI, όχι canvas-critical). **ΜΗΝ adr-index** (shared tree).

---

## 5. ΒΗΜΑΤΑ ΥΛΟΠΟΙΗΣΗΣ (σειρά)
1. **PHASE 1 (RECOGNITION):** Διάβασε ADR-443 + structural-tab.ts + RibbonButtonIcon.tsx + CircleIcon.tsx (variant pattern reference). Επιβεβαίωσε ότι ο πίνακας §1 ταιριάζει με τον τρέχοντα κώδικα (code = source of truth).
2. Φτιάξε `structural-icon-bases.tsx` + `structural-icon-methods.tsx` (καθαρά SVG fragments, viewBox 0 0 24 24, stroke=currentColor, μικρό badge κάτω-δεξιά για το method).
3. Φτιάξε `StructuralToolIcon.tsx` (props: `base`, `method`, `size`· συνθέτει base + overlay· `aria-hidden`).
4. Πρόσθεσε τα cases στο `RibbonButtonIcon.tsx`.
5. Άλλαξε τα 22 `icon:` tokens στο `structural-tab.ts`.
6. Tests (StructuralToolIcon render + anti-collision στο structural-tab.test).
7. **Ζήτα από Giorgio browser-verify** (ανοίγει «Δομικά» → κάθε κουμπί έχει διακριτό, αναγνωρίσιμο εικονίδιο· large 28px + μικρό 16px ευανάγνωστα).
8. N.15 docs (ADR-443 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ). **Commit ο Giorgio.**

---

## 6. OPEN QUESTIONS για Giorgio (ρώτησέ τον στην αρχή — ΜΗΝ μπλοκάρεις, πρότεινε default)
1. **tie-beam vs strip-from-wall:** χρειάζονται distinct glyphs (αλλιώς ξανα-σύγκρουση); Default πρόταση: tie-beam = δικό του «tie» method (δύο παράλληλες δοκοί + εγκάρσιος δεσμός), strip-from-wall = on-entity.
2. **Χρώμα/badge:** μονόχρωμο (currentColor, συνεπές με υπόλοιπο ribbon) — προτεινόμενο default· ή ελαφρύ accent στο method badge; (Default: μονόχρωμο, μέγιστη συνέπεια.)
3. Να επεκταθεί το ίδιο base×method σύστημα αργότερα στις καρτέλες **Αρχιτεκτονικά** + **6×ΗΛΜ** (έχουν παρόμοια variants); (DEFER — όχι τώρα.)

---

## 7. ΚΡΙΣΙΜΑ checks πριν «τελείωσα»
- [ ] Κάθε button στην «Δομικά» = ΜΟΝΑΔΙΚΟ icon token (test το κατοχυρώνει).
- [ ] Τα slab/opening/stair/railing ΑΜΕΤΑΒΛΗΤΑ.
- [ ] labels/commandKey/action/shortcut **ΑΜΕΤΑΒΛΗΤΑ** (μόνο `icon:` άλλαξε) → μηδέν αλλαγή συμπεριφοράς/dispatch.
- [ ] No inline styles (N.3), no `any`, semantic, function ≤40γρ, νέα logic-files ≤500γρ (data files εξαιρούνται).
- [ ] tsc: ΜΟΝΟ αν χρειαστεί (N.17 — ένας tsc τη φορά· πρώτα έλεγξε ότι δεν τρέχει άλλος).
- [ ] `git add` ΜΟΝΟ δικά σου. **Commit ο Giorgio.**
- [ ] N.15: ADR-443 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ ενημερωμένα στο ίδιο (μελλοντικό) commit.

---

## 8. ΣΧΕΤΙΚΑ (read-only context)
- ADR-443 = permanent «Δομικά»/«Αρχιτεκτονικά» + 6×ΗΛΜ tabs (DONE 2026-06-12).
- ADR-345 §8.1b = ribbon icon renderer architecture.
- Variant-icon reference: `ui/toolbar/icons/CircleIcon.tsx` (variant prop → πολλά glyphs, 1 component).
