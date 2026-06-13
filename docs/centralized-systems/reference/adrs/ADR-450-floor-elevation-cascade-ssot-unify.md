# ADR-450 — Floor-elevation cascade + SSoT-unify «οροφή ορόφου» (Revit level-driven)

**Status:** 🟢 Implemented — pending browser-verify + commit (2026-06-13)
**Discipline:** Floors API · DXF Viewer · BIM storey datum · structural elevation SSoT
**Related:** ADR-448 (storey-aware DXF viewer — Phase 4/4b entity cascade, γειτονικό domain), ADR-441/401 (storey-aware beams + framing column→beam attach — το verify που αποκάλυψε τη ρίζα), ADR-369 (elevation convention §9 Q5), ADR-399 (floor-stack datum)

---

## 1. Context / Problem

Το ADR-441/401 (storey-aware beams + framing column→beam attach) είναι DONE & browser-verified. Κατά το verify, δοκάρια «από κάναβο» έβγαιναν `topElevation=3000` αντί 5000. **Δεν ήταν bug κώδικα** — ήταν **ασύμβατα δεδομένα ορόφων** συν **dual-source** για την «οροφή ορόφου»:

| Όροφος | elevation | height |
|--------|-----------|--------|
| 1ος (`flr_161aa890`) | 3 | 5 (ο χρήστης το άλλαξε) |
| 2ος (`flr_528ca26e`) | **6** (stale — έπρεπε 3+5=**8**) | 3 |

- **Κολώνα** → `resolveStoreyHeightMm` → `floor.height` = **5000** ✓
- **Δοκάρι** → `resolveStoreyCeilingElevationMm` → `nextFloorElevationMm − floorElevationMm` = (6−3)·1000 = **3000** ✗
- → αποκλίνουν· οι κολώνες (5000) attach-άρουν στα δοκάρια (3000) και τραβιούνται κάτω.

**Δύο ρίζες:**
1. **Δεν υπάρχει floor-elevation cascade σε αλλαγή `height`.** Υπήρχε μόνο client-side uniform-delta cascade σε αλλαγή `elevation` (`useFloorsTabState.handleSaveEdit`). Η αλλαγή ύψους του 1ου ορόφου δεν μετατόπιζε το `elevation` του 2ου → stale.
2. **Dual-source** «οροφή ορόφου»: κολώνα διαβάζει `floor.height`, δοκάρι/πλάκα διαβάζει το inter-floor gap. Ταυτίζονται μόνο όταν τα δεδομένα είναι συνεπή.

**Revit / big-player:** Τα Levels είναι το SSoT της κατακόρυφης θέσης. Αλλάζεις ύψος/elevation ενός level → τα από πάνω μετατοπίζονται (auto-stack). Το floor-to-floor height προκύπτει από τα Levels — μία πηγή.

## 2. Decision

### 2.1 Floor-elevation cascade (Revit level-driven) — §1

Invariant: `elevation[i+1] = elevation[i] + height[i]` για κάθε διαδοχικό ζεύγος ορόφων.

`src/app/api/floors/floor-elevation-cascade.service.ts` — `cascadeFloorElevations(db, buildingId, changedFloorId, companyId, updatedBy)`:
- Triggered server-side στο `handleUpdateFloor`, **μετά** τον entity cascade (`cascadeFloorHeightToEntities`), όταν αλλάζει το `height`.
- Φέρνει τους ορόφους του building (sorted by `number`), περπατά **από τον changed floor προς τα πάνω**, recompute `elev_next = elev_below + height_below` (μέτρα).
- **Self-healing** (absolute, όχι delta): διορθώνει stale upper elevations σε ένα pass.
- **Idempotent**: όροφος ήδη στο derived elevation → no write, no audit.
- **Lower floors** (number ≤ changed) δεν αγγίζονται ποτέ (datum μένει σταθερό).
- **ADR-195**: audit entry (`field: 'elevation'`) ανά μετατοπισμένο όροφο.

Belt-and-suspenders με τον entity cascade: εκείνος τεντώνει τα **entities** του changed ορόφου· αυτός re-stacks τους **ορόφους από πάνω**. Τα entities των επάνω ορόφων ακολουθούν αυτόματα στο render (multi-floor stack = floor.elevation), χωρίς re-cascade.

