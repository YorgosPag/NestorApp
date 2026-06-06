# HANDOFF — ΥΛΟΠΟΙΗΣΗ: Thermal U-value (per-wall-type) + IFC alignment (Revit-grade)

**Ημερομηνία:** 2026-06-06
**Subapp:** `http://localhost:3000/dxf/viewer`
**Τύπος:** ΥΛΟΠΟΙΗΣΗ (follow-up της έρευνας 2026-06-06). FULL ENTERPRISE + FULL SSOT, parity Revit.
**ADR:** ADR-396 — νέα φάση **P10** (επέκταση P8 θερμική + P9 IFC).
**Μοντέλο:** Opus (αρχιτεκτονική) ή Sonnet (αν θες οικονομία — η υλοποίηση είναι καθαρή).
**⚠️ Working tree SHARED με άλλον agent** — μόνο στοχευμένα δικά μου αρχεία, **ΟΧΙ `git add -A`**.
**⚠️ COMMIT/PUSH τα κάνει ο Giorgio, ΟΧΙ ο agent. Καμία `--no-verify`. Γλώσσα: Ελληνικά.**

---

## 0. ΑΠΟΦΑΣΗ ΠΟΥ ΗΔΗ ΠΑΡΘΗΚΕ (μη την ξανασυζητάς)

Έγινε βαθιά έρευνα (code + ISO 6946 / ΤΟΤΕΕ / Revit / IFC4). Ετυμηγορία **Α vs Β**:

> **Β για το data model + Α για τα analytics (υβριδικό).**
> - **ΜΗΝ** βάλεις τη μόνωση ETICS ως φυσική στρώση στο `WallDna` → σπάει SSOT (διπλομέτρηση σε γεωμετρία/m²/BOQ). Το ETICS = building-envelope system, σωστά εκφρασμένο ως `IfcCovering`.
> - **ΑΛΛΑ** πάρε το Revit-parity win: υπολόγισε U **ανά τύπο τοίχου** από τα **υπάρχοντα** `WallDnaLayer`, και εμφάνισε «U τοίχου με κέλυφος» **παραρτώντας virtually** τη στρώση ETICS τη στιγμή του υπολογισμού (όχι αποθηκεύοντας).

Η αρχιτεκτονική είναι ΣΩΣΤΗ. Λείπουν ΔΥΟ φθηνά κομμάτια (η δομή δεδομένων υπάρχει ήδη).

---

## 1. ΤΙ ΛΕΙΠΕΙ (gaps, επιβεβαιωμένα από κώδικα)

| # | Gap | Σήμερα | Στόχος (Revit) | Σοβ. |
|---|---|---|---|---|
| 1 | U ανά τύπο τοίχου | μόνο hardcoded `REFERENCE_BARE_WALL_LAYERS` | U από πραγματικές DNA στρώσεις | 🔴 |
| 2 | Wall thermal στο IFC | οι τοίχοι **δεν** εξάγουν Pset/layer set | `IfcMaterialLayerSet` + `Pset_WallCommon.ThermalTransmittance` | 🔴 |
| 3 | `Pset_MaterialThermal` | μόνο `ThermalConductivity` | + `SpecificHeatCapacity` | 🟢 |
| 4 | ADR §3 διάγραμμα γρ.87 | λέει ψευδώς ότι wall envelope data «ΥΠΑΡΧΕΙ» στο DNA | διόρθωση | 🟡 |

**Βάση που ΥΠΑΡΧΕΙ ήδη (μην ξαναφτιάχνεις):**
- `bim/types/wall-dna-types.ts` → `WallDnaLayer { thickness(mm), materialId, side:'exterior'|'core'|'interior' }`.
- `bim/walls/wall-material-catalog.ts` → `WALL_MATERIAL_LAMBDA` + `getThermalConductivityLambda(materialId)`.
- `bim/thermal/assembly-u-value.ts` → `computeAssemblyUValue(layers, surface?)` = ISO 6946 `1/(Rsi+Σd/λ+Rse)`, `ThermalLayer{thickness_m,lambda}`, `RSI_WALL_DEFAULT 0.13`/`RSE_WALL_DEFAULT 0.04`.
- `bim/thermal/kenak-thermal-config.ts` → `KENAK_MAX_U_WALL` (Α0.55/Β0.45/Γ0.40/Δ0.35), `REFERENCE_BARE_WALL_LAYERS`.
- IFC: `services/ifc/` πλήρες pipeline. `serializers/ifc-wall-serializer.ts` (geometry only, **κανένα Pset**), `serializers/ifc-covering-serializer.ts` (ETICS = `IfcCovering INSULATION` + `IfcRelCoversBldgElements` + `IfcMaterialLayerSet` + `Pset_MaterialThermal.ThermalConductivity` — **σωστό, μην το χαλάσεις**).
- `ui/components/bim-pset/pset-templates.ts` → `PSET_TEMPLATES.Pset_WallCommon` (έχει ήδη `ThermalTransmittance:0`, `IsExternal`, `LoadBearing`). **Πεδία SSoT.**
- Header IFC: `services/ifc/ifc-step-writer.ts` → `FILE_SCHEMA(('IFC4'))`. Στόχος = **IFC4**.

