# ADR-282: Contact Persona Architecture Refactoring — Google-Level Redesign

**Status**: PROPOSED  
**Date**: 2026-04-04  
**Author**: Claude + Γιώργος Παγώνης  
**Supersedes**: Extends ADR-121 (Contact Persona System)  
**Related**: ADR-283 (Project Roles SSOT Refactoring)  
**Category**: Entity Systems / UX Architecture  

---

## 1. Πρόβλημα

### 1.1 Duplication μεταξύ καρτελών

Η τρέχουσα αρχιτεκτονική έχει **3 ξεχωριστές καρτέλες** που επικαλύπτονται:

| Καρτέλα | Order | Τι περιέχει | Πρόβλημα |
|---------|-------|-------------|----------|
| **Ιδιότητες** (Personas) | 2.5 | 9 chips + conditional field sections | Ξεχωριστό tab μόνο για chips |
| **Επαγγελματικά Στοιχεία** | 3 | Επάγγελμα, Ειδικότητα, Δεξιότητες (ESCO) | Δεν περιλαμβάνει domain-specific πεδία |
| **Σχέσεις** | - | Διαπροσωπικές σχέσεις | OK — ξεχωριστός σκοπός |

**Παράδειγμα duplication**: Ο χρήστης ενεργοποιεί "Μηχανικός" → εμφανίζεται section "Στοιχεία Μηχανικού" με `engineerSpecialty`. Αλλά στα "Επαγγελματικά Στοιχεία" υπάρχει ήδη πεδίο `specialty` (Ειδικότητα). Δύο μέρη, παρόμοιος σκοπός.

### 1.2 Αποσύνδεση Έργων-Επαφών

Όταν ο χρήστης προσθέτει επαφή ως "Μηχανικό" σε ένα έργο (μέσω `contact_links`), η καρτέλα της επαφής **ΔΕΝ αντανακλά** αυτή τη σχέση. Ο χρήστης πρέπει χειροκίνητα να ενεργοποιήσει και την ετικέτα "Μηχανικός" στις Ιδιότητες.

### 1.3 Περιττή καρτέλα

Η καρτέλα "Ιδιότητες" περιέχει 9 chip buttons. Αυτό δεν δικαιολογεί ξεχωριστό tab — είναι σπατάλη πλοήγησης.

---

## 2. Τρέχουσα Αρχιτεκτονική (As-Is)

### 2.1 Persona System (ADR-121)

**Config SSoT**: `src/config/persona-config.ts`  
**Types**: `src/types/contacts/personas.ts`  
**UI**: `src/components/contacts/personas/PersonaSelector.tsx`  
**Rendering**: `src/components/ContactFormSections/contactRenderersCore.tsx`  
**Orchestration**: `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx`

#### 9 Personas και τα πεδία τους

| Persona | Ελληνικά | Κατηγορία | Πεδία |
|---------|----------|-----------|-------|
| `construction_worker` | Εργάτης Οικοδομής | Επαγγελματική | ikaNumber, insuranceClassId, triennia, dailyWage, specialtyCode, efkaRegistrationDate |
| `engineer` | Μηχανικός | Επαγγελματική | teeRegistryNumber, engineerSpecialty, licenseClass, ptdeNumber |
| `accountant` | Λογιστής | Επαγγελματική | oeeNumber, accountingClass |
| `lawyer` | Δικηγόρος | Επαγγελματική | barAssociationNumber, barAssociation |
| `notary` | Συμβολαιογράφος | Επαγγελματική | notaryRegistryNumber, notaryDistrict |
| `property_owner` | Ιδιοκτήτης Ακινήτων | Ρόλος | propertyCount, ownershipNotes |
| `client` | Πελάτης | Ρόλος | clientSince |
| `supplier` | Προμηθευτής | Ρόλος | supplierCategory, paymentTermsDays |
| `real_estate_agent` | Μεσίτης Ακινήτων | Ρόλος | licenseNumber, agency |

#### Firestore Data Model

```typescript
// contacts/{contactId}
{
  personas: PersonaData[],        // Array of persona objects with status + fields
  personaTypes: string[],         // Denormalized for queries
}
```

#### Data Flow

1. Click chip → `PersonaSelector.onToggle(type)` 
2. → Custom renderer checks removal guards
3. → Updates `formData.activePersonas[]` + `formData.personaData[type]`
4. → `getMergedIndividualSections()` appends conditional sections (order 100+)
5. → `UnifiedContactTabbedSection` renders all sections
6. → Field routing via `personaFieldLookup` Map → writes to `personaData[type][fieldId]`

