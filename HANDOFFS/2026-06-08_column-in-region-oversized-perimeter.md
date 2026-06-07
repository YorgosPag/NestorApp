# HANDOFF — «Κολώνες σε περιοχή» δημιουργεί ΓΙΓΑΝΤΙΑ κολώνα (λάθος κλειστό περίγραμμα)

> **Ημερομηνία:** 2026-06-08 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **Commit:** ΜΟΝΟ ο Giorgio (N.(-1))
> ⚠️ **Working tree ΚΟΙΝΟ με άλλον agent** (codex: drainage/heating + opening types/mep-manifold).
> `git add` **ΜΟΝΟ τα δικά σου** αρχεία — **ΠΟΤΕ** `git add -A`.
> **Quality:** FULL ENTERPRISE + FULL SSOT, Revit-grade (ρητή απαίτηση Giorgio).

---

## 1) ΤΟ ΠΡΟΒΛΗΜΑ (αναπαραγόμενο)
Στο εργαλείο **«Κολώνες μέσα σε περιοχή»** (column-in-region / «από περίγραμμα»), ο χρήστης σημαδεύει
μια μικρή περιοχή για να γεμίσει με κολώνα. Αντί για τη μικρή κολώνα, η εφαρμογή δημιούργησε
**γιγάντια κολώνα ~στο μέγεθος όλου του σχεδίου**.

### Πραγματικά δεδομένα (DB — flr_ea148848-8aed-49d8-b201-f2935e883f67)
| Column id | kind | width × depth (mm) | = m | BOQ (m³) |
|---|---|---|---|---|
| `col_1cdff9a6-a253-4339-b5ca-3fe2cc9dc7c9` | rectangular | 27777.78 × 25347.22 | **27.78 × 25.35** | 2112.27 |
| `col_daaa1ad4-7944-455c-afed-cc27e827b892` | rectangular | 27777.78 × 25347.22 | **27.78 × 25.35** | 2112.27 |
| `col_cbc2f5bb-7e87-4d1b-879e-5c004cb7f5d7` | shear-wall | 2950 × 200 | 2.95 × 0.20 | 1.77 (σωστό) |

- Και τα 2 γιγάντια έχουν **ίδια θέση** position (14.236, 13.021) — δύο διαδοχικά κλικ (21:02:28 & 21:02:39).
- Το DXF («_AfrPolGO.dxf», file_9ddb31e9) έχει bounds min(-36.46,-26.04) max(0,0) → ~**36.46 × 26.04 m**.
  Το ανιχνευμένο περίγραμμα (27.78×25.35m) ≈ **σχεδόν όλο το σχέδιο**.

### 🧹 Cleanup (πριν/μετά το fix — UI ή MCP)
Να σβηστούν τα 2 garbage + τα BOQ τους:
- entities: `col_1cdff9a6…`, `col_daaa1ad4…` (collection `floorplan_columns`)
- BOQ: `boq_bim_col_1cdff9a6…`, `boq_bim_col_daaa1ad4…` (collection `boq_items`, source `bim-auto`)
- (το `col_cbc2f5bb` shear-wall είναι σωστό — **ΜΗΝ** το σβήσεις)

---

## 2) ROOT CAUSE (επιβεβαιωμένο στον κώδικα)

Ροή: click-inside → `perimeterFacesToRects(entities, tol)` (SSoT face-detection) →
`perimeters.filter(p => isPointInPolygon(point, p.polygon))` → build ΕΝΑ column ανά perimeter στο `hit`.

**Δύο ελαττώματα που συνδυάζονται:**

1. **Καμία επιλογή «μικρότερου εσωτερικού loop».**
   `src/subapps/dxf-viewer/hooks/drawing/use-column-perimeter-commit.ts:87` (`onPerimeterClick`)
   και `:167` (`onDiscretePerimeterClick`): το filter κρατά **ΟΛΑ** τα περιγράμματα που περιέχουν το
   σημείο. Όταν το σημείο πέφτει και μέσα στο μεγάλο εξωτερικό περίγραμμα, αυτό περνά. **Revit-λάθος:**
   πρέπει να κερδίζει το **ελάχιστου εμβαδού** κλειστό loop γύρω από το σημείο (innermost), όχι όλα.

