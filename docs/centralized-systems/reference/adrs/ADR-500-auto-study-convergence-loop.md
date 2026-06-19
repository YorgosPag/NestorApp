# ADR-500 — «Αυτόματη Μελέτη»: ντετερμινιστικός βρόχος σύγκλισης (ADR-487 §7)

**Status:** 🟡 Slice 1 (core+loop+ribbon+report) — UNCOMMITTED 2026-06-19
**Date:** 2026-06-19
**Υλοποιεί:** ADR-487 §7 (μελλοντικός ορίζοντας Α — αυτο-διορθούμενη μελέτη / επαναληπτική σύγκλιση)
**Σχετικά:** ADR-459 (organism), ADR-464/489/497 (foundation), ADR-475/486/499 (auto-size), ADR-471/472/476/491 (reinforce), ADR-467 (load path), ADR-480/481/488 (analytical/FEM), ADR-485 (utilization), ADR-490 (warning overlay)

---

## 1. Πρόβλημα / Όραμα

Ο κανόνας «σε κάθε κίνηση» (ADR-487 §4) διορθώνει **τοπικά** (proactive hooks). Το §7 ζητά το επόμενο: ένα κουμπί **«Αυτόματη Μελέτη»** που μελετά **ολόκληρο τον όροφο μόνο του** με τον βρόχο **«δοκίμασε → έλεγξε → διόρθωσε → ξανά, μέχρι μηδέν κόκκινο»** (ή έως όριο γύρων → «εδώ χρειάζομαι εσένα»). **Ντετερμινιστικό** (EC2/EC7/EC8), **ΟΧΙ** machine learning (§7.1/§9).

## 2. Απόφαση

**ΔΕΝ φτιάχτηκε νέος engine.** Δημιουργήθηκε ένας **σύγχρονος, one-shot ντετερμινιστικός βρόχος** που **ενορχηστρώνει** τους υπάρχοντες SSoT cores σε σειρά:

```
runStructuralLoadTakedown  → φορτία (prereq, ΟΧΙ convergence driver)
runMemberAutoSize          → μεγάλωσε διατομές (geometry ΠΡΩΤΑ)
runOrganismAutoReinforce   → όπλισε (steel)
runAutoFoundationDesign    → διόρθωσε πέδιλα (μετά το column-N)
runOrganismDiagnostics     → re-derive ΣΥΓΧΡΟΝΑ → convergence signal
FEM solve (engaged-gated)  → refresh M/V/N για τον επόμενο γύρο (reuse)
```

Επανάληψη μέχρι: **μηδέν blocking diagnostics** (πλήρης σύγκλιση) **Ή** **καμία αλλαγή** (κόλλημα/ταλάντωση) **Ή** `MAX_STUDY_ROUNDS = 10` (§7.4 oscillation guard).

### 2.1 Δύο SSoT extractions (μηδέν διπλότυπο)

Το convergence signal (`StructuralDiagnosticsStore`) γράφεται **ασύγχρονα** (queueMicrotask) μέσα στο `useStructuralOrganism` → σύγχρονη ανάγνωση θα έδινε **stale** diagnostics. Επίσης η foundation re-design ζούσε ολόκληρη μέσα σε `useEffect`. Άρα — αντί duplication — βγήκαν σε SSoT πυρήνες (mirror του πώς βγήκαν τα `runOrganismAutoReinforce`/`runStructuralLoadTakedown`):

| NEW core | Από | Καλείται από |
|---|---|---|
| `hooks/structural-organism-core.ts` → `runOrganismDiagnostics(level,{storeyCount})` | `useStructuralOrganism` | ο hook (reactive) **+** ο loop (σύγχρονα) |
| `hooks/auto-foundation-design-core.ts` → `runAutoFoundationDesign(level,{user,exec})` | `useAutoFoundationDesign` | ο hook (reactive+toast) **+** ο loop (σύγχρονα) |

### 2.2 Atomic undo (§7.4 belt)

