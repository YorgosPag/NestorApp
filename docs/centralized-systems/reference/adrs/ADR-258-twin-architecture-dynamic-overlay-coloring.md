# ADR-258: Twin Architecture — Dynamic Overlay Coloring from Unit CommercialStatus

| Metadata | Value |
|----------|-------|
| **Status** | 📋 PLANNED |
| **Date** | 2026-03-23 |
| **Category** | Canvas & Rendering / Property Management / DXF Viewer |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Extends** | ADR-237 (Polygon Overlay Bridge), ADR-197 (Sales Pages) |
| **Affects** | StatusPalette.tsx, OverlayToolbarSection.tsx, FloorplanGallery.tsx, useFloorOverlays.ts, color-mapping.ts |

---

## 1. Context

### Τρέχουσα Κατάσταση (2026-03-23)

Το ADR-237 (Polygon Overlay Bridge) υλοποιήθηκε επιτυχώς — τα polygon overlays σχεδιάζονται στο DXF Viewer και εμφανίζονται στο Property Viewer. Ωστόσο, **ο χρωματισμός γίνεται λάθος**:

| Τι συμβαίνει σήμερα | Τι πρέπει να γίνεται |
|---|---|
| Ο χρήστης επιλέγει χρώμα/status **κατά τη σχεδίαση** (StatusPalette) | Ο χρήστης σχεδιάζει **μόνο λευκά** περιγράμματα |
| Το `overlay.status` αποθηκεύεται στο Firestore | Το overlay **δεν έχει status** — μόνο polygon + kind + linked |
| Η FloorplanGallery διαβάζει `overlay.status` για χρώμα | Η FloorplanGallery χρωματίζει βάσει `unit.commercialStatus` |
| Χειροκίνητος χρωματισμός → εκτός sync με πραγματικότητα | Αυτόματος χρωματισμός → πάντα σε sync |

### Το Πρόβλημα

Σήμερα, αν μια μονάδα πουληθεί (`commercialStatus: 'sold'`), το polygon της στην κάτοψη **παραμένει πράσινο** (for-sale) — γιατί το χρώμα αποθηκεύτηκε κατά τη σχεδίαση και δεν ενημερώνεται ποτέ. Αυτό σπάει τη βασική αρχή: **τα δεδομένα πρέπει να αντικατοπτρίζουν πάντα την τρέχουσα πραγματικότητα**.

### Γιατί "Twin Architecture"

Η αρχιτεκτονική βασίζεται στη διαχωρισμό **δύο δίδυμων** που πηγαίνουν μαζί αλλά αποθηκεύονται ξεχωριστά:

| Δίδυμο A: DXF Αρχείο | Δίδυμο B: Polygon Layers |
|---|---|
| **Static asset** — δεν αλλάζει ποτέ | **Dynamic data** — αλλάζουν ανάλογα με πωλήσεις |
| Η κάτοψη του αρχιτέκτονα | Ποια μονάδα πουλήθηκε, κρατήθηκε κλπ |
| Storage: Firebase Storage (blob/file) | Storage: Firestore `dxf_overlay_levels` (structured data) |
| Ένα upload, μηδέν updates | Real-time updates μέσω `onSnapshot()` |
| Δεν αλλάζει αν πουληθεί μονάδα | Αλλάζει χρώμα αυτόματα αν πουληθεί μονάδα |

**Industry Pattern**: Google Maps (tiles + dynamic pins/traffic), Google Docs (document + comments), AutoCAD Web (DWG + markups).

---

## 2. Decision

### 2.1 Αρχιτεκτονική Αλλαγή: Dynamic Color Resolution

**ΠΡΙΝ** (ADR-237 — τρέχουσα υλοποίηση):
```
Σχεδίαση (DXF Viewer)     →  overlay.status = 'for-sale' (hardcoded)
                                    ↓
FloorplanGallery           →  getStatusColors(overlay.status)  →  πράσινο
                                    ↓
Αν πουληθεί η μονάδα      →  overlay.status ΜΕΝΕΙ 'for-sale'  →  ΛΑΘΟΣ πράσινο
```

**ΜΕΤΑ** (ADR-258 — νέα αρχιτεκτονική):
```
Σχεδίαση (DXF Viewer)     →  overlay χωρίς status (λευκό polygon)
                                    ↓
Link                       →  overlay.linked.unitId = 'unit_xxx'
                                    ↓
FloorplanGallery           →  unit.commercialStatus → getStatusColors()  →  δυναμικό χρώμα
                                    ↓
Αν πουληθεί η μονάδα      →  unit.commercialStatus αλλάζει σε 'sold'  →  ΣΩΣΤΟ κόκκινο
```

### 2.2 Τρεις Βασικές Αλλαγές

#### Αλλαγή A: DXF Viewer — Αφαίρεση StatusPalette, Inline Entity Linking, Dynamic Color

| Πεδίο | Τρέχουσα | Νέα |
|---|---|---|
| **StatusPalette** | 5 χρωματιστά κουμπιά status στο toolbar | **ΑΦΑΙΡΕΙΤΑΙ** — δεν υπάρχει πλέον |
| **Entity Linking** | Δεν γίνεται κατά τη σχεδίαση | **Inline dropdown** στο DXF Viewer (primary path) |
| **Polygon rendering (DXF)** | Χρωματισμένα βάσει overlay.status | **Δυναμικό**: linked → χρώμα βάσει entity.commercialStatus, unlinked → λευκό |
| **Overlay.status** | Αποθηκεύεται κατά τη σχεδίαση | **Δεν αποθηκεύεται** — deprecated field |
| **Overlay.linked** | Σύνδεση με entity | **Παραμένει ως έχει** — SSoT σύνδεσης |