### 2.2 Επαγγελματικά Στοιχεία

**Config**: `src/config/individual-config.ts` (section order 3)

| Πεδίο | Field ID | Component |
|-------|----------|-----------|
| Επάγγελμα | `profession` | EscoOccupationPicker |
| Ειδικότητα | `specialty` | Input |
| Δεξιότητες | `skills` | EscoSkillPicker |
| Εργοδότης | `employer` | EmployerPicker |

### 2.3 Σύνδεση Έργων-Επαφών

**Collection**: `contact_links`  
**Service**: `src/services/contact-link.service.ts`  
**Roles**: `src/types/entity-associations.ts` → `ENTITY_ASSOCIATION_ROLES.project`  
**Κατεύθυνση**: Μονόδρομη (project → contact). Η επαφή **ΔΕΝ** ενημερώνεται.

---

## 3. Google Pattern Analysis

### 3.1 Google Contacts Pattern

- **Labels** = μόνο κατηγοριοποίηση (tags), χωρίς conditional πεδία
- **Ένα tab για επαγγελματικά** — general + conditional ανά επάγγελμα
- **Roles** (πελάτης, προμηθευτής) = badges στο header, όχι ξεχωριστό tab

### 3.2 Salesforce / SAP Pattern

- **Business Partner Roles** = tags στο header
- **Professional sections** = conditional fields εντός ενός ενοποιημένου tab
- **Project participation** = derived/computed, read-only section

### 3.3 Αρχή: Derived Data, Not Duplicated Data

```
SOURCE OF TRUTH:                    DERIVED (computed live):
─────────────────                   ──────────────────────
Έργο → Συνεργάτης: Γιώργος    →    Επαφή: Γιώργος
       (ρόλος: Αρχιτέκτονας)       → "Συμμετέχει σε: nestor-app ως Αρχιτέκτονας"
                                    (ΔΕΝ αποθηκεύεται — υπολογίζεται live)
```

---

## 4. Προτεινόμενη Αρχιτεκτονική (To-Be)

### 4.1 Νέα δομή καρτελών

| Πριν | Μετά |
|------|------|
| ~~Ιδιότητες (order 2.5)~~ — 9 chips + conditional sections | **ΚΑΤΑΡΓΕΙΤΑΙ** |
| Επαγγελματικά Στοιχεία (order 3) — 4 πεδία | **ΕΝΙΣΧΥΕΤΑΙ** — tags + general πεδία + conditional sections |
| *(δεν υπάρχει)* | **ΝΕΟ** — "Συμμετοχή σε Έργα" (order 3.5, read-only, derived) |
| Σχέσεις | Παραμένει ως έχει |

### 4.2 Νέα δομή "Επαγγελματικά Στοιχεία"

```
┌─ Επαγγελματικά Στοιχεία ──────────────────────────┐
│                                                     │
│  Ρόλοι:  [Πελάτης ×] [Προμηθευτής ×] [+ ...]      │  ← Role tags
│  Ειδικότητες: [Μηχανικός ×] [Λογιστής ×] [+ ...]  │  ← Professional tags
│                                                     │
│  Επάγγελμα:    Πολιτικός Μηχανικός  (ESCO)         │
│  Ειδικότητα:   Κατασκευές                           │
│  Δεξιότητες:   [AutoCAD ×] [BIM ×]  (ESCO)         │
│                                                     │
│  ── Στοιχεία Μηχανικού ─────────── (conditional)    │
│  Αρ. Μητρώου ΤΕΕ:  12345                           │
│  Ειδικότητα Μηχ.:  Πολιτικός                        │
│  Τάξη Πτυχίου:     Α'                              │
│  Αρ. ΠΤΔΑ':        ...                              │
│                                                     │
│  ── Στοιχεία Λογιστή ─────────── (conditional)      │
│  Αρ. Μητρώου ΟΕΕ:  67890                           │
│  Κατηγορία:        Α'                               │
│                                                     │
│  ── Στοιχεία Πελάτη ──────────── (conditional)      │
│  Πελάτης από:      15/03/2025                       │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─ Συμμετοχή σε Έργα (read-only, derived) ───────────┐
│                                                      │
│  🏗️ nestor-app     — Αρχιτέκτονας    (από 15/01/26) │
│  🏗️ villa-project  — Στατικός Μηχ.   (από 03/09/25) │
│                                                      │
│  ℹ️ Η σύνδεση γίνεται από τη Διαχείριση Έργων       │
└──────────────────────────────────────────────────────┘
```

