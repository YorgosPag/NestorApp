# SPEC-258B: Properties Panel Entity Linking (Inline Dropdown)

| Field | Value |
|-------|-------|
| **ADR** | ADR-258 (Twin Architecture — Dynamic Overlay Coloring) |
| **Phase** | 3 of 4 |
| **Priority** | HIGH — primary UX for entity linking |
| **Status** | IMPLEMENTED (2026-03-23) |
| **Depends On** | SPEC-258A (color infrastructure), SPEC-258C (status resolver hook) |

---

## Objective

Μετατροπή του Properties Panel από text input σε **searchable entity dropdown** με floor filtering, duplicate linking prevention, unlink action, και auto-open μετά Save — Google Earth Pro pattern.

## Current State

- Properties Panel (`OverlayProperties.tsx`) έχει text input για `linkedUnitId` (γραμμές 159-168)
- Δεν ανοίγει αυτόματα μετά τη δημιουργία overlay
- Δεν υπάρχει floor-level filtering — ο χρήστης πρέπει να ξέρει το ID
- Δεν υπάρχει duplicate linking prevention (1 entity μπορεί να συνδεθεί σε πολλά polygons)
- Δεν υπάρχει visual feedback για ήδη linked entities
- Δεν υπάρχει unlink action (κουμπί ✕)

## Target State

- Properties Panel ανοίγει **αυτόματα** μετά Save με focus στο Entity dropdown
- Entity dropdown εμφανίζει **μόνο entities του τρέχοντος ορόφου** (filtered by `Level.floorId` + `kind`)
- Already-linked entities εμφανίζονται **greyed out** με "(linked)" label
- Duplicate linking: **warning dialog** πριν τη μεταφορά σύνδεσης
- **Unlink action** (✕) — αποσυνδέει entity, polygon γίνεται λευκό
- Κατά τη σύνδεση: real-time fetch `entity.commercialStatus` → immediate polygon coloring

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/subapps/dxf-viewer/ui/OverlayProperties.tsx` | MODIFY (major) | Replace text input with dropdown, add unlink, floor filter |
| `src/subapps/dxf-viewer/ui/DraggableOverlayProperties.tsx` | MODIFY | Ensure wrapper supports auto-open behavior |
| `src/subapps/dxf-viewer/overlays/overlay-store.tsx` | MODIFY | Auto-open Properties Panel after Save |
| `src/subapps/dxf-viewer/systems/levels/config.ts` | READ | `Level.floorId` for floor context |
| `src/config/firestore-collections.ts` | READ | Collection names: `units`, `parking_spots`, `storage_units` |

## Implementation Steps

### Step 1: Auto-open Properties Panel μετά Save

Στο `overlay-store.tsx`, μετά το successful save ενός νέου overlay:

```
onSave(overlay) → success
  → set selectedOverlayId = newOverlayId
  → set propertiesPanelOpen = true
  → focus: entity dropdown
```

UX: Το panel ανοίγει αλλά **δεν μπλοκάρει** — ο χρήστης μπορεί να αγνοήσει το dropdown και να συνεχίσει σχεδίαση. Unlinked polygons μένουν λευκά.

### Step 2: Entity dropdown με floor filtering

Αντικατάσταση text input (`<Input>`) με searchable `<Select>` (Radix Select — ADR-001):

```
Dropdown logic:
  1. Πάρε currentLevel → Level.floorId
  2. Query entities βάσει kind:
     - kind='unit' → query units where floorId == Level.floorId
     - kind='parking' → query parking_spots where floorId == Level.floorId
     - kind='storage' → query storage_units where floorId == Level.floorId
  3. Για κάθε entity:
     - Αν ΔΕΝ είναι linked → κανονική εμφάνιση + status color dot
     - Αν ΕΙΝΑΙ ήδη linked σε άλλο polygon → greyed out + "(linked)"
  4. Χρήστης επιλέγει → overlay.linked.{kindId} = entity.id
