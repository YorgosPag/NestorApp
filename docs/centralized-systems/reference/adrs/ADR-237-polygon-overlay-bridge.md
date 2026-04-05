# ADR-237: Polygon Overlay Bridge (DXF Viewer → Δημόσια Σελίδα Ακινήτων)

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED (4/4 SPECs complete) |
| **Date** | 2026-03-16 |
| **Category** | Canvas & Rendering / Property Management |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Το Πρόβλημα

Η εφαρμογή διαθέτει **δύο ξεχωριστά polygon systems** που δεν επικοινωνούν μεταξύ τους:

- **Σύστημα A** (DXF Viewer): Ο χρήστης σχεδιάζει overlays πάνω στα DXF σχέδια — αποθηκεύονται σε Firestore real-time
- **Σύστημα B** (Property Viewer): Η σελίδα κάτοψης ορόφου εμφανίζει polygons πάνω σε floorplan εικόνες — vertices embedded σε Unit documents

**Αποτέλεσμα**: Ο χρήστης σχεδιάζει polygons στο DXF Viewer, αλλά αυτά **δεν εμφανίζονται** στην κάτοψη ορόφου. Χρειάζεται χειροκίνητη αντιγραφή vertices — error-prone και μη-scalable.

### Target Page (Σελίδα-Στόχος)

**Route**: `/properties?view=floorplan&selected={unitId}`
**Παράδειγμα**: `https://nestor-app.vercel.app/properties?view=floorplan&selected=unit_1e863f23-116f-4470-a089-7b379547148f`
**Τι δείχνει**: Κάτοψη ορόφου όπου βρίσκεται το επιλεγμένο ακίνητο
**Πρόσβαση**: Protected route — απαιτεί Firebase authentication

**Component Chain**:
```
/properties (page.tsx)
  └─ view=floorplan → PropertyManagementPageContent
                       ├─ usePublicPropertyViewer()
                       └─ ReadOnlyPropertyViewerLayout
                          └─ ReadOnlyMediaViewer
                             └─ FloorplanGallery (Canvas 2D)
```

**Κρίσιμα αρχεία**:
- `src/app/properties/page.tsx` — Route handler, επιλογή grid/floorplan view
- `src/components/property-management/PropertyManagementPageContent.tsx` — Main layout
- `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx` — Χρησιμοποιεί FloorplanGallery
- `src/components/shared/files/media/FloorplanGallery.tsx` — Canvas rendering target

### Τρέχοντα Ευρήματα Κώδικα (2026-03-16)

#### Σύστημα A: DXF Viewer Overlays

| Πεδίο | Τιμή |
|-------|------|
| **Firestore Collection** | `dxf-overlay-levels/{levelId}/items` |
| **Store** | `src/subapps/dxf-viewer/overlays/overlay-store.tsx` (417 γραμμές) |
| **Types** | `src/subapps/dxf-viewer/overlays/types.ts` (γρ. 27-43) |
| **Polygon Format (Memory)** | `Array<[number, number]>` (tuples) |
| **Polygon Format (Firestore)** | `Array<{x: number, y: number}>` (objects) |
| **Sync** | Real-time `onSnapshot()` (γρ. 61-110) |
| **Legacy Format** | Flat array `[x1, y1, x2, y2, ...]` — μετατρέπεται αυτόματα (γρ. 78-96) |

**Overlay Interface** (types.ts γρ. 27-43):
```typescript
interface Overlay {
  id: string;
  levelId: string;
  kind: OverlayKind;       // 'unit' | 'parking' | 'storage' | 'footprint'
  polygon: Array<[number, number]>;  // world coords [x, y]
  status?: PropertyStatus;
  label?: string;
  linked?: {
    unitId?: string;
    parkingId?: string;
    storageId?: string;
  };
  style?: OverlayStyle;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}
```

#### Σύστημα B: Property Viewer Polygons

| Πεδίο | Τιμή |
|-------|------|
| **Component** | `src/components/property-viewer/FloorPlanCanvas/PropertyPolygon.tsx` (92 γραμμές) |
| **Path Rendering** | `src/components/property-viewer/FloorPlanCanvas/PropertyPolygonPath.tsx` (90 γραμμές) |
| **Hover Info** | `src/components/property-viewer/PropertyHoverInfo.tsx` (118 γραμμές) |
| **Hover Hook** | `src/features/property-hover/hooks/useHoveredProperty.ts` (10 γραμμές) |
| **Vertex Format** | `Array<{x: number, y: number}>` (objects) |
| **Rendering** | SVG `<path>` element (M/L/Z commands) |
| **Types** | `src/types/property-viewer.ts` (γρ. 82) |
| **Hit-Testing** | ❌ **Δεν υλοποιημένο** |

**SVG Path Generation** (PropertyPolygonPath.tsx γρ. 46-48):
```typescript
const pathData = property.vertices
  .map((vertex, index) => `${index === 0 ? 'M' : 'L'} ${vertex.x} ${vertex.y}`)
  .join(' ') + ' Z';
```

#### FloorplanGallery (Canvas Rendering Target)

| Πεδίο | Τιμή |
|-------|------|
| **File** | `src/components/shared/files/media/FloorplanGallery.tsx` (980 γραμμές) |
| **DXF Rendering** | Canvas 2D — `renderDxfToCanvas()` (γρ. 157-308) |
| **PDF Rendering** | `<iframe>` (γρ. 778) |
| **Image Rendering** | `<img>` with zoom/pan (γρ. 787) |
| **Polyline Drawing** | `canvas.lineTo()` from vertices (γρ. 227-247) |

