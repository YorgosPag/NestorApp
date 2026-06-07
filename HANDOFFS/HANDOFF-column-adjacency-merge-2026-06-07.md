# HANDOFF — Column Adjacency Merge (Post-Creation Γ/Τ/Π Detection)
**Ημερομηνία:** 2026-06-07  
**Προηγούμενη συνεδρία:** Sonnet 4.6  
**Νέα συνεδρία:** Opus (GOL + SSOT — σύνθετο feature, 6-8 αρχεία, 2 domains)

---

## 1. ΤΙ ΕΓΙΝΕ ΣΤΗ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (COMMITTED + UNCOMMITTED)

### Διορθώσεις EC2 §9.6.1 (UNCOMMITTED — Giorgio θα κάνει commit)

**Αρχεία αλλαγμένα (git status M):**

#### `src/subapps/dxf-viewer/bim/columns/column-from-faces.ts`
- **Bug fix #1**: `rectAspectKind` άλλαξε `>=` → `>` (EC2: αυστηρά > 4 = τοιχίο, ≤ 4 = κολόνα)
- **Bug fix #2 (νέο)**: Στρογγυλοποίηση σε 1dp πριν τη σύγκριση:
  ```typescript
  const rounded = Math.round(aspect * 10) / 10;
  return rounded > SHEAR_WALL_MIN_ASPECT_RATIO ? 'shear-wall' : 'rectangular';
  ```
  **Γιατί**: ενδιάμεσοι γεωμετρικοί υπολογισμοί (polygon union) δίνουν 4.0000000001 από αληθινό 4:1 → bypass του dialog χωρίς rounding.
- **Νέο export**: `perimeterAspectRatio(perimeter)` — αναλογία πλευρών για display.
- **Νέο export**: `perimeterColumnKind(perimeter)` — SSoT classification χωρίς build.

#### `src/subapps/dxf-viewer/bim/columns/column-perimeter-confirm-store.ts`
- Νέο type `ColumnPerimeterConfirmMode = 'has-walls' | 'is-column'`
- Νέο field `mode` + `aspect` στο state
- Νέα function `requestColumnIsColumnWarn(aspect)` → Promise handshake για is-column dialog

#### `src/subapps/dxf-viewer/hooks/drawing/use-column-perimeter-commit.ts`
- EC2 guard στο **click path** (onPerimeterClick)
- EC2 guard στο **EventBus box-select handler** (outer-perimeter branch):
  - Αν η πρώτη ορθογωνική περίμετρος έχει displayed ratio ≤ 4 → `requestColumnIsColumnWarn` → dialog → user επιλέγει [Κολόνα] ή [Άκυρο]

#### `src/subapps/dxf-viewer/ui/dialogs/ColumnPerimeterConfirmDialog.tsx`
- Νέο mode `'is-column'` → renders `IsColumnDialog` sub-component
- IsColumnDialog: τίτλος «Αυτό είναι κολόνα», λόγος X.X:1, [Κολόνα (ορθογωνική)] / [Άκυρο]

#### `src/i18n/locales/el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json`
- Νέα keys: `perimeterColumnConfirm.isColumnTitle`, `.isColumnMessage`, `.createAsColumn`

#### `src/subapps/dxf-viewer/bim/columns/__tests__/column-from-faces.test.ts`
- 2 νέα tests: `aspect 4.0 exactly → rectangular` ✅, `aspect 4.4 → shear-wall` ✅
- **14/14 PASS**

---

## 2. ΤΙ ΠΡΕΠΕΙ ΝΑ ΥΛΟΠΟΙΗΘΕΙ (Η ΚΥΡΙΑ ΕΡΓΑΣΙΑ ΤΗΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ)

### Feature: Post-Creation Column Adjacency Detection + Merge to Τοιχίο

**Το πρόβλημα:**
Ο χρήστης δημιούργησε 2 ξεχωριστές κολόνες (ratio 4.0 + ratio < 4) σε διαφορετικά box-select. Μαζί σχηματίζουν Γ-shape = τοιχίο (Eurocode 8 §5.4.2.4). Το σύστημα δεν μπορεί να το ξέρει εκ των προτέρων — άρα χρειάζεται **post-creation check**.

**Το ζητούμενο (Revit-grade):**
Κάθε φορά που δημιουργείται νέα κολόνα, το σύστημα ελέγχει αν αγγίζει υφιστάμενη κολόνα και αν μαζί σχηματίζουν Γ/Τ/Π. Αν ναι → **non-blocking toast notification**:

> «Η νέα κολόνα αγγίζει υφιστάμενη κολόνα και μαζί σχηματίζουν σχήμα Γ (τοιχίο). Κατά Eurocode 8 §5.4.2.4 έχει διαφορετικό οπλισμό. **[Συγχώνευση σε τοιχίο Γ]** / [Αφήστε ξεχωριστά]»

**Αν ο χρήστης επιλέξει «Συγχώνευση»:**
- Διαγράφονται οι N κολόνες
- Δημιουργείται ΕΝΑ composite ColumnEntity (kind: 'composite') με το union polygon
- Single undo action (CompoundCommand)

---

