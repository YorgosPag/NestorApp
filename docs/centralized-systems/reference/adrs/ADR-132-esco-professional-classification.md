# ADR-132: ESCO Professional Classification Integration (Occupations + Skills)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | Contact Management / CRM |
| **Canonical Locations** | `src/types/contacts/esco-types.ts`, `src/services/esco.service.ts`, `src/components/shared/EscoOccupationPicker.tsx`, `src/components/shared/EscoSkillPicker.tsx` |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |

---

## 1. Context

### The Problem

- ❌ **Free-text profession field**: Τα πεδία `profession` και `specialty` στις επαφές φυσικών προσώπων ήταν ελεύθερο κείμενο — χωρίς τυποποίηση, χωρίς validation
- ❌ **Inconsistent data**: "Μηχανικός" vs "μηχανικός" vs "Μηχ." — αδύνατη η αξιόπιστη αναζήτηση/φιλτράρισμα
- ❌ **No international standard**: Δεν υπήρχε σύνδεση με ευρωπαϊκά πρότυπα ταξινόμησης
- ❌ **Hardcoded persona options**: Τα personas (ADR-121) χρησιμοποιούν hardcoded specialty codes (engineer: 7, accountant: 4)
- ❌ **No skills/competences field**: Δεν υπήρχε τρόπος καταχώρησης δεξιοτήτων για τις επαφές φυσικών προσώπων — κρίσιμες για matching επαγγελματιών σε έργα

### ESCO Overview

**ESCO** (European Skills, Competences, Qualifications and Occupations) — ευρωπαϊκό πρότυπο ταξινόμησης:
- **2.942 επαγγέλματα** (occupations) + **13.485 δεξιότητες** (skills)
- **28 γλώσσες** (EL + EN πλήρης υποστήριξη)
- Βασισμένο στο **ISCO-08** (International Standard Classification of Occupations)
- **Δωρεάν** public API, χωρίς API key
- **Άδεια**: EUPL 1.2 / Apache 2.0 — **permissive, OK για proprietary**
- **Qualifications**: ΔΕΝ διαθέσιμα μέσω REST API (400 Bad Request) — μόνο Occupations + Skills

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

1. **Import Scripts** κατεβάζουν occupations + skills μέσω ESCO REST API (EL + EN)
2. **Firestore Cache** αποθηκεύει τα δεδομένα σε `system/esco_cache/occupations` & `system/esco_cache/skills`
3. **In-Memory LRU Cache** (50 entries, 5min TTL, ξεχωριστά maps) μειώνει Firestore reads
4. **Search Tokens** — pre-computed, accent-normalized, για prefix matching

### Canonical Sources

```
src/types/contacts/esco-types.ts               → Types & Interfaces (Occupations + Skills)
src/services/esco.service.ts                   → Firestore search/lookup service (Occupations + Skills)
src/components/shared/EscoOccupationPicker.tsx → Occupation autocomplete UI (single-select)
src/components/shared/EscoSkillPicker.tsx      → Skill picker UI (multi-select, chips/tags)
scripts/import-esco-occupations.ts             → Occupations import (~2.942)
scripts/import-esco-skills.ts                  → Skills import (~13.485)
```

### API

```typescript
// Types
import type {
  EscoOccupation,
  EscoPickerValue,
  EscoOccupationPickerProps,
  EscoSkillValue,
  EscoSkillPickerProps,
  EscoLanguage,
} from '@/types/contacts/esco-types';

// Service — Occupations
import { EscoService } from '@/services/esco.service';

const results = await EscoService.searchOccupations({
  query: 'Μηχαν',
  language: 'el',
  limit: 10,
});

const occupation = await EscoService.getOccupationByUri(uri);
const group = await EscoService.getOccupationsByIscoGroup('214', 'el');

// Service — Skills
const skillResults = await EscoService.searchSkills({
  query: 'μαθημ',
  language: 'el',
  limit: 10,
});

const skill = await EscoService.getSkillByUri(uri);

// Component — Occupation (single-select)
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

// Component — Skills (multi-select)
import { EscoSkillPicker } from '@/components/shared/EscoSkillPicker';

<EscoSkillPicker
  value={escoSkills}        // Array<{ uri: string; label: string }>
  maxSkills={20}             // Configurable limit (default: 20)
  onChange={(skills: EscoSkillValue[]) => {
    // skills[].uri — ESCO skill URI (empty string for free-text)
    // skills[].label — human-readable skill label
  }}
/>
```

### Data Model

