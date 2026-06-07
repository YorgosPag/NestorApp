# HANDOFF — Revit-grade προκαθορισμένα ΧΡΩΜΑΤΑ ανά BIM κατηγορία (Object Styles)

> **Ημερομηνία:** 2026-06-08 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **Commit/Push:** ΜΟΝΟ ο Giorgio (N.(-1))
> ⚠️ **Working tree ΚΟΙΝΟ με άλλον agent** → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
> **Quality:** FULL ENTERPRISE + FULL SSOT, Revit-grade (ρητή απαίτηση Giorgio).
> **Μοντέλο:** ξεκίνα με αξιολόγηση N.8/N.14 — research+~3-6 αρχεία → Plan Mode.

---

## 1) ΣΤΟΧΟΣ
Ο Giorgio θέλει **προκαθορισμένα χρώματα ανά BIM κατηγορία**, «όπως οι μεγάλοι παίκτες (Revit)»:
- **τοιχία** (shear-walls / ColumnKind `shear-wall`,`composite`,`U-shape`)
- **κολώνες** (ColumnKind `rectangular` κ.λπ.)
- **πλάκες** (slab)
- **τοίχοι εσωτερικοί / εξωτερικοί** (WallCategory `interior` vs `exterior`)
- **κουφώματα** (openings — πόρτες/παράθυρα, OpeningKind)

### Δύο deliverables (με αυτή τη σειρά):
**A. ΕΡΕΥΝΑ (πρώτο):** Τι **προκαθορισμένα χρώματα** χρησιμοποιεί πραγματικά η Revit (Object Styles /
Architectural + Structural template) για τις παραπάνω κατηγορίες. ⚠️ **Να είσαι ειλικρινής:** η Revit
στο default Architectural template είναι κυρίως **μαύρες γραμμές με ιεραρχία πάχους (line weights)**, ΟΧΙ
έντονα χρώματα ανά κατηγορία — το χρώμα διαφοροποιείται κυρίως μέσω **Object Styles overrides** ή
templates (π.χ. Structural). Παρουσίασε στον Giorgio (α) τι κάνει ΟΝΤΩΣ η Revit και (β) πρότεινε ένα
Revit-grade σχήμα χρωμάτων για τις κατηγορίες που ζήτησε. **Χρησιμοποίησε AskUserQuestion** για να
κλειδώσει την παλέτα (συγκεκριμένα hex) πριν υλοποιήσεις.

**B. ΥΛΟΠΟΙΗΣΗ (μετά το κλείδωμα παλέτας):** πρόσθεσε τα χρώματα στο **SSoT** (κάτω) — FULL SSOT,
μηδέν hardcoded χρώματα στους renderers.

---

## 2) ΤΟ ΣΥΣΤΗΜΑ ΧΡΩΜΑΤΩΝ ΗΔΗ ΥΠΑΡΧΕΙ — ΕΙΝΑΙ DATA-ONLY ΑΛΛΑΓΗ (ADR-375 / ADR-377)
Υπάρχει ολοκληρωμένο Revit-equivalent **Object Styles** σύστημα. Σήμερα ορίζει **pens (πάχη)** ανά
κατηγορία, αλλά τα **χρώματα** (`projectionColor`/`cutColor`) είναι **κενά** → όλα πέφτουν σε
**canvas token** (μαύρο/adaptive). Άρα: οι κατηγορίες ΔΕΝ έχουν διακριτό χρώμα σήμερα.

**Ο resolver εφαρμόζει ΗΔΗ το χρώμα αυτόματα** με προτεραιότητα: per-element override → subcategory
color → parent ObjectStyle color → canvas token. **Άρα αρκεί να γεμίσεις τα `projectionColor`/`cutColor`
στο SSoT** και τα χρώματα θα εμφανιστούν σε 2D (και να ελεγχθεί το 3D path) — μηδέν αλλαγή renderer.

