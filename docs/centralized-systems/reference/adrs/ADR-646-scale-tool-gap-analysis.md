# ADR-646: Scale Tool — Ανάλυση Κενών & Χάρτης Ολοκλήρωσης

**Status:** 🟡 IN PROGRESS (Φάση 1 ✅ IMPLEMENTED 2026-07-13· Φάσεις 2-4 εκκρεμούν)
**Date:** 2026-07-12
**Domain:** DXF Viewer — Modify Tools
**Base:** [ADR-348](ADR-348-scale-command.md) (Scale Command)· σχετικά: ADR-418 (view-scale), ADR-625 (transform ghost preview SSoT)
**Shortcut:** `SC` · **Ribbon:** Home → Modify → Κλιμάκωση

---

## Context

Ο Giorgio ζήτησε (2026-07-12) audit «τι λείπει από το Scale». Το εργαλείο υπάρχει (ADR-348)
και καλύπτει τον πυρήνα, αλλά η **έρευνα στον κώδικα** (όχι στο ADR) αποκάλυψε αποκλίσεις από
(α) την ίδια την προδιαγραφή του ADR-348 και (β) τη συμπεριφορά των μεγάλων CAD (AutoCAD/BricsCAD).

> **Αρχή (N.0.1):** CODE = SOURCE OF TRUTH. Όπου το ADR-348 λέει «✅ Live preview during mouse
> drag» ενώ ο κώδικας δεν κλειδώνει τον συντελεστή με κλικ, **ισχύει ο κώδικας** — το ADR-348 ήταν
> aspirational σε αυτό το σημείο.

Αυτό το ADR καταγράφει την **τρέχουσα πραγματική κατάσταση**, τα **κενά με σειρά σημασίας**
(σύμπτωμα → ρίζα με `file:line` → βιομηχανική προσδοκία → σκίτσο διόρθωσης), και έναν **χάρτη
υλοποίησης** για την επόμενη συνεδρία. **Καμία αλλαγή κώδικα σε αυτή τη φάση.**

---

## Τρέχουσα κατάσταση — τι δουλεύει (verified in code)

| Δυνατότητα | Πηγή |
|---|---|
| FSM `idle→selecting→base_point→scale_input` | `hooks/tools/useScaleTool.ts` |
| Uniform + Non-uniform (πλήκτρο `N`) | `useScaleTool.ts` `dispatchScaleKey` |
| Copy mode (`C`) — κλώνοι, originals άθικτα | `core/commands/entity-commands/ScaleEntityCommand.ts` |
| Reference mode (`R`) — uniform & non-uniform (πληκτρολογημένο) | `useScaleTool.ts` `handleEnterConfirm` + `systems/scale/scale-reference-calc.ts` |
| Numeric buffer + Enter, αρνητικός συντελεστής (mirror+scale) | `dispatchScaleKey` (leading `-`) |
| Live ghost preview + tooltip `×factor` | `hooks/tools/useScalePreview.ts` (μέσω ADR-625 skeleton) |
| Κλείδωμα κλειδωμένων layers (skip + μήνυμα) | `useScaleTool.ts` `filterLockedEntities` |
| Grip handoff (pre-seeded base + reference vector) | `useScaleTool.ts` `onActivate` + `GripHandoffStore` |
| Undo/redo/serialize | `ScaleEntityCommand` (extends `SnapshotTransformCommand`) |
| Per-entity transform: line, circle→ellipse, ellipse, polyline/lwpolyline, spline, text, mtext, point, leader, dimension, hatch, rect, block(INSERT), group | `systems/scale/scale-entity-transform.ts` (SSoT) |

---

## Κενά (με σειρά σημασίας)

### 🔴 #1 — Δεν κλειδώνεις τον συντελεστή με ΚΛΙΚ (pick 2ου σημείου) — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13)
- **Σύμπτωμα:** Scale → κλικ σημείο βάσης → κουνάς το ποντίκι, βλέπεις ghost + tooltip `×1.234` →
  **κλικ για κλείδωμα → δεν γίνεται τίποτα.** Δουλεύει ΜΟΝΟ με πληκτρολόγηση αριθμού + Enter.
- **Ρίζα:** `useScaleTool.ts` `handleScaleClick` (γρ. 185-197) → σε φάση `scale_input` καλεί
  `routeReferenceClick` (γρ. 238-245), που έχει case ΜΟΝΟ για `ref_p1_*`/`ref_p2_*` — για `direct`
  κάνει **no-op**. Το click είναι συνδεδεμένο (`hooks/canvas/useCanvasClickHandler.ts:195`), απλώς
  αγνοείται.
