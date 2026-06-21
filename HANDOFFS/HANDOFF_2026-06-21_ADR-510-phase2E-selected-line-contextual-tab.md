# HANDOFF — ADR-510 Φ2E: Selected-Line Contextual Tab + Linetype Editing UI (Revit-grade)

> **Ημερομηνία:** 2026-06-21
> **Στόχος:** Όταν ο χρήστης **επιλέγει** μια γραμμή (ή polyline/circle/arc) → να εμφανίζεται **contextual ribbon
> tab** που **επεξεργάζεται τις ιδιότητες της ΙΔΙΑΣ της επιλεγμένης οντότητας** (linetype / lineweight / color),
> με **undo**, όπως ακριβώς κάνουν beam/wall/hatch. Σήμερα ΔΕΝ εμφανίζεται καμία tab.
> **FULL ENTERPRISE + FULL SSoT, όπως Revit.** Commit: **ΜΟΝΟ ο Giorgio.** Shared working tree (άλλοι agents ενεργοί).

---

## 0. 🚨 ΠΡΩΤΑ — ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT (grep) ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ

**ΜΑΘΗΜΑ (κρίσιμο):** σε ΔΥΟ προηγούμενους γύρους το audit έχασε ολόκληρα subsystems → παραλίγο διπλότυπα.
**ΜΗΝ εμπιστευτείς τυφλά αυτό το handoff — ξανα-grep ανά domain.** Τρέξε ΟΛΑ:

```
# 1. Πώς ΑΛΛΕΣ οντότητες δείχνουν contextual tab σε selection (το mapping)
grep -n "resolveContextualTrigger\|fromSelection\|-selected'" src/subapps/dxf-viewer/app/ribbon-contextual-config.ts
# 2. Υπάρχοντα selected-entity bridges που γράφουν entity props με undo (πρότυπο προς μίμηση)
grep -rn "UpdateEntityCommand\|useRibbonHatchBridge\|useRibbonBeamBridge\|beam-structural-bridge" src/subapps/dxf-viewer/ui/ribbon
# 3. Πώς διαβάζεται/γράφεται το style μιας ΕΠΙΛΕΓΜΕΝΗΣ οντότητας (linetype/lineweight/color)
grep -rn "linetypeName\|lineweightMm\|UpdateEntityCommand\|setEntityStyle\|update.*entity.*style" src/subapps/dxf-viewer/core/commands src/subapps/dxf-viewer/systems/properties
# 4. Selection store (ποιο είναι το primary selected entity)
grep -rn "resolveSelectedEntityFrom\|primarySelectedId\|selectionStore\|useSelection" src/subapps/dxf-viewer/systems/selection
# 5. Πώς δένει ένα contextual bridge στο ribbon command pipeline
grep -n "useRibbonCommands\|bridges\|getComboboxState\|onComboboxChange" src/subapps/dxf-viewer/app/useDxfViewerRibbon.ts
```

---

## 1. Διάγνωση (έτοιμη — επιβεβαίωσέ την με τα grep)

**Αιτία:** `app/ribbon-contextual-config.ts` → `resolveContextualTrigger(entity)` (γρ. ~335–406) έχει `case` για
wall/column/beam/hatch/text/dimension/slab/opening/roof/mep-*/array — **αλλά ΛΕΙΠΕΙ `case 'line'`** (+`polyline`/
`lwpolyline`/`circle`/`arc`). Επιλεγμένη γραμμή → `return null` → καμία tab.

**Pipeline (selection → tab):** `primarySelectedId` → `resolveSelectedEntityFrom` (`systems/selection/resolve-selected-entity.ts`)
→ `resolveContextualTrigger(entity)` (`app/ribbon-contextual-config.ts:~233`) → trigger → `useDxfViewerRibbon`
(`app/useDxfViewerRibbon.ts:~79`) → RibbonRoot δείχνει το tab με `.contextualTrigger === trigger`.

**ΠΡΟΣΟΧΗ — γιατί δεν είναι one-liner:** το υπάρχον `ui/ribbon/data/contextual-line-tool-tab.ts`
(`LINE_TOOL_CONTEXTUAL_TRIGGER = 'line-tool-active'`) + ο bridge `ui/ribbon/hooks/useRibbonLineToolBridge.ts`
γράφουν στο **`stores/QuickStyleStore.ts`** = draw-defaults για την **ΕΠΟΜΕΝΗ** γραμμή — **ΟΧΙ** στην επιλεγμένη.
Ο bridge ρητά **δεν** κάνει undo-able commands (ADR-357 Phase 17). Αν απλώς προσθέσεις το `case 'line'`, το tab
εμφανίζεται αλλά επεξεργάζεται draw-defaults → «μπακάλικο». **Χρειάζεται selected-entity bridge.**

## 2. Πρότυπο προς μίμηση (Revit-grade selected editing)

Το **`hatch`** το κάνει σωστά: ΕΝΑ trigger (`hatch-selected`) καλύπτει **και** tool-active **και** selected· ο
`useRibbonHatchBridge` διαβάζει/γράφει τις ιδιότητες της επιλεγμένης οντότητας με undo command. **Μίμησε αυτό**
(δες επίσης `beam-structural-bridge`). Audit grep #2/#3 για τα ακριβή ονόματα command/bridge.

