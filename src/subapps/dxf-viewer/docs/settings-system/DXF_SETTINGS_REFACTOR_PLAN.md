# 🎯 DXF SETTINGS PANEL - ΣΤΟΧΕΥΜΕΝΟ REFACTOR PLAN

## 📌 ΣΤΟΧΟΣ
Διόρθωση του DXF Settings Panel ώστε:
- Οι **Γενικές Ρυθμίσεις** να εφαρμόζονται παντού
- Οι **Ειδικές Ρυθμίσεις** να είναι πλήρως αυτόνομες ως overrides ανά entity
- **ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ** - Καμία διπλή δήλωση ή κώδικας
- **ΜΗΔΕΝ BREAKING CHANGES** - Η εφαρμογή πρέπει να λειτουργεί συνεχώς

---

## ⚠️ ΚΡΙΤΙΚΕΣ ΠΡΟΫΠΟΘΕΣΕΙΣ
1. **BACKUP ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΒΗΜΑ** - Checkpoint system για rollback
2. **ΕΛΕΓΧΟΣ ΔΙΠΛΟΤΥΠΩΝ** - Πριν από κάθε προσθήκη κώδικα
3. **TEST ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑΣ** - npm run dev:fast μετά από κάθε βήμα
4. **ΚΑΜΙΑ ΔΙΑΓΡΑΦΗ** χωρίς backup και έλεγχο

---

## 📋 ΒΗΜΑΤΙΚΟ ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ

### 🔵 PHASE 1: ΠΡΟΕΤΟΙΜΑΣΙΑ & ΑΝΑΛΥΣΗ (Μέρα 1)

#### ΒΗΜΑ 1.1: Ανάλυση Υπάρχουσας Κατάστασης
```bash
# Έλεγχος για διπλότυπα στο DXF Settings
find src/subapps/dxf-viewer -name "*.tsx" -o -name "*.ts" | xargs grep -l "DxfSettings\|LineSettings\|TextSettings" | sort | uniq -c | sort -rn

# BACKUP: F:\Pagonis_Nestor\backups\dxf-settings-initial-[DATE]
```
**ΕΝΕΡΓΕΙΕΣ**:
- ✅ Καταγραφή όλων των αρχείων που σχετίζονται με DXF Settings
- ✅ Εντοπισμός διπλότυπων components/hooks/contexts
- ✅ Έλεγχος ποια χρησιμοποιούνται και ποια όχι
- ✅ Backup ΟΛΩΝ των σχετικών αρχείων

#### ΒΗΜΑ 1.2: Δημιουργία Domain Types
```bash
# Δημιουργία νέου φακέλου
mkdir -p src/subapps/dxf-viewer/settings-core
```
**ΔΗΜΙΟΥΡΓΙΑ**: `/settings-core/types.ts`
```typescript
// Typed interfaces για όλα τα settings
export interface LineSettings {
  enabled: boolean;
  lineType: 'solid' | 'dashed' | 'dotted';
  lineWidth: number; // 0.25 - 2.0mm (ISO 128)
  color: string;
  opacity: number; // 0.0 - 1.0
  // ... όλα τα πεδία με strict types
}

export interface TextSettings {
  fontFamily: string;
  fontSize: number; // 2.5 - 10mm (ISO 3098)
  color: string;
  // ... όλα τα πεδία
}

// Validation functions με clamp
export const validateLineSettings = (settings: Partial<LineSettings>): LineSettings => {
  // Clamp values στα ISO standards
};
```
**ΕΛΕΓΧΟΣ**:
- ΜΗΔΕΝ any types
- Καμία διπλή δήλωση interfaces

---

### 🟡 PHASE 2: OVERRIDE ENGINE (Μέρα 2)

#### ΒΗΜΑ 2.1: Override Mechanism
**ΔΗΜΙΟΥΡΓΙΑ**: `/settings-core/override.ts`
```typescript
// Merge general + override = effective
export function mergeSettings<T>(
  general: T,
  override: Partial<T> | null
): T {
  return override ? { ...general, ...override } : general;
}

// Calculate diff between settings
export function diffSettings<T>(
  from: T,
  to: T
): Partial<T> {
  // Return only changed fields
}
```
**ΕΛΕΓΧΟΣ**:
- ✅ Unit tests για merge/diff
- ✅ Καμία απώλεια δεδομένων
- ✅ Type safety 100%

#### ΒΗΜΑ 2.2: Backup & Test
```bash
# BACKUP μετά το override engine
cp -r src/subapps/dxf-viewer/settings-core backups/override-engine-[DATE]

# Test compilation
npx tsc --noEmit --project tsconfig.json
```

---

### 🟢 PHASE 3: ZUSTAND STORE (Μέρα 3-4)

#### ΒΗΜΑ 3.1: Store Implementation
**ΔΗΜΙΟΥΡΓΙΑ**: `/providers/DxfSettingsStore.ts`
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface DxfSettingsState {
  general: {
    line: LineSettings;
    text: TextSettings;
  };
  overrides: Record<EntityId, Partial<Settings>>;
  selection: EntityId[];
}

interface DxfSettingsActions {
  setGeneral: (type: 'line' | 'text', patch: Partial<Settings>) => void;
  setOverride: (id: EntityId, patch: Partial<Settings>) => void;
  clearOverride: (id: EntityId) => void;
  applyToSelection: (patch: Partial<Settings>) => void;
  getEffective: (id: EntityId) => Settings;
}