1η αλλαγή της μελέτης → `execute` (νέο undo entry)· **όλες** οι επόμενες → `executeGrouped` (`appendToLast`). Ο σύγχρονος βρόχος (ms) είναι εντός `mergeTimeWindow` → ΟΛΟΙ οι γύροι = **ΕΝΑ** `CompositeCommand` → **ΕΝΑ Ctrl+Z** αναιρεί όλη τη μελέτη. Δεν μολύνει προηγούμενο ιστορικό.

### 2.3 Exit-to-human (§7.4)

Αν μετά MAX μένουν blocking diagnostics → επιστρέφονται ως `remaining`. Ο hook εκδίδει warning toast «W θέματα χρειάζονται εσένα»· τα ίδια diagnostics τα δείχνει **ήδη** το ADR-490 overlay (**μηδέν νέο UI**).

### 2.4 FEM gating

Το FEM solve μέσα στον βρόχο τρέχει **μόνο όταν `isAnalysisEngaged`** (ADR-488 latch) — δεν ανάβει διαγράμματα μόνο του. Εκτός engaged → tributary fallback (όπως ο reactive `useProactiveStructuralAnalysis`). Reuse του SSoT solver `runStructuralAnalysis`, silent.

## 3. Αρχεία

**NEW:** `structural-organism-core.ts`, `auto-foundation-design-core.ts`, `structural-auto-study-core.ts` (`runAutoStudy` + `MAX_STUDY_ROUNDS`), `useStructuralAutoStudy.ts`, `__tests__/structural-auto-study-core.test.ts` (8 jest GREEN).
**MOD:** `useStructuralOrganism.ts` (delegate), `useAutoFoundationDesign.tsx` (delegate+toast), `foundation-write-scope.ts` (export `FoundationWriterUser`), `analyze-tab.ts` (κουμπί), `useDxfViewerCallbacks.ts` (action), `drawing-event-map-bim.ts` (`bim:auto-study-requested`), `DxfViewerContent.tsx` (mount), i18n el+en (`autoStudyOrganism`, `autoStudy.report/remaining`).

## 4. Κρίσιμα μαθήματα

- 🚨 **Κανένα νέο reactive trigger** (ADR-491/488): one-shot σύγχρονο command. Τα events των cores προγραμματίζουν reactive microtasks που τρέχουν **μετά** τον βρόχο — αλλά τότε όλα έχουν συγκλίνει → idempotent no-ops.
- 🚨 **Όριο γύρων υποχρεωτικό** + «no change → stop» (ταλάντωση Α↔Β).
- **Convergence signal = `StructuralDiagnosticsStore` (warning+error)**, ΟΧΙ νέος έλεγχος. Το `runFeasibilityChecks` (ADR-499 D) είναι ήδη μέσα → το «ανέφικτο» εμφανίζεται ως error → exit-to-human.
- **Bug στο handoff pseudocode:** το store γράφεται async → χρειάστηκε SSoT extraction για σύγχρονη ανάγνωση.

## 5. DEFER

- **Per-kind unique report** («6 κολώνες, 3 δοκάρια» §7.2): οι cores επιστρέφουν `number` (όχι ids-ανά-τύπο)· το report είναι **aggregate ανά ενέργεια** (sized/reinforced/footed, summed). Unique breakdown θα απαιτούσε αλλαγή return type των shared cores + tests.
- **Force-FEM στον βρόχο** ανεξάρτητα engaged (αν χρειαστεί full frame-action σύγκλιση χωρίς ανοιχτά διαγράμματα).

## 6. Επαλήθευση (pending)

Live DB (Firestore MCP `proj_12788b6a`): 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + πλάκα-πρόβολος ανεπαρκής → «Αυτόματη Μελέτη» → ≤10 γύροι αυτο-διόρθωσης μέχρι μηδέν κόκκινο· toast «N γύροι, X/Y/Z»· ΕΝΑ Ctrl+Z αναιρεί. 🔴 browser-verify + commit (Giorgio).

## 7. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία (Slice 1).** runAutoStudy convergence loop ενορχηστρώνοντας load/size/reinforce/footing/diagnostics cores· 2 SSoT extractions (organism+foundation)· atomic undo (execute→appendToLast)· exit-to-human μέσω ADR-490· FEM engaged-gated· ribbon «Αυτόματη Μελέτη»· 8 jest GREEN. |