##### Inline Entity Linking (Google Earth Pro Pattern)

**Primary path** (90% περιπτώσεων): Σύνδεση **κατά τη σχεδίαση** στο DXF Viewer:

```
Χρήστης σχεδιάζει polygon → Save
  → Properties Panel (δεξιά) ανοίγει αυτόματα με focus στο Entity dropdown
  → Χρήστης επιλέγει: "A-DI-1.01"
  → overlay.linked.unitId = 'unit_xxx'
  → Real-time fetch: unit.commercialStatus = 'for-sale'
  → Polygon χρωματίζεται πράσινο ΑΜΕΣΩΣ
  → Label αυτο-συμπληρώνεται
```

**UX Pattern (Google Earth Pro / AutoCAD / Figma)**: Το Properties Panel ανοίγει αυτόματα μετά το Save αλλά **δεν μπλοκάρει** — ο χρήστης μπορεί να αγνοήσει το dropdown και να συνεχίσει σχεδίαση. Unlinked polygons μένουν λευκά.

```
Properties Panel (δεξιά, auto-open μετά Save):
┌─────────────────────────┐
│ Kind: [🏠 Μονάδα    ▼]  │
│ Entity: [Επιλέξτε... ▼] │  ← auto-focus εδώ
│ Label: [A-DI-1.01    ]  │
│                         │
│ Status: ⚫ Μη διαθέσιμο │  ← ενημερώνεται real-time μετά τη σύνδεση
└─────────────────────────┘
```

Το Entity dropdown εμφανίζει **μόνο entities του συγκεκριμένου ορόφου** (φιλτραρισμένο βάσει pipeline context):
- Αν `kind == 'unit'` → μόνο μονάδες αυτού του ορόφου
- Αν `kind == 'parking'` → μόνο parking spots αυτού του ορόφου
- Αν `kind == 'storage'` → μόνο αποθήκες αυτού του ορόφου

Ο όροφος είναι γνωστός από το pipeline εισαγωγής κάτοψης (Εταιρεία → Έργο → Κτίριο → Όροφος → DXF).

**Secondary path** (fallback): Σύνδεση **μετά**, από τη σελίδα διαχείρισης:

```
Χώροι → Μονάδες → A-DI-1.01 → tab "Κάτοψη" → σύνδεση με polygon
```

Αυτό χρησιμοποιείται όταν:
- Ο σχεδιαστής σχεδιάζει 15 polygons γρήγορα χωρίς να σταματάει
- Χρειάζεται διόρθωση λάθους σύνδεσης
- Η σύνδεση γίνεται από διαφορετικό χρήστη (πωλητής, όχι σχεδιαστής)

**Αποτέλεσμα**: Δεν χάνεται ποτέ η δυνατότητα — αν δεν συνδέσεις τώρα, συνδέεις μετά. Αν συνδέσεις λάθος, διορθώνεις χωρίς ξανασχεδίαση.

##### Polygon Color — Διαφορετική Ένταση ανά Context

**Αρχή**: Ίδιο χρώμα, διαφορετική ένταση — ανάλογα με τον σκοπό κάθε view.

| Context | Χρήστης | Προτεραιότητα | Fill Opacity | Stroke |
|---|---|---|---|---|
| **DXF Viewer** (σχεδίαση) | Σχεδιαστής / Μηχανικός | Γεωμετρία σχεδίου | **~20%** (αχνό — δεν κρύβει DXF γραμμές) | 100% |
| **FloorplanGallery** (πώληση) | Πωλητής / Αγοραστής | Εμπορική κατάσταση | **~50%** (έντονο — κύρια πληροφορία) | 100% |

**Industry Pattern**: AutoCAD, Bentley, Revit — στο σχεδιαστικό περιβάλλον τα overlays είναι αχνά για να μην κρύβουν αρχιτεκτονικές λεπτομέρειες. Στο εμπορικό/παρουσίασης view τα χρώματα κυριαρχούν.

##### Polygon Color στο DXF Viewer

| Κατάσταση Polygon | Χρώμα στο DXF Viewer |
|---|---|
| **Unlinked** (δεν έχει γίνει σύνδεση) | Λευκό (`#FFFFFF` stroke, `rgba(255,255,255,0.05)` fill) |
| **Linked** (συνδεδεμένο με entity) | Δυναμικό χρώμα βάσει `entity.commercialStatus` — **20% fill opacity** |
| **Linked, entity χωρίς status** | Γκρι (`'unavailable'`) — **20% fill opacity** |
| **Selected** (ανεξάρτητα linked/unlinked) | Cyan stroke (`#00BFFF`) |

##### Polygon Color στο FloorplanGallery (Property Viewer)

| Κατάσταση Polygon | Χρώμα στο FloorplanGallery |
|---|---|
| **Linked** (συνδεδεμένο με entity) | Δυναμικό χρώμα βάσει `entity.commercialStatus` — **50% fill opacity** |
| **Linked, entity χωρίς status** | Γκρι (`'unavailable'`) — **37.5% fill opacity** |
| **Hovered** | Ίδιο χρώμα — **70% fill opacity** + 3px stroke |
| **Footprint** | **Δεν εμφανίζεται** (φιλτράρεται) |
| **Unlinked** | Γκρι (`'unavailable'`) — **37.5% fill opacity** |

**Αρχεία που αλλάζουν**:
- `src/subapps/dxf-viewer/ui/toolbar/overlay-section/OverlayToolbarSection.tsx` — αφαίρεση `<StatusPalette>`, προσθήκη Entity Link dropdown
- `src/subapps/dxf-viewer/ui/toolbar/overlay-section/StatusPalette.tsx` — **DEPRECATED** (δεν διαγράφεται, σχολιάζεται ως deprecated)
- `src/subapps/dxf-viewer/overlays/types.ts` — `status` γίνεται `@deprecated`
- Canvas rendering στο DXF Viewer — dynamic color based on linked entity status

