# HANDOFF: Per-Room Floor Finishes — Revit-style (Full Enterprise + SSOT)

**Ημερομηνία**: 2026-06-06  
**Προηγούμενο session**: ADR-396 P10 (U-value τοίχων + IFC thermal export) — ΥΛΟΠΟΙΗΜΕΝΟ, pending commit από Giorgio  
**Επόμενο task**: NEW — Δάπεδο επικάλυψη ανά δωμάτιο (σαν Revit)  
**Μοντέλο**: Opus (Plan Mode) — 5+ αρχεία, 2+ domains, cross-cutting

---

## 1. ΤΙ ΖΗΤΗΣΕ Ο GIORGIO (verbatim)

> «Θέλω να προχωρήσουμε στην πλήρη και σωστή υλοποίηση. Θέλω υλοποίηση με σύστημα full enterprise + full SSOT όπως η Revit.»

**Context**: Η συζήτηση ξεκίνησε από το ερώτημα αν η εφαρμογή υποστηρίζει διαφορετικά πατωματικά υλικά ανά δωμάτιο (ξύλο στο υπνοδωμάτιο, πλακάκι στο μπάνιο, laminate στο σαλόνι).

**Απάντηση**: ΝΑΙ, αλλά με πρόβλημα — η τρέχουσα πλάκα έχει **ΕΝΑ DNA για ολόκληρο τον όροφο**. Αν βάλεις ξύλο ως στρώση, εμφανίζεται παντού. Δεν υπάρχει ανά-δωμάτιο διαφοροποίηση.

---

## 2. REVIT ΑΡΧΙΤΕΚΤΟΝΙΚΗ (Reference)

### Πώς κάνει το Revit:

```
Structural Slab (IfcSlab FLOOR)
  └─ DNA: [concrete 200mm] + [insulation 80mm] + [screed 50mm]
  └─ Ένα element ανά floor — ΔΕΝ αλλάζει ανά δωμάτιο

Floor Finish / Covering (IfcCovering FLOORING)  ← ΑΥΤΟ ΛΕΙΠΕΙ
  └─ Λεπτό element (10-50mm) που μπαίνει ΠΑΝΩτυ στην πλάκα
  └─ ΕΝΑ ΑΝΑ ΔΩΜΑΤΙΟ (ή τμήμα δαπέδου)
  └─ Δικό του footprint (= boundary του δωματίου)
  └─ Δικό του material (ξύλο / πλακάκι / laminate / μάρμαρο)
  └─ Δική του 2D εμφάνιση (hatch pattern)
  └─ Δικό του BOQ (τ.μ. × υλικό × πάχος)
  └─ Δική του θερμική συμβολή (R = d/λ)
```

### IFC Mapping:
- Structural slab → `IfcSlab` (FLOOR)
- Floor finish → `IfcCovering` (FLOORING) + `Pset_CoveringCommon` (Thickness, ThermalTransmittance)

---

## 3. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ ΤΗΣ APP

### Τι υπάρχει:
- `SlabEntity`: parametric πλάκα με DNA layers (ADR-412 slab family types)
- `ifc-covering-serializer.ts`: ήδη υπάρχει (εκτεταμένο για ETICS σε ADR-396 P10)
- `wall-material-catalog.ts`: catalog υλικών (εκτεταμένο με thermal props)
- ADR-413 PBR textures: system για υφές σε BIM elements
- ADR-412: slab family types με live preview

### Τι ΔΕΝ υπάρχει:
- ❌ `FloorFinishEntity` (νέο entity type)
- ❌ Ανά-δωμάτιο floor finish
- ❌ Floor finish material catalog (ξύλο/πλακάκι/laminate/μάρμαρο)
- ❌ 2D hatch per finish material
- ❌ 3D thin covering renderer
- ❌ Ribbon tab «Ιδιότητες Επικάλυψης Δαπέδου»
- ❌ IFC IfcCovering FLOORING (ETICS υπάρχει, FLOORING όχι)

---

## 4. ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ (Enterprise)

### Entity: `floor-finish` (FloorFinishEntity)

**ΟΧΙ** αλλαγή στο `SlabEntity` — το structural slab μένει ανέπαφο.  
**ΝΑΙ** νέο entity τύπου covering, σαν Revit:

```typescript
// floor-finish-types.ts
interface FloorFinishParams extends BimEntityParams {
  footprint: Point2D[];          // polygon boundary (= δωμάτιο)
  materialId: string;            // π.χ. 'floor-wood-oak', 'floor-tile-ceramic'
  thicknessMm: number;           // default 15 (ξύλο), 8 (πλακάκι), 12 (laminate)
  finishLevel?: number;          // z offset mm above slab (default 0 = on top)
  name?: string;                 // π.χ. "Υπνοδωμάτιο - Δρυς"
}
```

