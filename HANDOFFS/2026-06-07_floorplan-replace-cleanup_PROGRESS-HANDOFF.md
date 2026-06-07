# HANDOFF — Floorplan REPLACE (BIM+BOQ cleanup): τι έγινε & τι έμεινε

> **Ημερομηνία:** 2026-06-07 (βράδυ) · **Μοντέλο:** Opus 4.8 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά
> **Commit:** ΜΟΝΟ ο Giorgio (N.(-1)). ⚠️ **Working tree ΚΟΙΝΟ με άλλον agent** (ADR-421 opening types + mep-manifold) — άγγιξε ΜΟΝΟ τα δικά μου αρχεία.
> Συνέχεια του `HANDOFFS/2026-06-07_floorplan-replace-cleanup.md`.

---

## 1) ΣΤΟΧΟΣ
Στον wizard «Εισαγωγή Κάτοψης», όταν ανεβαίνει νέα κάτοψη σε όροφο που ΕΧΕΙ ήδη κάτοψη + BIM:
προειδοποίηση + (σε replace) πλήρης διαγραφή ΟΛΩΝ (DXF + BIM + BOQ) από DB & Storage **χωρίς orphans**.

**Απόφαση Giorgio:** το dialog δίνει 2 επιλογές — «Διατήρηση BIM» (default, σέβεται ADR-420 re-import) vs «Διαγραφή όλων (BIM + μετρήσεις)».

---

## 2) ΚΑΤΑΣΤΑΣΗ ΥΛΟΠΟΙΗΣΗΣ: 🟢 CODE DONE — 🔴 pending verify + commit
- **tsc:** exit 0 (δικά μου αρχεία) · **tests:** `bim-floor-wipe.service.test.ts` **6/6 PASS**
- **ADRs:** ADR-340 + ADR-420 changelog ενημερωμένα.
- **ΕΚΚΡΕΜΕΙ:** (α) ζωντανό verify replace (σενάρια Α/Β παρακάτω), (β) commit (Giorgio), (γ) N.15 (local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt / adr-index δεν τα άγγιξα — το adr-index το πειράζει ο άλλος agent).

---

## 3) ΤΙ ΕΚΑΝΑ — ΑΡΧΕΙΑ (ΔΙΚΑ ΜΟΥ, για commit)
**NEW:**
- `src/services/floorplan-background/bim-floor-wipe.service.ts` — `wipeBimForFloor()` + `countBimForFloor()`. Σβήνει τα 20 floor-scoped BIM collections by `floorId` + μόνο `source:'bim-auto'` BOQ (manual μένει). Best-effort per-entity `deleted` audit (μόνο για AuditEntityType που υπάρχουν στο union — railing/floor-finish/furniture/mep-radiator/mep-boiler ΔΕΝ είναι).
- `src/services/floorplan-background/firestore-batch-delete.ts` — shared chunked delete (ήταν duplicated 3×).
- `src/services/floorplan-background/__tests__/bim-floor-wipe.service.test.ts` — 6 tests.

**MODIFIED:**
- `src/config/firestore-collections.ts` — NEW SSoT `FLOOR_SCOPED_BIM_COLLECTIONS` (20 entity collections· ΟΧΙ catalogs bim_presets/materials/settings/family_types/stair_presets) + type.
- `src/services/floorplan-background/floorplan-floor-wipe.service.ts` — `WipeAllForFloorOptions.wipeBim` + audit· καλεί `wipeBimForFloor` όταν wipeBim· BIM/BOQ counts στο `preview()`· χρήση shared batch-delete.
- `src/services/floorplan-background/floorplan-cascade-delete.service.ts` — χρήση shared batch-delete (Boy Scout).
- `src/app/api/floorplans/wipe-floor/route.ts` — POST δέχεται `wipeBim`· pre-resolve performer name (`resolveUserDisplayName`) για audit.
- `src/features/floorplan-import/hooks/useFloorplanSmartUpload.ts` — `FloorWipePreview` += bim/boq counts· `SmartUploadOptions.wipeBim`· `wipeFloor(floorId, wipeBim)`.
- `src/features/floorplan-import/components/StepUpload.tsx` — 2-action dialog (Διατήρηση/Διαγραφή όλων, μόνο αν hasBim)· counts σε banner+dialog· **race fix** (κανένα upload όσο `preview` φορτώνει· failed preview → ZERO_PREVIEW).
- `src/i18n/locales/{el,en}/files-media.json` — keys `floorplanImport.wipePreview.bimLine`, `wipeDialog.{bimWarning,keepBim,wipeBim}`.
- `docs/centralized-systems/reference/adrs/ADR-340-...md` + `ADR-420-...md` — changelog.

**⚠️ ΟΧΙ ΔΙΚΑ ΜΟΥ** (άλλος agent, στο ίδιο `git status` — ΜΗΝ τα commit-άρεις μαζί): `adr-index.md`, `mep-manifold*`, `grip*`, `opening-grips*`, `ifc-entity-mixin.ts`, `beam-hatch-patterns.ts`, `GripShapeRenderer.ts`, `ADR-421-*`, κ.λπ.

---

## 4) IDS / BASELINE (flr_ea148848)
- Company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · Project `proj_867d006a-e721-42ec-abdd-f351a80590ab` · Building `bldg_b139ab81-7998-4d4f-8259-55b4057b2884`
- 1ος Όροφος: **`flr_ea148848-8aed-49d8-b201-f2935e883f67`** · level `lvl_9ec374bf-d873-41da-8a25-904b42fe86e3`
- default level (dangling): `lvl_8099e96f-...` → `sceneFileId: file_9788c0a0` (ΔΕΝ υπάρχει — pre-existing)
- Ενεργό file (πριν το επόμενο replace): `file_7b26c257-2cdf-4321-a649-c52cfbec2163`

