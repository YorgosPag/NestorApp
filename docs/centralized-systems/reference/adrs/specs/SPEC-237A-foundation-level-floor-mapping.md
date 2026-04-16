# SPEC-237A: Foundation — Level-to-Floor Mapping + Multi-Level Bug Fix

| Field | Value |
|-------|-------|
| **ADR** | ADR-237 |
| **Phase** | A — Foundation (Φάση 1 + Bug 3C) |
| **Priority** | CRITICAL — Blocking για Φάση 2, 3, 4, 5 |
| **Status** | ✅ IMPLEMENTED (Task A+B only — Task C NOT NEEDED) |
| **Estimated Effort** | 1 session |
| **Prerequisite** | None |
| **Dependencies** | SPEC-237B, SPEC-237C, SPEC-237D εξαρτώνται από αυτό |

---

## 1. Objective

Δημιουργία της **θεμελιώδους σύνδεσης** μεταξύ DXF Viewer Levels και Building Floors, καθώς και διόρθωση του Multi-Level bug που εμποδίζει μεζονέτες να εμφανίζουν κατόψεις ορόφου για κάθε επίπεδο.

**Δύο ξεχωριστά ζητήματα, ένα SPEC** — και τα δύο αφορούν τη σύνδεση Level↔Floor:

1. **Level-to-Floor Mapping**: Η `Level` interface δεν έχει `floorId` — χωρίς αυτό δεν μπορούμε να γνωρίζουμε ποια overlays ανήκουν σε ποιον floor
2. **Multi-Level Bug**: Μεζονέτες εμφανίζουν μόνο 1 tab κάτοψης ορόφου αντί N (1 ανά level)

---

## 2. Τρέχουσα Κατάσταση Κώδικα (Source of Truth)

### 2.1 Level Interface — ✅ `floorId` ΠΡΟΣΤΕΘΗΚΕ (2026-03-16)

**Αρχείο**: `src/subapps/dxf-viewer/systems/levels/config.ts` (γρ. 8-15)

```typescript
export interface Level {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
  floorId?: string;  // Σύνδεση με building floor (ADR-237, SPEC-237A)
}
```

**Firestore Collection**: `dxf_viewer_levels` — νέα documents αποθηκεύουν `floorId` αν δοθεί.

### 2.2 Floor Infrastructure — ΗΔΗ ΥΠΑΡΧΕΙ

| Component | Αρχείο | Status |
|-----------|--------|--------|
| `Floor` type | `src/types/building/contracts.ts` (γρ. 101-109) | ✅ Υπάρχει |
| `floors` Firestore collection | `{ id, buildingId, name, level, area }` | ✅ Υπάρχει |
| `useFloorFloorplans()` hook | `src/hooks/useFloorFloorplans.ts` (314 γραμμές) | ✅ Υπάρχει |
| Enterprise FileRecord pattern | `FloorFloorplanService` → `files` collection | ✅ Υπάρχει |

### 2.3 useFloorFloorplans — Existing API

**Αρχείο**: `src/hooks/useFloorFloorplans.ts`

```typescript
interface UseFloorFloorplansParams {
  floorId: string | null;
  buildingId: string | null;
  floorNumber: number | null;
  companyId?: string | null;
}

function useFloorFloorplans(params: UseFloorFloorplansParams): {
  floorFloorplan: FloorFloorplanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

**Strategy**: Enterprise-first (FloorFloorplanService) → Fallback (legacy `floor_floorplans`).

### 2.4 Multi-Level Bug — Τεχνική Ανάλυση

**Αρχείο**: `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx`

**Τρέχουσα λογική** (γρ. 340-349):
- Multi-level tabs δημιουργούνται σωστά: 1 tab ανά level (κάτοψη μονάδας)
- **ΑΛΛΑ** η "Κάτοψη Ορόφου" χρησιμοποιεί μόνο `floorId` + `floorNumber` → μόνο 1 floor floorplan tab

**Τρέχον αποτέλεσμα** (λάθος):
```
Tabs: [Κάτ. Ισόγειο] [Κάτ. 1ος Ορ.] [Κάτοψη Ορόφου] ← ΜΟΝΟ 1
```

**Σωστό αποτέλεσμα** (μετά τη διόρθωση):
```
Tabs: [Κάτ. Ισόγειο] [Κάτ. 1ος Ορ.] [Όρ. Ισογείου] [Όρ. 1ου Ορ.]
```

---

## 3. Task A: Προσθήκη `floorId` στο Level Interface

### Target File
`src/subapps/dxf-viewer/systems/levels/config.ts` — γραμμή 8-14

### Required Change
```typescript
export interface Level {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
  floorId?: string;  // ← NEW: Σύνδεση με building floor
}
```

### Impact Analysis

| Scope | Αντίκτυπος |
|-------|-----------|
| **Backward compatible** | ✅ Optional field — existing levels χωρίς `floorId` δουλεύουν κανονικά |
| **Firestore** | Νέο πεδίο στα `dxf_viewer_levels` documents — additive only |
| **Existing code** | Μηδενικό breaking change — κανείς δεν χρησιμοποιεί `floorId` ακόμα |
| **Migration** | Ζεστή: τα νέα levels αποκτούν `floorId`, τα παλιά δεν χρειάζεται |

### Firestore Document — Πριν και Μετά

**Πριν**:
```json
{
  "id": "level_abc",
  "name": "Ισόγειο",
  "order": 0,
  "isDefault": true,
  "visible": true
}
```

**Μετά**:
```json
{
  "id": "level_abc",
  "name": "Ισόγειο",
  "order": 0,
  "isDefault": true,
  "visible": true,
  "floorId": "floor_xyz"
}
```

---

## 4. Task B: Αποθήκευση `floorId` κατά τη Δημιουργία Level

### Σενάρια Auto-Population

| Σενάριο | Λογική |
|---------|--------|
| DXF project ανήκει σε building | Query `floors` collection → match `buildingId` + `level.order` → auto-assign `floorId` |
| DXF project standalone | `floorId` = null (δεν ανήκει σε building) |
| Manual assignment | Ο χρήστης συνδέει Level → Floor μέσω UI (μελλοντικά) |

### Query Pattern

```typescript
// Εύρεση floor από buildingId + order number
const floorsRef = collection(db, 'floors');
const q = query(
  floorsRef,
  where('buildingId', '==', buildingId),
  where('number', '==', level.order)
);
```

> **ΣΗΜΕΙΩΣΗ**: Αυτό το query ήδη χρησιμοποιείται στο `useFloorFloorplans.ts` (γρ. 110-131) — **REUSE**, μην δημιουργήσεις duplicate.

---

## 5. Task C: Multi-Level Floor Floorplan Tabs

### Target File
`src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx`

### Affected Lines
- γρ. 340-349: Tab creation logic
- γρ. 410-425: Tab content rendering

### Λογική Αλλαγής

**Condition**: `isMultiLevel && levels.length >= 2`

**Πριν** (τρέχων κώδικας):
```
1 floor floorplan tab → χρησιμοποιεί μόνο floorId + floorNumber
```

**Μετά** (διόρθωση):
```
N floor floorplan tabs → 1 ανά level
Κάθε tab: FloorFloorplanTabContent με τα αντίστοιχα floorId/floorNumber του level
```

### Tab Generation Pattern

```
Για κάθε level στο levels array:
  1. Βρες τον αντίστοιχο floor (μέσω level.floorId ή buildingId + level.order)
  2. Δημιούργησε tab: "Όρ. {floorName}" (π.χ. "Όρ. Ισογείου", "Όρ. 1ου Ορ.")
  3. Στο content: <FloorFloorplanTabContent floorId={floor.id} ... />