## 3. ΑΡΧΙΤΕΚΤΟΝΙΚΗ (FULL ENTERPRISE + FULL SSOT — Revit-grade)

### Νέα αρχεία (προτεινόμενα)

```
src/subapps/dxf-viewer/bim/columns/
  column-adjacency-detector.ts        # Pure function: given new column + scene entities → finds touching columns → union shape
  column-merge-command.ts             # CompoundCommand: delete N columns + create 1 composite
  __tests__/column-adjacency-detector.test.ts

src/subapps/dxf-viewer/hooks/drawing/
  useColumnAdjacencyNotification.ts   # Hook: listens to EventBus 'bim:column-created' → triggers adjacency check → emits notification

src/subapps/dxf-viewer/ui/notifications/
  ColumnAdjacencyToast.tsx            # Non-blocking toast (NON-modal — χρήστης μπορεί να συνεχίσει χωρίς να απαντήσει)
```

### Αρχεία που αλλάζουν (προτεινόμενα)

```
bim/columns/column-perimeter-confirm-store.ts   # ή νέο adjacency-notification-store.ts
types/entities.ts                               # isBimEntity guard αμετάβλητο
hooks/drawing/use-column-perimeter-commit.ts    # emit 'bim:column-created' event μετά commit
bim/scene/append-entity-to-scene.ts            # ή εδώ emit το event
i18n/locales/el/dxf-viewer-shell.json
i18n/locales/en/dxf-viewer-shell.json
```

### Κρίσιμες αποφάσεις για τον νέο agent

1. **Geometry**: Χρήση του υπάρχοντος `perimeterFacesToRects` + `buildColumnEntityFromPerimeter` (SSoT — μηδέν fork)
2. **Union**: Το union polygon των 2+ κολωνών → `ClosedPerimeter` με shape='composite'/'U-shape' → ΕΝΑ entity
3. **Notification style**: NON-blocking toast (ΟΧΙ modal dialog — ο χρήστης δεν πρέπει να σταματάει τη ροή εργασίας) — Revit-style
4. **Undo**: Η συγχώνευση πρέπει να είναι αναιρέσιμη με ΕΝΑ Ctrl+Z (CompoundCommand)
5. **Tolerance**: Ίδια `regionTol()` με το box-select (TOLERANCE_CONFIG.SNAP_DEFAULT / scale)
6. **Multi-column**: Πρέπει να χειρίζεται και 3+ κολόνες (Τ, Π, σταυρός)
7. **Only same-level**: Adjacency check μόνο για columns του ίδιου `levelId`
8. **ADR**: Νέο ADR ή section σε ADR-363 (§7 adjacency detection)

### SSoT που πρέπει να χρησιμοποιηθεί (ΠΡΩΤΑ grep αυτά)

- `docs/centralized-systems/README.md` — master hub
- `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` — column/τοιχίο drawing ADR
- `src/subapps/dxf-viewer/bim/columns/column-from-faces.ts` — perimeterFacesToRects, buildColumnsFromPerimeters, perimeterColumnKind (SSoT)
- `src/subapps/dxf-viewer/bim/walls/perimeter-from-faces.ts` — perimeterFacesToRects SSoT
- `src/subapps/dxf-viewer/core/commands/` — CompoundCommand pattern
- `src/subapps/dxf-viewer/systems/events/EventBus.ts` — event system SSoT
- `src/subapps/dxf-viewer/bim/columns/column-perimeter-confirm-store.ts` — Promise handshake pattern (mirror για adjacency store)

---

## 4. ΚΑΝΟΝΕΣ ΓΙΑ ΤΟΝ ΝΕΟ AGENT

- **Working tree κοινό** με άλλον agent — ΜΗΝ κάνεις commit, ΜΗΝ κάνεις push (Giorgio αποφασίζει)
- **GOL + SSOT**: Google-level quality, full enterprise
- **ΠΡΩΤΑ** διάβασε ADR-363 και column-from-faces.ts ΠΡΙΝ γράψεις κώδικα
- **ΠΡΩΤΑ** Plan Mode (N.8: 6-8 αρχεία, 2 domains = Orchestrator evaluation)
- **ΟΧΙ `any`**, ΟΧΙ inline styles, ΟΧΙ hardcoded strings
- **N.7.1**: MAX 500 lines ανά αρχείο, MAX 40 lines ανά function
- **Tests**: Minimum 3 tests για column-adjacency-detector (touching/not-touching/3-column-T)
- **i18n**: ΠΡΩΤΑ keys στα JSON, ΜΕΤΑ t() στον κώδικα
- **EventBus event name**: `'bim:columns-created'` ή `'bim:column-adjacency-detected'` — ΟΧΙ νέο χωρίς grep πρώτα

---

## 5. PROMPT ΓΙΑ COPY-PASTE ΣΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ

```
Διάβασε το αρχείο C:\Nestor_Pagonis\HANDOFFS\HANDOFF-column-adjacency-merge-2026-06-07.md και υλοποίησε αυτό που περιγράφει. GOL + SSOT. Opus. Plan Mode υποχρεωτικό πριν γράψεις κώδικα. Working tree κοινό — ΜΗΝ κάνεις commit.
```
