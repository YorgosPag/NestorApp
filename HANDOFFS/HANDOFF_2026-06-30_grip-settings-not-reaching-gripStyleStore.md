# HANDOFF — Οι ρυθμίσεις χερουλιών (Grip Settings panel) ΔΕΝ φτάνουν στο runtime `gripStyleStore`

**Ημερομηνία:** 2026-06-30
**Subapp:** `src/subapps/dxf-viewer`
**Κατάσταση working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** COMMIT τον κάνει **ΜΟΝΟ ο Giorgio**. `git add -A` **ΑΠΑΓΟΡΕΥΕΤΑΙ** — stage μόνο specific files.
**Μοντέλο:** Opus (cross-cutting, render + settings pipeline).

---

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ (browser-verified από Giorgio, 2 screenshots)

Στο DXF Viewer, στο πάνελ **«Ρυθμίσεις Χερουλιών»** (⚙️ «Ρυθμίσεις DXF» → Γενικά → tab «Χερούλια»):

1. **Toggle «Εμφάνιση Χερουλιών» = OFF** («Τα χερούλια είναι απενεργοποιημένα») → **κι όμως τα grips εμφανίζονται** στο canvas.
2. **«Όριο Πλήθους για Λαβές» = 10** (Προχωρημένες Ρυθμίσεις) + **40 επιλεγμένα** (Τοίχοι 31 + Κολώνες 8 + Δοκάρι 1, Ctrl+A) → 40 > 10 → **έπρεπε να κρυφτούν ΟΛΕΣ, αλλά φαίνονται**.
3. **«Διαφάνεια»** και **«Μέγεθος Χερουλιών»** — ο Giorgio αναφέρει ότι **δεν λειτουργούν** κι αυτά.

**Όλα τα συμπτώματα έχουν ΕΝΑ κοινό root cause** (παρακάτω).

---

## 🔬 ROOT CAUSE (εντοπίστηκε με grep — ΥΨΗΛΗ βεβαιότητα)

**Το Grip Settings panel γράφει σε ΑΛΛΟ bucket από αυτό που συγχρονίζεται στο `gripStyleStore`.**

Ροή που ΙΧΝΕΥΘΗΚΕ:
- Τα sliders/toggles του panel καλούν `updateSettings` από **`useUnifiedGripPreview()`** (`ui/hooks/useUnifiedSpecificSettings.ts:261`).
- Αυτό = **`useGripDraftSettings().updateSettings`** (`hooks/useGripDraftSettings.ts:26`) → καλεί **`updateSpecificGripSettings('draft', updates)`**.
- Δηλαδή γράφει στο **'draft'/'preview' specific** settings bucket.
- **ΑΛΛΑ** το runtime `gripStyleStore` (που διαβάζουν ΟΛΟΙ οι renderers/gates μέσω `getGripPreviewStyle()` / `gripStyleStore.get()`) συγχρονίζεται **ΜΟΝΟ** από το `GripProvider`:
  - mount/effect: `syncGripStyleStoreFromSettings(gripSettings)` (`providers/GripProvider.tsx:91-93`), όπου `gripSettings = centralGripHook.settings` (γρ.79-80).
  - `GripProvider.updateGripSettings(...)` (γρ.99-115) — **ΜΟΝΟ αυτό** ξανακαλεί `syncGripStyleStoreFromSettings(next)`.
- Το panel **ΔΕΝ** περνά από το `GripProvider.updateGripSettings` → άρα **ο `gripStyleStore` ΔΕΝ ξανασυγχρονίζεται ποτέ** όταν αλλάζεις ρύθμιση στο panel → μένει στα **module-level defaults** (`stores/GripStyleStore.ts:43-66`: showGrips=true, gripObjLimit=100, opacity=1, gripSize=default…).

**Συνέπεια:** ό,τι ρυθμίζεις στο panel αγνοείται από τον render. Με 40 επιλεγμένα ο gate διαβάζει `gripObjLimit=100` (default) → 40<100 → φαίνονται. Ο toggle γράφει σε draft → ο render διαβάζει `showGrips=true` → φαίνονται. Ίδιο για opacity/size.

### Δευτερεύον (να επιβεβαιωθεί)
Ακόμη κι αν το panel έγραφε σωστά, υπάρχει override-guard μηχανισμός (`guardGlobalAccess('GRIP_PREVIEW_STYLE_READ'/'GRIP_STYLE_UPDATE')` στο `getGripPreviewStyle`/`gripStyleStore.set`). Ελέγξτε ότι δεν μπλοκάρει writes όταν `isOverrideEnabled`.

---

## ✅ ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ ΣΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (UNCOMMITTED — οι gates είναι ΣΩΣΤΟΙ, απλώς διαβάζουν stale store)