### Placement:
- Χρήστης ζωγραφίζει polygon (σαν πλάκα, tool `floor-finish`)
- Ή: επιλέγει υπάρχοντα walls → auto-detect boundary (Phase 2, future)

### Material Catalog (SSoT):
```typescript
// floor-finish-material-catalog.ts
FLOOR_FINISH_MATERIALS = {
  'floor-wood-oak':      { λ: 0.18, ρ: 700,  cp: 1700, color: '#C8A97E', hatch: 'wood' },
  'floor-wood-pine':     { λ: 0.15, ρ: 550,  cp: 1600, color: '#D4B896', hatch: 'wood' },
  'floor-tile-ceramic':  { λ: 1.00, ρ: 2000, cp: 840,  color: '#E8E0D0', hatch: 'tile' },
  'floor-tile-marble':   { λ: 2.80, ρ: 2700, cp: 880,  color: '#F5F2EE', hatch: 'tile' },
  'floor-laminate':      { λ: 0.17, ρ: 900,  cp: 1500, color: '#B8956A', hatch: 'wood' },
  'floor-parquet':       { λ: 0.18, ρ: 700,  cp: 1700, color: '#8B6340', hatch: 'wood' },
  'floor-epoxy':         { λ: 0.23, ρ: 1200, cp: 1000, color: '#9EB8C8', hatch: 'solid' },
  'floor-carpet':        { λ: 0.06, ρ: 200,  cp: 1300, color: '#8B7355', hatch: 'dot' },
}
```

### 2D Rendering:
- Hatch pattern per material type (wood grain, tile grid, dot for carpet)
- Semi-transparent fill (δεν κρύβει structural slab hatch από κάτω)
- Grips: 4 corner + center move (σαν slab)

### 3D Rendering:
- Thin box (footprint × thicknessMm) positioned just above slab top surface
- PBR texture from ADR-413 registry (wood/tile slugs)
- Ύψος: slab.topZ + finishLevel + thicknessMm

---

## 5. SLICES ΥΛΟΠΟΙΗΣΗΣ (Plan Mode → Orchestrator)

```
Slice 1: Types + Schema
  - floor-finish-types.ts (NEW)
  - floor-finish-entity.ts (NEW) — registration, prefix ffl_, enterprise ID
  - Update EntityType union + entity-bounds

Slice 2: Material Catalog (SSOT)
  - floor-finish-material-catalog.ts (NEW)
  - Thermal props (λ/ρ/cp) για U-value
  - Color + hatch type per material

Slice 3: 2D Renderer
  - floor-finish-renderer.ts (NEW, BimRenderer)
  - Hatch patterns (wood/tile/dot/solid)
  - Semi-transparent fill
  - Grips (centred-box-grips reuse — SSOT)

Slice 4: 3D Converter
  - floor-finish-to-three.ts (NEW)
  - Thin box geometry
  - PBR texture from ADR-413 material registry
  - Position above slab (z-aware)

Slice 5: DXF Scene Integration
  - dxf-scene-entity-converter.ts (EXTEND) — register floor-finish
  - BimSceneLayer.ts (EXTEND) — register 3D converter
  - Hit testing, selection, duplication

Slice 6: Ribbon Contextual Tab
  - RibbonFloorFinishWidget.tsx (NEW)
  - Material picker (dropdown from catalog)
  - Thickness input
  - Name field
  - Show U contribution (R = d/λ, display only)

Slice 7: IFC Export
  - ifc-covering-serializer.ts (EXTEND)
  - Add FLOORING predefined type (ξεχωριστό από CLADDING/COATING για ETICS)
  - Pset_CoveringCommon: Thickness + ThermalTransmittance

Slice 8: Persistence
  - Firestore commands (create/update/delete FloorFinishEntity)
  - enterprise-id.service: prefix 'ffl_' (νέο generator)

Slice 9: Tests
  - floor-finish-material-catalog.test.ts (U-value, catalog completeness)
  - ifc-covering-serializer FLOORING test
  - 2D bounds test
  - Grips test

Slice 10: ADR
  - Νέο ADR (search για highest existing ADR number + 1)
  - Update local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```

---

## 6. PENDING COMMITS (ΠΡΙΝ ΞΕΚΙΝΗΣΕΙΣ)

**ΔΕΝ κάνεις commit εσύ. Ο Giorgio θα κάνει τα παρακάτω πρώτα:**