- **Δευτερεύον:** ο live συντελεστής = `dist / 100` (hardcoded 100 — αυθαίρετο), `useScalePreview.ts`
  `computeLiveScale` (γρ. 39), αντί για ratio ως προς την πρώτη θέση cursor.
- **Προσδοκία (AutoCAD/BricsCAD + ADR-348 §Industry «Live preview during mouse drag ✅»):** μετά το
  σημείο βάσης, κλικ 2ου σημείου κλειδώνει `factor = dist(base,pt) / refDist`.
- **Fix sketch:** στο `routeReferenceClick` (ή στο `handleScaleClick`) πρόσθεσε case `direct` →
  `executeScale(live, live)` με το ΙΔΙΟ `computeLiveScale`· κάνε το `computeLiveScale` το SSoT
  (μοιράζεται preview + commit) και όρισε το reference distance ρητά (πρώτο mouse-move δείγμα ή
  σταθερό world ref), όχι hardcoded 100.

### 🔴 #2 — Reference mode: δεν δείχνεις το «νέο μήκος» με κλικ — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13)
- **Σύμπτωμα:** στη φάση `ref_new_x`/`ref_new_y` μπορείς μόνο να **πληκτρολογήσεις** μήκος· κλικ = no-op.
- **Ρίζα:** ίδια (`routeReferenceClick` χωρίς case `ref_new_*`).
- **Προσδοκία:** ο AutoCAD επιτρέπει pick σημείου για το νέο μήκος (μετρά απόσταση base→pick).
- **Fix sketch:** case `ref_new_x`/`ref_new_y` → μήκος = `dist(base, pt)` → `computeUniformRef(...)`.

### 🟠 #3 — BIM & άλλες οντότητες = σιωπηλό no-op
- **Σύμπτωμα:** κλιμάκωση σε τοίχο/κολώνα/δοκό/πλάκα/σκάλα/πέδιλο/εικόνα/array/region/scale-bar/
  σύμβολα → **τίποτα**, χωρίς μήνυμα.
- **Ρίζα:** `scale-entity-transform.ts` `scaleEntity` `default: {}` (γρ. 243-244).
- **Απόφαση προς λήψη:** για parametric BIM ίσως σκόπιμο (η κλιμάκωση δεν έχει νόημα σε type-driven
  στοιχεία) — αλλά τότε χρειάζεται **ρητό μήνυμα** «η κλιμάκωση δεν υποστηρίζεται για {type}» +
  filtering (mirror του `filterLockedEntities`). Εναλλακτικά, υποστήριξη επιλεγμένων τύπων (image/
  array/scale-bar) που έχουν καθαρή γεωμετρική έννοια.

### 🟠 #4 — Τόξο (arc) σε non-uniform = γεωμετρικά λάθος
- **Σύμπτωμα:** non-uniform scale σε τόξο → λάθος σχήμα.
- **Ρίζα:** `scale-entity-transform.ts` `scaleArc` (γρ. 41-47) — σε non-uniform **αγνοεί το `sy`**,
  κλιμακώνει radius μόνο με `|sx|`· το τόξο **δεν** μετατρέπεται σε ελλειπτικό (ο κύκλος→έλλειψη
  γίνεται σωστά μέσω `scaleCircleToEllipse`, το arc→elliptical-arc **όχι** — το σχόλιο το παραδέχεται).
- **Fix sketch:** non-uniform arc → `elliptical-arc` (ή τουλάχιστον σωστή προσέγγιση), ανάλογα με το
  αν υπάρχει τύπος «elliptical-arc» στο σύστημα· αλλιώς τεκμηρίωσε το ως γνωστό όριο.

### 🟡 #5 — Rectangle: αγνοείται η περιστροφή
- **Ρίζα:** `scale-entity-transform.ts` `scaleRectangle` (γρ. 156-169) — χρησιμοποιεί x/y/width/height
  χωρίς `rotation` → non-uniform scale σε **στραμμένο** ορθογώνιο βγαίνει λάθος (η non-uniform
  παραμόρφωση πρέπει να γίνει στο τοπικό στραμμένο πλαίσιο, ή το rect να «ψηθεί» σε polyline).