### SSoT + κρίσιμα αρχεία:
| Αρχείο | Ρόλος |
|---|---|
| `src/subapps/dxf-viewer/config/bim-object-styles.ts` | **THE SSoT** — `DEFAULT_OBJECT_STYLES` (πρόσθεσε `projectionColor`/`cutColor` ανά category + `subcategories`). `ObjectStyle`/`SubcategoryStyle` interfaces έχουν ήδη τα πεδία χρώματος. |
| `src/subapps/dxf-viewer/config/bim-line-weight-resolver.ts` | `resolveSubcategoryStyle` — ΗΔΗ resolve-άρει color (element→sub→parent→token, γρ. ~160-192). Διάβασέ το (μάλλον μηδέν αλλαγή). |
| `src/subapps/dxf-viewer/config/bim-subcategories.ts` | `SUBCATEGORY_TAXONOMY` — έγκυρα subcategory keys. Για **εσωτ/εξωτ τοίχο**, **shear-wall vs κολώνα**, **πόρτα/παράθυρο** ίσως χρειαστούν subcategory entries εδώ. |
| `src/subapps/dxf-viewer/bim/types/wall-types.ts` | `WallCategory = 'exterior'\|'interior'\|'partition'\|'parapet'\|'fence'` — πώς ξεχωρίζει εσωτ/εξωτ. |
| `src/subapps/dxf-viewer/bim/types/column-types.ts` | `ColumnKind` + `SHEAR_WALL_MIN_ASPECT_RATIO` — κολώνα (`rectangular`) vs τοιχίο (`shear-wall`/`composite`/`U-shape`). |
| `src/subapps/dxf-viewer/bim/types/opening-types.ts` | `OpeningKind` — πόρτα/παράθυρο για ανά-είδος χρώμα κουφώματος. |
| `src/subapps/dxf-viewer/bim/renderers/{WallRenderer,ColumnRenderer,SlabRenderer,OpeningRenderer}.ts` | Καταναλωτές — περνούν category/subcategory στον resolver (δες `*-subcategory-wiring.test.ts`). |
| `src/subapps/dxf-viewer/bim/discipline/bim-discipline.ts` | discipline → ίσως πηγή χρώματος ανά discipline. |

### ΚΡΙΣΙΜΟ WIRING ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΕΛΕΓΞΕΙΣ (μην το θεωρήσεις δεδομένο):
1. **Εσωτ/εξωτ τοίχος:** το `WallRenderer` περνά `wall.category` ως subcategory key στον resolver; Αν ΟΧΙ,
   χρειάζεται mapping `WallCategory → subcategory` + entries στο `SUBCATEGORY_TAXONOMY` + χρώματα στο
   `wall.subcategories` του `DEFAULT_OBJECT_STYLES`. (Διάβασε WallRenderer + το wiring test.)
2. **Τοιχίο vs κολώνα:** ίδια κατηγορία `column` στα Object Styles. Για διαφορετικό χρώμα τοιχίου, η
   διάκριση γίνεται με `ColumnKind` (isWallColumnKind: shear-wall/composite/U-shape). Έλεγξε αν ο
   `ColumnRenderer` μπορεί να περάσει subcategory βάσει kind· αλλιώς πρόσθεσε mapping.
3. **Πόρτα vs παράθυρο:** OpeningKind → subcategory στο `opening`.
4. **3D:** έλεγξε αν το `bim-3d` path (BimToThreeConverter / object-styles consumers στο `bim-3d/scene`)
   τιμά τα ίδια χρώματα ή έχει δικό του color path (material color). Ο Giorgio θα θέλει συνέπεια 2D↔3D.

---

## 3) ΤΙ ΚΑΝΕΙ Η REVIT (seed για την έρευνα — επιβεβαίωσέ το)
- **Object Styles** (Manage → Object Styles): ανά κατηγορία/subcategory → Line Weight (cut/projection),
  **Line Color**, Line Pattern, Material. Default template = κυρίως **Black**, διαφοροποίηση με πάχος.
- **Structural template**: κάποιες κατηγορίες (π.χ. structural columns/framing) έχουν χρώματα.
- **Halftone / Underlay**: γκρι για στοιχεία άλλου ορόφου.
- Η διαφοροποίηση χρώματος ανά τύπο γίνεται συχνά με **Filters** (View Filters) ή Object Style overrides,
  όχι «έτοιμα» χρώματα. → Πρότεινε στον Giorgio μια καθαρή, διακριτή παλέτα Revit-grade (π.χ. κολώνες
  σκούρο μπλε, τοιχία μπορντό, πλάκες γκρι, εξωτ τοίχος μαύρο έντονο, εσωτ τοίχος γκρι, κουφώματα μπλε).