**ΟΛΟΣ ο παρακάτω κώδικας είναι σωστός και ΜΕΝΕΙ** — μόλις διορθωθεί το sync, θα δουλέψει. ADR: **ADR-559** (+ ADR-040 changelog).

### Γύρος 1 — feature `gripObjLimit` (AutoCAD GRIPOBJLIMIT, default 100, 0=unlimited)
- **SSoT predicate (reuse παντού):** `hooks/grips/grip-obj-limit.ts` → `isGripObjLimitExceeded(count, limit)` (+ test `__tests__/grip-obj-limit.test.ts`, 7/7).
- Bounds/clamp: `config/validation-bounds-config.ts` (`GRIP_BOUNDS.OBJ_LIMIT {0,32767}` + `clampGripObjLimit`).
- Settings chain (mirror του `maxGripsPerEntity`): `settings-core/types/domain.ts`, `settings-core/defaults.ts`, `settings/FACTORY_DEFAULTS.ts`, `types/gripSettings.ts`, `rendering/types/Types.ts`, `stores/GripStyleStore.ts`, `stores/grip-style-sync.ts` (forward), `adapters/ZustandToConsolidatedAdapter.ts` (read+write), `ui/hooks/useUnifiedSpecificSettings.ts`.
- 2D hit-test gate: `hooks/grips/grip-registry.ts`. 3D gates: `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` (`seatGrips`) + `bim-3d/animation/bim3d-grip-drag.ts` (`refreshReshapeGrips`).
- UI slider «Όριο Πλήθους για Λαβές»: `ui/components/dxf-settings/settings/core/GripSettings.tsx` + i18n key `settings.grip.labels.gripObjLimit` (el/en/pseudo `dxf-viewer-settings.json`).

### Γύρος 2 — Κεντρικοποίηση grip-settings shape (Giorgio SSoT order, Figma-level)
- **Canonical schema:** `types/grip-settings-schema.ts` (`GripColors`, `ResolvedGripColors` **re-export από `config/color-config.ts`**, `GripSettingsBase`, `GripStyleExtras`, `GripSettingsLegacyCompat`, `GripSettingsFull`).
- 5 τύποι → **projections** (όχι re-declarations): `domain.ts GripSettings`, `gripSettings.ts`, `rendering/Types.ts`, `GripStyleStore.ts GripStyle`, `useUnifiedSpecificSettings.ts MockGripSettings`. + UI: `LinePreview.tsx` (projection), `CurrentSettingsDisplay.tsx`→rename `GripSettingsSummary`, `useSettingsPreview.ts`→rename `GripCssPreviewInput`.
- Ratchet guard: module `grip-settings-schema` στο `.ssot-registry.json` (tier 3). Default VALUES έμειναν per-context (zero behavior change).

### Γύρος 3 — bugfixes render (ΣΩΣΤΟΙ, blocked από το sync bug)
- `canvas-v2/dxf-canvas/DxfRenderer.ts` — **ο ΠΡΑΓΜΑΤΙΚΟΣ visible-grips gate** (`renderEntityUnified` → `gripsVisible = isSelected && !suppressGrips && !this._gripsSuppressedByObjLimit`, per-frame flag). ⚠️ CHECK 6B/6D → stage **ADR-040** (ενημερώθηκε το changelog).
- `systems/phase-manager/renderers/GripPhaseRenderer.ts` (`renderStandardGrips`) — toggle gate (`if (!style.showGrips || !style.enabled) return;`) + opacity (`ctx.globalAlpha = style.opacity`, ο `UnifiedGripRenderer` δεν είχε καθόλου alpha). `gripSize` ήδη περνά.

**Τεκμηρίωση παραγωγών 2D grips (επιβεβαιωμένο):** `grip-registry.ts → AllGripsStore` = ΜΟΝΟ hit-test/snap. **Ορατά grips στο canvas = `DxfRenderer.renderEntityUnified` → `BaseEntityRenderer.renderPhaseGrips` (γρ.207) → `GripPhaseRenderer`**, που διαβάζει `getGripPreviewStyle()` → `gripStyleStore`.

---

## 🛠️ ΤΙ ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ (ΕΠΟΜΕΝΟ ΒΗΜΑ)

**Στόχος:** οι ρυθμίσεις του Grip Settings panel να φτάνουν στο `gripStyleStore` (το SSoT που διαβάζει ο renderer), ώστε να λειτουργούν: toggle «Εμφάνιση Χερουλιών», «Όριο Πλήθους για Λαβές», «Διαφάνεια», «Μέγεθος».

