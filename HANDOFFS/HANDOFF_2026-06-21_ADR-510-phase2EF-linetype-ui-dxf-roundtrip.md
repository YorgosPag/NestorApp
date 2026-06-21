# HANDOFF — ADR-510 Φ2E + Φ2F (Linetype UI + DXF LTYPE round-trip)

> **Ημερομηνία:** 2026-06-21
> **Κατάσταση:** Φ2 **rendering SSoT ΟΛΟΚΛΗΡΩΘΗΚΕ** (Φ2A-D, UNCOMMITTED). Απομένουν **Φ2E (UI)** + **Φ2F (DXF
> round-trip + persistence)** — orchestrator-scale το καθένα, γι' αυτό χωριστή συνεδρία (ποιότητα με fresh context).
> **Commit:** ΜΟΝΟ ο Giorgio.

## 0. Τι ΟΛΟΚΛΗΡΩΘΗΚΕ (Φ2A-D — rendering SSoT, μη το ξανακάνεις)

**Στόχος που επιτεύχθηκε:** ΕΝΑ pattern catalog (mm) → ΕΝΑΣ resolver (zoom×LTSCALE×CELTSCALE) → ΟΛΟΙ οι
on-screen consumers. DXF entity + 8 BIM renderers + legacy preview/settings πλέον **ταυτόσημα zoom-scaled**.

| Module | Ρόλος |
|---|---|
| `config/linetype-iso-catalog.ts` | **27 mm patterns** SSoT (8 ISO + 14 variants 2/X2 + 3 Dot + 2 specials). `LINETYPE_CATALOG_NAMES`, `listAllLinetypes`, `isIsoBaselineLinetype`(=`origin==='iso-baseline'`), `getCatalogLinetype` |
| `config/linetype-aliases.ts` (NEW) | `resolveAnyLinetype(input)` + `resolveAnyDashMm` — legacy enum + 28 BIM keys + case-variant DXF → canonical `LinetypeDef` |
| `rendering/linetype-dash-resolver.ts` | `dashMmToScreenPx(mm, zoom, ltscale, celtscale)` — abs gaps, dot→MIN_DOT_PX, []→solid |
| `stores/LinetypeScaleStore.ts` | global **LTSCALE** (default 1, localStorage `dxf:ltscale`) |
| `config/bim-dash-resolver.ts` (NEW) | `bimDashPx(key,scale)` / `bimDashMm(key)` — BIM key → catalog mm → zoom-px |
| `types/base-entity.ts` | `+ dashMm?` (resolved pattern) `+ ltscale?` (CELTSCALE, DXF grp 48) |

**Consumers wired:** DxfRenderer (line-batch + EntityModel via `base-entity-style-helpers.applyEntityLinetypeDash`),
8 BIM renderers (Wall/Beam/Stair/Slab/SlabOpening/Opening + bim-3d-edge), legacy `settings-core/defaults.getDashArray`.
`bim-line-patterns` `BUILT_IN_DASH_ARRAYS`+`linePatternToDashArray` + `defaults.DASH_PATTERNS` = **@deprecated**.
~250 jest GREEN, tsc clean (δικά μου). **ΕΚΤΟΣ scope (μη το αγγίξεις):** `config/text-rendering-config.LINE_DASH_PATTERNS`
= UI chrome (cursor/hover/selection overlays), ξεχωριστό domain.

## 1. Φ2E — UI (LTSCALE control + live dropdown + custom-creation)

1. **LTSCALE status-bar control** — NEW UI που γράφει `setLinetypeScale()` (`stores/LinetypeScaleStore.ts`).
   Reuse Radix Select / numeric input (ADR-001· **ΟΧΙ** EnterpriseComboBox). i18n el+en (N.11, keys πρώτα).
   Πιθανό σημείο: DXF viewer status bar / ribbon. Live = το canvas ανανεώνεται (το store είναι useSyncExternalStore).
