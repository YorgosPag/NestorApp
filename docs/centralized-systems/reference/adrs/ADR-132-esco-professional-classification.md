# ADR-132: ESCO Professional Classification Integration

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | Contact Management / CRM |
| **Canonical Locations** | `src/types/contacts/esco-types.ts`, `src/services/esco.service.ts`, `src/components/shared/EscoOccupationPicker.tsx` |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |

---

## 1. Context

### The Problem

- ❌ **Free-text profession field**: Τα πεδία `profession` και `specialty` στις επαφές φυσικών προσώπων ήταν ελεύθερο κείμενο — χωρίς τυποποίηση, χωρίς validation
- ❌ **Inconsistent data**: "Μηχανικός" vs "μηχανικός" vs "Μηχ." — αδύνατη η αξιόπιστη αναζήτηση/φιλτράρισμα
- ❌ **No international standard**: Δεν υπήρχε σύνδεση με ευρωπαϊκά πρότυπα ταξινόμησης
- ❌ **Hardcoded persona options**: Τα personas (ADR-121) χρησιμοποιούν hardcoded specialty codes (engineer: 7, accountant: 4)

### ESCO Overview

**ESCO** (European Skills, Competences, Qualifications and Occupations) — ευρωπαϊκό πρότυπο ταξινόμησης:
- **3.039 επαγγέλματα**, 13.939 δεξιότητες
- **28 γλώσσες** (EL + EN πλήρης υποστήριξη)
- Βασισμένο στο **ISCO-08** (International Standard Classification of Occupations)
- **Δωρεάν** public API, χωρίς API key
- **Άδεια**: EUPL 1.2 / Apache 2.0 — **permissive, OK για proprietary**

### ISCO-08 Hierarchy

```
Level 1: Major Group      (1 digit)  → "2" = Professionals
Level 2: Sub-major Group  (2 digits) → "21" = Science & Engineering
Level 3: Minor Group      (3 digits) → "214" = Engineering Professionals
Level 4: Unit Group        (4 digits) → "2142" = Civil Engineers
Level 5+: ESCO Occupation  (URI)      → "Structural Engineer" (ESCO-specific)
```

---

## 2. Decision

### Architecture: Hybrid Approach (Firestore Cache + In-Memory LRU)

Αντί για API-only (αργό, εξαρτάται από EC servers) ή download-only (μεγάλο bundle), επιλέξαμε **Hybrid**:

1. **Import Script** κατεβάζει occupations μέσω ESCO REST API (EL + EN)
2. **Firestore Cache** αποθηκεύει τα δεδομένα σε `system/esco_cache/occupations`
3. **In-Memory LRU Cache** (50 entries, 5min TTL) μειώνει Firestore reads
4. **Search Tokens** — pre-computed, accent-normalized, για prefix matching

### Canonical Sources

```
src/types/contacts/esco-types.ts          → Types & Interfaces
src/services/esco.service.ts              → Firestore search/lookup service
src/components/shared/EscoOccupationPicker.tsx → Autocomplete UI component
scripts/import-esco-occupations.ts        → One-time CSV→Firestore import
```

### API

```typescript
// Types
import type {
  EscoOccupation,
  EscoPickerValue,
  EscoOccupationPickerProps,
  EscoLanguage,
} from '@/types/contacts/esco-types';

// Service
import { EscoService } from '@/services/esco.service';

const results = await EscoService.searchOccupations({
  query: 'Μηχαν',
  language: 'el',
  limit: 10,
});

const occupation = await EscoService.getOccupationByUri(uri);
const group = await EscoService.getOccupationsByIscoGroup('214', 'el');

// Component
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';

<EscoOccupationPicker
  value={profession}
  escoUri={escoUri}
  iscoCode={iscoCode}
  onChange={(value: EscoPickerValue) => {
    // value.profession — human-readable text (always set)
    // value.escoUri — ESCO URI (optional, only for ESCO selections)
    // value.iscoCode — ISCO-08 code (optional)
  }}
/>
```

### Data Model

```typescript
// Contact document — new fields (backward compatible)
{
  profession: "Πολιτικός Μηχανικός",     // Human-readable (always set)
  escoUri: "http://data.europa.eu/...",   // ESCO link (optional)
  escoLabel: "Πολιτικός Μηχανικός",      // Cached ESCO label (optional)
  iscoCode: "2142",                        // ISCO code (optional)
  specialty: "Στατικός",                   // Free text (unchanged)
}
```

### Firestore Structure

```
system/esco_cache/occupations/{docId}
├── uri: string                    // ESCO occupation URI
├── iscoCode: string               // "2142"
├── iscoGroup: string              // "214"
├── preferredLabel.el: string      // "Πολιτικός Μηχανικός"
├── preferredLabel.en: string      // "Civil Engineer"
├── alternativeLabels.el: string[] // ["Δομοστατικός"]
├── alternativeLabels.en: string[] // ["Structural Engineer"]
├── searchTokensEl: string[]       // Pre-computed for prefix search
├── searchTokensEn: string[]       // Pre-computed for prefix search
└── updatedAt: Timestamp
```

### UI Component: ESCO Autocomplete