### 2.2 SSoT-unify «οροφή ορόφου» — §2

**ΕΝΑ resolver** που χρησιμοποιούν ΚΑΙ οι δύο τύποι → δομικά αδύνατο να ξαναποκλίνουν.

`systems/levels/storey-creation-defaults.ts`:
```ts
resolveStoreyCeilingRelativeMm(storey) = storey?.storeyHeightMm ?? null;
resolveStoreyHeightMm(o, f, s)          = o ?? resolveStoreyCeilingRelativeMm(s) ?? f;
resolveStoreyCeilingElevationMm(o, f, s)= o ?? resolveStoreyCeilingRelativeMm(s) ?? f;
```

**Canonical source = `floor.height`** (`storeyHeightMm`), ΟΧΙ το inter-floor gap. Γιατί:
1. **Robust σε stale upper-floor elevation** — η ακριβής ρίζα του bug (beam-top 3000 ενώ column 5000).
2. **Ταυτίζεται με τον server cascade** (`floor-height-cascade.service.ts`) που παράγει beam `topElevation` από `floor.height`, όχι gap.
3. **Σωστό σε missing intermediate floor** — ο όροφος έχει ένα height· το gap θα έδινε 2× height.

Μετά τον cascade (§2.1) ισχύει `gap === floor.height`, οπότε για συνεπή δεδομένα ταυτίζεται με τον παλιό gap τύπο → **μηδέν regression**.

### 2.3 Cosmetic — σωστό toast ανά κατηγορία — §3

`bim:columns-auto-attached` έδειχνε το wall key («Οι **τοίχοι** κόλλησαν…») στη δημιουργία κολωνών «από κάναβο». Νέα keys `attachToStructural.autoAttachedColumns` / `.autoAttachedStairs` (el+en)· οι column & stair listeners (`structural-attach-notifications.ts`) τα χρησιμοποιούν. Boy-Scout: ίδιο latent bug στα stairs.

## 3. Consequences

- ✅ Αλλαγή ύψους ορόφου → ΟΛΟ το πλαίσιο (entities + όροφοι από πάνω) ακολουθεί συνεπώς. Δεν ξανασπάει στην επόμενη αλλαγή.
- ✅ Κολώνα-top & δοκάρι/πλάκα-top resolve σε ΕΝΑ νούμερο — αδύνατη η δομική απόκλιση.
- ✅ Self-healing: παλιά stale δεδομένα διορθώνονται στο πρώτο επόμενο height-edit.
- ⚠️ Ο client-side uniform-delta elevation-cascade (`useFloorsTabState`, αλλαγή `elevation`) παραμένει ως ξεχωριστή πράξη (out of scope).

## 4. Files

**NEW:** `src/app/api/floors/floor-elevation-cascade.service.ts` (+ `__tests__/floor-elevation-cascade.service.test.ts`, 7 tests)
**MOD:** `src/app/api/floors/floors.handlers.ts` (call στον `handleUpdateFloor`)· `systems/levels/storey-creation-defaults.ts` (+`resolveStoreyCeilingRelativeMm`, delegate)· `__tests__/storey-creation-defaults.test.ts` (+4 unify tests)· `hooks/notifications/structural-attach-notifications.ts`· `i18n/locales/{el,en}/dxf-viewer-shell.json`

## 5. Verification

- Jest: 34/34 (cascade+resolver+entity-cascade regression) + 28/28 consumer (beam/slab/storey-ceiling/active-storey).
- Browser (project pagonis-87766, building bldg_1fa41c6d): άλλαξε `height` του 1ου ορόφου → ο 2ος `elevation` ακολουθεί αυτόματα (8 αν height=5· 7 αν height=4)· δοκάρια/κολώνες παραμένουν στο ίδιο ceiling.

## Changelog

- **2026-06-13** — Implemented §1 (floor-elevation cascade service + handler wiring + 7 tests), §2 (SSoT-unify `resolveStoreyCeilingRelativeMm` + delegation + 4 tests), §3 (column/stair attach toast keys el+en). Pending browser-verify + commit (Opus).