#### Αλλαγή B: useFloorOverlays — Real-time Enrichment με Entity CommercialStatus

Σήμερα, το `useFloorOverlays` επιστρέφει overlays **ως έχουν** από το Firestore (με `overlay.status`).

**Νέα αρχιτεκτονική**: Το hook κάνει **real-time enrichment** — για κάθε overlay ανάλογα με `kind`, ανακτά το `commercialStatus` της linked entity:

```
useFloorOverlays(floorId)
  ├─ Βήμα 1: Φόρτωση overlays (onSnapshot) — ΥΠΑΡΧΕΙ ΗΔΗ
  ├─ Βήμα 2: Φιλτράρισμα footprint overlays (δεν εμφανίζονται) — ΝΕΟ
  ├─ Βήμα 3: Εξαγωγή unique entity IDs ανά collection:
  │     unitIds     → από overlay.linked.unitId (kind='unit')
  │     parkingIds  → από overlay.linked.parkingId (kind='parking')
  │     storageIds  → από overlay.linked.storageId (kind='storage')
  ├─ Βήμα 4: Real-time subscriptions (onSnapshot) σε 3 collections:
  │     units/{id}.commercialStatus
  │     parking_spots/{id}.commercialStatus
  │     storage_units/{id}.commercialStatus
  └─ Βήμα 5: Merge → FloorOverlayItem.resolvedStatus = entity.commercialStatus
```

**Κεντρικοποιημένο Real-time Σύστημα (ΧΡΗΣΗ ΥΠΑΡΧΟΝΤΟΣ)**:

Η εφαρμογή διαθέτει ήδη κεντρικοποιημένο real-time subscription system:

| Σύστημα | Αρχείο | Χρήση στο ADR-258 |
|---|---|---|
| **RealtimeService** (singleton) | `src/services/realtime/RealtimeService.ts` | Dispatch events cross-component |
| **firestoreQueryService.subscribeDoc()** | `src/services/firestore/firestore-query.service.ts` | Single doc real-time subscription |
| **useRealtimeQuery** (generic hook) | `src/services/realtime/hooks/useRealtimeQuery.ts` | Collection query με constraints |
| **RealtimeCollection** type | `src/services/realtime/types.ts` | Type-safe collection names |

**Pattern**: Χρήση `firestoreQueryService.subscribeDoc()` ή `useRealtimeQuery` — ΟΧΙ raw `onSnapshot()`. Αυτό εξασφαλίζει tenant-aware filtering, auto-inject `companyId`, proper cleanup.

**FloorOverlayItem** — νέο πεδίο:
```typescript
export interface FloorOverlayItem {
  // ... υπάρχοντα πεδία ...

  /** @deprecated Χρησιμοποίησε resolvedStatus αντί αυτού */
  status?: PropertyStatus;

  /** Dynamic status resolved from linked entity's commercialStatus (ADR-258) */
  resolvedStatus: PropertyStatus;
}
```

##### SSoT Hook: `useEntityStatusResolver`

**Αρχή**: Η λογική resolution (overlay → entity → commercialStatus) γράφεται **ΜΙΑ φορά** σε ένα κοινό hook. Και τα δύο contexts (DXF Viewer + FloorplanGallery) χρησιμοποιούν τον ίδιο hook. Η μόνη διαφορά (opacity) είναι rendering config, ΟΧΙ data logic.

```
useEntityStatusResolver(overlays)        ← SSoT hook (ΕΝΑ)
  → Map<overlayId, resolvedStatus>
        ↓                           ↓
  DXF Viewer                 FloorplanGallery
  OVERLAY_OPACITY.DXF = 0.2  OVERLAY_OPACITY.GALLERY = 0.5
```

**Αρχείο**: `src/hooks/useEntityStatusResolver.ts` (ΝΕΟ — SSoT για status resolution)
**Consumers**:
- `useFloorOverlays.ts` — χρησιμοποιεί τον resolver, επιστρέφει enriched overlays για FloorplanGallery
- DXF Viewer canvas rendering — χρησιμοποιεί τον ίδιο resolver για χρωματισμό linked polygons

**Κανόνας Resolution** (priority order):
1. Αν kind == `'footprint'` → **φιλτράρεται** στο Property Viewer (στο DXF Viewer εμφανίζεται λευκό)
2. Αν linked entity υπάρχει → fetch `entity.commercialStatus` → χρησιμοποίησε αυτό
3. Αν δεν υπάρχει linked entity → `'unavailable'` (γκρι — unlinked polygon)
4. **Backward compatibility**: Αν υπάρχει `overlay.status` (legacy) ΚΑΙ δεν υπάρχει linked entity → χρησιμοποίησε `overlay.status`

##### Opacity Constants (SSoT)

```typescript
// src/subapps/dxf-viewer/config/color-config.ts — ΕΠΕΚΤΑΣΗ (ΟΧΙ νέο αρχείο)
export const OVERLAY_OPACITY = {
  /** DXF Viewer: αχνό fill — δεν κρύβει αρχιτεκτονικές γραμμές */
  DXF_FILL: 0.2,
  /** FloorplanGallery: έντονο fill — εμπορική κατάσταση κυριαρχεί */
  GALLERY_FILL: 0.5,
  /** FloorplanGallery: hover state */
  GALLERY_HOVER: 0.7,
  /** Unavailable / off-market */
  MUTED: 0.375,
} as const;
```

