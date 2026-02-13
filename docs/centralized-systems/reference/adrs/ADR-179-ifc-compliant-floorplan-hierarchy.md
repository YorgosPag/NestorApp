# ADR-179: IFC-Compliant Floor Plan Import Hierarchy

| Field | Value |
|-------|-------|
| **ADR ID** | ADR-179 |
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-02-14 |
| **Category** | DXF Viewer / Import |
| **Author** | Claude Agent |
| **Approved By** | Γιώργος Παγώνης |

---

## Context

Ο DXF import wizard (`SimpleProjectDialog`) χρησιμοποιούσε **λανθασμένη ταξινόμηση** κατόψεων:

- "Κάτοψη Κτηρίου" / "Κάτοψη Αποθηκών" — διαχώριζε κατόψεις βάσει **περιεχομένου** αντί βάσει **ορόφου**
- "Κάτοψη Θ.Σ." (parking) — σε επίπεδο έργου, δημιουργούσε σύγχυση σε multi-storey parking
- Δεν ακολουθούσε το **IFC 4.3 (ISO 16739)** standard

### IFC 4.3 Hierarchy

```
IfcSite → IfcBuilding → IfcBuildingStorey → IfcSpace
```

Μια κάτοψη ανήκει **πάντα σε όροφο (BuildingStorey)**, ανεξάρτητα αν περιέχει δωμάτια, parking, ή αποθήκες. Δεν υπάρχει ξεχωριστός τύπος "parking plan" ή "storage plan" στα industry standards.

### Industry Practice

| Software | Approach |
|----------|----------|
| Autodesk Revit | Floor plan = View of a Level (BuildingStorey) |
| Bentley MicroStation | Plan view per storey |
| Trimble Connect | IFC hierarchy — Site > Building > Storey |
| Procore | Floor plans organized by building + floor |

---

## Decision

### Νέα ροή UI (IFC-compliant)

```
Βήμα 1: Εταιρεία
Βήμα 2: Έργο → [Γενική Κάτοψη Έργου (Site Plan)]
Βήμα 3: Κτίριο → Όροφος (υποχρεωτικός) → [Φόρτωση Κάτοψης Ορόφου]
Βήμα 4: Μονάδα → [Κάτοψη Μονάδας] (αμετάβλητο)
```

### Αλλαγές

**Βήμα 2 (Έργο):**
- ΑΦΑΙΡΕΘΗΚΕ: Κουμπί "Κάτοψη Θ.Σ." (parking σε επίπεδο έργου)
- ΜΕΤΟΝΟΜΑΣΤΗΚΕ: "Κάτοψη Έργου" → **"Γενική Κάτοψη Έργου"** (site plan)
- Hint: "Γενική κάτοψη/τοπογραφικό σε επίπεδο οικοπέδου — θέσεις κτιρίων, κοινόχρηστοι χώροι"

**Βήμα 3 (Κτίριο):**
- ΑΦΑΙΡΕΘΗΚΑΝ: Κουμπιά "Κάτοψη Κτηρίου" + "Κάτοψη Αποθηκών"
- Η επιλογή ορόφου γίνεται **υποχρεωτική και κυρίαρχη**
- Αν δεν υπάρχουν όροφοι → inline φόρμα δημιουργίας ορόφου
- Αν υπάρχουν → dropdown + κουμπί **"Φόρτωση Κάτοψης Ορόφου"**
- Αποθήκευση: `type: 'floor'` (αντί `'building'`/`'storage'`)

**Βήμα 4 (Μονάδα):** Αμετάβλητο.

---

## Before / After

### Before (pre-ADR-179)

```
Step 2: [Κάτοψη Έργου] [Κάτοψη Θ.Σ.]
Step 3: [Κάτοψη Κτηρίου] [Κάτοψη Αποθηκών]
         (floor section — only if floors exist)
```

### After (ADR-179)

```
Step 2: [Γενική Κάτοψη Έργου]
         "Γενική κάτοψη σε επίπεδο οικοπέδου..."

Step 3: "Επιλέξτε Όροφο & Φόρτωση Κάτοψης"
         [Floor dropdown] → [Φόρτωση Κάτοψης Ορόφου]
         — ή —
         "Δεν υπάρχουν όροφοι. Δημιουργήστε τον πρώτο:"
         [Input] [Δημιουργία Ορόφου]
```

---

## Backward Compatibility

- Existing floorplans με `type: 'building'`/`'storage'`/`'parking'` **παραμένουν αναγνώσιμα**
- Ο save path στο `performFloorplanImport` / `performPdfFloorplanImport` εξακολουθεί να χειρίζεται legacy types
- Μόνο νέες εισαγωγές χρησιμοποιούν `type: 'floor'` ή `type: 'project'`
- **Κανένα Firestore migration** δεν απαιτείται
- TypeScript union type διατηρεί όλα τα legacy values

---

## Files Changed

| File | Change |
|------|--------|
| `src/subapps/dxf-viewer/components/SimpleProjectDialog.tsx` | UI refactoring: removed parking/building/storage buttons, IFC floor-first approach, inline floor creation |
| `src/i18n/locales/el/dxf-viewer.json` | New keys: `sitePlan`, `selectFloorAndLoad`, `hintSitePlan`, `noFloorsYet`, `createFloor`, `floorNamePlaceholder` |
| `src/i18n/locales/en/dxf-viewer.json` | English mirror of new keys |
| `docs/centralized-systems/reference/adrs/ADR-179-ifc-compliant-floorplan-hierarchy.md` | This document |
| `docs/centralized-systems/reference/adr-index.md` | Added ADR-179 entry |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-14 | Initial implementation — IFC 4.3 compliant hierarchy |
