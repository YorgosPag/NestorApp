# 📂 DXF LOADING FLOW - ΤΕΚΜΗΡΙΩΣΗ

> **ΣΗΜΑΝΤΙΚΟ**: Αυτό το αρχείο τεκμηριώνει **ΑΚΡΙΒΩΣ** πώς φορτώνεται ένα DXF αρχείο.
>
> **ΔΙΑΒΑΣΕ ΑΥΤΟ ΠΡΙΝ ΑΛΛΑΞΕΙΣ ΚΑΤΙ στο DXF loading!**

---

## 🚨 ΚΟΙΝΟ BUG - ΔΙΑΒΑΣΕ ΠΡΩΤΑ!

### ❌ **Το Συνηθισμένο Πρόβλημα:**

**Symptom**: Πατάς το "DXF File (Legacy)" button → **ΔΕΝ φορτώνει το αρχείο**

**Root Cause**: Το `onSceneImported` prop δεν είναι συνδεδεμένο ή λείπει.

**Fix**: Έλεγξε ότι η **αλυσίδα props** είναι ακέραια (βλέπε παρακάτω).

---

## 📊 ΠΛΗΡΗΣ ΑΛΥΣΙΔΑ - Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION                                              │
│    Button: "DXF File (Legacy)" (EnhancedDXFToolbar)             │
│    Component: UploadDxfButton.tsx                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. BUTTON COMPONENT                                              │
│    File: ui/UploadDxfButton.tsx                                 │
│    Opens: DxfImportModal                                        │
│    User selects: File + Encoding                                │
│    Callback: onFileSelect(file, encoding)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. TOOLBAR COMPONENT                                             │
│    File: ui/toolbar/EnhancedDXFToolbar.tsx                      │
│    Prop received: onSceneImported                               │
│    Renders: UploadDxfButton with onFileSelect={onSceneImported} │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. TOOLBAR SECTION (Layout Component)                           │
│    File: components/dxf-layout/ToolbarSection.tsx               │
│    Line 62: onSceneImported={dxfProps.handleFileImport}         │
│    ⚠️ CRITICAL: Must use handleFileImport (NOT onFileImport!)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. NORMAL VIEW (Layout Orchestrator)                            │
│    File: components/dxf-layout/NormalView.tsx                   │
│    Line 19: <ToolbarSection {...props} />                       │
│    Passes all props including handleFileImport                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. DXF VIEWER LAYOUT                                             │
│    File: components/dxf-layout/DXFViewerLayout.tsx              │
│    Receives: handleFileImport from MainContentSection           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. MAIN CONTENT SECTION                                          │
│    File: layout/MainContentSection.tsx                          │
│    Line 155: handleFileImport={handleFileImportWithEncoding}    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. DXF VIEWER CONTENT (Top-level State)                         │
│    File: app/DxfViewerContent.tsx                               │
│    Line 543: const handleFileImportWithEncoding                 │
│    This is the ACTUAL implementation!                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. DXF IMPORT HOOK                                               │
│    File: hooks/useDxfImport.ts                                  │
│    Parses DXF file                                              │
│    Creates scene model                                          │
│    Updates application state                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 ΑΡΧΕΙΑ ΚΑΙ ΓΡΑΜΜΕΣ ΚΩΔΙΚΑ

### **1. UI Button Component**
**File**: `ui/UploadDxfButton.tsx`

**Σημαντικές γραμμές**:
- Line 8: `onFileSelect?: (file: File, encoding?: string) => void;`
- Line 19: `onFileSelect?.(file, encoding);`

**Τι κάνει**: Εμφανίζει button + modal για επιλογή αρχείου.

---

### **2. Toolbar Component**
**File**: `ui/toolbar/EnhancedDXFToolbar.tsx`

**Σημαντικές γραμμές**:
- Line 34: `onSceneImported?: (file: File, encoding?: string) => void;`
- Line 229: `onFileSelect={onSceneImported}`

**Τι κάνει**: Περνάει το `onSceneImported` στο `UploadDxfButton`.

---

### **3. Toolbar Section (Layout)**
**File**: `components/dxf-layout/ToolbarSection.tsx`

**🚨 ΚΡΙΣΙΜΗ ΓΡΑΜΜΗ**:
```tsx
// Line 62
onSceneImported={dxfProps.handleFileImport}  // ✅ ΣΩΣΤΟ

// ❌ ΛΑΘΟΣ (παλιό bug):
// onSceneImported={dxfProps.onFileImport}  // Property does NOT exist!
```

**Τι κάνει**: Συνδέει το toolbar button με το actual handler.