#### Αλλαγή C: FloorplanGallery — Χρήση resolvedStatus

Σήμερα (γραμμή 367 FloorplanGallery.tsx):
```typescript
const colors = getStatusColors(overlay.status ?? 'unavailable') ?? OVERLAY_FALLBACK;
```

**Νέα γραμμή**:
```typescript
const colors = getStatusColors(overlay.resolvedStatus) ?? OVERLAY_FALLBACK;
```

Μία μόνο γραμμή αλλάζει — η υπόλοιπη rendering λογική (hit-testing, hover, labels) **παραμένει ακριβώς ίδια**.

### 2.3 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TWIN ARCHITECTURE                               │
│                                                                     │
│  ┌─────────────────────┐        ┌─────────────────────────────┐    │
│  │  ΔΊΔΥΜΟ A            │        │  ΔΊΔΥΜΟ B                    │    │
│  │  DXF File            │        │  Polygon Layers              │    │
│  │  (Static Asset)      │        │  (Dynamic Data)              │    │
│  │                      │        │                              │    │
│  │  Firebase Storage    │        │  Firestore:                  │    │
│  │  floorplans/{id}     │        │  dxf_overlay_levels/         │    │
│  │                      │        │  {levelId}/items             │    │
│  │  Upload: 1 φορά      │        │                              │    │
│  │  Updates: 0           │        │  Polygon geometry: Static    │    │
│  │                      │        │  linked.unitId: Semi-static  │    │
│  └─────────┬────────────┘        │  (αλλάζει μόνο στη σύνδεση)  │    │
│            │                     └──────────────┬───────────────┘    │
│            │                                    │                    │
│            │         ┌──────────────────────────┘                    │
│            │         │                                               │
│  ┌─────────▼─────────▼────────────────────────────────────────┐     │
│  │           FloorplanGallery (Canvas 2D)                      │     │
│  │                                                              │     │
│  │  DXF → renderDxfToCanvas()    (Δίδυμο A)                   │     │
│  │  Overlays → drawOverlayPolygons()  (Δίδυμο B)              │     │
│  │                                                              │     │
│  │  Χρώμα:  overlay.linked.unitId                              │     │
│  │              ↓                                               │     │
│  │          unit.commercialStatus    (Firestore: units/{id})   │     │
│  │              ↓                                               │     │
│  │          getStatusColors()        (color-mapping.ts SSoT)   │     │
│  │              ↓                                               │     │
│  │          Canvas fill + stroke                                │     │
│  └──────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 DXF Viewer — Νέα Εμφάνιση Polygons

Στο DXF Viewer, τα polygons εμφανίζονται ανάλογα με τη **σύνδεσή τους**:

```
Χρώματα DXF Viewer:
  Unlinked:  Stroke: #FFFFFF (λευκό), Fill: rgba(255,255,255,0.05) — αχνό
  Linked:    Stroke: entity color (100%), Fill: entity color (20% opacity) — αχνό χρώμα
  Selected:  Stroke: #00BFFF (cyan) — ξεχωρίζει το επιλεγμένο
```

Τα linked polygons δείχνουν χρώμα βάσει `entity.commercialStatus` αλλά σε **20% opacity** (αχνό) ώστε να μην κρύβουν τις DXF γραμμές. Βλ. §2.2 Αλλαγή A για πλήρη πίνακα χρωμάτων.

### 2.5 Toolbar Layout Μετά την Αλλαγή

**ΠΡΙΝ:**
```
[Draw] [Edit] | [🟢][🔵][🟡][🔴][🟣] | [🏠][🚗][📦][👣] | [Save][Cancel] | [Copy][Delete]
                 ↑ StatusPalette
```

**ΜΕΤΑ:**
```
[Draw] [Edit] | [🏠][🚗][📦][👣] | [Save][Cancel] | [Copy][Delete]
                 ↑ KindSelector (παραμένει — επιλογή τύπου polygon)
```

Η `StatusPalette` αφαιρείται εντελώς. Ο χρήστης **δεν χρειάζεται** να ξέρει τι status έχει η μονάδα κατά τη σχεδίαση — αυτό είναι εμπορική πληροφορία, όχι αρχιτεκτονική.

---

## 3. Κεντρικοποιημένα Συστήματα — Χρήση Υπαρχόντων (ZERO DUPLICATES)

### Τι ΥΠΑΡΧΕΙ ΗΔΗ και ΧΡΗΣΙΜΟΠΟΙΟΥΜΕ:

| Σύστημα | Αρχείο | Ρόλος στο ADR-258 |
|---|---|---|
| **STATUS_COLORS_MAPPING** | `src/subapps/dxf-viewer/config/color-mapping.ts` | SSoT χρωμάτων — ΚΑΝΕΝΑ νέο mapping |
| **getStatusColors()** | Ίδιο αρχείο | SSoT function — ΚΑΜΙΑ νέα function |
| **PropertyStatus** | `src/constants/property-statuses-enterprise.ts` | SSoT τύπος — ΚΑΝΕΝΑΣ νέος τύπος |
| **CommercialStatus** | `src/types/unit.ts` | SSoT εμπορικού status μονάδας |
| **useFloorOverlays** | `src/hooks/useFloorOverlays.ts` | **ΕΠΕΚΤΕΙΝΕΤΑΙ** (enrichment) |
| **FloorplanGallery** | `src/components/shared/files/media/FloorplanGallery.tsx` | **1 γραμμή αλλάζει** |
| **UI_COLORS** | `src/subapps/dxf-viewer/config/color-config.ts` | SSoT χρωμάτων canvas |
| **OVERLAY_ALPHA_FILL** | `src/subapps/dxf-viewer/overlays/types.ts` | SSoT opacity overlay |

