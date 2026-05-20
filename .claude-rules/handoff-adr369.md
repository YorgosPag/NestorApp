# 🔴 HANDOFF — ADR-369 BIM Elevation Convention

**Date**: 2026-05-20
**Session ended at**: ~88% context, post Q4 answered
**Previous agent**: Claude Opus 4.7 (1M context)
**Next agent**: continuation της ίδιας Q&A διαδικασίας

---

## Κατάσταση (Status)

ADR-369 σε **PROPOSED** state. Q&A phase ενεργό. **4 από 10 ερωτήσεις απαντημένες**. Δεν έχει αρχίσει implementation ακόμα. User explicit instruction: «Αφού ολοκληρώσουμε τις ερωταπαντήσεις, αφού ολοκληρώσουμε όλες τις διευκρινίσεις που θέλεις, τότε θα προχωρήσουμε στην υλοποίηση κώδικα.»

## Τι έγινε

1. **ADR-369 δημιουργήθηκε**: `docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md`
2. **Index updates**: `adr-index.md` (ADR-368 + ADR-369 entries), `CLAUDE.md` (next free ADR = 370)
3. **Έρευνα 1**: Revit + AutoCAD (initial §1.1)
4. **Έρευνα 2 (deep)**: ArchiCAD, Vectorworks, Allplan, BricsCAD, IFC, Revit advanced (§9)
5. **Code investigation 1**: Current state per entity (slab/beam/wall/column/opening — §1.2)
6. **Code investigation 2**: Floor entity + Buildings page Floors tab (§9.0)
7. **Code investigation 3**: Negative numbers + auto-naming (Q6 findings inside §9.10)

## Critical Findings

### 🎉 Floor entity ΗΔΗ υπάρχει LIVE in production

- Firestore collection `floors` (top-level, `firestore-collections.ts:26`)
- Fields: `number`, `name`, `elevation` (meters), `height` (meters), `buildingId`, etc.
- IFC-compliant (mirrors `IfcBuildingStorey`)
- UI live at `/buildings` → καρτέλα Όροφοι (`FloorsTabContent.tsx`)
- **BIM entities (Wall/Slab/Beam/Opening/Column/SlabOpening) ΗΔΗ έχουν `floorId` FK**
- DEFAULT_STOREY_HEIGHT = 3.0m
- Auto-naming Ελληνικά + English (`intl-domain.ts:20-35`):
  - 0 → "Ισόγειο" / "Ground Floor"
  - -1 → "Υπόγειο" / "Basement"
  - -2 → "2ο Υπόγειο" / "Basement 2"
  - 1 → "1ος Όροφος"
- Cascade-shift logic signed-delta-correct (works for basements)

### Major Gap

BIM entities έχουν `floorId` FK αλλά **δεν διαβάζουν** `Floor.elevation` για 3D positioning. Όλα hardcoded από z=0. **Αυτό είναι το κύριο task του ADR-369**: wiring, όχι building.

## Q&A Status (4/10 answered)

### ✅ Q1 — Floor as entity vs scalar
**Answer**: Α (Revit-style entity). Discovery: ΗΔΗ ΥΠΑΡΧΕΙ.

### ✅ Q2/Q4 — FFL vs Top of Structural Slab
**Answer**: Hybrid A — FFL primary + auto-derived ToS.
- `Floor.elevation` = FFL (METRES)
- New field `Floor.finishThickness` (mm, default 80mm Greek typical)
- Derived `topOfStructuralSlab = elevation - finishThickness/1000`
- Auto-generated construction drawings + BOQ at ToS

### ✅ Q3/Q6 — Negative storeys (basements)
**Answer**: Revit + Full Enterprise — όλα είναι Floor entities με signed `number`.
- New `kind` field: `'foundation' | 'basement' | 'ground' | 'standard' | 'roof' | 'mezzanine'`
- Per-kind defaults & validation rules
- Auto-template on Building creation: Foundation @ lowest + Ground @ 0 + Roof @ top
- i18n keys missing: "Θεμέλια", "Δώμα", "Μεσοπάτωμα" → add to `el/building-storage.json`

### ✅ Q5 — Parametric coupling
**Answer**: Γ — Hybrid με opt-in binding (Revit pattern).
- `baseBinding: 'storey-floor' | 'absolute'`
- `topBinding: 'storey-ceiling' | 'absolute' | 'unconnected'`
- Default = bound (95% case)
- Auto-stretch trigger: `FloorService.update({ height })` → cascade subscriber