**Επιβεβαιωμένα standards facts (από έρευνα — μη τα ξαναψάχνεις):**
- ISO 6946 Rsi/Rse: τοίχος 0.13/0.04, στέγη(πάνω) 0.10/0.04, δάπεδο(κάτω) 0.17/0.04. Αεροδιάκενα + ανομοιογενείς στρώσεις → ISO 6946. Θερμογέφυρες (ψ/χ) → ISO 14683/10211 (**ο Revit στο type-level τις αγνοεί κι αυτός** → η απλοποίησή μας = αποδεκτό parity).
- IFC4 `Pset_MaterialThermal`: `ThermalConductivity` (`IfcThermalConductivityMeasure`, W/mK), `SpecificHeatCapacity` (`IfcSpecificHeatCapacityMeasure`, J/kgK). MassDensity ανήκει στο `Pset_MaterialCommon` (όχι Thermal). Attach μέσω `IfcMaterialProperties` που δείχνει στο `IfcMaterial` — **ήδη το κάνουμε σωστά**.
- `Pset_WallCommon.ThermalTransmittance` = `IfcThermalTransmittanceMeasure` (W/m²K), υπάρχει IFC2x3 + IFC4.
- `IfcCovering` PredefinedType (IfcCoveringTypeEnum) έχει `CLADDING` + `INSULATION`. `IfcRelCoversBldgElements` = σωστή σχέση. Semantic-only (Representation=$) = valid.

---

## 2. ΠΛΑΝΟ ΥΛΟΠΟΙΗΣΗΣ (εγκεκριμένο)

### WS1 — Per-wall-type U-value (analytics, SSOT core)
- **NEW** `src/subapps/dxf-viewer/bim/thermal/wall-assembly-thermal.ts` (pure, ΟΧΙ state/geometry):
  - `wallDnaToThermalLayers(dna): ThermalLayer[]` — ανά `WallDnaLayer`: mm→m (`thickness*0.001`), λ από `getThermalConductivityLambda(materialId)`· **skip** στρώση με άγνωστο λ (custom).
  - `computeWallTypeUValue(dna, surface?)` → reuse `computeAssemblyUValue`.
  - `computeWallTypeUValueWithEnvelope(dna, envelopeLayer:{thickness_m,materialId}, surface?)` → virtual append της ETICS στρώσης (exterior) **χωρίς mutation** του DNA.
- **Extend** `bim/thermal/assembly-u-value.ts`: SSoT `SURFACE_RESISTANCES_BY_FLOW` (`wall` 0.13/0.04 · `roof` 0.10/0.04 · `floor` 0.17/0.17 — ISO 6946). Default παραμένει wall (μηδέν regression).
- **Wire** `ui/components/bim-envelope/ThermalEnvelopeDialog.tsx`: αν υπάρχει επιλεγμένος τοίχος → πραγματικό per-type U (`computeWallTypeUValueWithEnvelope`)· αλλιώς fallback `REFERENCE_BARE_WALL_LAYERS` (ο dialog είναι ανά-όροφο). Reuse υπάρχον U section.

### WS2 — Wall thermal στο IFC (🔴 μεγαλύτερο interop gap)
- **NEW** `src/services/ifc/serializers/serializer-psets.ts` (δεν υπάρχει Pset emission σήμερα): helpers
  `appendPropertySingleValue(graph, name, typedValue)` + `appendRelDefinesByProperties(graph, objectIDs, psetID)` + `appendPropertySet(graph, name, propIDs)`. Reusable (wall τώρα, slab/column μετά).