### Τι ΔΕΝ ΔΗΜΙΟΥΡΓΟΥΜΕ:

- ❌ Νέο color mapping (χρήση `STATUS_COLORS_MAPPING` + επέκταση με `for-sale-and-rent`)
- ❌ Νέο Firestore collection
- ❌ Νέο rendering function
- ❌ Νέο utility

### Τι ΔΗΜΙΟΥΡΓΟΥΜΕ (ελάχιστο νέο — SSoT):

- ✅ `useEntityStatusResolver` hook — **SSoT** για status resolution, χρησιμοποιείται και στα 2 contexts (DXF Viewer + FloorplanGallery)
- ✅ `resolvedStatus` πεδίο στο `FloorOverlayItem` — enrichment result
- ✅ `commercialToPropertyStatus()` function στο `color-mapping.ts` — κεντρική mapping
- ✅ `OVERLAY_OPACITY` constants στο `color-config.ts` — SSoT opacity ανά context

---

## 4. Color Resolution ανά Overlay Kind

### 4.1 Κανόνας Χρωματισμού — Απλοποιημένο (Ερευνα Κώδικα 2026-03-23)

**Κρίσιμο εύρημα**: Τα parking (`parking_spots`) και storage (`storage_units`) **έχουν ήδη δικό τους `commercialStatus`** πεδίο (τύπος `SpaceCommercialStatus` από `src/types/sales-shared.ts`). Επιπλέον, υπάρχει **αυτόματος συγχρονισμός** μέσω του `appurtenance-sync` API (`src/app/api/sales/[unitId]/appurtenance-sync/route.ts`):

- Αν parking/storage είναι **παρακολούθημα** → όταν αλλάζει το unit status, το sync API ενημερώνει αυτόματα το `parking.commercialStatus` / `storage.commercialStatus`
- Αν parking/storage πωλείται **αυτόνομα** → έχει δικό του `commercialStatus` ανεξάρτητα

**Αποτέλεσμα**: Δεν χρειάζεται να ελέγξουμε αν είναι παρακολούθημα ή αυτόνομο. **Απλά διαβάζουμε `entity.commercialStatus` απευθείας** — είναι ήδη σωστό σε κάθε περίπτωση.

| Overlay Kind | Linked Field | Firestore Collection | Πεδίο Χρώματος |
|---|---|---|---|
| **unit** | `linked.unitId` | `units` | `unit.commercialStatus` |
| **parking** | `linked.parkingId` | `parking_spots` | `parking.commercialStatus` |
| **storage** | `linked.storageId` | `storage_units` | `storage.commercialStatus` |
| **footprint** | — | — | **Δεν εμφανίζεται** (§4.2) |
| **(unlinked)** | — | — | `'unavailable'` (⚫ γκρι) |

### Resolution Algorithm (απλοποιημένο):

```
resolveOverlayColor(overlay):
  1. Αν kind == 'footprint' → SKIP (δεν εμφανίζεται στο Property Viewer)

  2. Αν kind == 'unit' && linked.unitId:
     → fetch units/{unitId}.commercialStatus → return

  3. Αν kind == 'parking' && linked.parkingId:
     → fetch parking_spots/{parkingId}.commercialStatus → return

  4. Αν kind == 'storage' && linked.storageId:
     → fetch storage_units/{storageId}.commercialStatus → return

  5. Fallback: 'unavailable' (⚫ γκρι — unlinked polygon)
```

### Υποστηρικτικά Ευρήματα Κώδικα:

| Πεδίο | Αρχείο | Γραμμή |
|---|---|---|
| `ParkingSpot.commercialStatus` | `src/types/parking.ts` | ~85 |
| `Storage.commercialStatus` | `src/types/storage/contracts.ts` | ~40 |
| `SpaceCommercialStatus` type | `src/types/sales-shared.ts` | ~11 |
| `canSellIndependently()` | `src/types/sales-shared.ts` | ~68 |
| `Unit.linkedSpaces[]` | `src/types/unit.ts` | ~462 |
| Appurtenance sync API | `src/app/api/sales/[unitId]/appurtenance-sync/route.ts` | — |
| Link direction: Unit → Space | `LinkedSpace.spaceId` | `src/types/unit.ts` ~257 |
| **Κανένα reverse ref** | Parking/Storage **δεν** έχουν `parentUnitId` | — |

### 4.2 Footprint Overlays — ΑΠΟΚΡΥΠΤΟΝΤΑΙ στο Property Viewer

**Απόφαση**: Τα footprint overlays (αποτύπωμα κτιρίου) **δεν εμφανίζονται** στην κάτοψη ορόφου του Property Viewer. Είναι δομικά στοιχεία που χρησιμεύουν μόνο στο DXF Viewer κατά τη σχεδίαση.

- **DXF Viewer**: Εμφανίζονται κανονικά (λευκά, όπως όλα τα polygons)
- **Property Viewer**: Φιλτράρονται — `overlays.filter(o => o.kind !== 'footprint')`

### 4.3 CommercialStatus ↔ PropertyStatus Mapping

**Απόφαση**: Το `'for-sale-and-rent'` αποκτά **ξεχωριστό χρώμα** (Teal `#14b8a6`) — δεν συγχωνεύεται με κανένα άλλο status. Κάθε διακριτή εμπορική κατάσταση αξίζει ξεχωριστή οπτική αναπαράσταση.

**Αλλαγή στο centralized system**: Προσθήκη `'for-sale-and-rent'` στο `PropertyStatus` type και στο `STATUS_COLORS_MAPPING` — επέκταση, όχι νέο σύστημα.