---

### **4. Normal View**
**File**: `components/dxf-layout/NormalView.tsx`

**Σημαντικές γραμμές**:
- Line 19-27: `<ToolbarSection {...props} />`

**Τι κάνει**: Περνάει όλα τα props (including `handleFileImport`) στο ToolbarSection.

---

### **5. Main Content Section**
**File**: `layout/MainContentSection.tsx`

**Σημαντικές γραμμές**:
- Line 31: `handleFileImportWithEncoding: (file: File, encoding?: string) => Promise<void>;`
- Line 155: `handleFileImport={handleFileImportWithEncoding}`

**Τι κάνει**: Middleware layer που περνάει το handler στο DXFViewerLayout.

---

### **6. DXF Viewer Content (Top-level)**
**File**: `app/DxfViewerContent.tsx`

**Σημαντικές γραμμές**:
- Line 543-588: `handleFileImportWithEncoding` implementation
- Line 797: `handleFileImportWithEncoding={handleFileImportWithEncoding}`

**Τι κάνει**: Το ACTUAL implementation που:
1. Διαβάζει το file
2. Καλεί το `useDxfImport` hook
3. Ενημερώνει το state

---

### **7. DXF Import Hook**
**File**: `hooks/useDxfImport.ts`

**Τι κάνει**:
- Parses DXF file (με dxf-parser library)
- Δημιουργεί SceneModel
- Ενημερώνει application state
- Κάνει fit-to-view

---

## 🐛 ΣΥΝΗΘΗ BUGS & ΛΥΣΕΙΣ

### **Bug #1: "DXF File button δεν κάνει τίποτα"**

**Symptom**: Πατάς το button → ΔΕΝ ανοίγει modal

**Cause**: Το `onSceneImported` είναι `undefined` στο `EnhancedDXFToolbar`

**Fix**: Έλεγξε το **ToolbarSection.tsx line 62**:
```tsx
// ✅ ΣΩΣΤΟ:
onSceneImported={dxfProps.handleFileImport}

// ❌ ΛΑΘΟΣ:
onSceneImported={dxfProps.onFileImport}  // Property does NOT exist
```

**Verification**:
1. Βάλε `console.log` στο `EnhancedDXFToolbar` line 229
2. Δες αν το `onSceneImported` είναι function ή undefined

---

### **Bug #2: "Modal ανοίγει αλλά δεν φορτώνει DXF"**

**Symptom**: Επιλέγεις file → ΔΕΝ φορτώνει

**Cause**: Το `handleFileImportWithEncoding` δεν είναι συνδεδεμένο

**Fix**: Έλεγξε το **MainContentSection.tsx line 155**:
```tsx
// ✅ ΣΩΣΤΟ:
handleFileImport={handleFileImportWithEncoding}

// ❌ ΛΑΘΟΣ:
handleFileImport={undefined}
```

---

### **Bug #3: "Φορτώνει αλλά χωρίς encoding"**

**Symptom**: DXF φορτώνει αλλά μη-ASCII χαρακτήρες είναι garbage

**Cause**: Το encoding parameter δεν περνιέται

**Fix**: Έλεγξε ότι ΟΛΟΙ οι handlers δέχονται `encoding`:
```tsx
// ✅ ΣΩΣΤΟ:
(file: File, encoding?: string) => void

// ❌ ΛΑΘΟΣ:
(file: File) => void  // Missing encoding parameter
```

---

## ✅ VERIFICATION CHECKLIST

### **Πώς να ελέγξεις ότι όλα δουλεύουν:**

1. **Browser Console**:
   ```javascript
   // Στο EnhancedDXFToolbar, προσθέσε:
   console.log('🔍 onSceneImported:', typeof onSceneImported);
   // Expected: "function"
   ```

2. **Manual Test**:
   - [ ] Πάτα "DXF File (Legacy)" button
   - [ ] Βλέπεις modal;
   - [ ] Επιλέγεις αρχείο
   - [ ] Φορτώνει το drawing;
   - [ ] Βλέπεις entities (lines, circles);

3. **Console Logs (Expected flow)**:
   ```
   📋 DxfViewerContent.handleFileImportWithEncoding called
   🎯 useDxfImport: Starting import...
   📦 Scene loaded successfully
   ```

---

## 🚨 ΠΡΙΝ ΚΑΝΕΙΣ ΑΛΛΑΓΗ

### **Read These Rules:**

1. **ΠΟΤΕ μην αλλάξεις** το prop name από `handleFileImport` → `onFileImport`
   - Το interface (`integration/types.ts`) ορίζει `handleFileImport`
   - Η αλλαγή θα σπάσει το loading