---

## 5. Φάσεις Υλοποίησης

### Φάση 1: Μεταφορά conditional fields στα Επαγγελματικά (Μέτρια)

**Στόχος**: Τα persona conditional sections μετακινούνται ΜΕΣΑ στο Professional tab. Η καρτέλα Ιδιότητες γίνεται μόνο chips.

**Αρχεία που αλλάζουν**:

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/config/persona-config.ts` | Προσθήκη `PROFESSIONAL_PERSONA_TYPES`, `ROLE_PERSONA_TYPES`, `getProfessionalPersonaSections()` |
| `src/config/individual-config.ts` | Προσθήκη dummy field `professionalPersonaSections` στο professional section (order 3) |
| `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx` | Αλλαγή `getMergedIndividualSections()` → μη-merged (personas δεν εμφανίζονται top-level) |
| `src/components/ContactFormSections/contactRenderersTyped.tsx` | Νέος renderer `professionalPersonaSections` |

**Νέα αρχεία**:

| Αρχείο | Σκοπός | ~Γραμμές |
|--------|--------|----------|
| `src/components/contacts/personas/PersonaConditionalSections.tsx` | Renders conditional field sections εντός professional tab | ~120 |

**Firestore migration**: ΚΑΜΙΑ. Τα δεδομένα `personas[]` παραμένουν ίδια.

**IKA integration**: ΜΗΔΕΝ επίπτωση. Διαβάζει απευθείας από Firestore.

**Removal guards**: ΜΗΔΕΝ επίπτωση. Η toggle logic μετακινείται μαζί με τα chips.

### Φάση 2: Κατάργηση καρτέλας Ιδιότητες (Μεγάλη)

**Στόχος**: Η καρτέλα Ιδιότητες εξαφανίζεται. Τα professional tags πάνε στο Professional tab, τα role tags στο header.

**Αρχεία που αλλάζουν**:

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/config/individual-config.ts` | Αφαίρεση section order 2.5 (`personas`) |
| `src/components/contacts/details/ContactDetailsHeader.tsx` | Προσθήκη role tag badges |
| `src/components/contacts/personas/PersonaSelector.tsx` | Deprecation, delegation σε 2 νέα components |

**Νέα αρχεία**:

| Αρχείο | Σκοπός | ~Γραμμές |
|--------|--------|----------|
| `src/components/contacts/personas/ProfessionalTagSelector.tsx` | Chips μόνο για professional personas (top of Professional tab) | ~80 |
| `src/components/contacts/personas/RoleTagSelector.tsx` | Chips μόνο για role personas (header area) | ~80 |

**Specialty duplication resolution**: Το generic `specialty` (ESCO) = γενική ειδικότητα (π.χ. "Κατασκευές"). Το `engineerSpecialty` (ΤΕΕ) = ειδικότητα μηχανικού (π.χ. "Πολιτικός"). Διαφορετικός σκοπός — και τα δύο παραμένουν με helpText επεξήγηση.

### Φάση 3: Derived "Συμμετοχή σε Έργα" (Εύκολη)

**Στόχος**: Read-only section στην επαφή που δείχνει σε ποια έργα συμμετέχει, computed live από `contact_links`.

**Νέα αρχεία**:

| Αρχείο | Σκοπός | ~Γραμμές |
|--------|--------|----------|
| `src/hooks/useContactProjectParticipation.ts` | Hook που φέρνει project links για μία επαφή | ~100 |
| `src/components/contacts/details/ProjectParticipationSection.tsx` | Read-only section UI | ~120 |

