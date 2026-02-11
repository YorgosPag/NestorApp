# UC-BOQ-004: DXF Auto Extraction + Verification

**Parent ADR:** ADR-175 — Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ)
**Phase:** C (DXF Auto Extraction)
**Status:** Draft — Implementation Contract
**Date:** 2026-02-11
**Depends on:** UC-BOQ-001, UC-BOQ-002
**Blocks:** —

---

## 1. Σκοπός

Αυτόματη εξαγωγή ποσοτήτων BOQ από **DXF αρχεία κατόψεων**. Pipeline: Room Detection → Element Recognition → Quantity Calculation → BOQ Generation. Κάθε auto-extracted item περνά υποχρεωτικά **verification** πριν γίνει trusted.

Πρότυπο: Autodesk Takeoff, CostX PDF takeoff, PlanSwift Auto-Mode.

---

## 2. Actors

| Actor | Ρόλος | Ενέργειες |
|-------|-------|-----------|
| **Μηχανικός** | Κύριος | Upload DXF, trigger extraction, verify results |
| **QA Engineer** | Ποιοτικός έλεγχος | Accept/reject auto quantities, set confidence thresholds |
| **AI Pipeline** | Automated | Room classification, element detection |

---

## 3. Preconditions

1. UC-BOQ-001: BOQItem data model + service layer
2. DXF Viewer: υπάρχει ήδη (`src/subapps/dxf-viewer/`)
3. DXF αρχείο: valid 2D floorplan, layers ονομασμένα (WALLS, DOORS, WINDOWS, etc.)
4. Building + Floor mapping: DXF αντιστοιχεί σε κτίριο + όροφο

---

## 4. Data Model

### 4.1 Existing (ΗΔΗ στο BOQItem — bridge fields)

```typescript
// Πεδία ήδη στο BOQItem (από UC-BOQ-001):
source: 'manual' | 'dxf-auto' | 'dxf-verified';
confidenceScore: number | null;       // 0-1
qaStatus: 'pending' | 'accepted' | 'rejected' | null;
qaReasonCodes: string[];              // failure codes
drawingRevisionId: string | null;
measurementMethod: MeasurementMethod; // 'ai' | 'rule' | 'hybrid'
```

### 4.2 DXF Extraction Run

```typescript
interface DxfExtractionRun {
  id: string;                          // 'run_XXXXX'
  buildingId: string;
  floorId: string | null;
  dxfFileId: string;                   // FK → uploaded DXF
  drawingRevision: string;             // "Rev.A", "Rev.B"
  status: 'processing' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;

  // Pipeline results
  roomsDetected: number;
  elementsDetected: number;
  boqItemsGenerated: number;
  averageConfidence: number;           // 0-1

  // Errors
  warnings: ExtractionWarning[];
  errors: ExtractionError[];

  createdBy: string;
}

interface ExtractionWarning {
  type: 'open_polyline' | 'missing_layer' | 'unrecognized_block' |
        'low_confidence' | 'overlapping_rooms' | 'duplicate_element';
  message: string;
  location: { x: number; y: number } | null;
  layerName: string | null;
}

interface ExtractionError {
  type: 'no_walls_layer' | 'invalid_geometry' | 'extraction_timeout';
  message: string;
  fatal: boolean;
}
```

### 4.3 Detected Room

```typescript
interface DetectedRoom {
  id: string;
  extractionRunId: string;
  polygon: { x: number; y: number }[];  // Closed polygon points
  area: number;                          // m² — computed from polygon
  perimeter: number;                     // m — computed
  centroid: { x: number; y: number };
  classifiedType: RoomType;              // AI classification
  classificationConfidence: number;      // 0-1
  floorId: string | null;
  height: number | null;                 // Αν γνωστό (default = floor height)
  wallArea: number | null;               // perimeter × height − openings
  elements: DetectedElement[];           // Doors, windows σε αυτόν τον χώρο
}
```

### 4.4 Detected Element

```typescript
interface DetectedElement {
  id: string;
  type: 'door' | 'window' | 'sanitary' | 'electrical' | 'furniture';
  subType: string | null;                // 'single_door', 'double_window', 'toilet', 'sink'
  blockName: string;                     // DXF block name
  layerName: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number } | null;
  confidence: number;                    // 0-1
  roomId: string | null;                 // Σε ποιον χώρο ανήκει
}
```

---

## 5. Happy Path

### 5.1 Flow: DXF Upload + Extraction