**Baseline counts (πριν το replace που θα κάνει ο Giorgio):**
walls **2** (wall_6840a520, wall_80166da1) · columns **2** (col_9d897e2a, col_c874b43f) · openings **1** (opening_71072467 Θ.101) · slabs **1** (slab_2488aa9b) · boq_items bim-auto **6** · files **1** · audit(wall) 2×created.

---

## 5) INCIDENTS ΤΗΣ ΣΥΝΕΔΡΙΑΣ (όλα εξηγημένα)
1. **Άδειος καμβάς #1** → αιτία: **BUILD ERROR άλλου agent** (`beam-hatch-patterns.ts` διπλός `buildAxisAlignedHatch`: import + local def). Όλος ο viewer JS νεκρός. **Διορθώθηκε από τον άλλον agent** (αφαίρεσε το local def· τώρα import-only από `polygon-utils.ts:444`).
2. **Συνέπεια:** ο `linkSceneToLevel` του wizard δεν έτρεξε μετά το (προηγούμενο) replace → `lvl_9ec374bf.sceneFileId` έμεινε **null** → άδειο level. **Repair:** έθεσα `sceneFileId=file_7b26c257` via Firestore MCP → ΕΠΑΝΗΛΘΕ.
3. **Άδειος καμβάς #2 (τώρα):** μετά το manual DB-set, **auto-save έγραψε ΑΔΕΙΑ σκηνή** (`file_7b26c257...scene.json`, 95B, 0 entities) και ξανα-έδειξε το file doc εκεί (revision 2). Γνωστό **sticky/cross-floor auto-save target** hazard (το default level «Επίπεδο 1» αυτο-αποθηκεύτηκε πάνω στο file). **Τα 3262 entities υπάρχουν ακόμα** στο `.dxf.processed.json`.

**ΚΡΙΣΙΜΟ ΤΕΧΝΙΚΟ ΕΥΡΗΜΑ:** `useLevelSceneLoader.ts:72,89` → η σκηνή φορτώνει **ΑΠΟΚΛΕΙΣΤΙΚΑ** από `level.sceneFileId`. **ΔΕΝ υπάρχει files-by-floor fallback.** Η παλιά σημείωση «sceneFileId null = by-design» ήταν **ΛΑΘΟΣ** (δούλευε μόνο από in-memory cache).

---

## 6) ΤΙ ΕΜΕΙΝΕ (επόμενα βήματα)
**Α. Ζωντανό verify — «Διαγραφή όλων (BIM + μετρήσεις)»** (ο Giorgio κάνει replace, εγώ ελέγχω delta με MCP):
- walls/columns/openings/slabs → **0** · boq_items bim-auto → **0** · manual boq (αν υπάρχουν) → μένουν
- παλιό `file_7b26c257` + **όλα τα `file_7b26c257*` (μαζί το stray `.scene.json`)** σβηστά → **μηδέν orphans** στο Storage
- νέο `file_*` + **ΜΗ-άδεια** σκηνή + `dxf_viewer_levels.sceneFileId` re-bound στο νέο
- audit: `deleted` entries (wall/column/opening/slab)

**Β. Ζωντανό verify — «Διατήρηση BIM»:** τα BIM μένουν, αλλάζει μόνο file/scene.

**Γ. Επιβεβαίωση warning/race:** το dialog ΕΜΦΑΝΙΖΕΤΑΙ (να μην ξανα-περάσει σιωπηλά).

**Δ. Επιβεβαίωση sceneFileId re-bind:** σε καθαρό replace (build OK) ο wizard να ξανα-δένει **μόνος του** το `sceneFileId`. Αν ΟΧΙ → πραγματικό bug να προσθέσω αξιόπιστο `linkSceneToLevel` στο replace flow (δικό μου scope).

**Ε. Commit** (Giorgio) — μόνο τα δικά μου αρχεία (§3). **ΣΤ. N.15** docs.

---

## 7) KNOWN ISSUES / FOLLOW-UPS (όχι μπλόκερ τώρα)
- 🐛 **Auto-save άδειας σκηνής** (sticky/cross-floor target): έγραψε empty `.scene.json` πάνω στο file μετά από level switch / manual bind. Αν επανεμφανιστεί ΜΕΤΑ από καθαρό replace → ξεχωριστό bug (πιθανώς ADR-399/293 περιοχή, ΟΧΙ δικό μου scope). Άξιο ξεχωριστού ticket.
- **Dangling default level** `lvl_8099e96f` → `file_9788c0a0` (δεν υπάρχει): pre-existing, χαμηλή προτεραιότητα (baseline note).
- **Γνωστό orphan storage tree** `proj_7d08ec31/flr_a376666d`: από project/floor DELETE cascade, ΟΧΙ από replace — ξεχωριστό.

---

## 8) ΚΑΝΟΝΕΣ
- 🌐 ΠΑΝΤΑ Ελληνικά. ⚠️ Commit/push ΜΟΝΟ ο Giorgio. ⚠️ Κοινό tree → μόνο τα §3 αρχεία. 100% ειλικρίνεια.
- Memory: `~/.claude/.../memory/project_floorplan_replace_bim_cleanup.md` (+ pointer στο MEMORY.md).
- Plan file: `~/.claude/plans/enchanted-bouncing-hippo.md`.