```
┌─────────────────────────────────────────┐
│ Επάγγελμα: [Πολιτ...               🔍 ] │  ← Input with search icon
│  ┌─────────────────────────────────────┐ │
│  │ Πολιτικός Μηχανικός (2142)        │ │  ← ESCO result
│  │   Civil Engineer                   │ │  ← Secondary language
│  │ Τεχνικός Πολιτικών Έργων (3112)   │ │
│  │──────────────────────────────      │ │
│  │ ✏️ Χρήση ελεύθερου κειμένου      │ │  ← Free text fallback
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Features:
- Radix Popover + Input (ADR-001 compliant)
- Debounced search (300ms, min 2 chars)
- Bilingual display (current locale + ISCO code)
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- "ESCO" badge when selection is active
- Free text fallback always available
- Accessible (role="combobox", aria-autocomplete)

---

## 3. Consequences

### Positive

- ✅ **EU Standard Compliance**: Τυποποιημένα επαγγέλματα κατά ESCO/ISCO-08
- ✅ **Bilingual**: Πλήρης υποστήριξη EL/EN, labels αλλάζουν με τη γλώσσα
- ✅ **Reliable Search**: ISCO codes επιτρέπουν grouping/filtering ανεξάρτητα γλώσσας
- ✅ **Backward Compatible**: Παλιές επαφές χωρίς ESCO λειτουργούν κανονικά
- ✅ **Free Text Fallback**: Ο χρήστης μπορεί πάντα να γράψει ελεύθερο κείμενο
- ✅ **Performant**: In-memory LRU cache + pre-computed search tokens
- ✅ **Zero Dependencies**: Χωρίς νέα npm packages — μόνο Radix Popover (ήδη installed)
- ✅ **Permissive License**: EUPL 1.2 / Apache 2.0 — OK για proprietary

### Negative

- ⚠️ **Import Script Required**: Πρέπει να τρέξει μία φορά για να γεμίσει το Firestore cache
- ⚠️ **Firestore Reads**: Κάθε αναζήτηση = 1 Firestore query (μετριάζεται με cache)
- ⚠️ **3.039 documents**: Η cache collection χρησιμοποιεί ~3K documents στο Firestore

---

## 4. Prohibitions (after this ADR)

- ⛔ **ΜΗΝ** δημιουργήσεις νέο dropdown/autocomplete για επαγγέλματα — χρησιμοποίησε `EscoOccupationPicker`
- ⛔ **ΜΗΝ** hardcode-άρεις λίστες επαγγελμάτων — χρησιμοποίησε ESCO search
- ⛔ **ΜΗΝ** αφαιρέσεις το free-text fallback — είναι ΚΡΙΣΙΜΟ για backward compatibility
- ⛔ **ΜΗΝ** γράφεις `undefined` στα ESCO fields — χρησιμοποίησε `null` (Firestore rule)

---

## 5. Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/types/contacts/esco-types.ts` | ESCO interfaces, types, ISCO constants |
| `src/services/esco.service.ts` | Firestore search, lookup by URI/ISCO group, LRU cache |
| `src/components/shared/EscoOccupationPicker.tsx` | Autocomplete UI (Radix Popover + Input) |
| `scripts/import-esco-occupations.ts` | ESCO API → Firestore batch import |

### Modified Files

| File | Change |
|------|--------|
| `src/types/contacts/contracts.ts` | +3 fields: `escoUri`, `escoLabel`, `iscoCode` |
| `src/types/ContactFormTypes.ts` | +3 form fields + initialFormData |
| `src/utils/contactForm/mappers/individual.ts` | ESCO fields in save mapping (null safety) |
| `src/utils/contactForm/fieldMappers/individualMapper.ts` | ESCO fields in load mapping |
| `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx` | Custom renderer `profession` → `EscoOccupationPicker` |
| `src/constants/property-statuses-enterprise.ts` | +2 labels: `ESCO_URI`, `ISCO_CODE` |
| `src/i18n/locales/el/contacts.json` | +section `esco` (6 keys) |
| `src/i18n/locales/en/contacts.json` | +section `esco` (6 keys) |
| `src/config/firestore-collections.ts` | +`ESCO_CACHE` collection path |
| `firestore.indexes.json` | +2 composite indexes (occupations) |

---

## 6. References

- [ESCO Portal](https://esco.ec.europa.eu)
- [ESCO API Documentation](https://ec.europa.eu/esco/api/doc/esco_api_doc.html)
- [ISCO-08 (ILO)](https://www.ilo.org/public/english/bureau/stat/isco/isco08/)
- Related: [ADR-121](./ADR-121-contact-persona-system.md) — Contact Persona System
- Related: [ADR-001](./ADR-001-select-dropdown-component.md) — Select/Dropdown Component Standard

---

## 7. Setup / Deployment

### Step 1: Import ESCO Data

```bash
npx tsx scripts/import-esco-occupations.ts
```

### Step 2: Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes --project pagonis-87766
```

### Step 3: Verify

- Open Individual Contact → Professional Info tab
- "Profession" field is now autocomplete with ESCO search
- Type "Μηχαν" → see standardized results
- Select occupation → ESCO badge appears
- Or use free text fallback

---

## 8. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — ESCO Professional Classification Integration | Georgios Pagonis + Claude Code |
| 2026-02-09 | Status: IMPLEMENTED — All 5 phases complete, zero TypeScript errors | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
*EU Standard: ESCO v1.2.1 (European Commission, DG EMPL)*