## 3. Ελάχιστο enterprise wiring (επιβεβαίωσε/προσάρμοσε μετά το audit)

1. **`app/ribbon-contextual-config.ts`** — στο `resolveContextualTrigger`: `case 'line'` (+ `polyline`/`lwpolyline`/
   `circle`/`arc`) → επέστρεψε έναν trigger για selected geometry (π.χ. reuse `LINE_TOOL_CONTEXTUAL_TRIGGER` ΟΠΩΣ
   το hatch, ή NEW `'line-selected'` αν θες ξεχωριστό tab για editing vs drawing — **απόφαση: δες αν το ίδιο tab
   εξυπηρετεί και τα δύο modes, όπως hatch**).
2. **NEW selected-entity bridge** `ui/ribbon/hooks/useRibbonLineSelectedBridge.ts` (mirror `useRibbonHatchBridge`):
   - `getComboboxState`: διαβάζει `linetypeName`/`lineweightMm`/`color` από το **selected entity** (μέσω selection
     store + `resolveSelectedEntityFrom`), με σωστό **ByLayer** display (resolved cascade — reuse
     `systems/properties/resolve-entity-style.ts`).
   - `onComboboxChange`: dispatch **`UpdateEntityCommand`** (ή ό,τι βρει το audit #3) → undo-able· ενημερώνει το
     entity· canvas re-render. **ΟΧΙ** QuickStyleStore.
   - **Linetype options = live `LinetypeRegistry`** (`stores/LinetypeRegistry.ts` → `listLinetypes()` = 27 built-in
     + custom), **ΟΧΙ** στατικό `LINETYPE_ISO_NAMES`. Lineweight options = `lineweight-iso-catalog`.
3. **`app/useDxfViewerRibbon.ts`** — πρόσθεσε το νέο bridge στη λίστα bridges (γρ. ~104).
4. **i18n el+en** για τυχόν νέα labels (N.11 — keys πρώτα στα `i18n/locales/{el,en}/*.json`).
5. (Προαιρετικό, ίδιο tab) **CELTSCALE** per-object: πεδίο `ltscale` (ήδη στο `types/base-entity.ts`) editable.

## 4. ΥΠΟΔΟΜΗ ΠΟΥ ΥΠΑΡΧΕΙ ΗΔΗ (Φ2A-D — ΜΗΝ ξαναφτιάξεις, ΧΡΗΣΙΜΟΠΟΙΗΣΕ)

Το **rendering SSoT ολοκληρώθηκε** (UNCOMMITTED, δες `reference_line_creation_system.md` memory + ADR-510 §6):
- `config/linetype-iso-catalog.ts` — 27 mm patterns (`listAllLinetypes`, `LINETYPE_CATALOG_NAMES`).
- `config/linetype-aliases.ts` — `resolveAnyLinetype(input)` (legacy enum + bim key + DXF → canonical).
- `stores/LinetypeRegistry.ts` — `listLinetypes()`/`resolveLinetype()`/`subscribeLinetypeRegistry` (live, custom-capable).
- `config/lineweight-iso-catalog.ts` — 24 ISO + `lineweightToPx`.
- `stores/LinetypeScaleStore.ts` — global LTSCALE (Φ2E θα μπορούσε να προσθέσει status-bar control γι' αυτό).
- `systems/properties/resolve-entity-style.ts` — ByLayer/ByBlock cascade (για σωστό display των ByLayer τιμών).
- `rendering/linetype-dash-resolver.ts` — `dashMmToScreenPx(mm, zoom, ltscale, celtscale)` (για preview).

## 5. Υπόλοιπο Φ2E (ίδια συνεδρία αν χωράει) + Φ2F (ξεχωριστά)
- **Φ2E επίσης:** LTSCALE status-bar control· linetype dropdown σε layer panel → live registry· custom-linetype
  creation pattern editor (→ `registerLinetype`). Δες `HANDOFF_2026-06-21_ADR-510-phase2EF-linetype-ui-dxf-roundtrip.md`.
- **Φ2F (ΞΕΧΩΡΙΣΤΗ συνεδρία):** DXF LTYPE round-trip (entity grp 6/48/370 + import/export + Firestore persistence).

## 6. Κανόνες
- **SSoT πρώτα (§0 grep).** Μηδέν διπλότυπα — reuse `resolveAnyLinetype`, `LinetypeRegistry`, `resolve-entity-style`,
  το hatch bridge pattern. ΜΗΝ φτιάξεις 2ο style-editing path.
- **Shared tree ΕΝΕΡΓΟ** (beam/foundation/structural/hatch agents): `git status` ΠΡΙΝ κάθε edit· `git add` ΜΟΝΟ
  δικά σου· ΠΟΤΕ `-A`/`--no-verify`. **Commit ΜΟΝΟ ο Giorgio.**
- ΕΝΑ tsc τη φορά (N.17)· μηδέν `any` (N.2)· ≤500/≤40 (N.7.1)· i18n el+en (N.11)· ADR-001 Radix Select (ΟΧΙ
  EnterpriseComboBox).
- Μετά: ADR-510 changelog + status + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory.
- **N.8:** πιθανώς 3-5 αρχεία/1-2 domains → Plan-Mode (ή ρώτα τον Giorgio αν μεγαλώσει).
