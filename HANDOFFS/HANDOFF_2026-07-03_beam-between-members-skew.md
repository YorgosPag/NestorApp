# HANDOFF — «Δοκάρι ανάμεσα σε μέλη» (ADR-569): διόρθωση ΛΟΞΗΣ τοποθέτησης

**Ημερομηνία:** 2026-07-03
**Κατάσταση:** UNCOMMITTED (ο Giorgio κάνει τα commit, ΟΧΙ ο agent). Working tree μοιράζεται με **άλλον agent** — άγγιξε ΜΟΝΟ τα δικά σου αρχεία, ξαναδιάβαζε πριν κάθε edit.
**Επόμενο βήμα:** ΜΠΕΣ ΣΕ **PLAN MODE**, κάνε **βαθύτατη βουτιά** (SSOT audit με grep), βρες γιατί τα δοκάρια βγαίνουν λοξά, υλόποιησε σωστά (Revit/Cinema4D/Figma-level, FULL SSoT, μηδέν διπλότυπα). ΟΧΙ tsc (N.17· jest OK). ΟΧΙ commit.

---

## 1. Τι είναι η εντολή (ADR-569)

Νέα εντολή στο DXF Viewer subapp: **«Δοκάρι ανάμεσα σε μέλη»** (ribbon «Δομικά»). Ροές:
- **Αλυσίδα:** πατάς την εντολή → σειριακά κλικ σε κολόνες/τοιχία· κάθε **δεύτερο** κλικ δημιουργεί ΑΜΕΣΩΣ δοκάρι ανάμεσα στο προηγούμενο και στο τρέχον μέλος· το τρέχον γίνεται αρχή του επόμενου (συνεχής αλυσίδα).
- **Αντίστροφη (selection-first):** με ≥2 προεπιλεγμένα μέλη + εντολή → δοκάρι ανά διαδοχικό ζεύγος.
- **Highlight:** native hover (φωτίζεται το μέλος κάτω από τον κέρσορα) + persistent «επιλεγμένο» highlight ΜΟΝΟ στο τρέχον anchor· με τη δημιουργία, σβήνει το προηγούμενο, μένει το νέο.

## 2. ✅ Τι δουλεύει ήδη (verified από τον Giorgio)

- Αλυσίδα + αντίστροφη ροή.
- Hover φωτισμός (native HoverStore μέσω `entityPickingActive`) + persistent anchor highlight (overlay).
- **Διαμήκης span = παρειά-προς-παρειά** (face-to-face).
- **Πλευρικό flush κατά φορά** (Giorgio, ΕΓΚΕΚΡΙΜΕΝΟ + επιβεβαιωμένο με 2 σκίτσα): 2ο κλικ **δεξιά** → **νότια-flush** στη νότια άκρη της κοινής επικάλυψης· **αριστερά** → **βόρεια-flush**. Η άκρη επικάλυψης = **παρειά της στενότερης** οντότητας → πατάει και στα δύο, μηδέν κρέμασμα.
- 19/19 jest πράσινα.

## 3. 🔴 ΤΟ ΠΡΟΒΛΗΜΑ ΠΡΟΣ ΔΙΟΡΘΩΣΗ — ΛΟΞΑ ΔΟΚΑΡΙΑ