```
1. Χρήστης → Building → Tab "Επιμετρήσεις"
2. Click "🔄 Αυτόματη Εξαγωγή από DXF"
3. Modal: "Επιλογή DXF αρχείου"
   • Αν υπάρχει ήδη uploaded DXF → επιλογή
   • Αν όχι → upload νέο
4. Επιλογή ορόφου (floor mapping)
5. Εισαγωγή drawing revision ("Rev.A")
6. Click "Εκκίνηση Ανάλυσης"
7. Processing spinner + progress:
   Step 1: Layer analysis... ✅
   Step 2: Room detection... ✅ (8 rooms found)
   Step 3: Element detection... ✅ (12 doors, 8 windows, 5 sanitary)
   Step 4: Quantity calculation... ✅
   Step 5: BOQ generation... ✅ (23 items generated)
8. Results screen (verification)
```

### 5.2 Pipeline Technical Steps

```
DXF File
  │
  ▼
[1] LAYER ANALYSIS
  • Parse layers: WALLS, DOORS, WINDOWS, SANITARY, ELECTRICAL
  • Validate required layers exist (minimum: WALLS)
  • Report missing expected layers as warnings
  │
  ▼
[2] ROOM DETECTION
  • Extract closed polylines from WALLS layer
  • ezdxf → Shapely polygonize (geometry library)
  • NetworkX cycle detection for complex topologies
  • Output: list of closed room polygons + area + perimeter
  │
  ▼
[3] ROOM CLASSIFICATION (AI)
  • Input: polygon shape, area, aspect ratio, nearby elements
  • Model: OpenAI gpt-4o-mini (or fine-tuned classifier)
  • Output: RoomType + confidence score
  • Reference: CubiCasa5K dataset patterns
  │
  ▼
[4] ELEMENT DETECTION
  • Scan blocks on DOORS/WINDOWS/SANITARY layers
  • Match block names to known patterns
  • Count elements per room
  • Extract dimensions where available
  │
  ▼
[5] QUANTITY CALCULATION
  Per room:
  • Floor area = polygon area (m²)
  • Ceiling area ≈ floor area (m²)
  • Wall area = perimeter × height − Σ(opening areas) (m²)
  • Baseboard length = perimeter − Σ(door widths) (m)
  • Door count (pcs)
  • Window count (pcs)
  • Sanitary count per type (pcs)
  │
  ▼
[6] BOQ GENERATION
  • Map quantities to BOQItem model
  • Assign categoryCode based on measurement type
  • Set source = 'dxf-auto'
  • Set confidenceScore per item
  • Set qaStatus = 'pending'
  • Write to boq_items collection
```

### 5.3 Flow: Verification (mandatory)

```
1. Extraction complete → results screen:
   ┌────────────────────────────────────────────────┐
   │ Αποτελέσματα Ανάλυσης DXF              [Close] │
   │                                                 │
   │ Χώροι: 8  |  Στοιχεία: 25  |  Εμπιστοσύνη: 87% │
   │                                                 │
   │ [Map View] ── χώροι χρωματισμένοι σε κάτοψη     │
   │                                                 │
   │ ┌───┬──────────┬──────┬────┬───────┬──────────┐ │
   │ │ ✓ │ Περιγραφή│ Μον. │Ποσ.│Εμπιστ.│ Status   │ │
   │ ├───┼──────────┼──────┼────┼───────┼──────────┤ │
   │ │ ☑ │Δάπεδο κου│ m²   │22.5│ 95%   │ ✅ Accept │ │
   │ │ ☑ │Τοίχοι κου│ m²   │48.2│ 88%   │ ✅ Accept │ │
   │ │ ☐ │Πόρτα μπάν│ pcs  │ 1  │ 72%   │ ⚠️ Review │ │
   │ │ ☑ │Νιπτήρας  │ pcs  │ 2  │ 91%   │ ✅ Accept │ │
   │ │ ☐ │Λεκάνη    │ pcs  │ 1  │ 45%   │ ❌ Reject │ │
   │ └───┴──────────┴──────┴────┴───────┴──────────┘ │
   │                                                 │
   │ [Reject All] [Accept Selected] [Accept All]      │
   └────────────────────────────────────────────────┘

2. Χρήστης reviews κάθε item:
   • Accept → qaStatus = 'accepted', source αμετάβλητο ('dxf-auto')
   • Edit + Accept → qaStatus = 'accepted', ποσότητα/τιμή τροποποιήθηκε
   • Reject → qaStatus = 'rejected' → item αρχειοποιείται

3. Click "Accept Selected"
   • Accepted items: source remains 'dxf-auto', qaStatus = 'accepted'
   • Χρήστης μπορεί αργότερα να αλλάξει σε 'dxf-verified' μετά site visit

4. Verified items εμφανίζονται στην κανονική BOQ λίστα
```

