# ΒΗΜΑ 1: ΑΝΑΛΥΣΗ & ΣΧΕΔΙΑΣΜΟΣ - DEPENDENCY MAP

## ΚΑΤΑΓΡΑΦΗ ΤΡΕΧΟΝΤΩΝ CONTEXTS

### ΚΥΡΙΑ CONTEXTS (Main Settings)
1. **LineSettingsContext** - Γενικές ρυθμίσεις γραμμών
2. **TextSettingsContext** - Γενικές ρυθμίσεις κειμένου
3. **GripProvider** - Γενικές ρυθμίσεις grips
4. **ProjectHierarchyContext** - Hierarchy διαχείριση

### SPECIFIC CONTEXTS (Override System)
5. **SpecificLinePreviewContext** - Ειδικές ρυθμίσεις preview γραμμών
6. **SpecificLineCompletionContext** - Ειδικές ρυθμίσεις completion γραμμών
7. **SpecificTextPreviewContext** - Ειδικές ρυθμίσεις preview κειμένου
8. **SpecificGripPreviewContext** - Ειδικές ρυθμίσεις preview grips

### BRIDGE CONTEXTS (Store Synchronization)
9. **LinePreviewSettingsContext** - Bridge: SpecificLine → toolStyleStore
10. **LineCompletionSettingsContext** - Bridge: SpecificLineCompletion → toolStyleStore
11. **TextPreviewSettingsContext** - Bridge: SpecificText → textStyleStore
12. **GripPreviewSettingsContext** - Bridge: SpecificGrip → gripStyleStore

### LEGACY/UNUSED
- LineSettingsContext.legacy.tsx
- TextSettingsContext.legacy.tsx
- UnifiedSettingsContext.tsx
- GripProvider.legacy.tsx

## ΧΑΡΤΗΣ ΕΞΑΡΤΗΣΕΩΝ (DEPENDENCY MAP)

```
DxfViewerApp.tsx Provider Tree:
├── ProjectHierarchyProvider
├── LineSettingsProvider
├── TextSettingsProvider
├── GripProvider
├── SpecificLinePreviewProvider
├── SpecificLineCompletionProvider
├── SpecificGripPreviewProvider
├── SpecificTextPreviewProvider
├── LinePreviewSettingsProvider
├── LineCompletionSettingsProvider
├── TextPreviewSettingsProvider
└── GripPreviewSettingsProvider
```

## STORES ΣΥΣΤΗΜΑ
- **toolStyleStore** - Για γραμμές (lines)
- **textStyleStore** - Για κείμενα (text)
- **gripStyleStore** - Για grips

## ΠΡΟΒΛΗΜΑΤΑ ΤΡΕΧΟΥΣΑΣ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ

### 1. PROVIDER HELL
- 12+ εμφωλευμένα providers
- Πολύπλοκη σειρά dependencies

### 2. DRY VIOLATIONS
- 3x επανάληψη της ίδιας λογικής:
  - Specific Context → Bridge Context → Store
  - Κάθε entity type (line/text/grip) έχει την ίδια ακριβώς δομή

### 3. TIGHT COUPLING
- Specific contexts εξαρτώνται από global contexts
- Bridge contexts εξαρτώνται από specific contexts
- Circular dependencies σε ορισμένες περιπτώσεις

### 4. MIXED CONCERNS
- Contexts κάνουν και business logic και styling
- Ανάμιξη state management με UI synchronization

## ΠΡΟΤΕΙΝΟΜΕΝΗ ΝΕΑ ΑΡΧΙΤΕΚΤΟΝΙΚΗ

### UNIFIED CONFIGURATION SYSTEM
```typescript
interface ViewerConfiguration {
  entities: {
    line: EntityConfig<LineSettings>
    text: EntityConfig<TextSettings>
    grip: EntityConfig<GripSettings>
  }
  mode: 'normal' | 'preview' | 'completion'
  overrides: UserOverrides
}

interface EntityConfig<T> {
  general: T
  specific: {
    preview?: Partial<T>
    completion?: Partial<T>
  }
  overrideEnabled: boolean
}
```

### ΑΠΛΟΠΟΙΗΜΕΝΟ PROVIDER TREE
```typescript
<ConfigurationProvider config={initialConfig}>
  <StyleManagerProvider>
    <DxfViewerContent />
  </StyleManagerProvider>
</ConfigurationProvider>
```

### CUSTOM HOOKS SYSTEM
```typescript
// Αντί για 12 contexts, 3 απλά hooks:
const lineStyles = useEntityStyles('line', mode, overrides)
const textStyles = useEntityStyles('text', mode, overrides)
const gripStyles = useEntityStyles('grip', mode, overrides)
```

## ΣΤΟΧΟΣ ΜΕΤΑΒΑΣΗΣ
- Από 12+ contexts → 2 providers
- Από tight coupling → loose coupling
- Από DRY violations → unified logic
- Από mixed concerns → single responsibility

**ΒΗΜΑ 1 ΟΛΟΚΛΗΡΩΘΗΚΕ**
Περιμένω έγκριση για ΒΗΜΑ 2: ΔΗΜΙΟΥΡΓΙΑ UNIFIED CONFIGURATION SYSTEM