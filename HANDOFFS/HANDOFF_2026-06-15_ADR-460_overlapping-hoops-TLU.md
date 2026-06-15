# HANDOFF — ADR-460: Επανασχεδίαση εγκάρσιου οπλισμού Γ/Τ/Π/Ι σε ΕΠΙΚΑΛΥΠΤΟΜΕΝΟΥΣ ΟΡΘΟΓΩΝΙΟΥΣ ΣΥΝΔΕΤΗΡΕΣ

**Ημ/νία:** 2026-06-15 · **Μοντέλο:** Opus · **Κατάσταση:** UNCOMMITTED (commit ΜΟΝΟ ο Giorgio) · **Shared tree** με ADR-459 agent → `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`.

> ⚠️ Ο Giorgio έχασε εμπιστοσύνη γιατί κάθε γύρος πρότεινα διαφορετικό οπλισμό. ΑΙΤΙΑ: έβαζα μπαλώματα πάνω σε **λάθος βάση** (ένα στεφάνι που ακολουθεί το outline). Η ΣΩΣΤΗ μέθοδος αποφασίστηκε ρητά (παρακάτω). **ΜΗΝ ξαναπροτείνεις άλλη μέθοδο — υλοποίησε ΑΥΤΗ, ολοκληρωμένα, με tests, και δείξ' την μία φορά.**

---

## 🎯 ΑΠΟΦΑΣΗ GIORGIO (κλειδωμένη — μην την αλλάξεις)

1. **Μέθοδος:** Επικαλυπτόμενοι **ορθογώνιοι κλειστοί συνδετήρες ανά σκέλος** + **cross-ties** για ενδιάμεσες (Revit/Tekla standard). ΟΧΙ ένα στεφάνι στο περίγραμμα.
2. **Κανονισμός:** Όρια οδηγούμενα από το combo «Κανονισμός» του panel (Ευρωκώδικας EC2+EC8 **ΚΑΙ** Ελληνικός ΕΑΚ/ΕΚΩΣ — επιλέξιμο).

## 📐 Η ΣΩΣΤΗ ΜΕΘΟΔΟΣ (πώς οπλίζουν οι μεγάλοι μια κολώνα Τ)

- Η διατομή Τ/Γ/Π/Ι **διασπάται σε ορθογώνια σκέλη** (T→πέλμα+κορμός· Γ→2 σκέλη· Π→βάση+2 πόδια· Ι→2 πέλματα+κορμός).
- **Ένας κλειστός ορθογώνιος συνδετήρας ανά σκέλος**, με άγκιστρα 135°. Οι συνδετήρες **επικαλύπτονται** στη ζώνη συμβολής.
- **Cross-ties (συνδετήρες δεσίματος)** για τις ενδιάμεσες ράβδους, άγκιστρο 135°, πιάνουν ράβδο σε κάθε άκρο.
- Κάθε γωνιακή ράβδος συγκρατείται από κάμψη συνδετήρα· **καμία ράβδος > όριο** από συγκρατούμενη.
- **Κρίσιμες ζώνες** στα άκρα: πυκνότερο βήμα.

## 📏 ΚΑΝΟΝΙΣΜΟΙ (ακριβείς παραπομπές — ΤΗΡΗΣΕ ΤΕΣ)

**EC2 EN1992-1-1:** §9.5.3(1) Ø_w ≥ max(6, ¼Ø_L)· §9.5.3(3) βήμα ≤ min(20Ø_L, μικρή πλευρά, 400)· §9.5.3(4) ×0,6 κρίσιμες· **§9.5.3(6): καμία ράβδος >150mm από συγκρατούμενη**· §8.5 άγκιστρο 135°→προέκταση **5Ø** (10Ø=90°).

**EC8 EN1998-1 (DCM):** §5.4.3.2.2(3) l_cr=max(h_c, l_clear/6, 450)· (4) βήμα κρίσιμης ≤ min(b₀/2, 175, 8Ø_L)· **(11) απόσταση συγκρατούμενων ράβδων ≤200mm** (DCM· 150 DCH)· άγκιστρα 135°.

**Ελληνικός ΕΑΚ 2000 §18 / ΕΚΩΣ 2000 §18.4:** ίδια φιλοσοφία (κλειστοί συνδετήρες 135°, συνδετήρες δεσίματος, πύκνωση κρίσιμων, περίσφιγξη πυρήνα).

→ Τα όρια (βήμα, απόσταση ράβδων, άγκιστρο) **διάβασέ τα από τον επιλεγμένο κανονισμό** (structural-settings store· βλ. `bim/structural/codes/`). Combo «Κανονισμός» = `COLUMN_STRUCTURAL_KEYS.code`.

