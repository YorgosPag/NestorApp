# ADR-559 — Όριο πλήθους επιλογής για εμφάνιση λαβών (AutoCAD `GRIPOBJLIMIT`)

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED) — 🔴 browser-verify εκκρεμεί
**Date:** 2026-06-30
**Domain:** DXF Viewer / Grips & Settings / 2D canvas + 3D BIM viewport
**Related:** ADR-183 (Unified Grip System / grip-registry), ADR-048 (UnifiedGripRenderer — μοναδικός grip renderer), ADR-034 (centralized validation bounds), ADR-040 (preview-canvas micro-leaf / event-time getters, zero React state), ADR-535/ADR-537/ADR-543 (3D reshape grips — BIM footprint + raw DXF seater)

---

## 1. Πρόβλημα

Όταν επιλέγονται **πολλές** οντότητες (γραμμές κ.λπ.), ο grip producer υπολογίζει και ζωγραφίζει λαβές για **όλες** — σε μεγάλα selection sets αυτό είναι ακριβό (υπολογισμός + render ανά frame). Οι μεγάλοι παίκτες (AutoCAD) το λύνουν με ρητό **system variable `GRIPOBJLIMIT`**:

- **Default = `100`** (range `0`–`32767`).
- Πάνω από το όριο **πλήθους επιλεγμένων αντικειμένων**, **καταστέλλεται η εμφάνιση ΟΛΩΝ των λαβών**.
- Τα αντικείμενα **παραμένουν επιλεγμένα** — μόνο η οπτικοποίηση των grips σταματά (performance).
- **`0` = χωρίς όριο** (πάντα ορατές λαβές).

**Διακριτή έννοια από το `maxGripsPerEntity`** (default 50): εκείνο είναι ανώτατο πλήθος grips **ανά ΜΙΑ** οντότητα (π.χ. polyline με 1000 κορυφές). Το `gripObjLimit` αφορά το **πλήθος επιλεγμένων ΑΝΤΙΚΕΙΜΕΝΩΝ**. Και οι δύο υπάρχουν στον AutoCAD και συνυπάρχουν εδώ.

## 2. Απόφαση

Νέο configurable setting **`gripObjLimit`** (default **100**, clamp **0–32767**, `0`=unlimited), **mirror** του υπάρχοντος `maxGripsPerEntity` σε ΟΛΗ την υπάρχουσα grip-settings αλυσίδα SSoT — **μηδέν νέο store / νέο settings σύστημα**.

**ΕΝΑΣ κανόνας (SSoT predicate):** νέο pure
`hooks/grips/grip-obj-limit.ts → isGripObjLimitExceeded(selectedCount, gripObjLimit)`
= `gripObjLimit > 0 && selectedCount > gripObjLimit`. Το χρησιμοποιούν **και τα 3** grip producers (1× 2D + 2× 3D) ώστε ο κανόνας να ορίζεται **μία φορά** (όχι αποκλίνοντα αντίγραφα).

### Σημεία gate (preview ≡ commit, καμία αλλαγή στην επιλογή — μόνο στο render)

| Producer | Αρχείο | Μετρητής |
|---|---|---|
| 2D DXF + overlays | `hooks/grips/grip-registry.ts` (early return πριν τα loops) | `selectedEntityIds.length + selectedOverlays.length` |
| 3D raw-DXF (multi-select, ADR-543) | `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` → `seatGrips` | `eligibles.length` |
| 3D BIM footprint reshape | `bim-3d/animation/bim3d-grip-drag.ts` → `refreshReshapeGrips` | `entityIds.length` (single-select σήμερα — parity/future-proof) |

Τα 3D σημεία διαβάζουν το limit **event-time** μέσω `gripStyleStore.get().gripObjLimit` (ADR-040 getter, **όχι** subscription).

## 3. Settings chain (mirror του `maxGripsPerEntity`)

`config/validation-bounds-config.ts` (`GRIP_BOUNDS.OBJ_LIMIT {0,32767}` + `clampGripObjLimit`), `settings-core/types/domain.ts` (interface + `mergeGripSettings` default + clamp), `settings-core/defaults.ts`, `settings/FACTORY_DEFAULTS.ts`, `types/gripSettings.ts` (interface + default + `validateGripSettings` clamp), `rendering/types/Types.ts` (interface), `stores/GripStyleStore.ts` (`GripStyle` + init), `stores/grip-style-sync.ts` (forward → store), `adapters/ZustandToConsolidatedAdapter.ts` (read + write), `ui/hooks/useUnifiedSpecificSettings.ts` (preview mock + default).

**UI:** `ui/components/dxf-settings/settings/core/GripSettings.tsx` — `SliderInput` (0–1000 πρακτικό εύρος, `showNumberInput`· clamp εγγυάται μέχρι 32767 προγραμματιστικά). **`?? 100`** (όχι `|| 100`, γιατί `0` είναι έγκυρη τιμή = no limit). i18n key `settings.grip.labels.gripObjLimit` στα 3 locales (el/en/pseudo).

## 4. Έλεγχος

`hooks/grips/__tests__/grip-obj-limit.test.ts` — 7 jest: `<limit`/`===limit` ⇒ εμφάνιση, `>limit` ⇒ απόκρυψη, `0`/non-positive ⇒ ποτέ απόκρυψη, `GRIPOBJLIMIT=1` boundary, empty selection. ✅ 7/7.

## 5. Συνέπειες

- ✅ AutoCAD parity (default 100, `0`=unlimited), big-player practice, configurable από UI.
- ✅ Full SSoT: ΕΝΑΣ κανόνας (predicate), reuse όλης της settings chain, μηδέν νέο store.
- ⚠️ **Boy-Scout flag:** το grip-settings shape είναι ορισμένο **5×** ως ξεχωριστός τύπος + 6 default blocks (προϋπάρχον διπλότυπο). Πλήρης κεντρικοποίηση = large refactor → κατεγράφη στο `.claude-rules/pending-ratchet-work.md` (N.0.2), εκτός scope αυτού του task.
- 🔴 Εκκρεμεί browser-verify (2D πολλαπλή επιλογή >100 + 3D raw-DXF multi-select).

## Changelog

- **2026-06-30** — Αρχική υλοποίηση: setting `gripObjLimit` (default 100) + predicate SSoT + 3 gates (2D + 2×3D) + UI slider + i18n + 7 jest. UNCOMMITTED.