### 5.4 Flow: Re-extraction (νέα αναθεώρηση σχεδίου)

```
1. Νέο DXF (Rev.B) → trigger re-extraction
2. Σύστημα:
   • Τρέχει pipeline ξανά
   • Συγκρίνει με previous run (Rev.A)
   • Δείχνει diff: "5 items αμετάβλητα, 3 αλλαγμένα, 2 νέα, 1 αφαιρέθηκε"
3. Χρήστης decides: merge, replace, ή ignore
4. drawingRevisionId ενημερώνεται στα νέα/αλλαγμένα items
```

---

## 6. Edge Cases

| # | Σενάριο | Συμπεριφορά |
|---|---------|-------------|
| 1 | DXF χωρίς WALLS layer | Fatal error: "Δεν βρέθηκε layer τοίχων" |
| 2 | Open polylines (μη κλειστοί τοίχοι) | Warning + attempt Shapely close_rings, reduced confidence |
| 3 | Room classification < 50% | qaStatus = 'pending', highlight for manual review |
| 4 | Overlapping rooms | Warning: "Αλληλεπικαλυπτόμενοι χώροι", suggest manual fix |
| 5 | Unknown block (unrecognized door type) | Warning code: 'unrecognized_block', element skipped |
| 6 | Very large DXF (>100 rooms) | Batched processing, timeout 60s, progress indicator |
| 7 | Re-extraction on same revision | Warning: "Ίδια αναθεώρηση — θέλετε αντικατάσταση;" |
| 8 | Mixed metric/imperial units | Unit detection + conversion, warning if ambiguous |
| 9 | 3D elements in 2D floorplan | Ignore Z-axis, log warning |
| 10 | Accepted items → building deleted | Cascade soft-delete (existing Firestore pattern) |

---

## 7. Confidence Scoring

### 7.1 Per-Item Confidence Calculation

```typescript
function computeConfidence(item: DetectedQuantity): number {
  let score = 1.0;

  // Geometry quality
  if (item.hasOpenPolyline) score *= 0.7;
  if (item.hasSmallGaps) score *= 0.85;

  // Classification
  score *= item.roomClassificationConfidence;

  // Element recognition
  if (item.elementType !== null) {
    score *= item.blockMatchConfidence;
  }

  // Layer naming
  if (item.layerNameStandard) score *= 1.0;        // WALLS, DOORS → trusted
  else if (item.layerNameRecognized) score *= 0.9;  // Wall, Door → ok
  else score *= 0.6;                                // Layer-0, custom → risky

  return Math.round(score * 100) / 100;
}
```

### 7.2 Confidence Thresholds

| Score | Status | Action |
|-------|--------|--------|
| ≥ 0.85 | Auto-accept suggested | 🟢 Accept by default, user can reject |
| 0.60 – 0.84 | Review required | 🟡 Highlighted, user must explicitly accept |
| < 0.60 | Auto-reject suggested | 🔴 Reject by default, user can override |

### 7.3 QA Reason Codes

```typescript
type QAReasonCode =
  | 'open_polyline'          // Μη κλειστή πολυγωνική
  | 'missing_layer'          // Αναμενόμενο layer δεν βρέθηκε
  | 'unrecognized_block'     // Block δεν αναγνωρίστηκε
  | 'low_room_confidence'    // Room classification < 60%
  | 'overlapping_rooms'      // Αλληλεπικαλυπτόμενοι χώροι
  | 'dimension_mismatch'     // Υπολογισμένη vs labeled dimension
  | 'duplicate_element'      // Διπλότυπο στοιχείο
  | 'small_area'             // Room area < 1m² (πιθανό artifact)
  | 'extraction_timeout'     // Pipeline timeout
  | 'manual_override';       // Χρήστης αλλαξε χειροκίνητα
```

---

## 8. Service Operations