## 🏗️ ΠΛΑΝΟ ΥΛΟΠΟΙΗΣΗΣ (η κομψή λύση: reuse ορθογωνικής μηχανής ανά σκέλος)

**Κλειδί:** μέσα σε ΕΝΑ ορθογώνιο οι ράβδοι ΕΙΝΑΙ ευθυγραμμισμένες → ο υπάρχων ορθογώνιος συνδετήρας (`buildRoundedStirrupPath`) + cross-ties (`buildColumnCrossTies` diamond/grid) δουλεύουν **τέλεια** (μηδέν ζιγκ-ζαγκ, μηδέν κοίλη γωνία). Άρα:

1. **NEW `column-rect-decomposition.ts`** — `decomposeColumnSectionRects(params): RectMm[]` (LOCAL mm centroid). Parametric ανά kind (διάβασε ΠΩΣ χτίζει το `materializeColumnLocalPolygonMm` στο `bim/geometry/column-geometry.ts` ώστε τα ορθογώνια να ΤΑΥΤΙΖΟΝΤΑΙ με το footprint). T: flange (width×flangeThickness) + web (webThickness×υπόλοιπο). Γ: 2 σκέλη. Π: legThickness/baseThickness. Ι: flangeThickness/webThickness. polygon/composite → fallback (generic rectilinear slab-decomposition Ή προσωρινά single-hoop+ties).
2. **NEW `column-multihoop-layout.ts`** — `buildMultiHoopLayout(r, section, rects)`: ανά rect κάλεσε τη ΛΟΓΙΚΗ της ορθογωνικής (hoop + bars + cross-ties), μετά **merge**: 1ος hoop→`stirrupPathMm`, υπόλοιποι→`extraStirrupPathsMm`· ένωσε bars (dedupe coincident στη συμβολή με tol)· ένωσε crossTieAnchorsMm/ties. Ο `ColumnRebarLayout` ήδη έχει `extraStirrupPathsMm` (το χρησιμοποιεί το wall) → οι renderers ήδη ζωγραφίζουν extra hoops.
3. **Bar count:** ο χρήστης δίνει `r.longitudinal.count`. Είτε (α) μοίρασέ τον στα rects αναλογικά (dedupe shared), είτε (β) προτίμησε **spacing-derived** ανά rect ώστε απόσταση ≤ όριο κανονισμού (Tekla-style) και ενημέρωσε το readout. Συζήτησε με Giorgio αν δεν είναι προφανές — αλλά μην κολλήσεις· proportional split είναι ασφαλές default.
4. **Dispatcher** `column-rebar-layout-resolve.ts`: για perimeter μη-ορθογώνιο → `buildMultiHoopLayout` (αντί `buildPerimeterLayoutFromOutline`). Rectangular fast-path ΑΜΕΤΑΒΛΗΤΟ. circular/wall ΑΜΕΤΑΒΛΗΤΑ.
5. **Όρια από κανονισμό**: πέρασε το επιλεγμένο code στα όρια βήματος/απόστασης (ήδη υπάρχει `bim/structural/codes/` με eurocode/greek-legacy).

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ ΣΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (UNCOMMITTED — ΚΡΑΤΑ/ΑΝΤΙΚΑΤΕΣΤΗΣΕ)

**ΚΡΑΤΑ (σωστά, ανεξάρτητα της μεθόδου):**
- **Άγκιστρο 135° = 5Ø** (όχι 10Ø): `column-cross-ties.ts` `CROSS_TIE_HOOK_EXTENSION_FACTOR=5` (EC2 §8.5). ✅ σωστό κατά EC2.
- **UI shape-aware**: `resolveColumnFieldOptions` (`column-command-keys.ts`) κρύβει το «διαμάντι» σε μη-ορθογώνια· `ColumnPropertyRow` `options?` prop· `ColumnAdvancedPanel` wiring. ✅
- **cross-ties μόνο σε ΠΡΑΓΜΑΤΙΚΕΣ ράβδους** (`alignedOppositeBar`): η ιδέα «tie πιάνει πάντα ράβδο, ποτέ γάντζος στο κενό» ισχύει ΚΑΙ στη νέα μέθοδο — αλλά στη νέα μέθοδο τα cross-ties θα προκύπτουν από την **ορθογωνική** `buildColumnCrossTies` ανά rect (καθαρότερο).

