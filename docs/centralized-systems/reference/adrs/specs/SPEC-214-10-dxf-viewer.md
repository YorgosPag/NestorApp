# SPEC-214-10: DXF Viewer Collections Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 10 |
| **Status** | PENDING |
| **Risk** | LOW |
| **Αρχεία** | 3 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration DXF Viewer Firestore operations (overlays, levels). Χαμηλό ρίσκο, isolated subapp.

---

## Αρχεία προς Αλλαγή

### 1. `src/subapps/dxf-viewer/overlays/overlay-store.tsx`

**Τρέχουσα κατάσταση**: addDoc + setDoc + deleteDoc + onSnapshot
**Σημείωση**: Χρησιμοποιεί ακόμα `addDoc` — πρέπει να μετατραπεί σε enterprise ID (ADR-210 gap)

### 2. `src/subapps/dxf-viewer/systems/levels/LevelsSystem.tsx`

**Τρέχουσα κατάσταση**: addDoc + deleteDoc + onSnapshot
**Σημείωση**: Χρησιμοποιεί ακόμα `addDoc` — πρέπει να μετατραπεί σε enterprise ID

### 3. `src/components/property-viewer/ReadOnlyLayerViewer.tsx`

**Τρέχουσα κατάσταση**: onSnapshot listener

---

## Bonus: ADR-210 Compliance

Κατά τη migration, θα αντικαταστήσουμε τα εναπομείναντα `addDoc` με enterprise IDs:
- `overlay-store.tsx`: `addDoc` → `generateOverlayId()` + `setDoc`
- `LevelsSystem.tsx`: `addDoc` → `generateLevelId()` + `setDoc`

(Ίσως χρειαστούν νέοι generators στο enterprise-id.service.ts)

---

## Verification Checklist

- [ ] Overlays CRUD works in DXF Viewer
- [ ] Levels CRUD works
- [ ] Real-time updates work (onSnapshot)
- [ ] ReadOnlyLayerViewer displays correctly
- [ ] No addDoc remaining (ADR-210 compliance)
- [ ] `npx tsc --noEmit` clean