### 1. ΠΡΩΤΑ — ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep), ΠΡΙΝ κώδικα
Ίχνευσε ΟΛΟ το pipeline (όχι isolated hook):
- `useEnterpriseDxfSettings` → `updateSpecificGripSettings` / `getEffectiveGripSettings('preview')` / `getEffectiveGripSettings('general')` — πού ζουν τα 'draft'/'specific'/'general' grip settings, ποιο είναι το «effective».
- `providers/GripProvider.tsx` — τι ακριβώς είναι το `centralGripHook` (γρ.~60-85) και ποιο settings source συγχρονίζει στο `gripStyleStore` (general; effective; draft;).
- `useUnifiedGripPreview` (`useUnifiedSpecificSettings.ts:261`) — γιατί γράφει 'draft' ενώ ο render διαβάζει general/effective.
- `getGripPreviewStyle` (`hooks/useGripPreviewStyle.ts`) + `guardGlobalAccess` override machinery — μήπως μπλοκάρει.
- Έλεγξε αν το ΙΔΙΟ πρόβλημα υπάρχει για Line/Text settings (πιθανό κοινό pattern).

### 2. FIX — enterprise + FULL SSoT (reuse, ΟΧΙ νέο path)
Πιθανές κατευθύνσεις (διάλεξε βάσει του audit — ΜΗΝ δημιουργήσεις δεύτερο sync μηχανισμό):
- **(α)** Το panel update path να καταλήγει στο **υπάρχον** `GripProvider.updateGripSettings` (που ήδη καλεί `syncGripStyleStoreFromSettings`) — ώστε κάθε αλλαγή να ξανασυγχρονίζει το store. Reuse `syncGripStyleStoreFromSettings` (SSoT writer, `stores/grip-style-sync.ts`), **μην** γράψεις νέο.
- **(β)** Ή: το `GripProvider` mount-effect (γρ.91-93) να συγχρονίζει το **effective settings που όντως επεξεργάζεται το panel** (το source να συμπίπτει), ώστε το `[gripSettings]` dep να αλλάζει όταν αλλάζει το panel.
- Επιβεβαίωσε ότι το `gripObjLimit` περιλαμβάνεται σε ΟΛΟ το νέο sync path (το πρόσθεσα ήδη στο `syncGripStyleStoreFromSettings` + adapter + getEffective; **έλεγξε** ότι το `getEffectiveGripSettings`/override merge δεν το πετάει).

### 3. Verify
- Browser: toggle OFF → καμία λαβή· όριο 10 + Ctrl+A(40) → καμία λαβή· Διαφάνεια 60% → ημιδιάφανες· Μέγεθος → αλλάζει.
- jest στοχευμένα (όχι tsc — N.17). Υπάρχει `stores/__tests__/style-store-sync-ssot.test.ts` για τον writer.
- Ενημέρωσε **ADR-559** (νέο §: «settings→store sync fix») + changelog.

---

## 🚨 ΕΝΤΟΛΕΣ GIORGIO (απαράβατες)
1. **FULL ENTERPRISE + FULL SSoT**, όπως **Revit / Maxon (Cinema 4D) / Figma**. Αν οι μεγάλοι δεν προτείνουν κάτι → ακολούθησε την πρακτική τους.
2. **ΠΡΙΝ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep).** Reuse υπάρχοντα κώδικα (`syncGripStyleStoreFromSettings`, `gripStyleStore`, `GripProvider`). **ΜΗΝ** φτιάξεις διπλότυπο sync/store.
3. Αν βρεις προϋπάρχοντα διπλότυπα → **κεντρικοποίησέ τα κι αυτά** (ΔΙΑΤΑΓΗ).
4. **ΟΧΙ commit / ΟΧΙ push** από agent. Shared working tree → stage μόνο specific files, **ΟΧΙ `git add -A`**.
5. **ΟΧΙ `tsc`** (N.17). jest επιτρέπεται. (`@swc/jest` = transpile-only, δεν κάνει type-check.)
6. Απαντάς **ΣΤΑ ΕΛΛΗΝΙΚΑ**.
7. Πλάνο **ΠΡΙΝ** υλοποίηση. Στο τέλος: ✅/⚠️/❌ Google-level + ενημέρωση ADR.

## 📌 Εκκρεμότητες (ratchet/flags) — `.claude-rules/pending-ratchet-work.md`
- **LineSettings / TextSettings** έχουν το ίδιο 5× re-declaration pattern (όπως είχε το grip) → flagged για dedicated pass με template το **ADR-559 §3b**.
- 🔴 Giorgio: `npm run ssot:baseline` (formal register του 0-violation module `grip-settings-schema`) + commit όλων.

## Pointers
- ADR-559: `docs/centralized-systems/reference/adrs/ADR-559-grip-object-limit.md`
- ADR-040 (DXF render perf, CHECK 6B): `docs/.../ADR-040-preview-canvas-performance.md`
- DXF render architecture rules: `CLAUDE.md` §«DXF VIEWER ARCHITECTURE».
