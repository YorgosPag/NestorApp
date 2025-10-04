# ΑΝΑΘΕΩΡΗΣΗ ΣΤΡΑΤΗΓΙΚΗΣ - ΑΠΟΦΥΓΗ ΔΙΠΛΟΤΥΠΩΝ

## 🚨 ΠΡΟΒΛΗΜΑ ΠΟΥ ΕΝΤΟΠΙΣΘΗΚΕ
Η αρχική στρατηγική με LegacyBridges θα δημιουργούσε διπλότυπα:
- useLegacyLineSettings vs useLineSettings
- useLegacySpecificLinePreview vs useSpecificLinePreview
- Κ.λπ.

## ✅ ΝΕΑ ΑΣΦΑΛΗΣ ΣΤΡΑΤΗΓΙΚΗ

### ΑΡΧΗ: ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ
- Διατήρηση ΙΔΙΩΝ exports και function signatures
- Αντικατάσταση ΜΟΝΟ της εσωτερικής λογικής
- Χρήση νέων providers ως "engine" κάτω από το παλιό API

### ΣΥΓΚΕΚΡΙΜΕΝΑ ΒΗΜΑΤΑ:

#### ΒΗΜΑ 5A: REFACTOR LineSettingsContext
```typescript
// ΠΡΙΝ: Δικό του state management
const [settings, setSettings] = useState(defaultSettings);

// ΜΕΤΑ: Χρήση νέου ConfigurationProvider εσωτερικά
const { config, updateEntityConfig } = useViewerConfig();
const settings = config.entities.line.general;
```

#### ΒΗΜΑ 5B: REFACTOR SpecificLinePreviewContext
```typescript
// ΠΡΙΝ: Δικά του states και logic
const [settings, setSettings] = useState(...);

// ΜΕΤΑ: Χρήση useEntityStyles εσωτερικά
const lineStyles = useEntityStyles('line', 'preview');
```

#### ΒΗΜΑ 5C: REFACTOR άλλα contexts με ίδιο τρόπο

### ΠΛΕΟΝΕΚΤΗΜΑΤΑ ΝΕΑΣ ΣΤΡΑΤΗΓΙΚΗΣ:
1. **ΜΗΔΕΝ διπλότυπα** - Διατηρούνται τα ίδια exports
2. **ΜΗΔΕΝ breaking changes** - Τα components συνεχίζουν να δουλεύουν
3. **ΣΤΑΔΙΑΚΗ βελτίωση** - Ένα context τη φορά
4. **ΑΣΦΑΛΕΙΑ** - Κάθε αλλαγή μπορεί να reverτ αμέσως
5. **ΚΑΘΑΡΟ τελικό αποτέλεσμα** - Τελικά θα έχουμε unified architecture

### ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΦΑΙΡΕΘΟΥΝ (στο τέλος):
- compatibility/LegacyBridges.tsx (δεν το χρειαζόμαστε πια)
- DxfViewerApp.new.tsx (θα γίνει το κανονικό)
- test-new-architecture.tsx (temporary)

### ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΔΙΑΤΗΡΗΘΟΥΝ:
- Όλα τα νέα core systems (ConfigurationProvider, hooks, κλπ)
- Όλα τα υπάρχοντα context αρχεία (refactored εσωτερικά)

## ΣΥΜΠΕΡΑΣΜΑ
Η νέα στρατηγική είναι 100% ασφαλής για διπλότυπα και διατηρεί πλήρη backward compatibility.