```

### Existing Component — REUSE

**`FloorFloorplanTabContent`** (internal στο ReadOnlyMediaViewer.tsx, γρ. 560-628):
- Ήδη δέχεται `floorId`, `buildingId`, `companyId` ως props
- Χρησιμοποιεί `useFloorFloorplans()` hook
- Renders `FloorplanGallery` component
- **REUSE αυτό** — δεν χρειάζεται νέο component

---

## 6. Κεντρικοποιημένα Συστήματα (REUSE ONLY)

| Σύστημα | Αρχείο | Χρήση |
|---------|--------|-------|
| `useFloorFloorplans()` | `src/hooks/useFloorFloorplans.ts` | Load floor floorplan data (enterprise + legacy) |
| `FloorFloorplanTabContent` | `ReadOnlyMediaViewer.tsx` (γρ. 560-628) | Existing internal component — 1 instance ανά floor tab |
| `FloorFloorplanService` | `src/services/floorplans/FloorFloorplanService.ts` | Enterprise FileRecord loading |
| `floors` collection | Firestore | Floor data source (buildingId, number, name) |

---

## 7. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `Level` interface περιέχει `floorId?: string` | TypeScript compilation |
| 2 | Νέα levels αποθηκεύουν `floorId` στο Firestore | Firestore Console inspection |
| 3 | Existing levels χωρίς `floorId` δουλεύουν κανονικά | Runtime — no regression |
| 4 | Μεζονέτα σε 2 ορόφους → 2 floor floorplan tabs | Visual — ReadOnlyMediaViewer |
| 5 | Μεζονέτα σε 3 ορόφους → 3 floor floorplan tabs | Visual — ReadOnlyMediaViewer |
| 6 | Single-level μονάδα → 1 floor floorplan tab (ως τώρα) | Visual — no regression |
| 7 | Κάθε floor floorplan tab φορτώνει σωστή κάτοψη | `useFloorFloorplans` returns correct data |

---

## 8. Σχετικά ADRs & SPECs

| Αναφορά | Σχέση |
|---------|-------|
| **ADR-237** | Parent ADR — Polygon Overlay Bridge |
| **ADR-236** | Multi-Level Property Management |
| **ADR-187** | Floor-Level Floorplans (IFC-Compliant) |
| **ADR-202** | Floorplan Save Orchestrator |
| **SPEC-237B** | Εξαρτάται από αυτό — Overlay Bridge Core |
| **SPEC-237C** | Εξαρτάται από αυτό — Interactive Overlays |

---

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Existing levels χωρίς `floorId` | LOW | Optional field — backward compatible |
| Floor numbering mismatch (level.order ≠ floor.number) | MEDIUM | Validate mapping, allow manual override |
| ReadOnlyMediaViewer complexity αυξάνεται | LOW | Reuse existing `FloorFloorplanTabContent` |
| Multi-level tab ordering confusion | LOW | Consistent naming: "Όρ. {floorName}" |

---

---

## 10. Implementation Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-16 | Task A: `floorId?: string` added to `Level` interface in `config.ts` | Claude Code |
| 2026-03-16 | Task B: `addLevel()` accepts + persists `floorId` in Firestore (`LevelsSystem.tsx`, `utils.ts`, `useLevels.ts`) | Claude Code |
| 2026-03-16 | Task C: NOT NEEDED — `ReadOnlyMediaViewer.tsx` already creates N floor floorplan tabs for multi-level units | Claude Code |
| 2026-03-16 | Status → IMPLEMENTED | Claude Code |

---

*SPEC Format based on: ADR-237 Polygon Overlay Bridge*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
