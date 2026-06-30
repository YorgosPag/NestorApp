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

`config/validation-bounds-config.ts` (`GRIP_BOUNDS.OBJ_LIMIT {0,32767}` + `clampGripObjLimit`), `settings-core/types/domain.ts` (projection + `mergeGripSettings` default + clamp), `settings-core/defaults.ts`, `settings/FACTORY_DEFAULTS.ts`, `types/gripSettings.ts` (projection + default + `validateGripSettings` clamp), `rendering/types/Types.ts` (projection), `stores/GripStyleStore.ts` (`GripStyle` projection + init), `stores/grip-style-sync.ts` (forward → store), `adapters/ZustandToConsolidatedAdapter.ts` (read + write), `ui/hooks/useUnifiedSpecificSettings.ts` (preview mock + default).

## 3b. Canonical grip-settings SCHEMA (Giorgio SSoT order — Figma/Revit-level)

**Πρόβλημα που εντόπισε ο SSoT audit:** το grip-settings *shape* ήταν re-declared ως **8 ξεχωριστά interfaces** (5 «κανονικά» + 3 UI-local) → κάθε νέο field (όπως το `gripObjLimit`) έπρεπε να προστεθεί χειροκίνητα σε όλα.

**Λύση — ΕΝΑ schema + projections (composition, μηδέν αλλαγή τιμών/συμπεριφοράς):** νέο `types/grip-settings-schema.ts` ορίζει το shape **μία φορά**:
- `GripColors` (sentinel `cold:string|null`) / `ResolvedGripColors` (`cold:string`)
- `GripSettingsBase` (τα 14 stored fields — **εδώ μπαίνει κάθε νέο grip field**)
- `GripStyleExtras` (`showGripTips`/`dpiScale`) · `GripSettingsLegacyCompat` (legacy optional)
- `GripSettingsFull = Base & Extras & Legacy & {colors:GripColors}` (input DTO)

Οι **5** τύποι έγιναν **projections** (όχι re-declarations): `domain GripSettings = Base & {colors:GripColors}` · input DTO (`gripSettings.ts`, `rendering/Types.ts`) = `GripSettingsFull` (εξαλείφει το μεταξύ-τους διπλότυπο) · `GripStyle = Base & Extras & {colors:ResolvedGripColors}` · `MockGripSettings = Omit<Base,'showGrips'> & {colors:ResolvedGripColors}`.

**3 UI-local `GripSettings`:** (1) `LinePreview.tsx` = γνήσιο subset → projection (`Omit<Base,'showGrips'|'gripObjLimit'> & {colors}`). (2) `CurrentSettingsDisplay.tsx` (έχει `gripShape`/`showFill` — display-only) → **rename** `GripSettingsSummary` (name-collision, ΟΧΙ duplicate· δεν μολύνει το schema). (3) `useSettingsPreview.ts` (`{color,size,style}` CSS) → **rename** `GripCssPreviewInput`.

**Default VALUES** μένουν per-context (stored/runtime/draft/hover/preview διαφέρουν σκόπιμα — π.χ. aperture 10 vs 20, sentinel vs resolved colors) → κεντρικοποιήθηκε **μόνο το shape**, όχι οι τιμές (zero behavior change).

**Ratchet guard:** module `grip-settings-schema` στο `.ssot-registry.json` (tier 3) — απαγορεύει νέο standalone `interface GripSettings|GripStyle|MockGripSettings` (0 violations· registry-golden 56/56 GREEN).

**UI:** `ui/components/dxf-settings/settings/core/GripSettings.tsx` — `SliderInput` (0–1000 πρακτικό εύρος, `showNumberInput`· clamp εγγυάται μέχρι 32767 προγραμματιστικά). **`?? 100`** (όχι `|| 100`, γιατί `0` είναι έγκυρη τιμή = no limit). i18n key `settings.grip.labels.gripObjLimit` στα 3 locales (el/en/pseudo).

## 4. Έλεγχος

`hooks/grips/__tests__/grip-obj-limit.test.ts` — 7 jest: `<limit`/`===limit` ⇒ εμφάνιση, `>limit` ⇒ απόκρυψη, `0`/non-positive ⇒ ποτέ απόκρυψη, `GRIPOBJLIMIT=1` boundary, empty selection. ✅ 7/7.

## 5. Συνέπειες

- ✅ AutoCAD parity (default 100, `0`=unlimited), big-player practice, configurable από UI.
- ✅ Full SSoT: ΕΝΑΣ κανόνας (predicate), reuse όλης της settings chain, μηδέν νέο store.
- ✅ **Grip-settings shape κεντρικοποιήθηκε (Giorgio order):** 8 re-declared interfaces → ΕΝΑ canonical schema + projections + 2 de-collision renames + ratchet guard (§3b). Νέο grip field πλέον μπαίνει σε ΕΝΑ σημείο (`GripSettingsBase`).
- 🔴 Εκκρεμεί browser-verify (2D πολλαπλή επιλογή >100 + 3D raw-DXF multi-select).
- ⚠️ Type-safety: `@swc/jest` δεν κάνει type-check (N.17 → όχι tsc από agent)· οι projections επαληθεύτηκαν field-by-field + 261/262 jest GREEN (το 1 fail = προϋπάρχον MEP scene-manager mock gap, άσχετο — SWC σβήνει τύπους, type-edit δεν προκαλεί runtime error). Final type-check: Giorgio/pre-commit.

## Changelog

- **2026-06-30** — Αρχική υλοποίηση: setting `gripObjLimit` (default 100) + predicate SSoT + 3 gates (2D + 2×3D) + UI slider + i18n + 7 jest. UNCOMMITTED.
- **2026-06-30 (follow-up, Giorgio SSoT order)** — Κεντρικοποίηση grip-settings shape (§3b): νέο `types/grip-settings-schema.ts` (canonical) + 6 projections + 2 de-collision renames + ratchet guard module. Zero behavior change (μόνο types, όχι default values). 261/262 jest GREEN (1 προϋπάρχον MEP mock fail, άσχετο). UNCOMMITTED.