### Κρίσιμο Κενό: Level Interface χωρίς `floorId`

**Αρχείο**: `src/subapps/dxf-viewer/systems/levels/config.ts` (γρ. 8-14)

```typescript
export interface Level {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
  // ❌ MISSING: floorId — χωρίς αυτό δεν μπορούμε να βρούμε
  //    ποια overlays ανήκουν σε ποιον floor
}
```

Η `Property` interface (Σύστημα B) **έχει** `floorId: string` (property-viewer.ts γρ. 81), αλλά η `Level` interface του DXF Viewer **δεν έχει** αντίστοιχο πεδίο. Αυτό είναι blocking — χωρίς `floorId` στο Level, δεν μπορούμε να κάνουμε map τα overlays ενός level στον αντίστοιχο floor.

---

## 2. Decision

### Αρχιτεκτονική: Bridge, Not Duplicate

**Τα `dxf-overlay-levels` παραμένουν Single Source of Truth (SSoT)** για polygon geometry. Δεν αντιγράφονται vertices σε Unit documents.

```
┌─────────────────────┐           ┌──────────────────────┐
│   DXF Viewer        │           │  Property Viewer     │
│   (Σύστημα A)       │           │  (Σύστημα B)         │
│                     │           │                      │
│  overlay-store      │           │  FloorplanGallery    │
│  ↕ onSnapshot()     │  Bridge   │  + Overlay Layer     │
│  Firestore:         │ ────────→ │                      │
│  dxf-overlay-levels │  read-    │  useFloorOverlays()  │
│  /{levelId}/items   │  only     │  ↕ onSnapshot()      │
│                     │           │  (same Firestore     │
│  WRITE + READ       │           │   collection)        │
│                     │           │  READ-ONLY           │
└─────────────────────┘           └──────────────────────┘
```

### Βασικές Αποφάσεις

1. **Ένα Firestore collection** — `dxf-overlay-levels` παραμένει SSoT
2. **Read-only hook** — νέο `useFloorOverlays(floorId)` για τη δημόσια σελίδα
3. **Δυναμικά χρώματα** — `overlay.linked.unitId` → `unit.commercialStatus` → χρώμα
4. **Canvas hit-testing** — `pointInPolygon` algorithm για hover detection
5. **Level-to-Floor mapping** — νέο `floorId` πεδίο στο Level interface
6. **Διαχωρισμός Σχεδίασης & Σύνδεσης** — Τα περιγράμματα σχεδιάζονται ΜΙΑ φορά, η σύνδεση αλλάζει ελεύθερα

### Κρίσιμη Αρχιτεκτονική: Σχεδίαση ≠ Σύνδεση

**ΑΠΟΦΑΣΗ**: Η σχεδίαση περιγραμμάτων και η σύνδεση με entities είναι **δύο ανεξάρτητες διαδικασίες**.

#### Βήμα 1: Σχεδίαση Περιγραμμάτων (DXF Viewer — μία φορά)

Ο χρήστης φορτώνει κάτοψη (π.χ. υπόγειο) στον καμβά και σχεδιάζει περιγράμματα:

```
┌─────────────────────────────────────────────────┐
│  ΚΑΤΟΨΗ ΥΠΟΓΕΙΟΥ (DXF Viewer)                  │
│                                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐       ┌──────┐   │
│  │Αποθ. │  │Αποθ. │  │Αποθ. │  ...  │Αποθ. │   │
│  │  01   │  │  02   │  │  03   │       │  15   │   │
│  └──────┘  └──────┘  └──────┘       └──────┘   │
│                                                  │
│  15 περιγράμματα → Αποθήκευση στο Firestore     │
│  Τα περιγράμματα ΔΕΝ ξαναγίνονται. ΤΕΛΟΣ.      │
└─────────────────────────────────────────────────┘
```

Κάθε περίγραμμα αποθηκεύεται ως overlay με:
- `polygon`: Array<[x, y]> — τα σημεία του περιγράμματος
- `kind`: `'storage'` ή `'parking'` ή `'unit'`
- `label`: "Αποθ. 01", "P-12", κ.λπ.
- `linked`: **αρχικά κενό** — η σύνδεση γίνεται αργότερα

#### Βήμα 2: Σύνδεση με Entities (UI Διαχείρισης — αλλάζει ελεύθερα)

Ο χρήστης πηγαίνει στη **σελίδα διαχείρισης μονάδων** (ΟΧΙ στο DXF Viewer):

```
┌───────────────────────────────────────────────────────┐
│  ΔΙΑΧΕΙΡΙΣΗ ΜΟΝΑΔΩΝ → A-DI-1.01 → Παρακολουθήματα   │
│                                                        │
│  Αποθήκη:              ┌────────────────────┐          │
│                        │ ▼ Αποθ. 01         │          │
│                        │   Αποθ. 02         │          │
│                        │   Αποθ. 03         │          │
│                        │   ...              │          │
│                        └────────────────────┘          │
│                                                        │
│  Θέση Στάθμευσης:      ┌────────────────────┐          │
│                        │ ▼ P-12             │          │
│                        └────────────────────┘          │
│                                                        │
│  [Αποθήκευση]                                          │
└───────────────────────────────────────────────────────┘
```