| CommercialStatus | PropertyStatus (χρώμα) | Χρώμα | Hex |
|---|---|---|---|
| `'for-sale'` | `'for-sale'` | 🟢 Πράσινο | `#10b981` |
| `'for-rent'` | `'for-rent'` | 🔵 Μπλε | `#3b82f6` |
| `'for-sale-and-rent'` | `'for-sale-and-rent'` | 🩵 Teal | `#14b8a6` |
| `'reserved'` | `'reserved'` | 🟡 Πορτοκαλί | `#f59e0b` |
| `'sold'` | `'sold'` | 🔴 Κόκκινο | `#ef4444` |
| `'rented'` | `'rented'` | 🔴 Σκούρο κόκκινο | `#dc2626` |
| `'unavailable'` | `'unavailable'` | ⚫ Γκρι | `#6b7280` |
| (χωρίς linked entity) | `'unavailable'` | ⚫ Γκρι | `#6b7280` |

**Αρχεία που αλλάζουν** (επέκταση centralized system):
- `src/constants/property-statuses-enterprise.ts` — προσθήκη `'for-sale-and-rent'` στο `PropertyStatus` type
- `src/subapps/dxf-viewer/config/color-mapping.ts` — προσθήκη entry στο `STATUS_COLORS_MAPPING`

**Αυτό το mapping υλοποιείται σε ΜΙΑ κεντρική function** `commercialToPropertyStatus()` — δεν σκορπίζεται.

### 4.4 SpaceCommercialStatus — Υποσύνολο του CommercialStatus

**Κρίσιμο**: Τα parking/storage χρησιμοποιούν `SpaceCommercialStatus` (`src/types/sales-shared.ts`) που είναι **υποσύνολο** του `CommercialStatus`:

| SpaceCommercialStatus | CommercialStatus | Σχόλιο |
|---|---|---|
| `'unavailable'` | `'unavailable'` | ✅ Ταυτίζονται |
| `'for-sale'` | `'for-sale'` | ✅ Ταυτίζονται |
| `'reserved'` | `'reserved'` | ✅ Ταυτίζονται |
| `'sold'` | `'sold'` | ✅ Ταυτίζονται |
| — | `'for-rent'` | ❌ Δεν υπάρχει στο Space |
| — | `'for-sale-and-rent'` | ❌ Δεν υπάρχει στο Space |
| — | `'rented'` | ❌ Δεν υπάρχει στο Space |

**Αυτό σημαίνει**: Η κεντρική `commercialToPropertyStatus()` function πρέπει να δέχεται **και τα δύο types** (`CommercialStatus | SpaceCommercialStatus`) και να τα χειρίζεται σωστά. Τα parking/storage δεν θα έχουν ποτέ `'for-rent'` ή `'rented'` — αυτό δεν είναι bug, είναι business logic.

---

## 5. Integrity Rules (Enterprise-Grade Safeguards)

### 5.1 Duplicate Linking Prevention

**Κανόνας**: 1 entity = 1 polygon. Δεν επιτρέπεται η μονάδα A-101 να συνδεθεί σε 2 polygons.

**Υλοποίηση**:
- Κατά τη σύνδεση: ελέγχεται αν η entity είναι ήδη linked σε άλλο overlay
- Αν ναι → **warning** ("Η μονάδα A-101 είναι ήδη συνδεδεμένη στο polygon X. Θέλετε να μεταφέρετε τη σύνδεση;")
- Αν ο χρήστης επιβεβαιώσει → η παλιά σύνδεση αφαιρείται, η νέα δημιουργείται
- **Αυτό αποτρέπει** 2 polygons να δείχνουν ταυτόχρονα πράσινα για το ίδιο ακίνητο

### 5.2 Already-Linked Visual Feedback στο Dropdown

Στο Entity dropdown, κάθε entity εμφανίζεται με **visual indicator**:

```
┌──────────────────────────────┐
│ Entity: [Επιλέξτε...      ▼] │
│ ┌──────────────────────────┐ │
│ │ 🟢 A-DI-1.01             │ │  ← ελεύθερη, χρώμα status
│ │ ⚫ A-DI-1.02 (linked)    │ │  ← ήδη linked, greyed out
│ │ 🟢 A-DI-1.03             │ │  ← ελεύθερη
│ │ 🔴 A-DI-1.04 (linked)    │ │  ← ήδη linked, greyed out
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- **Ελεύθερη entity**: κανονική εμφάνιση + χρώμα status (ο χρήστης βλέπει τι χρώμα θα πάρει)
- **Ήδη linked entity**: greyed out + "(linked)" — επιλέξιμη μόνο αν ο χρήστης θέλει να μεταφέρει τη σύνδεση

### 5.3 Unlink Action

Το Properties Panel περιλαμβάνει κουμπί **"Αποσύνδεση"** για linked polygons:

```
Properties Panel (linked polygon):
┌─────────────────────────────────┐
│ Kind: [🏠 Μονάδα    ▼]          │
│ Entity: [A-DI-1.01  ▼] [✕]     │  ← [✕] = Αποσύνδεση
│ Label: [A-DI-1.01    ]          │
│                                  │
│ Status: 🟢 Προς πώληση          │
└─────────────────────────────────┘
```

Κατά την αποσύνδεση:
- `overlay.linked.unitId` → `null`
- Polygon γίνεται **λευκό** (unlinked)
- Label **παραμένει** (δεν σβήνεται — ο χρήστης μπορεί να το αλλάξει χειροκίνητα)

---

## 6. Φασεολόγιο Υλοποίησης

### Φάση 1: DXF Viewer — Αφαίρεση StatusPalette, Inline Entity Linking, Dynamic Color

| # | Ενέργεια | Αρχείο | Τύπος |
|---|---|---|---|
| 1.1 | Αφαίρεση `<StatusPalette>` από toolbar | `OverlayToolbarSection.tsx` | Edit |
| 1.2 | Deprecation comment σε `StatusPalette.tsx` | `StatusPalette.tsx` | Edit |
| 1.3 | Mark `overlay.status` ως `@deprecated` | `overlays/types.ts` | Edit |
| 1.4 | Αφαίρεση default status κατά τη δημιουργία overlay | Overlay creation logic | Edit |
| 1.5 | **Properties Panel auto-open** μετά Save — Entity dropdown με auto-focus (δεν μπλοκάρει, ο χρήστης μπορεί να αγνοήσει) | Properties Panel / overlay-section/ | Edit |
| 1.6 | Entity dropdown φιλτράρει **μόνο entities του συγκεκριμένου ορόφου** (context από pipeline: Εταιρεία→Έργο→Κτίριο→Όροφος) | Entity Link dropdown | Logic |
| 1.7 | Κατά τη σύνδεση: real-time fetch `entity.commercialStatus` → χρωματισμός polygon | Canvas rendering + real-time hook | Edit |
| 1.8 | Unlinked polygons → λευκά, Linked → χρώμα βάσει status | Canvas rendering code | Edit |

### Φάση 2: SSoT Status Resolution Hook + Enrichment

| # | Ενέργεια | Αρχείο | Τύπος |
|---|---|---|---|
| 2.1 | **Δημιουργία `useEntityStatusResolver`** — SSoT hook: overlays → Map<overlayId, resolvedStatus> | `src/hooks/useEntityStatusResolver.ts` | **New (SSoT)** |
| 2.2 | Extract unique entity IDs ανά kind (unitIds, parkingIds, storageIds) | `useEntityStatusResolver.ts` | Logic |
| 2.3 | Real-time subscriptions σε 3 collections (χρήση `firestoreQueryService` ή `useRealtimeQuery`) | `useEntityStatusResolver.ts` | Logic |
| 2.4 | Κεντρική mapping function `commercialToPropertyStatus()` | `color-mapping.ts` | Edit |
| 2.5 | Προσθήκη `OVERLAY_OPACITY` constants (DXF_FILL, GALLERY_FILL, GALLERY_HOVER, MUTED) | `color-config.ts` | Edit |
| 2.6 | `useFloorOverlays` χρησιμοποιεί `useEntityStatusResolver` + enriches overlays με `resolvedStatus` | `useFloorOverlays.ts` | Edit |
| 2.7 | DXF Viewer canvas rendering χρησιμοποιεί τον ίδιο `useEntityStatusResolver` | DXF Viewer rendering | Edit |

### Φάση 3: FloorplanGallery — Dynamic Color

| # | Ενέργεια | Αρχείο | Τύπος |
|---|---|---|---|
| 3.1 | Αντικατάσταση `overlay.status` → `overlay.resolvedStatus` | `FloorplanGallery.tsx` γρ. 367 | Edit (1 γραμμή) |

### Φάση 4: Backward Compatibility & Cleanup

| # | Ενέργεια | Αρχείο | Τύπος |
|---|---|---|---|
| 4.1 | Legacy overlays (με `overlay.status`) χειρίζονται σωστά | `useFloorOverlays.ts` | Logic |
| 4.2 | Ενημέρωση ADR-237 changelog | `ADR-237-polygon-overlay-bridge.md` | Edit |

---

## 7. Performance Considerations

### Batch Entity Fetching

Αν μια κάτοψη ορόφου έχει 20 polygons linked σε entities, **δεν κάνουμε 20 ξεχωριστά queries**:

```
ΣΩΣΤΟ:  max 3 onSnapshot queries (1 per collection: units, parking_spots, storage_units)
        κάθε query: where('__name__', 'in', [id1, id2, ...])
ΛΑΘΟΣ:  20 × getDoc(entityId)
```

### Firestore `in` Query Limit — Chunking >30 Entities

Firestore `in` query: max **30 items** per query. Αν ένας όροφος έχει >30 entities του ίδιου kind:

```
Παράδειγμα: Όροφος με 45 μονάδες
  → Chunk 1: where('__name__', 'in', [unitId_1 ... unitId_30])  — 30 items
  → Chunk 2: where('__name__', 'in', [unitId_31 ... unitId_45]) — 15 items
  → Merge results