2. **Κενά (gaps) στις γραμμές → το μικρό loop ΔΕΝ ανιχνεύεται καθόλου.**
   Το `perimeter-from-faces.ts` (SSoT planar-face detection) απαιτεί ακριβή σύμπτωση άκρων (εντός `tol`).
   Αν το πλαίσιο που σημάδεψε ο χρήστης έχει κενό > tol, **δεν κλείνει** → δεν μπαίνει καν στο `hit`,
   οπότε μένει μόνο το μεγάλο εξωτερικό. (Ο χρήστης το διέγνωσε σωστά: «οι γραμμές δεν ενώνονταν».)

3. **Κανένας έλεγχος λογικού μεγέθους.** Μια «κολώνα» 27×25m είναι φυσικά αδύνατη — κανένα guard δεν
   την μπλόκαρε. Είναι το τελευταίο δίχτυ ασφαλείας που λείπει.

`tol` SSoT: `TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale` (`use-column-perimeter-commit.ts:65`).

---

## 3) ΤΙ ΚΑΝΕΙ Η REVIT (target behavior)
1. **Gap tolerance + auto-trim/extend:** μικρά κενά στις boundary lines κλείνουν αυτόματα (ανοχή).
2. **Smallest enclosing loop:** όταν κάνεις pick μέσα σε φωλιασμένα loops, διαλέγει το **εσωτερικό** (ελάχιστο), όχι το εξωτερικό.
3. **Preview + Finish:** δείχνει το ανιχνευμένο boundary highlighted ΠΡΙΝ το commit· ο χρήστης επιβεβαιώνει.
4. **«Lines do not form a closed loop» warning:** αν τα κενά ξεπερνούν την ανοχή, αρνείται + δείχνει τα ασύνδετα άκρα.
5. **Size sanity:** column families έχουν λογικά όρια· τεράστιο boundary → flag.

---

## 4) ΠΡΟΤΕΙΝΟΜΕΝΗ ΛΥΣΗ — defense-in-depth, FULL SSOT (σχεδίαση, ΟΧΙ ακόμα υλοποιημένη)

> ⚠️ Το ίδιο bug-class υπάρχει και στο **«Τοίχοι σε περιοχή»** (`wall-in-region.ts` / `buildWallFillingRect`)
> — η λύση πρέπει να μπει στο **κοινό SSoT** ώστε να διορθώσει **και τα δύο** (όχι fork).

**Layer 1 — Smallest-containing-loop selection (ο πυρήνας του fix).**
Στο `use-column-perimeter-commit.ts` (και στο wall mirror): όταν `hit.length > 1`, κράτα το perimeter με
**ελάχιστο εμβαδόν πολυγώνου** που περιέχει το σημείο (όχι όλα). SSoT helper, π.χ.
`pickSmallestContainingPerimeter(point, perimeters)` σε κοινό σημείο (geometry utils / perimeter SSoT).
Καλύπτει την κοινή περίπτωση inner+outer.

**Layer 2 — Gap-tolerant loop closure στο `perimeter-from-faces.ts` (SSoT).**
Snap σχεδόν-συμπιπτόντων άκρων εντός SSoT ανοχής πριν το face-building — **mirror του υπάρχοντος
pattern** `PIPE_JOIN_TOLERANCE_MM` / `resolvePipeJoinTolerance` (ADR-408, βλ. `mep-pipe-network-derive`).
Νέα σταθερά π.χ. `REGION_LOOP_JOIN_TOLERANCE_MM` στο `tolerance-config.ts`. Ανακτά το μικρό loop ώστε
να εμφανιστεί στο `hit`.

**Layer 3 — Boundary preview + confirm (Revit «Finish Sketch»).**
Πριν το commit, ghost-highlight του ανιχνευμένου boundary + διαστάσεις (π.χ. «27.8 × 25.3 m — σίγουρα;»).
Υποδομή υπάρχει ΗΔΗ: `column-perimeter-confirm-store.ts` (`requestColumnIsColumnWarn`,
`requestColumnDiscreteIntentConfirm`). Επέκταση με size-aware preview.