- **Extend** `services/ifc/serializers/ifc-wall-serializer.ts` (⚠️ ADR-369 αρχείο — δες ότι ΔΕΝ είναι ADR-040 micro-leaf· είναι serializer, ασφαλές):
  - Material: `IfcMaterialLayerSet`(στρώσεις από DNA) + `IfcMaterialLayer`(πάχος m + `IfcMaterial(name=materialId)`) + `IfcMaterialLayerSetUsage` + `IfcRelAssociatesMaterial` → wall. (Revit-parity layered material.)
  - Pset: `Pset_WallCommon` με `IsExternal`(category==='exterior'), `LoadBearing`, `ThermalTransmittance`=`typed('IfcThermalTransmittanceMeasure', computeWallTypeUValue(dna))`. Πεδία/defaults από `PSET_TEMPLATES.Pset_WallCommon`. Μόνο όταν `includePsets`.
  - Προσοχή: ο wall χρειάζεται `dna` — δες αν `WallEntity.params` έχει `dna`/`materialId` διαθέσιμο εδώ· αν όχι, πέρνα το μέσω context.

### WS3 — Pset_MaterialThermal completeness (🟢)
- **Extend** `bim/walls/wall-material-catalog.ts`: optional `WALL_MATERIAL_SPECIFIC_HEAT` (J/kgK) + `WALL_MATERIAL_DENSITY` (kg/m³) maps + `getSpecificHeat()`/`getDensity()` (EN ISO 10456 / ΤΟΤΕΕ 20701-2 αντιπροσωπευτικές).
- **Extend** `services/ifc/serializers/ifc-covering-serializer.ts` `appendThermalPset`: + `SpecificHeatCapacity` (`IfcSpecificHeatCapacityMeasure`) όταν γνωστό. (Density → προαιρετικά `Pset_MaterialCommon.MassDensity`.)

### WS4 — Docs (N.15)
- ADR-396: νέα φάση **P10** changelog· **fix §3 διάγραμμα γρ.87** (wall envelope data ΔΕΝ είναι στο DNA — είναι per-floor spec + virtual U)· τεκμηρίωση «B data + A analytics»· update §3.2 πίνακα (wall thermal πλέον DONE).
- `C:\Nestor_Pagonis\local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` → update item.
- **ΟΧΙ** `adr-index.md` (shared tree).

---

## 3. SSOT POINTS (μηδέν fork)
- λ / cp / ρ → **μόνο** `wall-material-catalog.ts`.
- U math → **μόνο** `assembly-u-value.ts` (+ thin adapter `wall-assembly-thermal.ts`).
- Pset πεδία/defaults → **μόνο** `pset-templates.ts`.
- Surface resistances → **μόνο** `assembly-u-value.ts`.

## 4. TESTS
- **NEW** `bim/thermal/__tests__/wall-assembly-thermal.test.ts` — DNA→layers, U ανά τύπο, U με κέλυφος, skip άγνωστου λ, surface-flow.
- **EXTEND** `services/ifc/serializers/__tests__/` (wall serializer test) — layer set εκπέμπεται + `Pset_WallCommon.ThermalTransmittance` == U calc.
- **EXTEND** `services/ifc/serializers/__tests__/ifc-covering-serializer.test.ts` — `SpecificHeatCapacity` όταν γνωστό υλικό.

## 5. CONSTRAINTS
N.2 (όχι `any`) · N.11 (i18n keys πρώτα αν προσθέσεις labels) · N.7.1 (≤500 γρ/αρχείο, ≤40 γρ/function) · shared tree → **μόνο τα δικά μου αρχεία**, ΟΧΙ `git add -A` · ΟΧΙ commit/push (Giorgio) · ΟΧΙ `--no-verify`.

## 6. VERIFICATION
- `npm test` στα νέα/αλλαγμένα suites (πράσινα).
- `npx tsc --noEmit` background (μη blocking).
- IFC export → άνοιξε το `.ifc` (STEP text) → επιβεβαίωσε `IFCMATERIALLAYERSET` + `IFCRELDEFINESBYPROPERTIES` με `Pset_WallCommon` + `THERMALTRANSMITTANCE`.
- Dialog: επίλεξε τοίχο → δες per-wall-type U (όχι σταθερό reference).

## 7. ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΟΥ SESSION
1. Διάβασε αυτό το handoff + (αν χρειαστεί) `bim/thermal/assembly-u-value.ts` + `ifc-wall-serializer.ts` + `ifc-covering-serializer.ts`.
2. Ξεκίνα WS1 (καθαρό pure module + test) → WS2 → WS3 → WS4.
3. Μετά από κάθε WS: τρέξε το αντίστοιχο test. tsc background.
4. Στο τέλος: ενημέρωσε ADR-396 P10 + ΕΚΚΡΕΜΟΤΗΤΕΣ. **Σταμάτα — ο Giorgio κάνει commit.**