```

Η `useEntityStatusResolver` hook πρέπει να κάνει **αυτόματο chunking** — split σε batches των 30, merge αποτελεσμάτων. Αυτό είναι σπάνιο σενάριο (ελάχιστα κτίρια έχουν >30 μονάδες ανά όροφο) αλλά πρέπει να χειρίζεται σωστά.

### Real-time Updates (μέσω κεντρικοποιημένου συστήματος)

Τα χρώματα ενημερώνονται **αυτόματα** χάρη στο real-time subscription system:
- Πωλητής αλλάζει status μονάδας → Firestore update → `onSnapshot` triggers → νέο χρώμα στο canvas
- **Χωρίς refresh** — η αλλαγή εμφανίζεται αυτόματα σε όλα τα tabs/χρήστες
- Χρήση `firestoreQueryService.subscribeDoc()` ή `useRealtimeQuery` (ήδη υπάρχοντα centralized systems)
- Tenant-aware: auto-inject `companyId`, proper cleanup σε unmount

---

## 8. Testing Checklist

### DXF Viewer
- [ ] StatusPalette αφαιρέθηκε — δεν εμφανίζονται χρωματιστά κουμπιά status
- [ ] KindSelector (unit/parking/storage/footprint) λειτουργεί κανονικά
- [ ] Save/Cancel/Delete/Duplicate λειτουργούν κανονικά
- [ ] Μετά Save: Properties Panel ανοίγει αυτόματα με focus στο Entity dropdown
- [ ] Entity dropdown δείχνει μόνο entities του τρέχοντος ορόφου
- [ ] Ήδη linked entities εμφανίζονται greyed out στο dropdown
- [ ] Σύνδεση entity → polygon χρωματίζεται αμέσως (20% opacity)
- [ ] Unlinked polygons εμφανίζονται λευκά
- [ ] Αποσύνδεση (✕) → polygon γίνεται λευκό
- [ ] Duplicate linking: warning αν entity ήδη linked σε άλλο polygon

### Property Viewer (FloorplanGallery)
- [ ] Polygon χρωματίζεται βάσει `entity.commercialStatus` (50% opacity)
- [ ] Αλλαγή status entity → αλλαγή χρώματος **real-time χωρίς refresh**
- [ ] Unlinked polygons εμφανίζονται γκρι (unavailable)
- [ ] Footprint overlays **δεν εμφανίζονται**
- [ ] Legacy overlays (με `overlay.status`) χειρίζονται σωστά (backward compat)
- [ ] Hit-testing / hover / click λειτουργούν κανονικά
- [ ] Hover: PropertyHoverInfo panel δείχνει σωστό status badge
- [ ] Parking/Storage: χρωματίζονται βάσει δικού τους `commercialStatus`

### Performance & SSoT
- [ ] Batch entity fetch (max 3 queries ανά όροφο), όχι N+1
- [ ] `useEntityStatusResolver` χρησιμοποιείται και στα 2 contexts
- [ ] `OVERLAY_OPACITY` constants χρησιμοποιούνται (όχι hardcoded τιμές)
- [ ] `commercialToPropertyStatus()` χειρίζεται και CommercialStatus και SpaceCommercialStatus

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Legacy overlays με `overlay.status` σπάνε | Backward compatibility: fallback σε `overlay.status` αν δεν υπάρχει linked entity |
| `CommercialStatus` δεν ταυτίζεται με `PropertyStatus` | Κεντρική mapping function `commercialToPropertyStatus()` |
| `SpaceCommercialStatus` υποσύνολο `CommercialStatus` | Mapping function δέχεται union type, parking/storage δεν έχουν rent statuses (σωστό) |
| N+1 query problem (20 entities = 20 queries) | Batch fetch με Firestore `in` query (max 3 queries ανά όροφο) |
| Race condition: overlays φορτώνονται πριν τα entities | Loading state: εμφάνιση `'unavailable'` μέχρι να φορτωθεί το status |
| Duplicate linking (1 entity → 2 polygons) | Validation + warning dialog πριν τη σύνδεση |

---

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-03-23 | Initial ADR creation — Twin Architecture, Dynamic Overlay Coloring |
| 2026-03-23 | Q&A: Footprints hidden στο Property Viewer, parking/storage απλοποιημένο resolution, teal for-sale-and-rent, real-time coloring, DXF Viewer linked=χρώμα/unlinked=λευκό |
| 2026-03-23 | Color Legend: ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ — υπάρχει ήδη PropertyHoverInfo panel (δεξιά 320px) με status badge on hover |
| 2026-03-23 | Linking: Dual path — Primary: Properties Panel auto-open μετά Save στο DXF Viewer, Secondary: σελίδα διαχείρισης μονάδας (fallback) |
| 2026-03-23 | Opacity: DXF Viewer 20% (αχνό), FloorplanGallery 50% (έντονο) — industry pattern AutoCAD/Bentley/Revit |
| 2026-03-23 | SSoT: `useEntityStatusResolver` — ΕΝΑ hook για status resolution, χρησιμοποιείται και στα 2 contexts |
| 2026-03-23 | Enterprise safeguards: Duplicate linking prevention, already-linked feedback στο dropdown, unlink action, SpaceCommercialStatus mapping |
| 2026-03-23 | Fix §2.4 inconsistency: linked polygons δείχνουν χρώμα (20% opacity), μόνο unlinked είναι λευκά |
| 2026-03-23 | SPEC-258A IMPLEMENTED: StatusPalette removed, overlay.status deprecated, for-sale-and-rent added to PropertyStatus + STATUS_COLORS_MAPPING (TEAL #14b8a6), OVERLAY_OPACITY SSoT constants, commercialToPropertyStatus() mapping function, canvas rendering dynamic |
| 2026-03-23 | SPEC-258C IMPLEMENTED: useEntityStatusResolver SSoT hook — real-time overlay→entity→commercialStatus→PropertyStatus resolution, FloorOverlayItem.resolvedStatus enrichment in useFloorOverlays, onSnapshot per collection/chunk (FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS=10), backward compat with legacy overlay.status |
| 2026-03-23 | SPEC-258B IMPLEMENTED: Properties Panel entity linking — text input→Radix Select dropdown (ADR-001), useFloorEntitiesForLinking hook (reuses useFirestoreUnits/ParkingSpots/Storages), auto-open via EventBus overlay:polygon-saved→universalSelection, ConfirmDialog transfer (ADR-003), unlink ✕, kind-aware linking (unit/parking/storage), floor-level filtering via Level.floorId, i18n EN/EL |
| 2026-03-23 | SPEC-258D IMPLEMENTED: FloorplanGallery overlay.status→overlay.resolvedStatus, OVERLAY_OPACITY SSoT constants (GALLERY_HOVER, MUTED), footprint filter verified |
| 2026-03-23 | **ADR-258 COMPLETE** — All 4 phases implemented: SPEC-258A (color infra), SPEC-258C (resolver hook), SPEC-258B (entity linking), SPEC-258D (gallery integration) |
