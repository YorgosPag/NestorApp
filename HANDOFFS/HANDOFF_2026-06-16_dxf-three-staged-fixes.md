# HANDOFF — DXF Viewer: 3 σταδιακές διορθώσεις (μετά το ADR-462 verify)

**Ημερομηνία:** 2026-06-16
**Συντάκτης:** Opus 4.8 (συνεδρία ADR-462 canonical-mm browser-verify — μόλις ολοκληρώθηκε)
**Θέμα:** Τρία ανεξάρτητα θέματα στον DXF viewer, να διορθωθούν **ένα-ένα σταδιακά** (ο Giorgio το ζήτησε ρητά). **FULL ENTERPRISE + FULL SSoT + Revit-grade.**

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT/PUSH:** Ο Giorgio τα κάνει, ΟΧΙ εσύ (N.(-1)). ΠΟΤΕ `git add -A`.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent (cursor-lag / snap). `git add` ΜΟΝΟ δικά σου αρχεία. ΜΗΝ αγγίξεις: `ADR-040`, `canvas-v2/layer-canvas/LayerCanvas.tsx`, `systems/cursor/snap-scheduler.ts`, `HANDOFF_…cursor-lag…md`.
> ⚠️ **MODEL (N.14):** δήλωσε μοντέλο & περίμενε «ok» πριν από κάθε θέμα.
> ⚠️ **TSC (N.17):** ένα tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος.
> ⚠️ **i18n (N.11):** κάθε νέο `t('key')` → el ΚΑΙ en ΠΡΩΤΑ.
> ⚠️ **N.8:** κάθε θέμα = ξεχωριστό. Αξιολόγησε mode (simple/plan/orchestrator) ανά θέμα. ΜΗΝ τα κάνεις όλα μαζί.

---

## ΜΕΡΟΣ 0 — ΚΑΤΑΣΤΑΣΗ / ΕΚΚΡΕΜΟ COMMIT

**✅ ADR-462 Canonical-mm Phase 1 — DONE + BROWSER-VERIFIED (3/3), UNCOMMITTED.** 🔴 Μένει **μόνο commit** (όταν το πει ο Giorgio).
`git add` ΜΟΝΟ αυτά (shared tree):
```
src/subapps/dxf-viewer/utils/dxf-scene-builder.ts
src/subapps/dxf-viewer/utils/scene-units.ts
src/subapps/dxf-viewer/io/dxf-import.ts
src/subapps/dxf-viewer/workers/dxf-parser.worker.ts
src/subapps/dxf-viewer/utils/__tests__/canonical-mm-units.test.ts   (new)
docs/centralized-systems/reference/adrs/ADR-462-canonical-mm-units.md (new)
docs/centralized-systems/reference/adr-index.md                       (⚠️ MIXED — ΜΟΝΟ τη γραμμή 462)
```
Verify απόδειξη (Firestore): κολώνα `col_30b6a07d` → `sceneUnits:'mm'`, width/depth=400, footprint span ακριβώς 400mm, σε Ισόγειο-με-meter-DXF. Foundation import 35.4×28.6m σε mm. Μήκος μετρήθηκε 9750mm=9.75m ακριβές. Το «κολώνα μικροσκοπική» λύθηκε στη ρίζα.

---

## ΜΕΡΟΣ 1 — BASELINE ΒΑΣΗΣ (test data, ζωντανά)

- **company:** `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` («ΠΑΓΩΝΗΣ Ενεργειακή»). **user:** `WKBWEg3DSfcdSbLNJfzGEW3vkct1`.
- **project:** `proj_0df5af7a-1e3b-47ca-b5a9-01210dd9a353` · **building:** `bldg_b4d3cecb-6b93-4da0-8336-e8212ce60fae`.
- **files (2):** `file_eb1f8525` (Σ-1_ΞΥΛΟΤΥΠΟΣ_ΘΕΜΕΛΙΩΣΗΣ, bounds 35.4×28.6m) · `file_68717ab8` (_AfrPolGD, Ισόγειο, bounds 21×15m). Και τα δύο `units:'mm'`.
- **floorplan_columns (1):** `col_30b6a07d` (40×40, sceneUnits mm) σε floor `flr_9fd4c003`.
- **Επίπεδα (από UI):** Επίπεδο 1 (default/κενό) · Κάτοψη Ορόφου «F» (265 στ. = θεμελίωση) · Απόληξη Κλιμακοστασίου (κενό) · 1ος Όροφος (1 στ.) · Κάτοψη Ορόφου «Ισόγειο» (842 στ.) · 2ος Όροφος (κενό).
- Firestore MCP διαθέσιμο για diagnosis.