```

**Dropdown UI** (Google Earth Pro pattern):

```
┌──────────────────────────────┐
│ Entity: [Επιλέξτε...      ▼] │
│ ┌──────────────────────────┐ │
│ │ 🟢 A-DI-1.01             │ │  ← ελεύθερη, for-sale
│ │ ⚫ A-DI-1.02 (linked)    │ │  ← greyed out
│ │ 🟢 A-DI-1.03             │ │  ← ελεύθερη
│ │ 🔴 A-DI-1.04 (linked)    │ │  ← greyed out
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### Step 3: Duplicate linking prevention

Αν ο χρήστης επιλέξει entity που είναι ήδη linked σε άλλο polygon:

```
Warning dialog:
  "Η μονάδα A-DI-1.01 είναι ήδη συνδεδεμένη στο polygon #{X}.
   Θέλετε να μεταφέρετε τη σύνδεση;"
  [Ακύρωση] [Μεταφορά]
```

Αν "Μεταφορά":
1. Αφαίρεση σύνδεσης από παλιό polygon → γίνεται λευκό
2. Δημιουργία σύνδεσης στο νέο polygon → χρωματίζεται

### Step 4: Unlink action

Στο Properties Panel, δίπλα στο Entity dropdown όταν υπάρχει linked entity:

```
┌─────────────────────────────────┐
│ Entity: [A-DI-1.01  ▼] [✕]     │  ← [✕] = Αποσύνδεση
│ Status: 🟢 Προς πώληση          │
└─────────────────────────────────┘
```

Κατά το unlink:
- `overlay.linked.unitId` → `null` (ή αφαίρεση πεδίου)
- Polygon γίνεται λευκό (unlinked)
- Label **παραμένει** (δεν σβήνεται)

### Step 5: Real-time color update μετά σύνδεση

Μετά τη σύνδεση entity:
1. Fetch `entity.commercialStatus` (real-time)
2. `commercialToPropertyStatus(status)` → PropertyStatus
3. `getStatusColors(propertyStatus)` → `{ stroke, fill }`
4. Apply στο polygon canvas: fill με `OVERLAY_OPACITY.DXF_FILL` (20%)
5. Polygon χρωματίζεται **αμέσως** — χωρίς refresh

## Existing Functions to Reuse

- `getStatusColors(status)` — `color-mapping.ts` (color lookup)
- `commercialToPropertyStatus()` — `color-mapping.ts` (SPEC-258A)
- `OVERLAY_OPACITY` — `color-config.ts` (SPEC-258A)
- `firestoreQueryService.getAll()` — `firestore-query.service.ts` (entity fetching)
- `useRealtimeQuery` — `services/realtime/hooks/useRealtimeQuery.ts` (floor entities)
- Radix Select — `@/components/ui/select` (ADR-001 canonical dropdown)
- `Level.floorId` — `systems/levels/config.ts` (floor context)
- `useLevels()` — `systems/levels/useLevels.ts` (current level)

## Acceptance Criteria

- [x] Properties Panel ανοίγει αυτόματα μετά Save με focus στο Entity dropdown
- [x] Entity dropdown εμφανίζει **μόνο entities του τρέχοντος ορόφου**
- [x] Kind filtering: unit→μονάδες, parking→parking spots, storage→αποθήκες
- [x] Already-linked entities εμφανίζονται greyed out στο dropdown
- [x] Σύνδεση entity → polygon χρωματίζεται **αμέσως** (20% fill opacity via SPEC-258C)
- [x] Duplicate linking: warning dialog πριν τη μεταφορά σύνδεσης
- [x] Unlink action (✕): polygon γίνεται λευκό, label παραμένει
- [x] Χρήστης μπορεί να **αγνοήσει** το dropdown και να συνεχίσει σχεδίαση
- [x] Radix Select component (ADR-001 — ΟΧΙ EnterpriseComboBox)
- [x] Zero TypeScript errors

---

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-03-23 | Initial SPEC creation |
| 2026-03-23 | IMPLEMENTED: Radix Select dropdown, useFloorEntitiesForLinking hook, auto-open via EventBus, ConfirmDialog transfer, unlink ✕, i18n EN/EL |