**ΘΑ ΑΝΤΙΚΑΤΑΣΤΑΘΕΙ (λάθος βάση):**
- `column-perimeter-layout.ts`: το single-outline stirrup + το `buildPerimeterCrossTieAnchors` (perpendicular-projection). Στη νέα μέθοδο το perimeter μη-ορθογώνιο πάει σε `buildMultiHoopLayout`. (Το `buildPerimeterLayoutFromOutline` μπορεί να μείνει ως fallback για polygon/composite.)

**ΜΑΘΗΜΑΤΑ (γιατί απέτυχαν τα μπαλώματα):**
- Ένα στεφάνι στο outline = **μη-κατασκευάσιμο** σε κοίλη (reentrant) γωνία → «δεν αγκαλιάζει τη ράβδο». ΣΩΣΤΟ είναι επικαλυπτόμενα ορθογώνια.
- bars perimeter-distributed = ΜΗ ευθυγραμμισμένες απέναντι παρειές → ζιγκ-ζαγκ ή γάντζος-στο-κενό. Μέσα σε rect ευθυγραμμίζονται → καθαρά cross-ties.
- (Διευκρίνιση Giorgio: στεφάνι ΔΕΝ αγκαλιάζει ράβδο σε κοίλη γωνία = ΣΩΣΤΟ· συγκρατείται από cross-ties.)

## 🚨 ΚΑΝΟΝΕΣ (διάβασε ΠΡΙΝ γράψεις)
1. **COMMIT/PUSH ΜΟΝΟ ο Giorgio** (N.(-1)). Ετοίμασε, δείξε `git status`/`git diff`, σταμάτα.
2. **Shared tree**: `git add` ΜΟΝΟ δικά σου. MIXED με ADR-459 agent: `structural-code-types.ts`, `section-context.ts`, `column-reinforcement-compute.ts`.
3. **N.17 — ΕΝΑ tsc τη φορά**: ΠΡΙΝ τρέξεις `tsc --noEmit` έλεγξε ότι δεν τρέχει άλλος (ο ADR-459 agent τρέχει συχνά). Background, μη-blocking.
4. **`DxfRenderer.ts` = ADR-040** (CHECK 6B/6D): αν το αγγίξεις, stage ADR-040+ADR-460 μαζί. (Στη νέα μέθοδο μάλλον ΔΕΝ χρειάζεται — οι hoops ρέουν μέσω `extraStirrupPathsMm` που ήδη ζωγραφίζεται.)
5. **N.2** μηδέν `any`· **N.7.1** ≤500γρ/αρχείο, ≤40γρ/συνάρτηση.
6. **Browser-verify Firestore-first**: φτιάξε Τ/Γ/Π/Ι → «Auto» → δες επικαλυπτόμενα ορθογώνια στεφάνια + cross-ties σε ράβδους + 3Δ κλωβό. Δείξε στον Giorgio screenshot **ολοκληρωμένο**.

## ✔️ VERIFICATION
- Jest: `npx jest reinforcement codes detail-sheet validators column-multishape column-field` — όλα GREEN, rect αμετάβλητο. Πρόσθεσε tests: decomposition ανά kind (σωστά rects), multihoop (≥2 hoops σε Τ, dedupe bars, cross-ties σε πραγματικές ράβδους).
- tsc background (N.17).

## 📌 Έγγραφα (ίδιο commit — N.0.1/N.15)
ADR-460 changelog (ήδη έχει follow-ups 1-5· πρόσθεσε «follow-up 6: overlapping rectangular hoops redesign»)· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-460 υπάρχει)· memory `project_adr460_multishape_column_reinforcement.md`.

## 🔖 Reference αρχεία
`bim/structural/reinforcement/`: column-section-outline, column-rebar-layout(-resolve), column-perimeter-layout, column-cross-ties (buildColumnCrossTies/straightTie/buildTiesFromAnchors), column-rebar-layout (buildRoundedStirrupPath/computeColumnRebarLayout/distributeBars).
`bim/geometry/column-geometry.ts` (materializeColumnLocalPolygonMm — ΔΙΑΒΑΣΕ για τα rects).
`bim/structural/codes/` (eurocode, greek-legacy — όρια κανονισμού).
`ui/column-advanced-panel/` + `ui/ribbon/hooks/bridge/column-command-keys.ts`.
ADR: `docs/centralized-systems/reference/adrs/ADR-460-multi-shape-column-reinforcement.md`.

## 📊 Κατάσταση tsc
Όλα τα δικά μου αρχεία = tsc clean ως τον γύρο follow-up 4. Ο follow-up 5 (alignedOppositeBar) ΔΕΝ πρόλαβε tsc (έτρεχε άλλος agent· N.17). 303 jest GREEN. Στη νέα συνεδρία τρέξε tsc αφού ελέγξεις ότι είναι ελεύθερο.
