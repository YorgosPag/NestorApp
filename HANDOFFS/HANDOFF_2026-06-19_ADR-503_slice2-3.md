# HANDOFF — ADR-503 Slice 2 (safety-gated lock) + Slice 3 (organism-wide two-way)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` §4 (live αυτο-διόρθωση) + §5 (δυναμική επανα-διαστασιολόγηση) + **§8.4** (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί). Μετά: `ADR-503-two-way-auto-size-safety-gated-lock.md`.

**Ημ/νία:** 2026-06-19 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **Μοντέλο:** Opus (`/model opus`) · **PLAN-FIRST** (plan σε slices → «προχώρα» → κώδικας).
**🚨 commit + tsc = ο GIORGIO. jest = repo ROOT. Επαλήθευση: live DB Firestore MCP `proj_12788b6a`.**
**⚠️ SHARED TREE:** `git add` ΜΟΝΟ τα δικά σου. ΜΗΝ αγγίξεις ADR-496 (`bim/columns/column-beam-align*`) ούτε ADR-483 (`bim-3d/diagrams/*`). Νέο ADR = ήδη **ADR-503** (συνέχισέ το, ΜΗΝ νέο νούμερο).

---

## 0. ΑΠΟΦΑΣΕΙΣ GIORGIO (παγωμένες — verbatim)

«Η εφαρμογή πρέπει να είναι έξυπνη → να αλλάζει αυτόματα διατομές+οπλισμό κολωνών ώστε μηδέν υπο-διαστασιολόγηση (ανασφαλές) ΚΑΙ μηδέν υπερ-διαστασιολόγηση (σπατάλη υλικού/χρήματος). Ο αρχιτέκτονας βάζει default χωρίς να ξέρει στατικά.»

- **Q1 = Two-way** (μεγαλώνει + μικραίνει). → **Slice 1 DONE** (κολώνα).
- **Q2 = Lock υποδιαστασιολογημένης → ΜΠΛΟΚΑΡΕΤΑΙ ΕΝΤΕΛΩΣ** (μένει AUTO ώσπου να γίνει ασφαλής). Invariant: **καμία persisted οντότητα ποτέ κάτω από το επαρκές**. (Over-dimensioned lock = επιτρέπεται, η επιλογή του μηχανικού.)

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Slice 1, UNCOMMITTED)

`bim/structural/sizing/column-sizing.ts`: `suggestColumnSection` → two-way (ελάχιστο επαρκές `s×s`, αφαίρεση grow-only `Math.max`). NEW `MAX_AXIAL_LOAD_RATIO=0.65` (EC8 §5.4.3.2.1 DCM)· `columnSectionFits` τεστάρει τετράγωνη `s×s` + 2 πύλες (ν≤0.65 + οπλισμός). Square-only v1 (μη-τετράγωνες grow-only). Live-verified: 400×400 + φορτίο→300×300. 11 jest + column-size-patch updated. (git add: `column-sizing.ts`, `__tests__/column-sizing.test.ts`, `__tests__/column-size-patch.test.ts`, ADR-503, adr-index.)

## 2. SLICE 2 — Safety-gated lock (κολώνα)

**Στόχος:** όταν ο μηχανικός αλλάζει ΧΕΙΡΟΚΙΝΗΤΑ διατομή κολώνας: manual **≥ επαρκές** → lock OK (`autoSized:false`)· manual **< επαρκές** → **ΜΠΛΟΚ** (μένει AUTO, το σύστημα κρατά το ελάχιστο επαρκές + διακριτικό μήνυμα).