2. **ΠΟΤΕ μην αφαιρέσεις** το `encoding` parameter
   - Χρειάζεται για non-ASCII χαρακτήρες (Ελληνικά, κλπ.)

3. **ΠΑΝΤΑ έλεγξε** την αλυσίδα props μετά από refactoring:
   ```
   DxfViewerContent
     → MainContentSection
       → DXFViewerLayout
         → NormalView
           → ToolbarSection
             → EnhancedDXFToolbar
               → UploadDxfButton
   ```

4. **ΠΑΝΤΑ τρέξε** manual test μετά από αλλαγή:
   - Ctrl+F5 (hard refresh)
   - Πάτα "DXF File (Legacy)"
   - Επίλεξε test DXF
   - Επιβεβαίωσε ότι φορτώνει

---

## 📝 HISTORY LOG

### **2025-10-04 - Bug Fixed (4 μήνες μετά)**

**Symptom**: DXF File button δεν φόρτωνε αρχεία

**Root Cause**:
- File: `components/dxf-layout/ToolbarSection.tsx`
- Line: 62
- Bug: `onSceneImported={dxfProps.onFileImport}`
- Property `onFileImport` **does NOT exist** in DXFViewerLayoutProps

**Fix**:
```tsx
// Before (WRONG):
onSceneImported={dxfProps.onFileImport}

// After (CORRECT):
onSceneImported={dxfProps.handleFileImport}
```

**Lesson Learned**:
- Η αλυσίδα props είναι εύθραυστη
- Το TypeScript **ΔΕΝ πιάνει** αυτό το bug γιατί το `{...props}` bypass το type checking
- Χρειαζόμαστε **automated tests** για να μην ξαναχαθεί

**Time Lost**: 4 μήνες (ψάχναμε zoom bugs ενώ το DXF loading ήταν σπασμένο)

---

## 🎯 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (TODO)

- [ ] Φτιάξε automated test για DXF loading
- [ ] Προσθέσε TypeScript strict checking στο ToolbarSection
- [ ] Δημιούργησε integration test που ελέγχει ολόκληρη την αλυσίδα
- [ ] Προσθέσε warning στο console αν `onSceneImported` είναι undefined

---

## 📚 RELATED DOCUMENTATION

- [CANVAS_ECOSYSTEM_DEBUG_PLAN.md](./CANVAS_ECOSYSTEM_DEBUG_PLAN.md) - Canvas debugging guide
- [centralized_systems.md](./centralized_systems.md) - Centralized systems overview
- [CLAUDE.md](../../../CLAUDE.md) - Work rules (ΔΕΚΑΛΟΓΟΣ)

---

## 🎨 ΕΠΙΠΛΕΟΝ BUGS ΒΡΕΘΗΚΑΝ (2025-10-04)

Μετά την διόρθωση του DXF loading bug, βρέθηκαν **2 επιπλέον προβλήματα** που επηρέαζαν την εμφάνιση των DXF entities:

### 🐛 **Bug #4: Layer Colors δεν εμφανίζονταν**

**Symptom**: Όλα τα DXF entities ήταν **ΛΕΥΚΑ**, αγνοούσαν τα layer colors που φαίνονταν σωστά στο panel.

**Root Cause #1**:
- File: `utils/dxf-scene-builder.ts`
- Entities δεν είχαν `color` property κατά την δημιουργία τους
- Το layer color υπήρχε μόνο στο `layers[]` object, ΟΧΙ στο entity

**Root Cause #2**:
- File: `systems/phase-manager/PhaseManager.ts`
- Το rendering (normal phase) χρησιμοποιούσε generic preview settings
- Αγνοούσε εντελώς το `entity.color`

**Fix Applied**:
1. `dxf-scene-builder.ts` (lines 31-41): Προσθήκη layer color σε κάθε entity
   ```typescript
   const layerColor = layers[entity.layer]?.color || DEFAULT_LAYER_COLOR;
   (entity as any).color = layerColor;
   ```

2. `PhaseManager.ts` (lines 154-161): Χρήση entity.color για rendering
   ```typescript
   case 'normal':
     this.ctx.strokeStyle = entity.color || CAD_UI_COLORS.entity.default;
   ```

**Verification**: Τα layer colors εμφανίζονται τώρα σωστά! ✅

---

### 🐛 **Bug #5: Τεταρτημόρια πορτών ανάποδα (Y-axis flip)**