**Layer 4 — Size sanity guard (το δίχτυ που θα είχε σταματήσει το bug).**
Στο `column-from-faces.ts` (`buildColumnFillingRect` / `buildPerimeterColumn`): απόρριψη/warn όταν το
περίγραμμα ξεπερνά λογικό envelope δομικού μέλους — SSoT max (π.χ. configurable `MAX_REGION_MEMBER_MM`
ή ποσοστό του drawing bbox). Μήνυμα: «Δεν βρέθηκε κλειστό περίγραμμα κοντά στο σημείο· οι γραμμές ίσως
δεν ενώνονται.»

**Layer 5 — Open-loop diagnostics.** Όταν δεν βρεθεί μικρό κλειστό loop κοντά στο pick αλλά υπάρχει
ανοιχτή αλυσίδα, highlight τα ασύνδετα άκρα (Revit-style «these lines don't connect»).

**Σειρά υλοποίησης (προτεινόμενη):** Layer 1 (μέγιστο όφελος/ελάχιστο ρίσκο) → Layer 4 (ασφάλεια) →
Layer 2 (ανάκτηση intent) → Layer 3 (UX) → Layer 5 (diagnostics). Κάθε layer αυτοτελές + testable.

---

## 5) ΧΑΡΤΗΣ ΑΡΧΕΙΩΝ (entry points)
| Αρχείο | Ρόλος / Layer |
|---|---|
| `src/subapps/dxf-viewer/hooks/drawing/use-column-perimeter-commit.ts` | click-inside filter — **Layer 1** (γρ. 87, 167) |
| `src/subapps/dxf-viewer/bim/walls/perimeter-from-faces.ts` | **SSoT** face/loop detection — **Layer 2** (κοινό με τοίχους) |
| `src/subapps/dxf-viewer/bim/walls/perimeter-polygon-math.ts` | polygon math (area/containment helpers) |
| `src/subapps/dxf-viewer/bim/columns/column-from-faces.ts` | builders — **Layer 4** sanity guard |
| `src/subapps/dxf-viewer/bim/columns/column-perimeter-confirm-store.ts` | confirm dialogs — **Layer 3** preview |
| `src/subapps/dxf-viewer/bim/walls/wall-in-region.ts` | **mirror bug** «τοίχοι σε περιοχή» — ίδιο SSoT fix |
| `src/subapps/dxf-viewer/config/tolerance-config.ts` | `TOLERANCE_CONFIG` SSoT (gap tolerance εδώ) |
| `src/subapps/dxf-viewer/utils/geometry/GeometryUtils.ts` | `isPointInPolygon` (+ νέο smallest-containing helper) |

**ADRs:** ADR-363 (bim-drawing-mode, §6 «από περίγραμμα»), ADR-419 (column-in-region). Διάβασέ τα + update changelog (N.0.1).

---

## 6) ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ
- 🌐 ΠΑΝΤΑ Ελληνικά. ⚠️ Commit/push ΜΟΝΟ ο Giorgio. ⚠️ Κοινό tree → `git add` μόνο δικά σου, ΠΟΤΕ `-A`.
- **ADR-driven (N.0.1):** διάβασε τρέχοντα κώδικα → σύγκρινε με ADR-363/419 → update ADR → υλοποίησε → re-update.
- **N.8 execution mode:** ~8-12 αρχεία/1 domain → Plan Mode (μπες μόνος σου).
- **N.17:** ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος πριν ξεκινήσεις.
- **N.11:** μηδέν hardcoded strings — keys στο i18n (el+en) πρώτα.
- **Tests:** unit για smallest-containing + gap-closure + sanity guard (mirror των `column-from-faces-discrete.test.ts`, `perimeter-from-faces.test.ts`).
- **N.15:** update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR + adr-index μετά την υλοποίηση (το adr-index ίσως το πειράζει ο άλλος agent — συντόνισε).

---

## 7) ΕΚΤΟΣ SCOPE (μην τα αγγίξεις)
- Οτιδήποτε floorplan-replace (`StepUpload.tsx`, `bim-floor-wipe.service.ts`, `floorplan-floor-wipe.service.ts` κ.λπ.) — άλλη συνεδρία, pending commit του Giorgio.
- Drainage / heating / opening-types / mep-manifold — codex agent.