**SSoT AUDIT (confirmed grep 2026-06-19 — ΞΑΝΑ-grep):**
- Το lock-on-manual-section-edit (`autoSized:false`) υπάρχει **ΜΟΝΟ για δοκάρια**: `hooks/grips/grip-parametric-commits.ts:333` → `sectionChanged ? {...newParams, autoSized:false} : newParams` (UpdateBeamParamsCommand). **Mirror αυτό για κολώνες.**
- Κολώνα manual edit σημεία: (α) grip section drag (grip-parametric-commits — βρες το column branch· ίσως λείπει), (β) ribbon/panel (`useColumnParamsDispatcher` / `ui/column-advanced-panel/` — βλ. MEMORY `reference_column_properties_palette_ssot`). Grep: `UpdateColumnParamsCommand`, `useColumnParamsDispatcher`.
- `isColumnAutoSized(params)` + `buildColumnSizePatch` ήδη στο `sizing/column-size-patch.ts`.

**Σχέδιο:**
1. NEW pure `isColumnSectionAdequate(provider, params, designMoment)` στο `column-sizing.ts` (reuse `suggestColumnSection`: αν `suggested.widthMm > params.width || depth>...` → υποδιαστασιολογημένη). Επιστρέφει `{adequate, minWidthMm, minDepthMm}`.
2. Στο σημείο manual column section edit: αν adequate → `autoSized:false` (mirror δοκαριού)· αλλιώς → **ΜΗΝ** set `autoSized:false` (μένει AUTO) + κράτα/δείξε το ελάχιστο επαρκές + toast/μήνυμα i18n (el+en) «η διατομή Χ×Υ είναι ανεπαρκής — κράτησα Α×Β».
3. i18n keys σε `src/i18n/locales/{el,en}/*.json` ΠΡΩΤΑ (CLAUDE.md N.11).
- **Jest:** manual 500×500 (επαρκές) → lock OK· manual 200×200 (ανεπαρκές, < MIN ή < adequate) → μένει AUTO + δεν κλειδώνει.

## 3. SLICE 3 — Organism-wide two-way + gate

Ίδιο two-way + lock-gate σε:
- **Δοκό:** `sizing/member-sizing.ts` `suggestBeamSection` (έλεγξε αν grow-only → κάν' το two-way· lock ήδη στο grip-parametric-commits:333).
- **Πλάκα:** `sizing/slab-sizing.ts` `suggestSlabThickness`.
- **Πέδιλο:** auto-foundation (A_req=N/σ ήδη two-way συνεχές· πρόσθεσε μόνο το lock-gate αν χρειάζεται).
- Κοινός helper `isMemberSectionAdequate` αν προκύψει κοινό pattern (N.0.2).

## 4. ΚΡΙΣΙΜΑ ΜΑΘΗΜΑΤΑ

- 🚨 **Two-way shrink ΧΩΡΙΣ έλεγχο επάρκειας πλήρη = παραβίαση κανονισμού.** Στην κολώνα η πύλη ήταν ν (EC8). Στη δοκό/πλάκα η πύλη είναι βέλος (serviceability L/d) + κάμψη/διάτμηση — βεβαιώσου ότι το «ελάχιστο επαρκές» τις περιλαμβάνει ΟΛΕΣ πριν μικρύνεις.
- 🚨 **Convergence:** κάθε two-way sizer πρέπει idempotent (ίδιο input→ίδιο output→μηδέν patch). Το 50mm/module quantization + `*MateriallyDiffers` guard το κλείνει.
- **Μη-τετράγωνες κολώνες** = grow-only (proportional shrink DEFER). Μην τις squareίσεις.
- GOL: ≤40γρ/func, ≤500γρ/file, μηδέν `any`, i18n πρώτα.

## 5. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB proj_12788b6a)
Μοντέλο: 2 κολώνες 400×400 + 2 πέδιλα + δοκάρι + πλάκα-πρόβολος. Με ADR-502+503 η κολώνα έχει appliedLoad dead≈430/live≈105 → two-way προτείνει 300×300. **Slice 2 test:** βάλε χειροκίνητα 200×200 → να μπλοκάρει (μένει ≥ επαρκές). Βάλε 500×500 → να κλειδώνει (lock OK).

## 6. PRE-EXISTING jest fails (ΟΧΙ δικά σου): 6 raft (ADR-476 `maxFreeSpanM` σε `section-context.ts:464`) + 1 `AssignWallTypeCommand` undo. (stash-confirmed baseline.)