Ο χρήστης επιλέγει από dropdown:
- **Αποθήκη**: Αποθ. 01 (η ετικέτα που έδωσε κατά τη σχεδίαση)
- **Θέση Στάθμευσης**: P-12

**Αποτέλεσμα στο Firestore**:
- Unit document: `appurtenances.storage = "storage_01"`, `appurtenances.parking = "parking_12"`
- Overlay document: `linked.storageId = "storage_01"` (αυτόματη αντιστοίχιση)

#### Αλλαγή Σύνδεσης (Διόρθωση Λάθους)

**Ο χρήστης ΔΕΝ χρειάζεται να ξανασχεδιάσει τίποτα.** Πηγαίνει στη διαχείριση:

```
ΠΡΙΝ (λάθος):     A-DI-1.01 → Αποθ. 01
ΜΕΤΑ (διόρθωση):  A-DI-1.01 → Αποθ. 05  ✅  (αλλαγή μόνο dropdown)

Τα 15 περιγράμματα ΜΕΝΟΥΝ ως έχουν.
Μόνο η σύνδεση αλλάζει στη βάση δεδομένων.
```

#### Η Αλυσίδα Δεδομένων (Data Chain)

```
ΣΧΕΔΙΑΣΗ (μία φορά, DXF Viewer):
  Περίγραμμα → overlay { polygon, kind: 'storage', label: 'Αποθ. 01' }

ΣΥΝΔΕΣΗ (UI Διαχείρισης, αλλάζει ελεύθερα):
  A-DI-1.01 → appurtenances → storageId: 'storage_01'
  storage_01 → overlayId: 'overlay_xxx' (αυτόματη αντιστοίχιση μέσω label)

ΕΜΦΑΝΙΣΗ (Σελίδα Ακινήτων, read-only):
  Overlay → linked.storageId → storage → unit.appurtenances → A-DI-1.01
  → Εμφάνιση: "Αποθ. 01 ανήκει στο A-DI-1.01"
  → Κλικ "Δείξε →" → πλοήγηση στο υπόγειο + highlight polygon
```

#### Πλεονεκτήματα Αυτής της Προσέγγισης

- ✅ **Σχεδίαση μία φορά** — 15 αποθήκες σχεδιάζονται ΜΟΝΟ μία φορά
- ✅ **Ελεύθερη αλλαγή σύνδεσης** — χωρίς ξανασχεδίαση
- ✅ **Διόρθωση λαθών** — από τη σελίδα διαχείρισης, όχι από τον καμβά
- ✅ **Ανεξαρτησία** — ο σχεδιαστής κάνει τη δουλειά του, ο πωλητής τις συνδέσεις
- ✅ **Audit trail** — η αλλαγή σύνδεσης καταγράφεται στο ιστορικό

### Polygon Format Conversion

| Σύστημα | Memory Format | Firestore Format |
|---------|--------------|-----------------|
| DXF Overlays | `[number, number][]` (tuples) | `{x, y}[]` (objects) |
| Property Viewer | `{x, y}[]` (objects) | N/A — embedded in units |
| **Bridge** | `{x, y}[]` (objects) | Reads `{x, y}[]` from Firestore directly |

Ο bridge θα διαβάζει τα Firestore objects `{x, y}` **χωρίς μετατροπή** — ήδη compatible με το Property Viewer format.

---

## 3. Φασεολόγιο Υλοποίησης

### Φάση 1: Level-to-Floor Mapping

**Στόχος**: Κάθε DXF Level να γνωρίζει σε ποιον Floor ανήκει.

#### Τρέχουσα Κατάσταση (Έρευνα 2026-03-16)

**Ήδη υπάρχουν:**
- ✅ `floors` collection στο Firestore — `Floor { id, buildingId, name, level, area }`
  (`src/types/building/contracts.ts` γρ. 101-109)
- ✅ `ReadOnlyMediaViewer` δέχεται `levels` array με `floorId` στα props
  (`src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx`)
- ✅ `useFloorFloorplans(floorId)` hook δουλεύει ήδη
  (`src/hooks/useFloorFloorplans.ts`)

**Λείπει ΜΟΝΟ:**
- ❌ `Level` interface δεν έχει `floorId` (`src/subapps/dxf-viewer/systems/levels/config.ts` γρ. 8-14)
- ❌ `dxf-viewer-levels` Firestore documents δεν αποθηκεύουν `floorId`

#### Ενέργειες

| Ενέργεια | Αρχείο |
|---------|--------|
| Προσθήκη `floorId?: string` στο `Level` interface | `systems/levels/config.ts` |
| Αποθήκευση `floorId` στα `dxf-viewer-levels` Firestore documents | `LevelsSystem.tsx` |
| Auto-populate: Όταν δημιουργείται Level σε DXF project που ανήκει σε building, αυτόματη σύνδεση με τον αντίστοιχο floor | Level creation logic |

**Εκτίμηση**: Μικρή αλλαγή, backward-compatible (optional field). Τα existing levels χωρίς `floorId` συνεχίζουν να δουλεύουν κανονικά.

### Φάση 2: Read-Only Overlay Hook

**Στόχος**: Νέο hook `useFloorOverlays(floorId)` που φορτώνει overlays read-only.

```typescript
// Proposed API
function useFloorOverlays(floorId: string | null): {
  overlays: ReadonlyArray<OverlayItem>;
  loading: boolean;
  error: string | null;
}
```