Τα παρακάτω αρχεία είναι staged/modified από ADR-396 P10 + WS4:
- `src/subapps/dxf-viewer/bim/thermal/wall-assembly-thermal.ts`
- `src/subapps/dxf-viewer/bim/thermal/assembly-u-value.ts`
- `src/services/ifc/serializers/serializer-psets.ts`
- `src/services/ifc/serializers/ifc-wall-serializer.ts`
- `src/services/ifc/serializers/ifc-covering-serializer.ts`
- `src/subapps/dxf-viewer/bim/walls/wall-material-catalog.ts`
- `src/subapps/dxf-viewer/ui/components/bim-envelope/ThermalEnvelopeHost.tsx`
- `src/subapps/dxf-viewer/ui/ribbon/components/RibbonWallTypePropertiesWidget.tsx`
- `src/subapps/dxf-viewer/ui/ribbon/components/EditWallTypeDialog.tsx`
- `src/i18n/locales/el/dxf-viewer-shell.json`
- `src/i18n/locales/en/dxf-viewer-shell.json`
- `docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md`
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

**Working tree SHARED** — αγγίζεις μόνο δικά σου files. ΟΧΙ `git add -A`.

---

## 7. SSOT CHECKS (ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ)

```bash
# 1. Έλεγξε existing covering/finish/floor entities
grep -r "floor-finish\|FloorFinish\|IfcCovering.*FLOORING\|floor_finish" src/ --include="*.ts" --include="*.tsx" -l

# 2. Existing covering serializer
cat src/services/ifc/serializers/ifc-covering-serializer.ts

# 3. Slab entity (reference για floor-finish structure)
cat src/subapps/dxf-viewer/bim/geometry/slab-geometry.ts  # ή equivalent

# 4. Enterprise ID generators (για ffl_ prefix)
grep "ffl\|floor.*finish\|finish.*floor" src/services/enterprise-id.service.ts

# 5. Highest ADR number
ls docs/centralized-systems/reference/adrs/ | sort -t'-' -k2 -n | tail -5

# 6. BimRenderer interface (template για floor-finish-renderer)
cat src/subapps/dxf-viewer/bim/renderers/BaseEntityRenderer.ts  # ή equivalent

# 7. Grips SSoT (centred-box-grips reuse)
grep -r "centred-box-grips\|centredBoxGrips" src/ --include="*.ts" -l

# 8. ADR-413 PBR texture registry (για 3D textures)
grep -r "material.*registry\|UserMaterialRegistry\|resolveMaterialKey" src/ --include="*.ts" -l | head -10
```

---

## 8. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)

1. **ΟΧΙ commit χωρίς εντολή Giorgio** (N.-1)
2. **ΟΧΙ `--no-verify`** (N.-1.1)
3. **Working tree SHARED** — git add μόνο specific files
4. **SSOT FIRST** — grep πριν γράψεις οτιδήποτε (N.0.2)
5. **No `any`** (N.2)
6. **Inline styles forbidden** (N.3)
7. **Enterprise IDs**: prefix `ffl_` μέσω enterprise-id.service (N.6)
8. **Max 40 lines/function, 500 lines/file** (N.7.1)
9. **ADR update** στο ίδιο commit με τον κώδικα (N.0.1)
10. **Update local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt** μετά από κάθε υλοποίηση (N.15)

---

## 9. GOOGLE-LEVEL CHECKLIST (N.7.2)

| # | Ερώτηση | Απάντηση για floor-finish |
|---|---------|--------------------------|
| 1 | Proactive ή reactive? | Proactive — entity δημιουργείται σωστά στο placement |
| 2 | Race condition? | Όχι — footprint + material atomic στο create command |
| 3 | Idempotent? | Ναι — duplicate placement = 2 entities (διαφορετικά IDs) |
| 4 | Belt-and-suspenders? | Ναι — default material αν catalog miss |
| 5 | SSOT? | Ναι — floor-finish-material-catalog.ts SSoT, ΟΧΙ inline |
| 6 | Await ή fire-and-forget? | Await για persistence |
| 7 | Owner lifecycle; | FloorFinishPersistenceHost (mirror SlabPersistenceHost) |

---

## 10. ΑΡΧΕΙΟ ΑΝΑΦΟΡΑΣ

Τα παρακάτω αρχεία θα χρειαστείς ως templates:
- `src/subapps/dxf-viewer/bim/geometry/slab-geometry.ts` — slab footprint → polygon
- `src/subapps/dxf-viewer/bim/renderers/RoofRenderer.ts` — 3D renderer pattern
- `src/services/ifc/serializers/ifc-covering-serializer.ts` — IFC covering base (EXTEND, not fork)
- `src/subapps/dxf-viewer/bim/geometry/roof-eave-detail.ts` — thin geometry pattern
- `src/subapps/dxf-viewer/bim/walls/wall-material-catalog.ts` — material catalog pattern (copy structure for floor)

---

*Το HANDOFF αυτό δημιουργήθηκε αυτόματα στο τέλος του session 2026-06-06.*
*Ο Giorgio θα κάνει commit όλα τα pending αρχεία ADR-396 P10 ΠΡΙΝ ξεκινήσει το νέο task.*