## Επόμενα Βήματα (Pending — Q5-Q10 from ADR list)

Continue Q&A in Greek, simple words, examples, ONE AT A TIME. Order remaining:

1. **Q2 (multi-building)**: Ένα project = ένα κτίριο, ή multiple buildings per project (όπως Revit Site)?
2. **Q3 (Project Base Point vs Survey Point)**: Geodetic / sea-level reference; ή local origin αρκεί;
3. **Q7 (Sloped slabs / variable thickness)**: MVP support ή post-MVP;
4. **Q8 (IFC export readiness)**: Schema design now for future IFC export, ή leave for later;
5. **Q9 (Naming convention)**: Default ονόματα ("L1" vs "Ισόγειο" vs "1ος όροφος") + auto-renumber rules;
6. **Q10 (Existing Firestore data)**: Πόσα production projects έχουν ήδη BIM data; zero-downtime migration;

After all 10 answered → start implementation (Phases 0-I in ADR-369 §9.9).

## Κρίσιμο Context

### User Preferences (από αυτή τη συνομιλία)

- ✅ **Revit + Full Enterprise** style for everything
- ✅ **Industry standard** (αν 4-5 παίχτες συγκλίνουν → that's the answer)
- ✅ **Completeness over MVP** (μην προτείνεις phased/minimal)
- ✅ Q&A: Ελληνικά, απλές λέξεις, παραδείγματα, ένα-ένα
- ✅ Update ADR after every answer
- ✅ NO implementation until ALL questions answered

### Πιθανές παγίδες

1. **Mε αλλάζεις μονάδες**: Floor χρησιμοποιεί METRES, BIM entities χρησιμοποιούν MILLIMETRES. Conversion layer απαραίτητο.
2. **Floor.elevation semantic τώρα είναι absolute z**: όχι offset από parent. Όταν multi-building έρθει, μπορεί να χρειαστεί refactor σε `offsetFromBuilding`.
3. **Cascade-shift για BIM entities δεν υπάρχει**: το cascade-shift λειτουργεί μόνο για other floors' elevations, ΟΧΙ για walls/slabs που έχουν `floorId`. Χρειάζεται extension.
4. **Existing 7 legacy DXF files**: Έχουν `EnterpriseComboBox` migration pending (ADR-001). Άσχετο με ADR-369 αλλά μπορεί να τα συναντήσεις.
5. **Pre-commit hooks**: SSoT ratchet, i18n ratchet, file size <500 lines, native-tooltip ratchet. Όλα BLOCK σε violations.

### NON-NEGOTIABLE rules

- ❌ NEVER git commit χωρίς explicit "commit" order από Giorgio (N.(-1))
- ❌ NEVER git push χωρίς explicit "push"/"στείλε"/"ανέβασε" order
- ❌ NEVER hardcoded i18n strings (defaultValue: 'literal' = forbidden)
- ✅ ALWAYS ADR Phase 1-4 workflow (read code → update ADR → implement → update ADR again → commit ADR+code together)
- ✅ Files max 500 lines, functions max 40 lines
- ✅ Greek responses (LANGUAGE RULE — overrides everything)

## Files in flux (uncommitted)

```
M src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts
M src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts
M src/subapps/dxf-viewer/hooks/canvas/useDxfSceneConversion.ts
M src/subapps/dxf-viewer/hooks/drawing/drawing-preview-generator.ts
?? docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md  (NEW)
M docs/centralized-systems/reference/adr-index.md  (added ADR-368, ADR-369 rows)
M CLAUDE.md  (next free ADR-370)
?? .claude-rules/handoff-adr369.md  (THIS FILE)
```

Pre-existing uncommitted work από previous commits (ADR-363/368) δεν επηρεάζεται.

## Όταν ξαναξεκινήσει η συνομιλία

1. Διάβασε αυτό το handoff
2. Διάβασε ADR-369 §9 (έχει όλη την έρευνα + answered questions)
3. Αν user γράψει «συνέχισε ADR-369» ή «επόμενη ερώτηση» → ξεκίνα από Q2 (multi-building support) — βλέπε Pending list παραπάνω
4. ΜΗΝ ξαναρωτήσεις τις 4 ήδη απαντημένες
5. Recall: ένα-ένα + ελληνικά + παραδείγματα + update ADR after each answer