| Ενέργεια | Αρχείο |
|---------|--------|
| Query: Level documents where `floorId === targetFloorId` | Νέο hook |
| Sub-query: `dxf-overlay-levels/{levelId}/items` | onSnapshot() |
| Filter: μόνο overlays με `linked.unitId` (skip footprints) | Hook logic |
| **Δεν** τροποποιεί overlays — read-only | — |

**Dependency**: Φάση 1 (χρειάζεται `floorId` στα Level documents).

### Φάση 3: Canvas Overlay Rendering

**Στόχος**: Rendering polygon overlays πάνω σε **ΟΛΟΥΣ τους τύπους κάτοψης** (DXF, PDF, εικόνα).

**ΑΠΟΦΑΣΗ**: Τα overlays εμφανίζονται ανεξαρτήτως τύπου floorplan — DXF, PDF, JPG/PNG.

#### Rendering Strategy ανά τύπο

| Τύπος Κάτοψης | Τρέχον Rendering | Overlay Strategy |
|---------------|-----------------|-----------------|
| **DXF** | Canvas 2D (`renderDxfToCanvas()`) | Overlay layer **πάνω στο ίδιο Canvas** μετά το DXF rendering |
| **PDF** | `<iframe>` | Transparent **Canvas overlay** πάνω από το iframe (absolute positioned) |
| **Εικόνα** (JPG/PNG) | `<img>` with zoom/pan | Transparent **Canvas overlay** πάνω από το img (absolute positioned) |

> **Σημείωση**: Για PDF και εικόνα, το overlay canvas πρέπει να συγχρονίζεται με το zoom/pan state ώστε τα polygons να παραμένουν aligned.

| Ενέργεια | Αρχείο |
|---------|--------|
| DXF: Extend `renderDxfToCanvas()` — draw overlays μετά τα entities | `FloorplanGallery.tsx` |
| PDF/Image: Δημιουργία transparent canvas layer (absolute over content) | `FloorplanGallery.tsx` |
| Polygon fill semi-transparent — χρήση υπάρχουσας `OverlayStyle.opacity` (default 0.7 στο `overlay-adapter.ts` γρ. 45) ή `fillOpacity` από polygon-system (`real-estate` = 0.15) | Canvas `fillStyle` + `globalAlpha` |
| Zoom/pan sync: overlay canvas ακολουθεί το transform matrix του κύριου content | `useZoomPan` hook integration |
| Δυναμικά χρώματα: `unit.commercialStatus` → color map | Νέο color mapping |

**Color Mapping** (βάσει `CommercialStatus` — `src/types/unit.ts` γρ. 78-85):