**Αρχεία που αλλάζουν**:

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/config/individual-config.ts` | Νέο section `projectParticipation` (order 3.5) |
| `src/components/ContactFormSections/contactRenderersTyped.tsx` | Νέος renderer `projectParticipation` |
| `src/i18n/locales/el/contacts-core.json` | i18n keys |
| `src/i18n/locales/en/contacts-core.json` | i18n keys |

**Data source**: Reuse `useEntityContactLinks` από `src/hooks/useEntityAssociations.ts` (ήδη υπάρχει), φιλτραρισμένο μόνο σε `entityType: 'project'`.

---

## 6. Εκτίμηση Μεγέθους

| Φάση | Αρχεία | Νέα | Modified | Δυσκολία | Εκτίμηση |
|------|--------|-----|----------|----------|----------|
| 1 | 5 | 1 | 4 | Μέτρια | 1 συνεδρία |
| 2 | 6 | 2 | 4 | Μεγάλη | 1-2 συνεδρίες |
| 3 | 6 | 2 | 4 | Εύκολη | 1 συνεδρία |
| **Σύνολο** | **~15** | **5** | **~10** | | **3-4 συνεδρίες** |

---

## 7. Κρίσιμα Αρχεία (Critical Files)

### SSoT / Config
- `src/config/persona-config.ts` — Ορισμός personas + field sections
- `src/config/individual-config.ts` — Ορισμός form sections + ordering
- `src/types/contacts/personas.ts` — PersonaType, PersonaData, type guards

### UI Components
- `src/components/contacts/personas/PersonaSelector.tsx` — Chip toggles
- `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx` — Orchestration
- `src/components/ContactFormSections/contactRenderersCore.tsx` — Custom renderers (persona toggle)
- `src/components/ContactFormSections/contactRenderersTyped.tsx` — Custom renderers (typed, professional)
- `src/components/contacts/details/ContactDetailsHeader.tsx` — Header (Phase 2 target)

### Services / Hooks
- `src/services/contact-link.service.ts` — Contact-project linking
- `src/hooks/useEntityAssociations.ts` — Existing hook for contact links
- `src/config/persona-removal-guards.ts` — Business logic guards

### Integration Points
- `src/components/projects/ika/hooks/useProjectWorkers.ts` — IKA reads construction_worker persona
- `src/types/entity-associations.ts` — Project role definitions

---

## 8. Περιβάλλον Ανάπτυξης — Κρίσιμη Σημείωση

> **Η εφαρμογή είναι σε στάδιο ΑΝΑΠΤΥΞΗΣ, ΟΧΙ παραγωγής.**
> - Η βάση δεδομένων (Firestore) περιέχει **ελάχιστα δοκιμαστικά δεδομένα**
> - Όλα τα δεδομένα θα **αδειάσουν** πριν τη μετάβαση σε production
> - **ΔΕΝ χρειάζεται backward compatibility** ή data migration
> - **ΔΕΝ χρειάζονται deprecated functions** ή σταδιακή μετάβαση
> - Μπορούμε να κάνουμε **breaking changes** ελεύθερα

### Συνέπειες στο σχεδιασμό:
- **Φάσεις 1+2 μπορούν να ενοποιηθούν** σε μία φάση (δεν χρειάζεται coexistence period)
- `PersonaSelector` μπορεί να **αντικατασταθεί** αντί να γίνει deprecated
- `getMergedIndividualSections()` μπορεί να **αφαιρεθεί** αντί να παραμείνει
- Firestore schema μπορεί να αλλάξει αν χρειαστεί (τα δεδομένα είναι δοκιμαστικά)

---

## 9. Κίνδυνοι και Μετριασμός

| Κίνδυνος | Μετριασμός |
|----------|------------|
| IKA integration break | IKA reads Firestore directly, not affected by UI changes |
| Removal guards stop working | Toggle logic moves with chips, guards remain pluggable |
| persona-config.ts >500 lines | Extract `PERSONA_SELECT_OPTIONS` σε ξεχωριστό file |

---

## 10. Verification Plan

### Phase 1 Testing
- [ ] Ενεργοποίηση κάθε persona → conditional fields εμφανίζονται στο Professional tab
- [ ] Απενεργοποίηση persona → fields εξαφανίζονται
- [ ] Removal guard (client + units) → blocking works
- [ ] Removal guard (real_estate_agent + brokerage) → blocking works
- [ ] IKA worker page → reads construction_worker persona correctly
- [ ] Save + reload → persona data persists

### Phase 2 Testing
- [ ] Καρτέλα Ιδιότητες δεν υπάρχει πλέον
- [ ] Professional tags στο Professional tab header
- [ ] Role tags στο contact header
- [ ] Όλα τα conditional sections λειτουργούν

### Phase 3 Testing
- [ ] Contact linked to project → appears in "Συμμετοχή σε Έργα"
- [ ] Contact unlinked → disappears
- [ ] Click project name → navigates to project
- [ ] No project links → empty state message

---

## Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-04-04 | Initial proposal — ευρήματα + σχεδιασμός 3 φάσεων |
| 2026-04-04 | Ενημέρωση: development mode, zero backward compatibility needed, φάσεις μπορούν να ενοποιηθούν |
| 2026-04-04 | Cross-reference: ADR-283 (Project Roles SSOT) — companion ADR for project-side role refactoring |