**Στιγμιότυπο:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-07-03 210722.jpg`

Τα δοκάρια βγαίνουν **λοξά/κεκλιμένα** (γέρνουν πάνω-κάτω) αντί για ευθυγραμμισμένα/οριζόντια, ενώ οι κολόνες είναι σε (περίπου) οριζόντια σειρά. Ο Giorgio σχεδίασε με μπλε τη σωστή (οριζόντια, κατά μήκος της κάτω παρειάς) θέση.

**Ρίζα (υπόθεση προς επιβεβαίωση):** στο `computeBeamAxisBetweenMembers` ο διαμήκης άξονας `u` ορίζεται ως **κέντρο→κέντρο** (`polygon2DCentroid(A)`→`polygon2DCentroid(B)`). Όταν τα δύο μέλη έχουν **διαφορετικά κέντρα σε Y** (διαφορετικό βάθος/μέγεθος, ή εισηγμένες DXF θέσεις με μικρο-offset), το `u` **γέρνει** → όλος ο άξονας του δοκαριού γίνεται λοξός. Επιπλέον, το «νότια/βόρεια flush» έχει νόημα μόνο για σχεδόν-αξονικό δοκάρι· σε λοξό γίνεται ασαφές.

## 4. Τι πρέπει να μελετηθεί στη βαθιά βουτιά (Plan Mode)

Στόχος: **πώς ορίζεται σωστά η ΔΙΕΥΘΥΝΣΗ του δοκαριού** ώστε να μη λοξοδρομεί (big-player behavior). Υποψήφιες προσεγγίσεις — κάνε πραγματικό **SSOT audit (grep)** πριν γράψεις:

1. **Snap της διεύθυνσης σε άξονα/κάναβο:** αν τα δύο μέλη είναι σχεδόν-συγγραμμικά σε άξονα (0°/90° ή σε guide/grid άξονα), κούμπωσε το `u` στον άξονα (οριζόντιο/κατακόρυφο) → οριζόντιο δοκάρι, το flush δουλεύει καθαρά.
   - Grep: `bim/grid/*` (grid axes, ADR-441), `bim/framing/beam-span-snap.ts` (ADR-528/529 — πώς ορίζει ΕΚΕΙΝΟ τον άξονα ζεύγους· ΜΗΝ ξαναγράψεις, δες αν το `pairFrame`/facing-point axis είναι πιο σωστό), `systems/guides/*` (guide axes), `axis-normal.ts` (`canonicalAxisNormal`).
2. **Facing-face line αντί centroid line:** ο άξονας να ορίζεται από την **κοινή παρειά** (π.χ. η νότια παρειά και των δύο) → οριζόντιος. Το `beam-span-snap.ts` κάνει ήδη κάτι σχετικό (facing-point axis, ADR-529 Φ1). Δες αν το reuse λύνει ΚΑΙ το λοξό ΚΑΙ το flush.
3. **Ορθογωνιοποίηση:** project τα κέντρα σε οριζόντιο/κατακόρυφο και κράτα το κυρίαρχο (dominant axis) — απλό, αλλά έλεγξε αν χαλάει τις πραγματικά λοξές περιπτώσεις (κεκλιμένα μέλη — ίσως θέλει ο Giorgio ΚΑΙ αυτά).

**Ρώτα τον Giorgio (concrete example, ASCII/νούμερα — προτίμησή του):** για κολόνες που ΔΕΝ είναι τέλεια ευθυγραμμισμένες (κέντρα σε διαφορετικό Y), θέλει (α) το δοκάρι **οριζόντιο** (snap σε άξονα, flush σε κοινή παρειά) ή (β) να ακολουθεί την πραγματική λοξή γραμμή των κέντρων; Το στιγμιότυπο δείχνει ότι θέλει **(α) ευθυγραμμισμένο**. Επιβεβαίωσε ΠΡΙΝ υλοποιήσεις.

## 5. Πού ζει ο κώδικας (τα ΔΙΚΑ ΜΑΣ αρχεία)

### Πυρήνας γεωμετρίας (εδώ γίνεται η διόρθωση)
- `src/subapps/dxf-viewer/bim/beams/beam-between-members.ts`
  - `computeBeamAxisBetweenMembers(footprintA, footprintB, halfWidthScene)` → **ΕΔΩ** ορίζεται `u`=centroid→centroid (η ρίζα του λοξού). Decoupled: διαμήκης (alongMax_A→alongMin_B) + πλευρικός flush (lo/hi της επικάλυψης, dx≥0→νότια, dx<0→βόρεια). Ορθοκανονική βάση `{u,n}`, `P=O+s·u+t·n`.
  - `pickStructuralMemberAt`, `getStructuralMemberFootprint2D`, `buildBeamBetweenMembers`, `connectorBetweenMembers`, `connectorFromMemberToPoint`.
- `src/subapps/dxf-viewer/bim/geometry/shared/polygon-nearest.ts` — SSoT `shortestSegmentBetweenPolygons` / `closestPointOnPolygonOutline`.
- **Reuse (ΜΗΝ ξαναγράψεις):** `bim/geometry/shared/polygon-axis-projection.ts` (`projectPolygonOnAxis`/`projectPointOnAxis`), `polygon-utils.ts` (`polygon2DCentroid`), `bim/framing/beam-span-snap.ts` (ADR-528/529 pairFrame/facing-axis — πιθανό source of truth για τη διεύθυνση).

### Preview (πρέπει να μείνει preview ≡ commit)
- `src/subapps/dxf-viewer/hooks/tools/useBeamBetweenMembersPreview.ts` — καλεί το ΙΔΙΟ `computeBeamAxisBetweenMembers`. Αν αλλάξει η διεύθυνση, το ghost διορθώνεται αυτόματα.
- `src/subapps/dxf-viewer/systems/beam-between-members/BeamBetweenMembersStore.ts` — anchor store (ADR-040 store-driven leaf).

### FSM + wiring
- `src/subapps/dxf-viewer/hooks/drawing/useBeamBetweenMembersTool.ts` — FSM (αλυσίδα + reverse)· option callbacks μέσω **refs** (αλλιώς useToolLifecycle ξανα-έτρεχε το activate).
- Wiring (μικρές γραμμές): `ui/toolbar/types.ts`, `systems/tools/tool-definitions.ts`, `hooks/canvas/canvas-click-tool-types.ts` + `canvas-click-types.ts` + `canvas-click-bim-dispatch.ts`, `hooks/tools/useSpecialTools.ts`, `hooks/canvas/useCanvasClickHandler.ts`, `components/dxf-layout/CanvasSection.tsx` (+ `entityPickingActive`), `components/dxf-layout/canvas-layer-stack-tool-preview-mounts.tsx` + `canvas-layer-stack-preview-mounts.tsx`, `ui/ribbon/data/structural-tab.ts`, i18n `el/en/dxf-viewer-shell.json`.

### Tests
- `bim/beams/__tests__/beam-between-members.test.ts` (19 tests μαζί με flush) — **ενημέρωσέ τα** αν αλλάξει η διεύθυνση.
- `bim/geometry/shared/__tests__/polygon-nearest.test.ts`.

### Docs
- `docs/centralized-systems/reference/adrs/ADR-569-beam-between-members.md` (+ changelog).
- ADR-040 changelog + adr-index ενημερωμένα.

## 6. Κανόνες / περιορισμοί
- **ΟΧΙ commit/push** (ο Giorgio). Working tree ΜΟΙΡΑΖΕΤΑΙ — μόνο δικά σου αρχεία, `git add` specific, ξαναδιάβασμα πριν edit.
- **ΟΧΙ tsc** (N.17). **jest OK** (γρήγορα, στοχευμένα).
- **FULL SSoT audit (grep) ΠΡΙΝ κώδικα** — reuse `projectPolygonOnAxis` / `beam-span-snap` / grid axes· μηδέν διπλότυπα.
- Ο άλλος agent έχει **ADR-568** (wall-gap-auto-opening) — ΜΗΝ το αγγίξεις. Δικό μας = **ADR-569**.
- **Staging όταν commitάρει ο Giorgio:** κώδικας + **ADR-569 + ADR-040 + adr-index** μαζί (CHECK 6B για CanvasSection).
- Απάντηση στον Giorgio **ΠΑΝΤΑ στα Ελληνικά**.

## 7. Επαλήθευση όταν διορθωθεί
Reload `http://localhost:3000/dxf/viewer` → εντολή → σειρά από κολόνες διαφορετικού μεγέθους/θέσης → τα δοκάρια πρέπει να είναι **ευθυγραμμισμένα (όχι λοξά)**, flush στη σωστή παρειά (δεξιά→νότια, αριστερά→βόρεια), να πατάνε και στα δύο μέλη.