| commercialStatus | Value | Χρώμα | Σημασία |
|-----------------|-------|-------|---------|
| `unavailable` | Μη Διαθέσιμη | ⚪ Γκρι (#9ca3af) | Default — δεν είναι στην αγορά |
| `for-sale` | Προς Πώληση | 🟢 Πράσινο (#22c55e) | Διαθέσιμο προς πώληση |
| `for-rent` | Προς Ενοικίαση | 🔵 Μπλε (#3b82f6) | Διαθέσιμο προς ενοικίαση |
| `for-sale-and-rent` | Πώληση & Ενοικίαση | 🟣 Μωβ (#a855f7) | Dual listing |
| `reserved` | Κρατημένη | 🟡 Κίτρινο (#eab308) | Προκαταβολή δόθηκε |
| `sold` | Πωλημένη | 🔴 Κόκκινο (#ef4444) | Ολοκληρωμένη πώληση |
| `rented` | Ενοικιασμένη | 🟠 Πορτοκαλί (#f97316) | Ενεργή μίσθωση |

> **ΑΠΟΦΑΣΗ**: Όλα τα ακίνητα εμφανίζονται στην κάτοψη ανεξαρτήτως status — τα πωλημένα/ενοικιασμένα φαίνονται με το αντίστοιχο χρώμα ώστε ο χρήστης να βλέπει την πλήρη εικόνα του ορόφου.

### Φάση 4: Canvas Hit-Testing + Hover + Click

**Στόχος**: Hover → preview στοιχείων, Click → πλοήγηση στο ακίνητο.

#### Hover Behavior (mousemove)
- Mouse hover πάνω σε polygon → **κάτω δεξιά** στην οθόνη εμφανίζονται **real-time** τα στοιχεία του ακινήτου (όνομα, τύπος, τ.μ., τιμή, status)
- Τα στοιχεία αλλάζουν δυναμικά καθώς ο κέρσορας μετακινείται μεταξύ polygons

#### Click Behavior (click)
- **Click σε `for-sale` / `for-rent` / `for-sale-and-rent`** → Φορτώνει το ακίνητο στην **ίδια σελίδα** (αλλαγή `?selected=unit_xxx`). Ο χρήστης βλέπει τα πλήρη στοιχεία του ακινήτου που μπορεί να αγοράσει/νοικιάσει.
- **Click σε `reserved` / `sold` / `rented` / `unavailable`** → **Τίποτα δεν συμβαίνει**. Αυτά τα ακίνητα δεν είναι διαθέσιμα στους χρήστες του διαδικτύου — εμφανίζονται μόνο οπτικά στην κάτοψη για πληρότητα, αλλά δεν είναι clickable.

#### Clickable vs Non-Clickable Status Map

| commercialStatus | Clickable | Cursor | Hover Info |
|-----------------|-----------|--------|-----------|
| `for-sale` | ✅ Ναι | `pointer` | ✅ Πλήρη στοιχεία |
| `for-rent` | ✅ Ναι | `pointer` | ✅ Πλήρη στοιχεία |
| `for-sale-and-rent` | ✅ Ναι | `pointer` | ✅ Πλήρη στοιχεία |
| `reserved` | ❌ Όχι | `default` | ⚠️ Μόνο "Κρατημένο" |
| `sold` | ❌ Όχι | `default` | ⚠️ Μόνο "Πωλημένο" |
| `rented` | ❌ Όχι | `default` | ⚠️ Μόνο "Ενοικιασμένο" |
| `unavailable` | ❌ Όχι | `default` | ⚠️ Μόνο "Μη Διαθέσιμο" |

| Ενέργεια | Αρχείο |
|---------|--------|
| `pointInPolygon(point, vertices)` — ray-casting algorithm | Νέο utility |
| Canvas `mousemove` → screen-to-world coordinate transform | FloorplanGallery |
| Match hit polygon → `overlay.linked.unitId` → fetch unit data | Hook composition |
| Εμφάνιση hover info panel σε **fixed position κάτω δεξιά** (βλ. πεδία παρακάτω) | FloorplanGallery |
| Click → `router.push` με νέο `?selected=unit_xxx` (μόνο available statuses) | Click handler |

#### Hover Info Panel — Πεδία (Phase 1)

| Πεδίο | Παράδειγμα | Πηγή |
|-------|-----------|------|
| Όνομα μονάδας | A-DI-0.02 Διαμέρισμα 2 | `unit.name` |
| Τύπος | Διαμέρισμα / Μεζονέτα | `unit.unitType` |
| Εμβαδόν | 90 τ.μ. | `unit.area` |
| Τιμή πώλησης/ενοικίασης | €150.000 / €800/μήνα | `unit.commercialData` |
| Εμπορική κατάσταση | Προς Πώληση | `unit.commercialStatus` |

> **Σημείωση**: Τα πεδία μπορεί να επεκταθούν στο μέλλον κατ' εντολή Γιώργου.

**Point-in-Polygon Algorithm** (Ray Casting):
```typescript
// Standard ray-casting — O(n) per vertex count
function pointInPolygon(
  point: { x: number; y: number },
  vertices: ReadonlyArray<{ x: number; y: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

### Φάση 5: Bidirectional Hover Sync (Αμφίδρομη Σύνδεση)

**Στόχος**: Αμφίδρομο hover μεταξύ αριστερής λίστας ακινήτων και κάτοψης ορόφου.

**ΑΠΟΦΑΣΗ**: Ο Γιώργος επιβεβαίωσε ότι θέλει **πλήρη αμφίδρομη σύνδεση**.

#### Κατεύθυνση Α: Λίστα → Κάτοψη
- Hover πάνω σε κάρτα ακινήτου στην **αριστερή λίστα** (PropertyList, 360px)
- → Το αντίστοιχο **polygon στην κάτοψη** (FloorplanGallery, κέντρο) γίνεται highlight
- → Εμφάνιση στοιχείων στο **hover info panel** (κάτω δεξιά)

#### Κατεύθυνση Β: Κάτοψη → Λίστα
- Hover πάνω σε **polygon στην κάτοψη** (FloorplanGallery, κέντρο)
- → Εμφάνιση στοιχείων στο **hover info panel** (κάτω δεξιά)
- → **Αν** το ακίνητο είναι διαθέσιμο (`for-sale`/`for-rent`/`for-sale-and-rent`): η αντίστοιχη **κάρτα στη λίστα** γίνεται highlight + scroll into view
- → **Αν** το ακίνητο είναι δεσμευμένο (`reserved`/`sold`/`rented`/`unavailable`): **δεν υπάρχει κάρτα στη λίστα** — μόνο hover info panel ενημερώνεται

> **ΣΗΜΕΙΩΣΗ**: Η αριστερή λίστα εμφανίζει **μόνο διαθέσιμα** ακίνητα. Η κάτοψη εμφανίζει **όλα** τα ακίνητα (με χρώμα ανά status). Άρα bidirectional sync λειτουργεί πλήρως μόνο για τα διαθέσιμα.

```
┌──────────────┬────────────────────────────┬────────────────┐
│  ΑΡΙΣΤΕΡΑ    │         ΚΕΝΤΡΟ             │    ΔΕΞΙΑ       │
│  PropertyList│   FloorplanGallery         │  Details +     │
│              │                            │  HoverInfo     │
│  A-DI-0.02 ◄─── hover polygon ──────────►│  ┌──────────┐ │
│  A-DI-0.03   │                            │  │ Hover    │ │
│  A-GK-0.01   │   hover card ────────────► │  │ Info     │ │
│              │   highlights polygon       │  │ (κάτω    │ │
│              │                            │  │  δεξιά)  │ │
│              │                            │  └──────────┘ │
└──────────────┴────────────────────────────┴────────────────┘
```

| Ενέργεια | Αρχείο |
|---------|--------|
| Shared `hoveredUnitId` state μέσω existing `useHoveredProperty` hook | `src/features/property-hover/hooks/useHoveredProperty.ts` |
| PropertyListCard `onMouseEnter` → set `hoveredUnitId` | `PropertyList.tsx` |
| Canvas polygon hit → set `hoveredUnitId` → list card auto-scroll + highlight | `FloorplanGallery.tsx` + `PropertyList.tsx` |
| Canvas polygon highlight (brighter fill/stroke) όταν `hoveredUnitId` match | `FloorplanGallery.tsx` |

---

## 3B. Existing Floorplan Infrastructure (Έρευνα 2026-03-16)

> **ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ**: Το σύστημα αποθήκευσης κατόψεων είναι **πλήρως κεντρικοποιημένο**.
> Δεν χρειάζεται νέα υποδομή — χρησιμοποιούμε τα existing services.

### 4-Step Orchestrator Pattern (ADR-202)

**Αρχείο**: `src/services/floorplans/floorplan-save-orchestrator.ts`

```
Βήμα 1: Δημιουργία FileRecord (status: pending) → Firestore `files` collection
Βήμα 2: Upload αρχείου → Firebase Storage (canonical path)
Βήμα 3: Λήψη download URL
Βήμα 4: Finalize FileRecord (status: ready) + processing
```

### 3 Services ανά Τύπο Κάτοψης

| Τύπος Κάτοψης | Service | Storage Path |
|---------------|---------|-------------|
| **Γενική Κάτοψη (Κτιρίου)** | `BuildingFloorplanService` | `companies/{companyId}/entities/building/{buildingId}/domains/construction/categories/floorplans/files/{fileId}.dxf` |
| **Κάτοψη Ορόφου** | `FloorFloorplanService` | `companies/{companyId}/projects/{projectId}/entities/floor/{floorId}/domains/construction/categories/floorplans/files/{fileId}.json` |
| **Κάτοψη Μονάδας** | `UnitFloorplanService` | `companies/{companyId}/entities/unit/{unitId}/domains/construction/categories/floorplans/files/{fileId}.dxf` |

### Firestore `files` Collection — FileRecord Schema

```typescript
interface FileRecord {
  id: string;                    // file_xxxxx
  companyId: string;             // Tenant isolation (REQUIRED)
  entityType: 'floor' | 'unit' | 'building';
  entityId: string;              // floorId / unitId / buildingId
  domain: 'construction';
  category: 'floorplans';
  purpose: 'floor-floorplan' | 'unit-floorplan' | 'building-floorplan';
  displayName: string;           // Κεντρικοποιημένη ονοματοδοσία
  originalFilename: string;
  ext: string;                   // 'dxf' | 'pdf' | 'json'
  status: 'pending' | 'ready' | 'failed';
  storagePath: string;           // Canonical Firebase Storage path
  downloadUrl?: string;
  sizeBytes?: number;
  createdBy: string;
  createdAt: string;             // ISO8601
}
```

### Κεντρικοποιημένη Ονοματοδοσία

| Τύπος | Display Name Pattern |
|-------|---------------------|
| Γενική Κάτοψη | "Γενική Κάτοψη - Κτίριο Α" |
| Κάτοψη Ορόφου | "Κάτοψη Ορόφου - Ισόγειο" |
| Κάτοψη Μονάδας | "Κάτοψη Μονάδας - Α-101" |

### Canonical Path Builder

**Αρχείο**: `src/services/upload/utils/storage-path.ts`

Paths περιέχουν **μόνο IDs**, ποτέ human-readable names:
```
companies/{companyId}/projects/{projectId}/entities/{entityType}/{entityId}/
  domains/{domain}/categories/{category}/files/{fileId}.{ext}
```

### Πώς Χρησιμοποιεί το Pipeline τα Existing Services

Το οριζόντιο pipeline (Εταιρεία → Έργο → Γεν. Κάτοψη → Όροφος → Κάτοψη) αντιστοιχεί **ακριβώς** στα existing services:

| Pipeline Step | Αντιστοίχιση |
|--------------|-------------|
| Εταιρεία → `companyId` | Tenant isolation — ήδη υπάρχει |
| Έργο → `projectId` | Project context — ήδη στο storage path |
| Γενική Κάτοψη | → `BuildingFloorplanService.saveFloorplan()` |
| Όροφος → `floorId` | Floor selection — ήδη στο `FloorFloorplanService` |
| Κάτοψη Ορόφου | → `FloorFloorplanService.saveFloorplan()` |
| Κάτοψη Μονάδας | → `UnitFloorplanService.saveFloorplan()` |

**Δεν χρειάζεται νέο service** — μόνο νέο UI (horizontal pipeline) που καλεί τα existing services.

### Σχετικά ADRs

| ADR | Τίτλος | Σχέση |
|-----|--------|-------|
| ADR-031 | Canonical File Storage System | Path builder + naming |
| ADR-060 | Building Floorplan Enterprise Storage | Building-level storage |
| ADR-187 | Floor-Level Floorplans (IFC-Compliant) | Floor-level architecture |
| ADR-196 | Unit Floorplan Enterprise FileRecord Migration | Unit-level fixes |
| ADR-202 | Floorplan Save Orchestrator | 4-step upload pattern |

---

## 3C. Bug: Multi-Level Units — Λείπουν Κατόψεις Ορόφου (Έρευνα 2026-03-16)

> **BUG ΕΝΤΟΠΙΣΤΗΚΕ**: Μεζονέτες που εκτείνονται σε 2+ ορόφους εμφανίζουν **μόνο 1** κάτοψη ορόφου αντί για 1 ανά όροφο.

### Τρέχουσα Κατάσταση (Λάθος)

Μεζονέτα σε Ισόγειο + 1ο Όροφο:

```
Tabs: [Κάτοψη Ισόγειο] [Κάτοψη 1ος Ορ.] [Κάτοψη Ορόφου] [Φωτ.] [Βίντεο]
       ↑ κάτοψη μονάδας  ↑ κάτοψη μονάδας  ↑ ΜΟΝΟ 1 ❌
       (level 1)          (level 2)          (ποιου ορόφου;)
```

**Πρόβλημα**: Η "Κάτοψη Ορόφου" (single tab) δείχνει κατόψεις μόνο **ενός** ορόφου. Αλλά η μεζονέτα βρίσκεται σε **2 ορόφους** — ο χρήστης δεν μπορεί να δει τα περιγράμματα (polygons) των άλλων ιδιοκτησιών στον 2ο όροφο.

**Τεχνική αιτία** (`ReadOnlyMediaViewer.tsx`):
- Τα multi-level tabs δημιουργούνται σωστά: ένα tab ανά level (γρ. 317-338)
- Αλλά η "Κάτοψη Ορόφου" (floor floorplan) χρησιμοποιεί **μόνο** `floorId` + `floorNumber` (γρ. 340-349) — δηλαδή μόνο τον primary floor
- **Δεν** δημιουργεί floor floorplan tabs ανά level

### Σωστή Συμπεριφορά (Διόρθωση)

```
Tabs: [Κάτ. Ισόγειο] [Κάτ. 1ος Ορ.] [Όρ. Ισογείου] [Όρ. 1ου Ορ.] [Φωτ.] [Βίντεο]
       ↑ κάτοψη        ↑ κάτοψη        ↑ κάτοψη       ↑ κάτοψη
       μονάδας          μονάδας          ορόφου #1       ορόφου #2
       (level 1)        (level 2)        (όλα τα         (όλα τα
                                          ακίνητα         ακίνητα
                                          ισογείου)       1ου ορ.)
```

**Λογική**: Αν `isMultiLevel && levels.length >= 2`, τότε δημιουργούνται:
- **N tabs κάτοψης μονάδας** (ήδη υπάρχουν, σωστά)
- **N tabs κάτοψης ορόφου** (ΛΕΙΠΟΥΝ — πρέπει να προστεθούν)

### Αρχεία προς Διόρθωση

| Αρχείο | Αλλαγή |
|--------|--------|
| `ReadOnlyMediaViewer.tsx` (γρ. 340-349) | Αντί για 1 floor floorplan tab → N tabs (ένα ανά level) |
| `ReadOnlyMediaViewer.tsx` (γρ. 410-425) | Αντί για 1 floor floorplan content → N contents (ένα `FloorFloorplanTabContent` ανά level) |

### Σχέση με ADR-237

Αυτό το bug είναι **blocking** για τη Φάση 3 (Canvas Overlay Rendering) γιατί:
- Τα polygon overlays εμφανίζονται **ανά κάτοψη ορόφου**
- Αν λείπει η κάτοψη ορόφου #2, τα overlays του 2ου ορόφου δεν θα φαίνονται ποτέ
- **Πρέπει να διορθωθεί πριν ή μαζί με** τη Φάση 3

### Σχετικά Αρχεία

- `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx` (γρ. 317-425)
- `src/types/unit.ts` (γρ. 148-157 — `UnitLevel` interface)
- `src/config/domain-constants.ts` (`MULTI_LEVEL_CAPABLE_TYPES`)
- [ADR-236](./ADR-236-multi-level-property-management.md) — Multi-Level Property Management

---

## 4. Consequences

### Positive

- ✅ **Single Source of Truth** — Polygons σχεδιάζονται μία φορά στο DXF Viewer
- ✅ **Real-time sync** — Αλλαγές στο DXF Viewer εμφανίζονται αυτόματα στη δημόσια σελίδα
- ✅ **Δυναμικά χρώματα** — Κατάσταση πώλησης αντικατοπτρίζεται visual
- ✅ **Interactive** — Hover, click, bidirectional sync
- ✅ **Backward compatible** — Τα existing overlays συνεχίζουν να δουλεύουν

### Negative

- ⚠️ **Firestore reads αυξάνονται** — κάθε Property Viewer page φορτώνει overlays
- ⚠️ **Canvas complexity** — FloorplanGallery ήδη 980 γραμμές, θα αυξηθεί
- ⚠️ **Coordinate mapping** — DXF world coords → Canvas screen coords χρειάζεται ακρίβεια

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Firestore read costs | Cache overlays per session, δεν αλλάζουν συχνά |
| Performance σε πολλά polygons | Batch rendering, skip off-screen polygons |
| Coordinate precision | Reuse existing DXF-to-Canvas transform matrix |

---

## 5. Prohibitions (μετά αυτό το ADR)

- ⛔ **ΜΗΝ αντιγράφεις** polygon vertices σε Unit documents — SSoT = `dxf-overlay-levels`
- ⛔ **ΜΗΝ δημιουργείς** νέο Firestore collection για property polygons
- ⛔ **ΜΗΝ χρησιμοποιείς** SVG rendering στο FloorplanGallery — ήδη Canvas-based
- ⛔ **ΜΗΝ τροποποιείς** overlays από τη δημόσια σελίδα — read-only access μόνο

---

## 6. Migration

| Component | Status | Notes |
|-----------|--------|-------|
| Level interface + `floorId` | ✅ Φάση 1 DONE | Backward compatible, optional field — SPEC-237A implemented 2026-03-16 |
| `useFloorOverlays` hook | 🔲 Φάση 2 | Νέο hook, read-only |
| Canvas overlay rendering | 🔲 Φάση 3 | Extend FloorplanGallery |
| Hit-testing + hover | 🔲 Φάση 4 | `pointInPolygon` utility |
| Bidirectional hover | 🔲 Φάση 5 | Extend useHoveredProperty |

---

## 7. References

### Σύστημα A: DXF Viewer Overlays
- **DXF Overlay Store**: `src/subapps/dxf-viewer/overlays/overlay-store.tsx`
- **Overlay Types**: `src/subapps/dxf-viewer/overlays/types.ts`
- **Level Config**: `src/subapps/dxf-viewer/systems/levels/config.ts`

### Σύστημα B: Property Viewer
- **PropertyPolygon**: `src/components/property-viewer/FloorPlanCanvas/PropertyPolygon.tsx`
- **PropertyPolygonPath**: `src/components/property-viewer/FloorPlanCanvas/PropertyPolygonPath.tsx`
- **PropertyHoverInfo**: `src/components/property-viewer/PropertyHoverInfo.tsx`
- **useHoveredProperty**: `src/features/property-hover/hooks/useHoveredProperty.ts`
- **FloorplanGallery**: `src/components/shared/files/media/FloorplanGallery.tsx`
- **Property Types**: `src/types/property-viewer.ts`

### Floorplan Upload & Storage Infrastructure
- **Floorplan Save Orchestrator**: `src/services/floorplans/floorplan-save-orchestrator.ts`
- **FloorFloorplanService**: `src/services/floorplans/FloorFloorplanService.ts`
- **UnitFloorplanService**: `src/services/floorplans/UnitFloorplanService.ts`
- **BuildingFloorplanService**: `src/services/floorplans/BuildingFloorplanService.ts`
- **Canonical Path Builder**: `src/services/upload/utils/storage-path.ts`
- **FileRecord Service**: `src/services/file-record.service.ts`
- **Domain Constants**: `src/config/domain-constants.ts`
- **EntityFilesManager**: `src/components/shared/files/EntityFilesManager.tsx`
- **useFloorplanUpload**: `src/hooks/useFloorplanUpload.ts`
- **FloorplanProcessor**: `src/services/floorplans/FloorplanProcessor.ts`

### Related ADRs
- [ADR-031](./adrs/ADR-031-enterprise-command-pattern-undo-redo.md) — Canonical File Storage System
- [ADR-060](./adrs/ADR-060-building-floorplan-enterprise-storage.md) — Building Floorplan Enterprise Storage
- [ADR-187](./ADR-187-floor-level-floorplans.md) — Floor-Level Floorplans (IFC-Compliant)
- [ADR-196](./ADR-196-unit-floorplan-enterprise-filerecord.md) — Unit Floorplan Enterprise FileRecord Migration
- [ADR-202](./ADR-202-floorplan-save-orchestrator.md) — Floorplan Save Orchestrator
- [ADR-236](./ADR-236-multi-level-property-management.md) — Multi-Level Property Management

### Implementation SPECs

| SPEC | Τίτλος | Φάσεις | Status |
|------|--------|--------|--------|
| [SPEC-237A](./specs/SPEC-237A-foundation-level-floor-mapping.md) | Foundation — Level-to-Floor Mapping + Multi-Level Bug Fix | Φάση 1 + Bug 3C | PLANNING |
| [SPEC-237B](./specs/SPEC-237B-overlay-bridge-core.md) | Overlay Bridge Core — Read-Only Hook + Canvas Rendering | Φάση 2 + 3 | PLANNING |
| [SPEC-237C](./specs/SPEC-237C-interactive-overlays.md) | Interactive Overlays — Hit-Testing, Hover, Click + Bidirectional Sync | Φάση 4 + 5 | PLANNING |
| [SPEC-237D](./specs/SPEC-237D-floorplan-import-pipeline.md) | Floorplan Import Pipeline — Horizontal UI | Pipeline UI | PLANNING |

---

## 8. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-16 | ADR Created — τεκμηρίωση ευρημάτων, 5 φάσεις υλοποίησης | Γιώργος Παγώνης + Claude Code |
| 2026-03-16 | 4 SPEC αρχεία δημιουργήθηκαν (237A-D) — αναλυτική τεκμηρίωση ανά φάση | Γιώργος Παγώνης + Claude Code |
| 2026-03-16 | SPEC-237A IMPLEMENTED: `floorId?: string` στο Level interface + Firestore persistence. Task C (multi-level bug) NOT NEEDED — ήδη υλοποιημένο | Claude Code |
| 2026-03-23 | ADR-258: overlay.status deprecated — FloorplanGallery uses overlay.resolvedStatus (dynamic from entity.commercialStatus). OVERLAY_OPACITY SSoT constants applied. | Claude Code |
| 2026-04-05 | **ADR-286**: DXF level creation path migrated to centralized `createEntity('dxfLevel', …)` pipeline via new `/api/dxf-levels` endpoint. Direct client-side `setDoc` removed from `useLevelOperations.addLevel`. Tenant scoping now fully server-side. | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