2. **Linetype dropdown → live registry** — `ui/ribbon/data/contextual-line-tool-tab.ts` (Quick Style) + layer
   linetype picker χρησιμοποιούν στατικό `LINETYPE_ISO_NAMES` (8). Άλλαξέ τα να διαβάζουν **live**
   `listLinetypes()` / `subscribeLinetypeRegistry` (`stores/LinetypeRegistry.ts`) → δείχνουν 27 built-in + custom.
3. **Custom-creation pattern editor** — NEW UI: ο χρήστης ορίζει μοτίβο (dash/gap/dot σε mm) + name →
   `registerLinetype(def)`. Preview μέσω `dashMmToScreenPx`. (Q5 «δημιουργία νέων».) Enterprise ID αν persisted.
4. **Preview SVG** (`ui/components/dxf-settings/.../LinePreview*`) → ήδη μέσω `getDashArray` (τώρα catalog-backed).
   Επαλήθευσε ότι δείχνει σωστά τα νέα patterns· ίσως ενοποίηση να διαβάζει απευθείας `resolveAnyDashMm`.

## 2. Φ2F — DXF LTYPE round-trip + persistence (= Φ9)

1. **Entity import** — ο entity parser συλλέγει group codes σε `data` αλλά οι converters ΔΕΝ τα διαβάζουν:
   grp **6**→`linetypeName`, **48**→`ltscale` (CELTSCALE), **370**→`lineweightMm`. Πρόσθεσέ τα στους
   `utils/dxf-entity-converters` (convertLine/Polyline/...).
2. **Production LTYPE import** — `DxfSceneBuilder.buildScene()` καλεί legacy `parseLayerColors()`, **ΟΧΙ**
   `parseLinetypeTable()`. Wire `parseLinetypeTable()` → `registerLinetypes()` ώστε custom DXF linetypes να
   μπαίνουν στο registry (υπάρχει έτοιμος ο parser `utils/dxf-linetype-table-parser.ts`, απλώς μη-wired).
3. **Export** — `export/core/dxf-ascii-writer.ts` γράφει μόνο ENTITIES + grp 62. Πρόσθεσε: LTYPE table (για
   non-`isIsoBaselineLinetype` linetypes) + entity grp 6/48/370. Συντόνισε με ADR-505 (Unified Export).
   `utils/dxf-layer-table-writer.ts` ήδη γράφει layer grp 6/370 + LTYPE — reuse pattern.
4. **Persistence** — `LinetypeRegistry` Phase 9: Firestore (custom linetypes per-company, **Enterprise IDs N.6
   `ltp_<ULID>`** — δες `LinetypeDef.id`) + localStorage. Default-deny rules + `companyId` (security).

## 3. Κανόνες
- **Shared tree ΕΝΕΡΓΟ:** beam refactor + foundation grips + structural + hatch agents δουλεύουν ταυτόχρονα
  (9 tsc errors στο full project είναι ΔΙΚΑ ΤΟΥΣ, όχι δικά μας). `git status` ΠΡΙΝ κάθε edit· `git add` ΜΟΝΟ δικά
  σου· ΠΟΤΕ `-A`/`--no-verify`.
- ΕΝΑ tsc τη φορά (N.17)· μηδέν `any` (N.2)· ≤500/≤40 (N.7.1)· i18n el+en (N.11)· Enterprise IDs (N.6).
- Μετά: ADR-510/358/377/505 changelogs + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory + `.ssot-registry.json` (πρόσθεσε
  `linetype-aliases.ts`/`bim-dash-resolver.ts` στα allowlists αν το ratchet τα flag-άρει) + `npm run ssot:baseline`.

## 4. 🔴 ΠΡΩΤΑ: browser-verify Φ2A-D + commit (πριν Φ2E/F)
DXF γραμμή Dashed/Hidden/Center → διακεκομμένη· **BIM τοίχος dashed → τώρα zoom-scaled (ίδιο με DXF)**· zoom
in/out scale· `Continuous`→συνεχής. ⚠️ ADR-040 CHECK 6B/6D → stage ADR-040+358+377+510 μαζί.