- **ΜΗΝ** εφεύρεις «facts» — αν δεν είσαι σίγουρος για το ακριβές Revit default, πες το ξεκάθαρα και
  πρότεινε τεκμηριωμένα (knowledge cutoff). Προαιρετικά WebSearch για «Revit default Object Styles colors».

---

## 4) ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ
- 🌐 ΠΑΝΤΑ Ελληνικά. ⚠️ Commit/push ΜΟΝΟ ο Giorgio. ⚠️ Κοινό tree → `git add` μόνο δικά σου, ΠΟΤΕ `-A`.
- **ADR-driven (N.0.1):** διάβασε ADR-375 + ADR-377 → σύγκρινε με κώδικα → update ADR (changelog) μαζί.
- **N.11 i18n:** αν προσθέσεις UI labels (π.χ. ονόματα subcategory/χρωμάτων) → keys σε el+en ΠΡΩΤΑ,
  **ICU plural** αν χρειαστεί πληθυντικός (⚠️ το project = **i18next-icu**: `{count, plural, one {…} other {…}}`,
  ΠΟΤΕ `_one`/`_other` suffixes — βλ. memory `reference_i18n_icu_plurals`).
- **N.17:** ΕΝΑ `tsc` τη φορά — έλεγξε `Get-CimInstance Win32_Process … *tsc*` πριν ξεκινήσεις.
- **Tests:** unit για το χρώμα ανά category/subcategory (mirror `*-subcategory-wiring.test.ts` + `bim-line-weight-resolver` tests). Πρόσθεσε regression ότι κάθε MODEL category έχει color ή σκόπιμα token.
- **N.15:** update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-375/377 + (αν αφορά) adr-index μετά την υλοποίηση.
- **ADR-040:** το `bim-object-styles.ts` είναι config (όχι high-freq path) — αλλά αν αγγίξεις renderer/
  bitmap-cache key, δες CHECK 6B/6D (stage ADR-040). Το χρώμα ΠΡΕΠΕΙ να είναι μέρος του bitmap-cache key
  (αλλιώς stale χρώματα) — έλεγξε το `dxf-bitmap-cache` (υπάρχει ήδη `*-subcategory-invalidation.test.ts`).

---

## 5) ΕΚΤΟΣ SCOPE (μην τα αγγίξεις)
- Η μόλις-ολοκληρωμένη δουλειά **ADR-419 «κολώνες/τοίχοι σε περιοχή»** (5-layer fix γιγάντιου
  περιγράμματος + perf cache + intent-aware confirm + ICU plural fix) είναι **pending commit του Giorgio**.
  Αρχεία: `perimeter-from-faces.ts`, `region-tolerance.ts`, `use-column-region-clicks.ts`,
  `use-column-perimeter-commit.ts`, `use-wall-region-clicks.ts`, `useRegionPerimeterMouseMove.ts`,
  `RegionPerimeterPreview*`, `column-from-faces.ts`. **ΜΗΝ τα πειράξεις** εκτός αν το χρώμα τα αφορά άμεσα.
- Drainage/heating/opening-types/mep — άλλος agent (codex) στο ίδιο tree.
- User customization χρωμάτων (ribbon + Firestore persistence) = ADR-375 Phase B → **deferred** εκτός αν
  ο Giorgio το ζητήσει· αυτή η συνεδρία = **defaults** στο SSoT.

---

## 6) ΠΡΟΤΕΙΝΟΜΕΝΗ ΡΟΗ
1. Διάβασε `bim-object-styles.ts` + `bim-line-weight-resolver.ts` (resolveSubcategoryStyle) + `bim-subcategories.ts` + ADR-375/377.
2. Έρευνα Revit defaults (knowledge + προαιρετικά WebSearch) → AskUserQuestion για κλείδωμα παλέτας (hex ανά: εξωτ τοίχος / εσωτ τοίχος / κολώνα / τοιχίο / πλάκα / πόρτα / παράθυρο).
3. Plan Mode → ExitPlanMode.
4. Υλοποίηση: γέμισε `DEFAULT_OBJECT_STYLES` colors + subcategories· wiring εσωτ/εξωτ + κολώνα/τοιχίο + πόρτα/παράθυρο· έλεγξε 2D + 3D + bitmap-cache key.
5. Tests + ADR + N.15 docs.