export const useDxfSettingsStore = create<DxfSettingsState & DxfSettingsActions>()(
  subscribeWithSelector((set, get) => ({
    // Implementation με selectors
  }))
);
```
**ΕΛΕΓΧΟΣ**:
- ✅ Selectors ανά πεδίο (no full re-renders)
- ✅ Tests για κάθε action
- ✅ Καμία παρενέργεια

---

### 🔴 PHASE 4: UI REFACTOR (Μέρα 5-6)

#### ΒΗΜΑ 4.1: Component Διάσπαση
```bash
# BACKUP πριν το UI refactor
cp -r src/subapps/dxf-viewer/ui/components/dxf-settings backups/ui-before-[DATE]
```
**ΔΙΑΣΠΑΣΗ**: LineSettings.tsx σε:
- `LineWidthControl.tsx` - Μόνο για line width με debounce
- `LineStyleControl.tsx` - Μόνο για line style
- `LineColorControl.tsx` - Μόνο για color picker
- `LinePreview.tsx` - Live preview component

**ΚΑΝΟΝΕΣ**:
- Κάθε control με δικό του selector
- Debounce 150-200ms σε sliders
- Props drilling ΑΠΑΓΟΡΕΥΕΤΑΙ
- Direct store connection

#### ΒΗΜΑ 4.2: Override UI
**ΠΡΟΣΘΗΚΕΣ**:
- Badge "Overridden" όταν υπάρχει override
- Button "Clear Override" για reset
- "Apply to Selection" button
- Visual distinction General vs Special tabs

---

### 🟣 PHASE 5: CANVAS INTEGRATION (Μέρα 7)

#### ΒΗΜΑ 5.1: Settings Applier
**ΔΗΜΙΟΥΡΓΙΑ**: `/canvas/bridge/settings-applier.ts`
```typescript
// Subscribe to store diffs only
const unsubscribe = useDxfSettingsStore.subscribe(
  state => state.general,
  (general) => {
    // Batch updates in requestAnimationFrame
    requestAnimationFrame(() => {
      applyToCanvas(general);
    });
  },
  { equalityFn: shallow }
);
```
**PERFORMANCE**:
- Max 1 redraw per frame
- Diff-only updates
- No jitter/flicker

---

### ⚡ PHASE 6: TESTING & OPTIMIZATION (Μέρα 8-9)

#### ΒΗΜΑ 6.1: Unit Tests
**ΔΗΜΙΟΥΡΓΙΑ**: `/__tests__/` για:
- override.test.ts - 10+ test cases
- store.test.ts - All actions tested
- integration.test.ts - Full flow tests

#### ΒΗΜΑ 6.2: Performance Tests
```typescript
// Measure και report
- Input → Apply latency < 50ms
- FPS > 55 με 1000+ entities
- Re-render count per change = 1
```

#### ΒΗΜΑ 6.3: Documentation
**ΔΗΜΙΟΥΡΓΙΑ**: `/docs/DXF_SETTINGS_ARCHITECTURE.md`
- Διάγραμμα ροής: General → Override → Effective → Canvas
- API reference του store
- Οδηγίες χρήσης για developers

---

### ✅ PHASE 7: FINAL VALIDATION (Μέρα 10)

#### ΒΗΜΑ 7.1: Functional Tests
**ΣΕΝΑΡΙΑ ΕΛΕΓΧΟΥ**:
1. Αλλάζω γενικό πάχος → Όλα τα entities ενημερώνονται
2. Entity με override → Μόνο αυτό αλλάζει
3. Clear override → Επιστροφή στο γενικό
4. Apply to 1000 entities → No UI freeze

#### ΒΗΜΑ 7.2: Cleanup
```bash
# Έλεγχος για διπλότυπα μετά το refactor
find src/subapps/dxf-viewer -type f -name "*.ts*" -exec md5sum {} + | sort | uniq -d -w 32

# Διαγραφή ΜΟΝΟ των confirmed διπλότυπων με backup
```

---

## 📊 SUCCESS METRICS

| Metric | Target | Validation |
|--------|--------|------------|
| Διπλότυπα | 0 | MD5 check |
| FPS με changes | >55 | DevTools Performance |
| Re-renders/change | 1 | React DevTools |
| Test coverage | >80% | Jest coverage |
| Type safety | 100% | npx tsc --strict |
| Latency | <50ms | Performance.now() |

---

## 🔄 ROLLBACK PROCESS

Σε περίπτωση προβλήματος:
```bash
# Άμεση επαναφορά από backup
cp -r backups/[LAST-WORKING-BACKUP] src/subapps/dxf-viewer/
npm run dev:fast # Verify restoration
```

---

## 🎯 ΜΕΤΑ ΤΗΝ ΟΛΟΚΛΗΡΩΣΗ

✅ Όταν το DXF Settings Panel λειτουργεί ΤΕΛΕΙΑ:
1. **Ενημέρωση DXF_VIEWER_CONFERENCE_REPORT.md** με:
   - Νέα αρχιτεκτονική του Settings Panel
   - Performance metrics
   - Test coverage report

2. **Συνέχεια με το Conference Plan**:
   - Phase 2: Documentation (με το νέο pattern)
   - Phase 3: Testing (extend τα tests του panel)
   - Phase 4: Performance (apply το batching pattern παντού)

---

## ⚠️ ΚΑΝΟΝΕΣ ΑΣΦΑΛΕΙΑΣ

1. **ΠΟΤΕ** μην διαγράψεις χωρίς backup
2. **ΠΑΝΤΑ** check για διπλότυπα πριν προσθέσεις
3. **ΚΑΘΕ** αλλαγή με incremental testing
4. **ΜΗΔΕΝ** breaking changes στο public API
5. **100%** backward compatibility

---

Generated: 2024-09-23
Priority: CRITICAL - Fix User-Facing Issue
Timeline: 10 working days
Next Step: ΒΗΜΑ 1.1 - Ανάλυση Υπάρχουσας Κατάστασης