---

## ΜΕΡΟΣ 2 — ΤΑ 3 ΘΕΜΑΤΑ (σειρά προτεραιότητας)

### 🔴 ΘΕΜΑ 1 (ΠΡΩΤΟ — blocker): Infinite render loop

**Σύμπτωμα:** Console error `[Enterprise] INFINITE LOOP DETECTED! Render count: 101` στο
`src/subapps/dxf-viewer/settings-provider/EnterpriseDxfSettingsProvider.tsx:179` (render-counter guard, `RENDER_LOOP_THRESHOLD`).

**Προκαταρκτική διάγνωση (Opus, ΑΝΑΓΝΩΣΗ μόνο — ΟΧΙ confirmed):**
- Εύθραυστο subsystem με ιστορικό (5+ σχόλια «prevents infinite loops»). **Όχι** δικό μου, **όχι** νέο (ADR-341, από 2026-05-08).
- **Πρώτος ύποπτος:** `settings-provider/storage/useUserSettingsRepoSync.ts` — δύο effects (hydrate ⟷ mirror-push) μοιράζονται ΕΝΑ `lastWrittenHashRef`. Αν το reducer `LOAD_SUCCESS` **κανονικοποιεί** τα settings (defaults/reorder keys), τότε `stableHash(state.settings)` ≠ `remoteHash` → το mirror effect (γρ. 82-91) ξανα-pushάρει → optimistic echo → subscribe callback (γρ. 51-72) → hydrate → **loop**.
- ⚠️ **ΔΥΟ διαφορετικές `stableHash` υλοποιήσεις** στο subsystem: `@/services/user-settings` (repo-sync) vs inline στο `useStorageSave.ts:28`. Αν δεν παράγουν ΙΔΙΟ hash για ΙΔΙΟ object → mismatch → loop. **ΕΛΕΓΞΕ το πρώτα.**
- Δευτερεύοντες ύποπτοι: `hooks/useEnterpriseSettingsState.ts` (μήπως το `LOAD_SUCCESS` φτιάχνει νέο object κάθε φορά), `storage/useStorageLoad.ts`, ο `useEffect` με `[syncDeps, state.isLoaded]` (γρ. 264-285 — αν ο γονιός περνά νέο `syncDeps` object κάθε render).
- Ποιος ενεργοποιεί `enabled=true` + `syncDeps`; (default `enabled=false`). Βρες τον caller (`DxfViewerApp.tsx:75`).

**🚨 REPRO (ΖΗΤΑ ΤΟΝ GIORGIO ΠΡΩΤΑ — feedback_confirm_repro_before_reimplementing):** ποια ενέργεια το πυροδοτεί; (boot viewer; αλλαγή ορόφου; άνοιγμα Ρυθμίσεων DXF;) ΜΗΝ διορθώσεις στα τυφλά εύθραυστο subsystem.

**Πιθανή λύση (αφού confirm repro):** ΕΝΑ SSoT `stableHash` (αφαίρεσε το διπλό), + κάνε το reducer `LOAD_SUCCESS` idempotent (skip dispatch αν deep-equal με υπάρχον state), + ξεχωριστά `lastWrittenHashRef` ή hash-normalization πριν τη σύγκριση. Mode: Plan (≥3-5 αρχεία, 1 domain).

---

### 🟡 ΘΕΜΑ 2: Στάθμες δεν φαίνονται πάντα (storey navigation strip)