```typescript
// Contact document — occupation fields (backward compatible)
{
  profession: "Πολιτικός Μηχανικός",     // Human-readable (always set)
  escoUri: "http://data.europa.eu/...",   // ESCO link (optional)
  escoLabel: "Πολιτικός Μηχανικός",      // Cached ESCO label (optional)
  iscoCode: "2142",                        // ISCO code (optional)
  specialty: "Στατικός",                   // Free text (unchanged)
}

// Contact document — skills fields (backward compatible, optional)
{
  escoSkills: [                            // Array of selected skills
    { uri: "http://data.europa.eu/esco/skill/...", label: "Μαθηματικά" },
    { uri: "http://data.europa.eu/esco/skill/...", label: "Project Management" },
    { uri: "", label: "Custom Skill" },    // Free-text (no ESCO URI)
  ]
}
```

### Firestore Structure

```
system/esco_cache/occupations/{docId}       ← ~2.942 documents
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

system/esco_cache/skills/{docId}            ← ~13.485 documents
├── uri: string                    // ESCO skill URI
├── preferredLabel.el: string      // "Μαθηματικά"
├── preferredLabel.en: string      // "Mathematics"
├── alternativeLabels.el: string[] // (from import)
├── alternativeLabels.en: string[] // (from import)
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

Features (Occupation Picker — single-select):
- Radix Popover + Input (ADR-001 compliant)
- Debounced search (300ms, min 2 chars)
- Bilingual display (current locale + ISCO code)
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- "ESCO" badge when selection is active
- Free text fallback always available
- Accessible (role="combobox", aria-autocomplete)

### UI Component: ESCO Skills Picker (Multi-select)

```
┌─────────────────────────────────────────┐
│ [ESCO Μαθηματικά ×] [Project Mgmt ×]   │  ← Selected skills as chips
│                                          │
│ Δεξιότητες: [φυσικ...             🔍 ]  │  ← Search input
│  ┌─────────────────────────────────────┐ │
│  │ Φυσική                              │ │  ← ESCO result
│  │   Physics                           │ │  ← Secondary language
│  │ Φυσικοθεραπεία                      │ │
│  │──────────────────────────────       │ │
│  │ ✏️ Προσθήκη ως ελεύθερο κείμενο   │ │  ← Free text fallback
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Features (Skill Picker — multi-select):
- Multi-select with removable chips/tags
- ESCO badge on ESCO-sourced skills, plain style for free-text
- Configurable max skills limit (default: 20)
- Backspace removes last skill when input is empty
- Filters out already-selected skills from results
- Same search, debounce, keyboard, accessibility as occupation picker

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

- ⚠️ **Import Scripts Required**: Πρέπει να τρέξουν μία φορά για να γεμίσουν το Firestore cache
- ⚠️ **Firestore Reads**: Κάθε αναζήτηση = 1 Firestore query (μετριάζεται με cache)
- ⚠️ **~16.400 documents**: Η cache collection χρησιμοποιεί ~2.942 (occupations) + ~13.485 (skills) documents

---

## 4. Prohibitions (after this ADR)

- ⛔ **ΜΗΝ** δημιουργήσεις νέο dropdown/autocomplete για επαγγέλματα — χρησιμοποίησε `EscoOccupationPicker`
- ⛔ **ΜΗΝ** δημιουργήσεις νέο multi-select για δεξιότητες — χρησιμοποίησε `EscoSkillPicker`
- ⛔ **ΜΗΝ** hardcode-άρεις λίστες επαγγελμάτων ή δεξιοτήτων — χρησιμοποίησε ESCO search
- ⛔ **ΜΗΝ** αφαιρέσεις το free-text fallback — είναι ΚΡΙΣΙΜΟ για backward compatibility
- ⛔ **ΜΗΝ** γράφεις `undefined` στα ESCO fields — χρησιμοποίησε `null` (Firestore rule)
- ⛔ **ΜΗΝ** αποθηκεύεις `escoSkills: undefined` — χρησιμοποίησε `[]` (empty array)

---

## 5. Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/types/contacts/esco-types.ts` | ESCO interfaces, types, ISCO constants (Occupations + Skills) |
| `src/services/esco.service.ts` | Firestore search, lookup by URI/ISCO group, LRU cache (Occupations + Skills) |
| `src/components/shared/EscoOccupationPicker.tsx` | Occupation autocomplete UI — single-select (Radix Popover + Input) |
| `src/components/shared/EscoSkillPicker.tsx` | Skill picker UI — multi-select with chips/tags (Radix Popover + Input) |
| `scripts/import-esco-occupations.ts` | Occupations ESCO API → Firestore batch import (~2.942) |
| `scripts/import-esco-skills.ts` | Skills ESCO API → Firestore batch import (~13.485) |

### Modified Files