### 🟡 #6 — Καμία οπτική βοήθεια UI
- Μόνο command-line στιλ (πληκτρολόγηση + `tool-hints`). Δεν υπάρχει on-screen numeric box, presets
  (×2 / ×0.5), ούτε ένδειξη ότι υπάρχουν τα `C`/`R`/`N`. Ο χρήστης δεν τα ανακαλύπτει.
- **Fix sketch:** contextual ribbon tab ή status-bar options (mirror άλλων modify tools) με κουμπιά
  Copy/Reference/Non-uniform + πεδίο συντελεστή.

### 🟢 #7 — Dead code (minor)
- `systems/scale/scale-reference-calc.ts` `computeNonUniformRef` **δεν χρησιμοποιείται** (ο tool καλεί
  `computeUniformRef` ×2 ανά άξονα). Είτε κατανάλωσέ το είτε αφαίρεσέ το (dead-code ratchet).

---

## Χάρτης Υλοποίησης (επόμενη συνεδρία)

**Φάση 1 — Interactive scaling (το ζουμί· #1 + #2).** Το preview ήδη υπολογίζει τον συντελεστή· λείπει
μόνο το click-commit + σωστό ratio. Ένα SSoT `computeLiveScale` για preview & commit· cases `direct`
και `ref_new_*` στο click routing. *(1-2 αρχεία, χαμηλό ρίσκο.)*

**Φάση 2 — Ασφαλής μεταχείριση μη-υποστηριζόμενων (#3).** Filtering + ρητό μήνυμα για BIM/λοιπά αντί
σιωπηλού no-op (απόφαση Giorgio: skip-with-message ή partial support).

**Φάση 3 — Γεωμετρική ορθότητα (#4, #5).** Arc→elliptical-arc σε non-uniform· rectangle rotation-aware
(ή bake σε polyline).

**Φάση 4 — UI affordance (#6) + καθαρισμός (#7).** Contextual controls για C/R/N + συντελεστή·
κατανάλωση/αφαίρεση `computeNonUniformRef`.

*(Κάθε φάση ξεχωριστή συνεδρία ≤70% context· ADR-driven, ADR-348 + αυτό το ADR ενημερώνονται ίδιο commit.)*

---

## Consequences

- **Θετικά:** το πιο ορατό κενό (#1) είναι μικρό σε προσπάθεια αλλά μεγάλο σε UX — φέρνει το εργαλείο
  σε parity με AutoCAD «drag-to-scale». Η καταγραφή αποτρέπει επανα-ανακάλυψη των ίδιων gaps.
- **Ρίσκα:** το #3 (BIM) είναι σχεδιαστική απόφαση, όχι απλό bug — χρειάζεται έγκριση Giorgio πριν
  επιλεγεί skip-with-message vs partial support.
- **SSoT:** κάθε διόρθωση περνά από τα υπάρχοντα SSoT (`scale-entity-transform`, `scale-reference-calc`,
  `useScalePreview`) — καμία νέα math/command class.

## Changelog

- **2026-07-13** — **Φάση 1 IMPLEMENTED** (#1 click-to-scale + #2 reference-pick). Νέο SSoT
  `computeLiveScale` στο `scale-reference-calc.ts` (moved από `useScalePreview.ts`) — ο live συντελεστής
  είναι πλέον **λόγος** ως προς το πρώτο cursor sample μετά το σημείο βάσης (`ScaleToolStore.dragRefPoint`,
  captured στο preview με guard `>1e-6`), όχι το hardcoded `dist/100`. Το preview tooltip, τα WYSIWYG
  copies **και** το click-commit μοιράζονται τον ΙΔΙΟ συντελεστή (μηδέν divergence). `handleScaleClick`:
  case `direct` → `executeScale(live, live)` (αγνοείται αν δεν έχει στηθεί drag reference)· cases
  `ref_new_x`/`ref_new_y` → νέο μήκος = `dist(base, pt)` → shared `confirmRefNewX`/`confirmRefNewY`
  (extracted, καλούνται και από typed-Enter και από click — SSoT, μηδέν clone/jscpd). Files: `ScaleToolStore.ts`,
  `scale-reference-calc.ts`, `useScalePreview.ts`, `useScaleTool.ts` + 2 test suites (15 tests). Φάσεις 2-4 εκκρεμούν.
- **2026-07-12** — Δημιουργία (findings-only). Audit του Scale tool κατόπιν αιτήματος Giorgio· 7 κενά
  εντοπισμένα στον κώδικα (verified `file:line`), ταξινομημένα, με 4-φασικό roadmap. Καμία αλλαγή κώδικα.
