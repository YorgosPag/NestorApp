# Ενδείξεις Έλξης σε Ευθύγραμμο Τμήμα (Line Snap Indicators)

---

## ⚠️ CRITICAL WARNING - ΔΙΑΒΑΣΕ ΠΡΩΤΑ

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        🚨 ΠΡΟΣΟΧΗ - ΜΗΝ ΑΛΛΑΞΕΙΣ 🚨                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  Η τρέχουσα υλοποίηση ΛΕΙΤΟΥΡΓΕΙ. Μην προσπαθήσεις να την "βελτιώσεις"      ║
║  χωρίς να καταλάβεις πλήρως πώς δουλεύει.                                   ║
║                                                                              ║
║  ❌ ΜΗΝ προσθέσεις worldToScreen() μετατροπή στο SnapIndicatorOverlay       ║
║  ❌ ΜΗΝ αλλάξεις τον τρόπο που περνούν τα coordinates από CanvasSection     ║
║  ❌ ΜΗΝ τροποποιήσεις το interface SnapResult (point, type)                 ║
║  ❌ ΜΗΝ αλλάξεις το ProSnapResult.snappedPoint χωρίς testing               ║
║                                                                              ║
║  Αν κάνεις αλλαγές και χαλάσει, ΕΠΑΝΑΦΕΡΕ με:                               ║
║  git checkout HEAD -- src/subapps/dxf-viewer/canvas-v2/overlays/            ║
║                       SnapIndicatorOverlay.tsx                               ║
║  git checkout HEAD -- src/subapps/dxf-viewer/components/dxf-layout/         ║
║                       CanvasSection.tsx                                      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Επισκόπηση

Όταν ο χρήστης πλησιάζει τον κέρσορα κοντά σε μία γραμμή (ευθύγραμμο τμήμα), εμφανίζονται ενδείξεις έλξης (snap indicators) που υποδεικνύουν τα σημεία στα οποία μπορεί να "κουμπώσει" η νέα γραμμή.

---

## Τύποι Ενδείξεων Έλξης

### 1. Endpoint Snap (Άκρα Γραμμής) - ■ Τετράγωνο

**Εμφάνιση:** Πράσινο τετράγωνο περιγράμματος (12x12 pixels)

**Θέση:** Στα δύο άκρα κάθε γραμμής (start point και end point)

```
Γραμμή A: ●━━━━━━━━━━━━━━━●
          ■                ■
       (start)          (end)
       Endpoint        Endpoint
```

### 2. Midpoint Snap (Μέσον Γραμμής) - △ Τρίγωνο

**Εμφάνιση:** Πράσινο τρίγωνο περιγράμματος (12x12 pixels)

**Θέση:** Στο ακριβές μέσον κάθε γραμμής

```
Γραμμή A: ●━━━━━━━━━━━━━━━●
                  △
              (midpoint)
```

---

## Ταύτιση Άκρων Δύο Γραμμών

### Σενάριο Χρήσης

Όταν ο χρήστης σχεδιάζει μια **νέα γραμμή** και θέλει να ξεκινήσει ακριβώς από το άκρο μιας **υπάρχουσας γραμμής**, το σύστημα snap εξασφαλίζει ότι τα δύο άκρα **ταυτίζονται απόλυτα**.

```
ΠΡΙΝ το snap:
Γραμμή A: ●━━━━━━━━━━━━━━━●
                           ↑ cursor (κοντά αλλά όχι ακριβώς)

ΜΕΤΑ το snap:
Γραμμή A: ●━━━━━━━━━━━━━━━●
                          ■← snap indicator (ακριβώς στο άκρο)

ΑΠΟΤΕΛΕΣΜΑ (νέα γραμμή):
Γραμμή A: ●━━━━━━━━━━━━━━━●━━━━━━━━━━● Γραμμή B
                          ↑
                    Κοινό σημείο
                    (τέλεια ταύτιση)
```

---

## Πώς Λειτουργεί - ΑΚΡΙΒΗΣ Τεχνική Περιγραφή

### Αρχιτεκτονική Ροής Δεδομένων

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ΒΗΜΑ 1: Mouse Move Event                                                    │
│ Αρχείο: useCentralizedMouseHandlers.ts (γραμμή 200-216)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top }          │
│ worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, vp)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ΒΗΜΑ 2: Snap Detection                                                      │
│ Αρχείο: useCentralizedMouseHandlers.ts (γραμμή 238)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ const snap = findSnapPoint(worldPos.x, worldPos.y);                        │
│ // Το snap engine δέχεται WORLD coordinates                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ΒΗΜΑ 3: Snap Engine Processing                                              │
│ Αρχείο: EndpointSnapEngine.ts (γραμμή 68-110)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ - Spatial index query για endpoints κοντά στον cursor                      │
│ - Επιστρέφει snap.snappedPoint = entity.start ή entity.end                │
│ - Τα coordinates είναι WORLD (όπως αποθηκεύονται στο entity)              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ΒΗΜΑ 4: Store in Context                                                    │
│ Αρχείο: useCentralizedMouseHandlers.ts (γραμμή 253)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ setCurrentSnapResult(snap);                                                 │
│ // Αποθηκεύει ολόκληρο το ProSnapResult object                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ΒΗΜΑ 5: Pass to Overlay                                                     │
│ Αρχείο: CanvasSection.tsx (γραμμή 917-921)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ <SnapIndicatorOverlay                                                       │
│   snapResult={currentSnapResult ? {                                         │
│     point: currentSnapResult.snappedPoint,  // ← ΚΡΙΣΙΜΟ                   │
│     type: currentSnapResult.activeMode                                      │
│   } : null}                                                                 │
│ />                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ΒΗΜΑ 6: Render Indicator                                                    │
│ Αρχείο: SnapIndicatorOverlay.tsx (γραμμή 217-218)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ style={{                                                                    │
│   left: point.x - SNAP_INDICATOR_HALF,  // ← ΑΠΕΥΘΕΙΑΣ χρήση              │
│   top: point.y - SNAP_INDICATOR_HALF,   // ← ΧΩΡΙΣ μετατροπή              │
│ }}                                                                          │
│                                                                             │
│ ⚠️ ΠΡΟΣΟΧΗ: Τα coordinates χρησιμοποιούνται ΑΠΕΥΘΕΙΑΣ ως CSS pixels       │
│             ΔΕΝ γίνεται worldToScreen() μετατροπή στο overlay              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Γιατί ΔΕΝ Πρέπει να Προσθέσεις worldToScreen()