**Symptom**: Τα arc entities (τεταρτημόρια πορτών) ήταν **ανάποδα** (flipped).

**Root Cause**:
- DXF coordinate system: Y αυξάνεται προς τα **ΠΑΝΩ** (CAD standard)
- Canvas coordinate system: Y αυξάνεται προς τα **ΚΑΤΩ**
- Οι γωνίες περνιούνταν όπως ήταν από το DXF → λάθος orientation

**Fix Applied**:
- File: `rendering/entities/BaseEntityRenderer.ts` (lines 467-476)
- Αντιστροφή γωνιών για canvas coordinate system:
  ```typescript
  const canvasStartAngle = -startAngle;  // Flip Y-axis
  const canvasEndAngle = -endAngle;      // Flip Y-axis
  this.ctx.arc(..., canvasEndAngle, canvasStartAngle, false);
  ```

**Verification**: Τα τεταρτημόρια πορτών εμφανίζονται σωστά! ✅

---

### 🗑️ **Cleanup: Διαγραφή unused rendering system**

Κατά την έρευνα βρέθηκε **διπλότυπο rendering system** (~800 γραμμές) που ΠΟΤΕ δεν χρησιμοποιήθηκε:

**Deleted Files**:
- `rendering/passes/EntityPass.ts` (438 lines)
- `rendering/passes/BackgroundPass.ts`
- `rendering/passes/OverlayPass.ts`
- `rendering/passes/index.ts`
- `rendering/core/RenderPipeline.ts` (~300 lines)

**Αιτιολογία**: Experimental/unused code. Το actual rendering χρησιμοποιεί:
`DxfRenderer` → `EntityRendererComposite` → `BaseEntityRenderer` → `PhaseManager`

**Όφελος**: ~800 γραμμές λιγότερες, μηδέν διπλότυπα, καθαρότερη codebase! 🎯

---

---

### 🐛 **Bug #6: Τα κείμενα εμφανίζονται πολύ μικρά (Text Rendering)**

**Symptom**: Τα text entities από DXF φαίνονται **πολύ μικρά** (4 μήνες debugging!)

**Root Cause**:
- `TextRenderer.ts` υπολόγιζε σωστά `screenHeight = height * scale` από DXF entity
- **ΑΛΛΑ** καλούσε `renderStyledTextWithOverride()` που:
  - **ΑΓΝΟΟΥΣΕ** το `screenHeight`
  - **ΧΡΗΣΙΜΟΠΟΙΟΥΣΕ** `textStyleStore.fontSize` (default 12px)
- Αποτέλεσμα: DXF text heights (π.χ. 0.132 units) → **ΑΓΝΟΟΥΝΤΑΝ ΕΝΤΕΛΩΣ!**

**Console Log Evidence**:
```
📝 TEXT: "www.pagonis.com.gr", height=0.10575, scale=50.00, screenHeight=5.3px  ← ΠΟΛΥ ΜΙΚΡΟ!
```

**Fix Applied**:
- File: `rendering/entities/TextRenderer.ts` (lines 34-63)
- Αντικατέστησα `renderStyledTextWithOverride()` με άμεση χρήση `ctx.fillText()`:
  ```typescript
  // ΠΡΙΝ (ΛΑΘΟΣ):
  this.ctx.font = `${screenHeight}px Arial`;
  renderStyledTextWithOverride(this.ctx, text, x, y);  // ΑΓΝΟΟΥΣΕ το font!

  // ΤΩΡΑ (ΣΩΣΤΟ):
  this.ctx.font = `${screenHeight}px Arial`;
  this.ctx.fillText(text, screenPos.x, screenPos.y);  // ✅ Χρησιμοποιεί DXF height!
  ```

**Verification**: Τα κείμενα εμφανίζονται με το **σωστό μέγεθος**! ✅

**Time Lost**: ~4 μήνες (on/off debugging)

---

**🏢 REMEMBER**:
- Αυτό το bug **έχει χαθεί 3+ φορές**
- Κάθε φορά χάνουμε **ώρες/μέρες** να το ξαναβρούμε
- **ΔΙΑΒΑΣΕ αυτό το αρχείο** πριν αλλάξεις το DXF loading!
- **ΝΕΟ**: Δες και το `centralized_systems.md` για τα layer colors & arc rendering fixes

---

*Last Updated: 2025-10-04*
*Updates: DXF loading fix + Layer colors fix + Arc Y-axis flip + Text rendering fix + Cleanup unused code*
*Next Review: Όταν ξαναχαλάσει το DXF loading (προσπάθησε να μην το αφήσεις να ξαναχαλάσει!)*
