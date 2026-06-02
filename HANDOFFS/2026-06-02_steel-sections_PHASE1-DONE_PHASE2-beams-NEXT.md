# HANDOFF — Κατάλογος μεταλλικών διατομών · ΦΑΣΗ 1 (κολώνες) DONE · ΕΠΟΜΕΝΟ = ΦΑΣΗ 2 (δοκάρια)

**Ημερομηνία:** 2026-06-02
**Συντάκτης:** Opus 4.8
**Γλώσσα:** Ελληνικά πάντα.
**Commit/push:** ΜΟΝΟ ο Giorgio (N.-1).
**⚠️ SHARED working tree** με railing (ADR-407) / electrical-panel + MEP (ADR-408) agents → `git add` **μόνο specific αρχεία**, ΠΟΤΕ `-A`. ΜΗΝ αγγίξεις δικά τους αρχεία.

---

## ✅ ΦΑΣΗ 1 — ΟΛΟΚΛΗΡΩΘΗΚΕ, COMMITTED + BROWSER-VERIFIED (Giorgio)

Πλήρης κατάλογος μεταλλικών διατομών EN 10365 στις **ΚΟΛΩΝΕΣ** (kind='I-shape').
- `section-catalog.ts`: 10 → **75 διατομές** (IPE 18 · HEA 19 · HEB 19 · HEM 19), b/h/tf/tw σε mm.
- **FULL SSOT:** το dropdown options (`contextual-column-tab.ts`) **παράγεται** από το `ISHAPE_CATALOG` (ήταν χειροκίνητο duplicate). + helper `formatIShapePresetLabel` (literal label, μηδέν i18n keys· αφαιρέθηκαν 10 orphan `catalogProfile.iShape.*` keys el+en). Αφαιρέθηκε το `labelKey` από `IShapeCatalogPreset`.
- **Verified:** tests 27/27, tsc 0, **EN 10365 ακρίβεια 0 αποκλίσεις** (subagent research, eurocodeapplied/wermac/structolution/projectmaterials, ≥95%). ΣΗΜ HEM: sectionDepth h = πραγματικό βάθος (HEM-100→h=120), ΟΧΙ nominal.
- Νομική βάση: ADR-409 §C.1 (διαστάσεις=facts). ADR-363 §5.6 changelog ενημερωμένο.
- UI ορατή αλλαγή: κολώνα → Τύπος → «Σχήμα Ι» → panel «Διατομή Ι» → «Κατάλογος προφίλ» = 76 επιλογές.

---

## 🎯 ΦΑΣΗ 2 — ΜΕΤΑΛΛΙΚΑ ΔΟΚΑΡΙΑ (ΤΟ ΕΠΟΜΕΝΟ TASK)

**Στόχος:** Τα δοκάρια να μπορούν να έχουν διατομή **I/H** (όπως οι κολώνες), με τον ΙΔΙΟ κατάλογο `ISHAPE_CATALOG` (κοινό SSoT — ΜΗΝ φτιάξεις δεύτερο catalog).

**Σημερινή κατάσταση (από recognition Φάσης 1):**
- `bim/types/beam-types.ts`: `BeamKind` (line ~51) = `'straight'|'curved'|'cantilever'` (ΟΧΙ section-kind). `BeamParams` (line ~83) = `width`+`depth` = **μόνο ορθογωνική** διατομή. `BeamSectionType` (line ~66) = `'I'|'H'` υπάρχει ΩΣ HINT αλλά **δεν παράγει I-geometry**. `profileDesignation?: string` (line ~113) = free-text label μόνο.
- Beam geometry: **δεν υπάρχει** I-shape footprint generation (μόνο rectangular outline).
- BOQ: `bim/config/bim-to-atoe-mapping.ts` `BEAM_MAPPING` (line ~97) = όλα `OIK-2.04 m3` (RC). Steel beam → νέο entry `unit:'kg'`, `categoryCode:'OIK-12.10'` (ίδιο με steel column `I-shape`).

**Πρότυπα προς αντιγραφή (κολώνα — ΗΔΗ δουλεύει):**
- I-shape footprint: `bim/geometry/column-geometry.ts:273` `buildIShapeLocal(width, depth, s, override?)` — reuse/mirror για δοκάρι.
- Catalog apply: `ui/ribbon/hooks/bridge/column-bridge-catalog-helpers.ts` (`applyEntityCatalogPreset`/`applyToolCatalogPreset`, custom-sentinel guards) — mirror για beam bridge.
- Dropdown options generated: `ui/ribbon/data/contextual-column-tab.ts` (`ISHAPE_CATALOG.map` + `formatIShapePresetLabel`, `isLiteralLabel:true`) — ίδιο pattern στο beam contextual tab.
- `ColumnIShapeParams` (`column-types.ts:117`: flangeThickness/webThickness/flipY) — mirror `BeamIShapeParams`.

**Σχέδιο Φάσης 2 (high-level, ~10 αρχεία — Plan Mode/recognition ΠΡΩΤΑ):**
1. `beam-types.ts`: `BeamIShapeParams` + `BeamParams.sectionKind?('rectangular'|'I-shape')` + `catalogProfile?` + `ishape?` sub-block.
2. `beam.schemas.ts` (ή αντίστοιχο Zod): νέα sub-schemas.
3. Beam geometry: I-shape footprint (reuse `buildIShapeLocal`) + 3D extrude path.
4. Beam→three converter: I-shape solid (έλεγξε units — STAIR pattern sceneUnitsToMeters, ΟΧΙ buggy fixture· βλ. memory).
5. 2D beam renderer (ADR-040 leaf): I-shape section outline.
6. `bim-to-atoe-mapping.ts`: steel beam → `kg`/`OIK-12.10`.
7. UI: beam contextual tab → catalog dropdown (reuse `ISHAPE_CATALOG`, generated options) + visibility gate (kind/sectionKind='I-shape').
8. beam bridge catalog helpers (mirror column).
9. tests + i18n (panel labels· τα διατομή-labels literal, μηδέν νέα keys).

**Αποφάσεις Giorgio ΗΔΗ ληφθείσες:** οικογένειες = IPE/HEA/HEB/HEM (όχι κοιλοδοκοί/UK/US). Ποιότητα = FULL ENTERPRISE + FULL SSOT.

**Ανοιχτό για διευκρίνιση στη Φάση 2:** πώς συνυπάρχει το `sectionKind` με το υπάρχον `BeamKind`/`BeamSectionType` (μην σπάσεις rectangular RC δοκάρια — default rectangular).

---

## 📌 ΣΗΜΕΙΩΣΕΙΣ
- ΜΗΝ αγγίξεις: railing (ADR-407), electrical-panel/MEP (ADR-408), ADR-409 αρχεία — άλλοι agents/sessions.
- ⚠️ Memory flag: το **MEP fixtureToMesh έχει latent units bug** — για 3D χρησιμοποίησε το **stair pattern** (sceneUnitsToMeters), ΟΧΙ fixture.
- Φάση 1 αρχεία (ήδη committed): `section-catalog.ts`, `contextual-column-tab.ts`, `section-catalog.test.ts`, `el/en dxf-viewer-shell.json`, `ADR-363`.