| File | Change |
|------|--------|
| `src/types/contacts/contracts.ts` | +3 occupation fields + `escoSkills` array |
| `src/types/ContactFormTypes.ts` | +3 occupation form fields + `escoSkills` + initialFormData |
| `src/utils/contactForm/mappers/individual.ts` | ESCO occupation + skills fields in save mapping |
| `src/utils/contactForm/fieldMappers/individualMapper.ts` | ESCO occupation + skills fields in load mapping |
| `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx` | Custom renderers: `profession` → `EscoOccupationPicker`, `skills` → `EscoSkillPicker` |
| `src/constants/property-statuses-enterprise.ts` | +3 labels: `ESCO_URI`, `ISCO_CODE`, `SKILLS` |
| `src/config/individual-config.ts` | +`skills` dummy field in professional section |
| `src/i18n/locales/el/contacts.json` | +`esco` section (6 keys) + `esco.skills` subsection (6 keys) + `individual.fields.skills` |
| `src/i18n/locales/en/contacts.json` | Same keys in English |
| `src/config/firestore-collections.ts` | +`ESCO_CACHE` + `ESCO_SKILLS_CACHE` collection paths |
| `firestore.indexes.json` | +2 composite indexes (occupations) + 2 composite indexes (skills) |

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
# Occupations (~2.942, ~30 seconds)
npx tsx scripts/import-esco-occupations.ts

# Skills (~13.485, ~60 seconds)
npx tsx scripts/import-esco-skills.ts
```

### Step 2: Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes --project pagonis-87766
```

### Step 3: Verify

- Open Individual Contact → Professional Info tab
- **Occupation**: "Profession" field is autocomplete with ESCO search
  - Type "Μηχαν" → see standardized occupation results
  - Select occupation → ESCO badge appears
  - Or use free text fallback
- **Skills**: "Skills" field is multi-select with ESCO search
  - Type "μαθημ" → see skills like "Μαθηματικά", "Μαθηματική μοντελοποίηση"
  - Select multiple skills → appear as removable chips
  - ESCO-sourced skills show "ESCO" badge
  - Free text skills also supported

---

## 8. Troubleshooting

### Turbopack Caching Issue (2026-02-09)

**Σύμπτωμα**: `EscoService.searchSkills is not a function` στο browser console, ενώ η μέθοδος υπάρχει στον source code.

**Αιτία**: Turbopack (`next dev --turbopack`) μπορεί να κρατάει cached/stale version αρχείων με μεγάλες αλλαγές. Η `searchSkills` method δεν αναγνωρίζεται παρόλο που υπάρχει στο `esco.service.ts`.

**Λύση**: Τρέξε τον dev server χωρίς Turbopack:
```bash
# Αντί: next dev --turbopack
npx next dev
```

Αν αυτό λύσει το πρόβλημα, μπορείς μετά να επιστρέψεις σε Turbopack (`next dev --turbopack`) αφού κάνεις commit τις αλλαγές.

### Skills Import Not Run Yet

**Σύμπτωμα**: Η αναζήτηση skills δεν επιστρέφει αποτελέσματα.

**Αιτία**: Το import script δεν έχει τρέξει — η collection `system/esco_cache/skills` είναι κενή.

**Λύση**:
```bash
npx tsx scripts/import-esco-skills.ts
```

---

## 9. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — ESCO Professional Classification Integration (Occupations) | Georgios Pagonis + Claude Code |
| 2026-02-09 | Status: IMPLEMENTED — Occupations: all phases complete, zero TypeScript errors | Claude Code |
| 2026-02-09 | Extended — ESCO Skills Integration: 13.485 skills, multi-select picker, EscoSkillPicker component | Georgios Pagonis + Claude Code |
| 2026-02-09 | Skills Import Complete — 13.485 skills imported to Firestore + composite indexes deployed | Claude Code |
| 2026-02-09 | Turbopack Bug — `searchSkills is not a function` resolved by running `next dev` without `--turbopack` | Claude Code |
| 2026-03-25 | Server-side ESCO enforcement — `set_contact_esco` rejects free-text writes when ESCO matches exist, forces AI to ask user first | Claude Code |
| 2026-03-25 | Extracted shared `esco-search-utils.ts` — eliminates duplication between contact-handler and utility-handler | Claude Code |
| 2026-03-25 | Bug fix — empty skills array no longer deletes existing skills (empty = no change) | Claude Code |
| 2026-03-25 | Fix: ESCO skill enforcement — skills without URI rejected when multiple ESCO matches exist. Skills now MERGE with existing (not replace) | Claude Code |
| 2026-03-25 | **Google-level enforcement**: Always-on server-side ESCO disambiguation. Added `disambiguated` flag — server BLOCKS writes with >1 matches unless user confirmed. AI can no longer bypass via auto-select with URI. URI validation after disambiguation. | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
*EU Standard: ESCO v1.2.1 (European Commission, DG EMPL)*