**Σύμπτωμα (Giorgio):** «Κάτω από το status bar δεν φαίνονται πάντα οι στάθμες. Σε κάποιον όροφο φαίνονται, σε άλλους όχι.»

**Στοιχεία (screenshots 131920 + 131933 στο `C:\Nestor_Pagonis\`):**
- Η μπάρα σταθμών («Όλα οι όροφοι | Θεμελίωση | Ισόγειο | 1ος Όροφος | 2ος Όροφος κενός | Απόληξη Κλιμακοστασίου κενός») **εμφανίζεται** όταν είσαι σε όροφο-με-κάτοψη (screenshot 2).
- **ΔΕΝ εμφανίζεται** όταν είσαι σε «Επίπεδο 1» (default, κενό — screenshot 1).
- Υπόθεση: render gate που εξαρτάται από ενεργό storey/sceneFileId/content αντί να δείχνει ΠΑΝΤΑ τη strip.

**Domain:** ADR-461 (Special Levels) / ADR-448 (storey-aware DXF). **ΟΧΙ** ADR-462.
**Πρώτα βήματα:** Grep για το component της strip (π.χ. storey/level navigation bar κάτω από το status bar — ψάξε `components/dxf-layout/` + storey/level chips). Βρες το conditional render. Αποφάσισε Revit-grade: η strip πρέπει να φαίνεται ΠΑΝΤΑ (ή τουλάχιστον σε όλα τα building storeys + specials), ανεξαρτήτως αν το επίπεδο έχει κάτοψη. Mode: πιθανόν Simple/Plan.

---

### 🟢 ΘΕΜΑ 3: Display-unit wiring (μέτρα/cm αντί mm) — ΖΗΤΗΘΗΚΕ

**Σύμπτωμα (Giorgio):** μετράει σε mm (π.χ. `9749.96` / `9750`) ενώ σκέφτεται μέτρα (9.75 m).

**ΚΑΛΟ ΝΕΟ:** Υπάρχει **ΗΔΗ dropdown «cm»** στο κάτω-δεξιά status bar (φαίνεται στα screenshots). Άρα **ΔΕΝ** φτιάχνεις επιλογέα από το μηδέν — **συνδέεις** τον υπάρχοντα cm/m επιλογέα με:
- το **measure/ruler readout** (δείχνει raw mm τώρα),
- τα **dim labels** (`bim/labels/bim-dim-labels.ts` — `formatBimDimLabels`/`drawDimPill`/`drawEntityDimLabel`),
- το **move-readout** (`bim/labels/move-readout.ts`, wraps `formatDistanceLocale`).

**Πρώτα βήματα:** Grep για το υπάρχον unit dropdown («cm») στο status bar → βρες το state/store της display-unit preference. Μετά route το μέσα από ΕΝΑΝ SSoT formatter (μήπως υπάρχει ήδη `formatDistanceLocale`/scene-units helper). **Canonical-mm μένει αμετάβλητο** — αλλάζει ΜΟΝΟ η εμφάνιση (mm→m/cm στο format). Δες ADR-462 §4 DEFER (α). Mode: Plan (formatter + consumers).
**ΠΡΟΣΟΧΗ ADR-040:** dim labels/readouts είναι στο canvas render path — αν αγγίξεις render αρχεία, stage ADR/doc (CHECK 6D).

---

## ΜΕΡΟΣ 3 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff πλήρως.
2. PHASE 1 (N.0.1): re-read τα σχετικά αρχεία του ΘΕΜΑΤΟΣ που ξεκινάς (κώδικας=αλήθεια).
3. Δήλωσε μοντέλο & περίμενε «ok» (N.14).
4. **ΘΕΜΑ 1 ΠΡΩΤΟ** → ζήτα repro → διόρθωσε σταδιακά → browser-verify → επόμενο θέμα.
5. Μετά από κάθε θέμα: ενημέρωσε ADR + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15), στο ίδιο commit με τον κώδικα.
6. Όλα τα fixes UNCOMMITTED μέχρι ο Giorgio να πει «commit».