```typescript
interface DxfExtractionService {
  // Extraction
  startExtraction(buildingId: string, dxfFileId: string, floorId?: string, revision?: string): Promise<DxfExtractionRun>;
  getExtractionStatus(runId: string): Promise<DxfExtractionRun>;
  getExtractionResults(runId: string): Promise<DetectedRoom[]>;

  // Verification
  acceptItem(itemId: string): Promise<BOQItem>;
  rejectItem(itemId: string, reasonCodes: QAReasonCode[]): Promise<BOQItem>;
  acceptAll(runId: string): Promise<number>;  // returns count
  rejectAll(runId: string): Promise<number>;

  // Comparison
  compareWithPreviousRun(currentRunId: string, previousRunId: string): Promise<ExtractionDiff>;

  // Pipeline steps (internal)
  analyzeLayers(dxfData: DxfData): LayerAnalysis;
  detectRooms(dxfData: DxfData, layers: LayerAnalysis): DetectedRoom[];
  classifyRooms(rooms: DetectedRoom[]): Promise<DetectedRoom[]>;
  detectElements(dxfData: DxfData, rooms: DetectedRoom[]): DetectedElement[];
  calculateQuantities(rooms: DetectedRoom[], elements: DetectedElement[]): BOQItem[];
}
```

---

## 9. Firestore

### 9.1 Collections (νέα)

```
dxf_extraction_runs           # Extraction run metadata + results summary
```

### 9.2 Notes

- Detected rooms/elements: stored transiently in extraction run (ή σε subcollection)
- Generated BOQ items: written to existing `boq_items` (source='dxf-auto')
- No separate collection needed for detected rooms (ephemeral data)

---

## 10. Affected Files

### 10.1 Νέα Αρχεία

```
src/services/measurements/dxf-extraction-service.ts      # Orchestrator
src/services/measurements/dxf-room-detector.ts           # Room detection (Shapely/geometry)
src/services/measurements/dxf-element-detector.ts        # Block/element recognition
src/services/measurements/dxf-room-classifier.ts         # AI room classification (OpenAI)
src/services/measurements/dxf-quantity-calculator.ts     # Area/perimeter/count computation
src/services/measurements/dxf-confidence-scorer.ts       # Confidence scoring engine
src/types/measurements/dxf-extraction.ts                 # DxfExtractionRun, DetectedRoom, etc.
src/components/building-management/measurements/DxfExtractionModal.tsx
src/components/building-management/measurements/ExtractionResultsView.tsx
src/components/building-management/measurements/RoomMapVisualization.tsx
src/components/building-management/measurements/ConfidenceBadge.tsx
```

### 10.2 Τροποποιούμενα Αρχεία

```
src/config/firestore-collections.ts           # +DXF_EXTRACTION_RUNS
src/services/measurements/boq-service.ts      # +bulkCreateFromExtraction()
src/components/building-management/measurements/BOQActionsBar.tsx  # +DXF extraction button
src/i18n/locales/el/measurements.json         # +dxf extraction translations
src/i18n/locales/en/measurements.json
```

---

## 11. Acceptance Criteria

- [ ] DXF upload + floor selection works
- [ ] Layer analysis: identifies WALLS, DOORS, WINDOWS layers
- [ ] Room detection: closed polygons → rooms with area + perimeter
- [ ] Room classification: AI assigns RoomType with confidence
- [ ] Element detection: doors, windows, sanitary counted per room
- [ ] Quantity calculation: floor area, wall area, baseboard length correct
- [ ] BOQ items generated with source='dxf-auto', qaStatus='pending'
- [ ] Confidence scoring: per-item 0-1, with reason codes
- [ ] Verification UI: accept/reject individual items
- [ ] Color-coded confidence: 🟢 ≥85%, 🟡 60-84%, 🔴 <60%
- [ ] Re-extraction: diff view vs previous run
- [ ] Open polyline handling: warning + reduced confidence
- [ ] Processing timeout: 60s max, progress indicator

---

## 12. Dependencies (Technical)

| Dependency | Σκοπός | License |
|-----------|--------|---------|
| **ezdxf** (Python) or JS parser | DXF parsing | MIT ✅ |
| **Shapely** (Python) or **turf.js** | Geometry (polygon, area) | BSD ✅ |
| **NetworkX** (Python) or **graphology** | Cycle detection | BSD ✅ |
| **OpenAI gpt-4o-mini** | Room classification | API (existing) |

**Σημείωση:** Αν η extraction γίνεται server-side (Python), χρειάζεται serverless function ή external microservice. Αν client-side (JS), χρειάζεται turf.js + graphology.

---

## 13. Out of Scope

- 3D model parsing (BIM/IFC) → Future
- PDF takeoff → Future
- AI-based cost estimation → Future
- Automatic BOQ verification without human → Never (always needs review)

---

*Implementation contract for ADR-175 Phase C. ALL auto-extracted items MUST pass human verification (qaStatus flow). No auto-accept without user action.*