### Η Προηγούμενη Αποτυχημένη Προσπάθεια (2026-01-06)

Έγινε προσπάθεια να "βελτιωθεί" ο κώδικας με:
1. Αλλαγή του overlay να δέχεται `ProSnapResult` απευθείας
2. Προσθήκη `useMemo` με `CoordinateTransforms.worldToScreen()`
3. Αλλαγή του CanvasSection να περνάει `currentSnapResult` χωρίς wrapper

**ΑΠΟΤΕΛΕΣΜΑ:** Η ένδειξη έλξης εμφανιζόταν **πολύ μακριά** από το άκρο της γραμμής.

**ΛΥΣΗ:** Επαναφορά με `git checkout HEAD --`

### Τι ΔΕΝ Πρέπει να Κάνεις

```typescript
// ❌ ΛΑΘΟΣ - Μην το κάνεις αυτό!
const screenPoint = useMemo(() => {
  return CoordinateTransforms.worldToScreen(
    snapResult.snappedPoint,
    transform,
    viewport
  );
}, [snapResult, transform, viewport]);

// ❌ ΛΑΘΟΣ - Μην αλλάξεις το interface!
interface SnapResult {
  point: Point2D;  // ΜΗΝ ΤΟ ΑΛΛΑΞΕΙΣ
  type: string;    // ΜΗΝ ΤΟ ΑΛΛΑΞΕΙΣ
}
```

### Τι Πρέπει να Διατηρηθεί

```typescript
// ✅ ΣΩΣΤΟ - Ο τρέχων κώδικας
<SnapIndicatorOverlay
  snapResult={currentSnapResult ? {
    point: currentSnapResult.snappedPoint,  // ✅ Περνάει snappedPoint
    type: currentSnapResult.activeMode      // ✅ Περνάει activeMode
  } : null}
/>

// ✅ ΣΩΣΤΟ - Στο overlay
style={{
  left: point.x - SNAP_INDICATOR_HALF,  // ✅ Απευθείας χρήση
  top: point.y - SNAP_INDICATOR_HALF,   // ✅ Χωρίς μετατροπή
}}
```

---

## Αρχεία που Συμμετέχουν

| Αρχείο | Ρόλος | Γραμμές |
|--------|-------|---------|
| `EndpointSnapEngine.ts` | Εύρεση endpoints γραμμών | 68-110 |
| `MidpointSnapEngine.ts` | Εύρεση midpoints γραμμών | - |
| `SnapOrchestrator.ts` | Συντονισμός snap engines | - |
| `SnapCandidateProcessor.ts` | Επιλογή καλύτερου candidate | 37 |
| `SnapContext.tsx` | React context για snap state | - |
| `useCentralizedMouseHandlers.ts` | Mouse handling + snap detection | 238, 253 |
| `CanvasSection.tsx` | Σύνδεση snap με overlay | 917-921 |
| `SnapIndicatorOverlay.tsx` | Visual feedback (■ △ σύμβολα) | 217-218 |

---

## Παράμετροι Snap

| Παράμετρος | Τιμή | Αρχείο |
|------------|------|--------|
| `SNAP_INDICATOR_SIZE` | 12px | SnapIndicatorOverlay.tsx:33 |
| `SNAP_INDICATOR_HALF` | 6px | SnapIndicatorOverlay.tsx:34 |
| `snapDistance` | 15px | Configurable |
| `color` | Πράσινο (`canvasUI.overlay.colors.snap.border`) | Design tokens |

---

## Αντιμετώπιση Προβλημάτων

### Πρόβλημα: Η ένδειξη εμφανίζεται μακριά από το endpoint

**Αιτία:** Κάποιος πρόσθεσε worldToScreen() μετατροπή

**Λύση:**
```bash
git checkout HEAD -- src/subapps/dxf-viewer/canvas-v2/overlays/SnapIndicatorOverlay.tsx
git checkout HEAD -- src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx
```

### Πρόβλημα: Δεν εμφανίζεται καθόλου η ένδειξη

**Έλεγχος:**
1. Είναι ενεργοποιημένο το snap; (`snapEnabled === true`)
2. Υπάρχουν entities στη σκηνή;
3. Είναι ορατό το SnapIndicatorOverlay; (z-index)

---

## Ιστορικό Αλλαγών

| Ημερομηνία | Αλλαγή | Αποτέλεσμα |
|------------|--------|------------|
| 2026-01-06 | Προσπάθεια προσθήκης worldToScreen() | ❌ ΑΠΟΤΥΧΙΑ - επαναφορά |
| 2026-01-06 | git checkout επαναφορά | ✅ ΛΕΙΤΟΥΡΓΕΙ |
| 2026-01-06 | Δημιουργία τεκμηρίωσης | ✅ Ολοκληρώθηκε |

---

## Τελευταία Ενημέρωση

- **Ημερομηνία:** 2026-01-06
- **Κατάσταση:** ✅ Λειτουργικό
- **Τελευταίο git commit που λειτουργεί:** HEAD (μετά από checkout)
