# ADR-132: ESCO Professional Classification Integration (Occupations + Skills)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | Contact Management / CRM |
| **Canonical Locations** | `src/types/contacts/esco-types.ts`, `src/services/esco.service.ts`, `src/components/shared/EscoOccupationPicker.tsx`, `src/components/shared/EscoSkillPicker.tsx` |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Σχετικά** | 🆕 **ADR-798** *(2026-08-24)* — **ΔΙΑΒΑΣΕ ΤΟ ΠΡΙΝ ΑΓΓΙΞΕΙΣ ΤΟ ΣΧΗΜΑ**, δύο λόγοι παρακάτω |

> 🔗 **ΣΧΕΤΙΚΑ — ADR-798 «Ο Άνθρωπος: ταυτότητα προσώπου ξεχωριστά από εξουσιοδότηση»** *(2026-08-24)*
>
> **(1) Το σχήμα ESCO αποκτά ΔΕΥΤΕΡΟ καταναλωτή.** Μέχρι σήμερα τα `escoUri` · `iscoCode` ·
> `escoLabel` ζούσαν **μόνο** πάνω στο `Contact`. Το ADR-798 αποφάσισε ότι το **ίδιο** σχήμα
> απαντά και στο *«τι είναι ο κάτοχος του λογαριασμού»* — **χωρίς νέο λεξιλόγιο** *(θα ήταν το
> δέκατο, ADR-749)*. ⚠️ Το `Contact` **δεν έχει `uid`**: η γέφυρα **δεν υπάρχει ακόμη**, και το
> αν θα υπάρξει ποτέ είναι **απόφαση GDPR** *(ADR-798 §11, Ο-3)*.
>
> **(2) ✅ 13 ΣΧΟΛΙΑ ΚΩΔΙΚΑ ΕΔΕΙΧΝΑΝ ΣΕ ΛΑΘΟΣ ADR — ΔΙΟΡΘΩΘΗΚΑΝ.** Σε **11** αρχεία, το ESCO
> αποδιδόταν στο **ADR-034** — που είναι **ΤΡΙΠΛΟ** *(`empty-spatial-bounds` · `gantt-chart` ·
> `validation-bounds`)* και του οποίου **κανένα** αρχείο δεν αναφέρει τη λέξη ESCO *(0·0·0,
> μετρημένο)*. **Ο ιδιοκτήτης είναι ΑΥΤΟ το έγγραφο.** Το λάθος **είχε ήδη διαδοθεί** σε handoff
> και σε εγκεκριμένο σχέδιο *(ADR-748 §12, **Π-21** — έκλεισε στη Φάση 1)*. Εναπομείναντα **0**.
>
> ⚠️ **Το `contracts.ts` έλεγε ΚΑΙ ΤΑ ΔΥΟ, έξι γραμμές απόσταση**: `ADR-034` για το **επάγγελμα**
> (γρ. 133) και `ADR-132` για τα **skills** (γρ. 139). Ο σωστός δείκτης ήταν πάντα μέσα στο ίδιο
> μπλοκ — κανείς δεν σύγκρινε τις δύο γραμμές μεταξύ τους.
>
> ⚠️ **ΜΗΝ «καθαρίσεις» σκέτα `ADR-034` στο `src/`**: οι αναφορές του **Gantt** · των
> **spatial/validation bounds** · του **rendering z-index** είναι **σωστές** και δείχνουν σε
> **άλλα δύο** από τα τρία ομώνυμα. Το κριτήριο που χρησιμοποιήθηκε ήταν `ADR-034` **ΚΑΙ**
> `esco|isco|profession` **στην ίδια γραμμή**.

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
| `scripts/lib/esco/esco-api.ts` | 🆕 2026-08-26 — σύρμα ESCO + **ταξινόμηση σφαλμάτων** *(παροδικό / μόνιμο)* · §10.4 |
| `scripts/lib/esco/esco-harvest.ts` | 🆕 2026-08-26 — **συγκομιδή με ετυμηγορία** *(κλειστή λογιστική, διακόπτης, δεύτερη σάρωση)* · §10.3 |
| `scripts/lib/esco/esco-import-runner.ts` | 🆕 2026-08-26 — **πύλη fail-closed** + γραφέας παρτίδων, κοινός στα δύο λεξιλόγια · §10.5 |
| `scripts/lib/esco/esco-document-base.ts` | 🆕 2026-08-26 — ο **κοινός κορμός** εγγράφου + ο κανόνας παράλειψης |
| `scripts/lib/esco/esco-occupation-document.ts` | 🆕 2026-08-26 — **τρεις καταστάσεις ISCO**, καμία επινοημένη · §10.2 |
| `scripts/lib/esco/esco-skill-document.ts` | 🆕 2026-08-26 — δεξιότητες *(καμία διαφορά πέρα από την απουσία ISCO)* |
| `src/lib/esco/search-tokens.ts` | 🆕 2026-08-26 — **Ο τοκενιστής**, για **τα δύο άκρα** του ευρετηρίου · §10.6 |
| `src/lib/esco/relevance.ts` | 🆕 2026-08-26 — **Η κλίμακα συνάφειας**, μία · §10.7 |
| `src/lib/esco/token-search.ts` | 🆕 2026-08-26 — **Η αναζήτηση προθέματος**, μία για επαγγέλματα + δεξιότητες · §10.8 |

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
# Occupations (~2.942, ~30 δευτερόλεπτα)
npm run import:esco:occupations

# Skills (~13.485, ~60 δευτερόλεπτα)
npm run import:esco:skills

# Εν γνώσει σου μερική ενημέρωση (τυπώνει ⚠️, ΠΟΤΕ ✅ — βλ. §10.5):
npm run import:esco:occupations -- --allow-partial
```

⚠️ **Κωδικός εξόδου `1` σημαίνει ότι ΔΕΝ γράφτηκε τίποτα** *(§10.5)*. Διάβασε τους λόγους που
τυπώνει — δεν είναι θόρυβος, είναι η απάντηση στο *«πήρα όσα υπάρχουν;»*.

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
| 2026-08-26 | 🔴 **§10 — ο εισαγωγέας επινοούσε `'0000'` και ανέφερε `✅` πάνω σε ολική αποτυχία.** Και τα δύο ήταν δηλωμένα ανοιχτά (ADR-798 §20.4 #3/#4). Νέα μηχανή `scripts/lib/esco/` με ετυμηγορία συγκομιδής + πύλη fail-closed. 30/30 μεταλλάξεις κόκκινες. | Giorgio + Claude Code |
| 2026-08-26 | **§10.6-10.8 — SSoT audit: 5 τοκενιστές → 1 · 3 κλίμακες συνάφειας → 1 · 3 κλώνοι υπηρεσιών → 0** (631 → 340 γραμμές). Νέα modules `lib/esco/search-tokens` · `relevance` · `token-search`, όλα στο μητρώο **με απόδειξη**. | Claude Code |

---

---

## 10. 🔴 Ο ΕΙΣΑΓΩΓΕΑΣ ΕΠΙΝΟΟΥΣΕ ΔΕΔΟΜΕΝΑ ΚΑΙ ΑΝΕΦΕΡΕ ΕΠΙΤΥΧΙΑ ΠΑΝΩ ΣΕ ΑΠΟΤΥΧΙΑ (2026-08-26)

> **Εντολή Giorgio.** Δηλωμένα ανοιχτά **ADR-798 §20.4 #3 και #4** — και τα δύο **έκλεισαν εδώ**.
> Ο εισαγωγέας δεν ανήκε σε καμία λωρίδα και **δεν τον τρέχει κανένα npm script**, οπότε
> **καμία πύλη δεν τον έβλεπε**. Πλέον τον τρέχουν δύο *(`import:esco:occupations` ·
> `import:esco:skills`)* και τον φυλάνε **58 άγκυρες** που εκτελούν.

### 10.1 🔬 Η ΑΝΑΤΟΜΙΑ — τρία ελαττώματα δεδομένων, γραμμένα **δύο φορές**

Το `scripts/import-esco-occupations.ts` *(358 γραμμές)* και το `scripts/import-esco-skills.ts`
*(299 γραμμές)* ήταν **δίδυμα**: ίδιος τοκενιστής, ίδιο `uriToDocId`, ίδιο `delay`, ίδια
αρχικοποίηση Admin SDK, ίδιος γραφέας παρτίδων, ίδιο `main()` — **και ίδιος ελαττωματικός βρόχος
σελιδοποίησης**.

| # | Βλάβη | Πού |
|---|---|---|
| **Α** | 🔴 **`extractIscoCode` επέστρεφε `'0000'`** όταν έλειπε ο κωδικός | occupations, γρ. 126-130 |
| **Β1** | `catch { page++ }` — **προσπερνά** τη σελίδα και η επόμενη γραμμή τυπώνει `✅` | **και τα δύο**, γρ. 165-201 |
| **Β2** | 🔴 Αποτυχία στην **πρώτη** σελίδα ⇒ `totalItems` μένει `1` ⇒ ο βρόχος τελειώνει αμέσως ⇒ `✅ IMPORT COMPLETE / Total: 0` | **και τα δύο** |
| **Β3** | Καμία σύγκριση πληρότητας: το *«πήρα όσα υπάρχουν;»* **δεν τίθεται πουθενά** | **και τα δύο** |

### 10.2 🔴 ΓΙΑΤΙ ΤΟ `'0000'` ΔΕΝ ΕΙΝΑΙ «ΑΓΝΩΣΤΟ»

Στο **ISCO-08 η μείζων ομάδα 0 είναι οι Ένοπλες Δυνάμεις** — τα `0110` *(αξιωματικοί)*, `0210`
*(υπαξιωματικοί)*, `0310` *(λοιπά μέλη)* είναι **υπαρκτές μονάδες**. Και επειδή το `'0000'` περνά
το σχήμα `^\d{1,4}$`, ο `resolveIscoPrefix` το κατέτασσε **`undeclared`** *(«σιωπή εκ σχεδιασμού»)*
αντί για `malformed` *(«σφάλμα»)*. Η γρ. 227 έκανε `iscoCode.substring(0,3)` ⇒ **`iscoGroup: '000'`**.

⇒ Κάθε επάγγελμα χωρίς κωδικό αρχειοθετούνταν σε ομάδα που ο άνθρωπος διαβάζει ως **στρατιωτική**.
🔑 **Δεν είναι κενό που φαίνεται· είναι λάθος κατάταξη που δείχνει σωστή.**

**Η απόφαση — τρεις καταστάσεις, όχι δύο:**

| Η πηγή είπε | Γράφουμε | Τι λέει ο `resolveIscoPrefix` |
|---|---|---|
| έγκυρο `2142.1.9` | `iscoCode:'2142'` · `iscoGroup:'214'` | `declared`/`undeclared` — **αλήθεια** |
| **τίποτα** | `iscoCode:''` · `iscoGroup:''` | `absent` — **ειλικρινής σιωπή** |
| **σκουπίδι** *(`X7.1`)* | `iscoCode:'X7'` **αυτούσιο** · `iscoGroup:''` | `malformed` — **σφάλμα, και ΟΡΑΤΟ** |

⚠️ Το δύσμορφο **δεν ξεπλένεται σε `''`**: ξεπλυμένο, μια αλλαγή σχήματος του ESCO θα ταξίδευε ως
σιωπή και **κανείς δεν θα το μάθαινε**. Μετριέται, τυπώνεται με δείγματα, και κατεβάζει το banner
από `✅` σε `⚠️`. Ότι ένας κωδικός που δεν λύνεται **δεν σπάει τίποτα** είναι ήδη αγκυρωμένο
*(ADR-798 §18.5)*.

🔑 **Ο μηχανισμός εξήχθη, δεν αντιγράφηκε**: το `ISCO_CODE_SHAPE` ήταν **ιδιωτικό** στο
`src/config/isco-prefix.ts`. Ένας εισαγωγέας με **δικό του** `/^\d{1,4}$/` θα ήταν **δεύτερος
ορισμός του «τι είναι έγκυρος κωδικός ISCO»** — ακριβώς η βλάβη που η επικεφαλίδα εκείνου του
αρχείου υπάρχει για να αποτρέψει *(ADR-749)*. Νέα δημόσια όψη: **`classifyIscoCode`** ·
**`iscoMinorGroupOf`** · **`ISCO_MINOR_GROUP_LENGTH`**, και ο `resolveIscoPrefix` **τα καταναλώνει**.

### 10.3 🔴 Η ΣΙΩΠΗ ΠΟΥ ΑΝΕΦΕΡΕ ΕΠΙΤΥΧΙΑ — και πώς πεθαίνει **δομικά**

`scripts/lib/esco/esco-harvest.ts` — η συγκομιδή επιστρέφει **ετυμηγορία**, όχι πίνακα:

| Βλάβη | Πώς πεθαίνει |
|---|---|
| **Β1** | κάθε αποτυχία μπαίνει στο `failedPages`· η ετυμηγορία **δεν μπορεί** να γίνει `complete` όσο ο πίνακας δεν είναι άδειος |
| **Β2** | το `declaredTotal` ξεκινά **`null`**, όχι `1`. Χωρίς απάντηση από την πηγή **δεν υπάρχει** πλήθος σελίδων, άρα ούτε «τελείωσε»: η ετυμηγορία είναι `first-page-failed` και **καμία τιμή δεν την κάνει `complete`** |
| **Β3** | η ερώτηση **ΕΙΝΑΙ** η ετυμηγορία: `uniqueCount === declaredTotal` |

Η αποτυχία είναι **τιμή επιστροφής**, ποτέ εξαίρεση — ώστε ο καλών **να μην μπορεί** να την
προσπεράσει με `catch {}`, που είναι ακριβώς ο τρόπος με τον οποίο γεννήθηκε το Β1.

### 10.4 🏆 ΠΟΥ ΠΑΜΕ ΠΙΟ ΠΕΡΑ ΑΠΟ ΤΗΝ ΠΡΟΦΑΝΗ ΔΙΟΡΘΩΣΗ

1. **Μετράμε ΜΟΝΑΔΙΚΑ URI, όχι πλήθος γραμμών.** Η προφανής θεραπεία *(«σύγκρινε
   `allResults.length` με το `total`»)* είναι **ανεπαρκής**: αν η σελίδα 3 σερβιριστεί δύο φορές
   και η 4 παραλειφθεί, τα **πλήθη ταιριάζουν** ενώ λείπουν 500 έννοιες. Η σύγκριση γίνεται σε
   **σύνολο URI**, οπότε η επικάλυψη εμφανίζεται ως **έλλειμμα** — και μαζί της κάθε λανθασμένη
   σημασιολογία `offset`. *(Άγκυρα: «πιάνει επικάλυψη που ΤΟ ΠΛΗΘΟΣ ΓΡΑΜΜΩΝ θα έκρυβε».)*
2. **Ανιχνεύουμε ΜΕΤΑΤΟΠΙΣΗ ΤΟΥ ΣΥΝΟΛΟΥ.** Το ESCO **δεν** προσφέρει στιγμιότυπο *(ούτε
   `search_after`, ούτε point-in-time token όπως το Elasticsearch)*. Αν το `total` αλλάξει
   ανάμεσα σε δύο σελίδες, η σελιδοποίηση είναι **σκισμένη**. Δεν μπορούμε να το **αποτρέψουμε** —
   μπορούμε να **αρνηθούμε να το πούμε πλήρες**.
3. **Διακόπτης κυκλώματος**: τρεις **διαδοχικές** αποτυχίες = πηγή εκτός, όχι τρεμοπαίξιμο.
   Μετρημένο στην άγκυρα: **7 κλήσεις αντί για 119**.
4. **Δεύτερη σάρωση** στις ανεπίλυτες σελίδες, **μετά** το τέλος της κύριας — πολύ μεγαλύτερο κενό
   χρόνου από όσο δίνει η υποχώρηση. Μια στιγμιαία διακοπή **δεν πετάει 39 σελίδες**.
5. **Ταξινόμηση σφαλμάτων στην πηγή**: `ESCO_TRANSIENT` *(δίκτυο · 5xx · **429**)* vs
   `ESCO_PERMANENT` *(4xx πλην 429)*. Ένα `404` **δεν γίνεται καλύτερο με αναμονή**· η επανάληψή
   του είναι σπατάλη 5 προσπαθειών επί εκθετική υποχώρηση. Μετρημένο: **1 κλήση, όχι 5**.

⚠️ **ΤΟ `offset` ΤΟΥ ESCO ΕΙΝΑΙ ΑΡΙΘΜΟΣ ΣΕΛΙΔΑΣ, ΟΧΙ ΔΕΙΚΤΗΣ ΣΤΟΙΧΕΙΟΥ.** Επαληθεύτηκε στο
**επίσημο OpenAPI v3** *(2026-08-26)*: *«The offset of the returned resources. Supports paging
where the 'offset' specifies the page number (zero-based numbering)»*. Είναι **ασυνήθιστο** — γι'
αυτό γράφεται εδώ. Αν κάποιος «το διορθώσει» σε `page * limit`, ο φρουρός **δεν** είναι αυτό το
σχόλιο, είναι η σύγκριση μοναδικών URI.

### 10.5 ⛔ Η ΠΥΛΗ FAIL-CLOSED — «ατελές» ΔΕΝ γράφεται

`scripts/lib/esco/esco-import-runner.ts`. **Τρεις** ανεξάρτητοι λόγοι άρνησης, **όλοι πριν από
οποιαδήποτε γραφή**:

1. η συγκομιδή δεν είναι `complete` *(χωρίς `--allow-partial`)*·
2. η πηγή δήλωσε **μηδέν** έννοιες — **ένδειξη βλάβης**, όχι άδειο λεξιλόγιο *(ESCO: ~2.942 /
   ~13.485)*·
3. ο μετασχηματισμός δεν παρήγαγε **κανένα** έγγραφο.

Το `--allow-partial` υπάρχει επειδή ένας άνθρωπος **μπορεί** να θέλει μερική ενημέρωση· τυπώνει
`⚠️ ΕΙΣΑΓΩΓΗ ΜΕ ΕΠΙΦΥΛΑΞΕΙΣ`, **ποτέ** `✅`, και ονομάζει τι λείπει.

**Κλειστή λογιστική**, σε κάθε τρέξιμο:
```
📐 Λογιστική: δηλωμένα 2942 · μοναδικά 2942 · έγγραφα 2938 · παραλείφθηκαν 4
   ISCO: 2901 με κωδικό · 37 χωρίς κωδικό · 0 δύσμορφα
```

🔑 Η **σειρά** *(«γράφει μόνο αφού περάσει η πύλη»)* είναι **μετρημένη**, όχι δηλωμένη: ο γραφέας
είναι **ενέσιμος** (`EscoImportPorts`) και η άγκυρα ελέγχει ότι **δεν κλήθηκε καθόλου**.

### 10.6 🔴 ΤΟ ΕΥΡΗΜΑ ΤΟΥ SSoT AUDIT — **ΠΕΝΤΕ** ΤΟΚΕΝΙΣΤΕΣ ΓΙΑ **ΕΝΑ** ΕΥΡΕΤΗΡΙΟ

Το υποχρεωτικό audit *(N.0 / N.12)* πριν από τον κώδικα βρήκε κάτι **μεγαλύτερο** από τα δύο
ελαττώματα. Η αναζήτηση ESCO είναι **ευρετήριο προθεμάτων** πάνω σε Firestore `array-contains`: ο
**εισαγωγέας γράφει** τα `searchTokens*`, η **υπηρεσία ρωτά**. Το `array-contains` απαιτεί
**ακριβή** ισότητα στοιχείου. Άρα:

> 🔑 **αν οι δύο πλευρές κανονικοποιήσουν διαφορετικά, η αναζήτηση επιστρέφει ΜΗΔΕΝ ΑΠΟΤΕΛΕΣΜΑΤΑ —**
> **χωρίς σφάλμα, χωρίς log, χωρίς κόκκινο test.** Στην οθόνη διαβάζεται «δεν υπάρχει τέτοιο επάγγελμα».

**Μετρημένα πέντε αντίγραφα**, σε δύο άκρα του **ίδιου** ευρετηρίου:

| # | Τόπος | Πλευρά |
|---|---|---|
| 1 | `scripts/import-esco-occupations.ts` `generateSearchTokens` | **γραφή** |
| 2 | `scripts/import-esco-skills.ts` — **ταυτόσημο** με το 1 | **γραφή** |
| 3 | `services/esco.service.ts` `normalizeForSearch` + `queryToTokens` | ανάγνωση |
| 4 | `services/esco-skill.service.ts` — **ταυτόσημο** με το 3 | ανάγνωση |
| 5 | `services/ai-pipeline/tools/esco-search-utils.ts` `normalizeEsco` | ανάγνωση *(διακομιστής)* |

**Τρία** από αυτά κουβαλούσαν σχόλιο *«Same algorithm as …»* — **σχόλιο εκεί που έπρεπε να υπάρχει
module**. Είναι το σχήμα του **ADR-749** *(«δεύτερη αλήθεια»)*, εδώ με **πέντε** διαλέκτους, και με
την επιπλέον ιδιότητα ότι η απόκλιση **δεν κοκκινίζει τίποτα**.

**Θεραπεία — ΕΝΑ module**: `src/lib/esco/search-tokens.ts` *(`normalizeEscoText` ·
`escoQueryTokens` ανάγνωση · `escoIndexTokens` γραφή)*, πάνω στο **υπάρχον** `stripAccents`
*(`@/utils/greek-text`)*. Οι δύο εισαγωγείς το φτάνουν με **σχετικό μονοπάτι** *(η καθιερωμένη
σύμβαση του `scripts/`)*· επαληθεύτηκε **εκτελεσμένα** ότι το `tsx` λύνει και τα `@/` alias μέσα
από αυτό.

### 10.7 🔴 ΚΑΙ ΔΕΥΤΕΡΟ: **ΤΡΕΙΣ** ΚΛΙΜΑΚΕΣ ΣΥΝΑΦΕΙΑΣ, ΜΙΑ ΕΙΧΕ ΑΠΟΚΛΙΝΕΙ

| Τόπος | Σκαλοπάτια | Απόκλιση |
|---|---|---|
| `esco.service.ts` | 1.0 · 0.9 · **0.8 (ISCO)** · 0.7 · 0.6 · 0.5 | — |
| `esco-skill.service.ts` | 1.0 · 0.9 · 0.7 · 0.6 · 0.5 | **χωρίς ISCO** — *σωστό*, οι δεξιότητες δεν έχουν κωδικό |
| `esco-search-utils.ts` *(διακομιστής)* | 1.0 · 0.9 · 0.7 · 0.5 | 🔴 **χωρίς συνώνυμα** |

🔑 Η τρίτη γραμμή είναι το εύρημα: ο διακομιστής επέβαλλε στον χρήστη *«διάλεξε από τη λίστα»*
*(§9, «Google-level enforcement»)* με κατάταξη που **δεν ήταν αυτή που έβλεπε ο χρήστης**. Δεν ήταν
σφάλμα που κοκκινίζει — ήταν **δεύτερη κρίση**.

**Θεραπεία**: `src/lib/esco/relevance.ts` — `judgeEscoRelevance` + `ESCO_RELEVANCE`. Η σκάλα
διατηρήθηκε **ακέραιη**· η μόνη συμπεριφορική αλλαγή είναι ότι ο διακομιστής **βλέπει πλέον τα
συνώνυμα**. ⚠️ Η **σειρά** των σκαλοπατιών **είναι** η συμπεριφορά: `contains` πριν το `startsWith`
ισοπεδώνει το autocomplete *(μετάλλαξη Μ21, κόκκινη)*.

### 10.8 🔨 ΚΑΙ ΤΡΙΤΟ: ΟΙ ΔΥΟ ΥΠΗΡΕΣΙΕΣ ΗΤΑΝ **ΠΑΡΑΛΛΗΛΑ ΔΙΔΥΜΑ** — το μέτρησε το CHECK 3.28

Το `jscpd` μέτρησε **τρεις** κλώνους ανάμεσα σε `esco.service.ts` και `esco-skill.service.ts`
*(65 · 89 · 77 tokens)*: ερώτημα Firestore, φιλτράρισμα «όλα τα tokens», βαθμολόγηση, ταξινόμηση,
LRU. Ό,τι πραγματικά διέφερε ήταν **τέσσερα**: η **συλλογή** · ο **τύπος εγγράφου** · η
**χαρτογράφηση σε τομέα** · και **ένα επιπλέον σκαλοπάτι** *(ο κωδικός ISCO)*. Αυτά είναι
**παράμετροι**.

**Θεραπεία**: `src/lib/esco/token-search.ts` *(`searchEscoByTokens`)*. **631 → 340 γραμμές** στις
δύο υπηρεσίες, **0 κλώνοι**.

⚠️ **ΤΟ ΟΡΙΟ ΠΟΥ ΟΡΙΖΕΙ ΤΗ ΣΧΕΔΙΑΣΗ**: το `array-contains` δέχεται **μία** τιμή ανά ερώτημα. Άρα
ρωτάμε με το **πρώτο** token και φιλτράρουμε τα υπόλοιπα **στον πελάτη**, ζητώντας `limit × 2`
έγγραφα. Δεν είναι ατέλεια — είναι το **συμβόλαιο του ευρετηρίου**.

⚠️ **ΔΕΝ ΕΝΟΠΟΙΗΘΗΚΕ** το `esco-search-utils.ts`: τρέχει σε **Admin SDK** και έχει **σκόπιμη
πολυ-token εφεδρεία** *(δοκίμασε κάθε token μέχρι να επιστρέψει γραμμές — λύνει το «τεχνίτης
κρεάτων», όπου το πρώτο token έχει 0 ευρήματα)*. **Άλλος μηχανισμός, όχι κλώνος.** Μοιράζεται τη
**σκάλα**, όχι το ερώτημα.

🔴 **ΔΗΛΩΜΕΝΟ ΚΕΝΟ ΠΟΥ ΠΛΗΡΩΘΗΚΕ ΕΔΩ**: το `scripts/` **ΔΕΝ** μπαίνει στο Layer-2 ratchet του
jscpd *(η ρίζα σάρωσης είναι `src`, `check-jscpd-ratchet.js:71`)*. Το `jscpd:diff` δουλεύει εκεί,
το **ratchet όχι**. Άρα για τους δύο εισαγωγείς **ο μόνος φρουρός είναι ο άνθρωπος** — γι' αυτό η
μηχανή τους ζει σε **ένα** αρχείο και τα σενάρια είναι **δηλώσεις 40 γραμμών**.

### 10.9 ✅ ΑΠΟΔΕΙΞΗ

| Τι | Μέτρηση |
|---|---|
| **Άγκυρες** *(όλες **εκτελούν**)* | **95 πράσινες** σε 8 σουίτες — `npm run test:esco-import` |
| **Μεταλλάξεις** | **30/30 ΚΟΚΚΙΝΕΣ**, `Μ0` πράσινο πριν **και** μετά |
| **Κλώνοι** *(CHECK 3.28)* | **5 → 0** σε 15 αρχεία *(1 δικός μου + **4 προϋπάρχοντες**, αποδεδειγμένα στο `HEAD`)* |
| **Γραμμές δύο υπηρεσιών** | **631 → 340** |
| **Αντίγραφα τοκενιστή** | **5 → 1** |
| **Κλίμακες συνάφειας** | **3 → 1** |
| **Μητρώο SSoT** | **+3 modules** *(`esco-search-tokens` · `esco-relevance` · `esco-token-search`)*, **+5 patterns, όλα με απόδειξη** ⇒ το ταβάνι «χωρίς απόδειξη» **δεν ανέβηκε** *(244 golden tests πράσινα)* |
| **npm scripts** | `import:esco:occupations` · `import:esco:skills` · `test:esco-import` — ο εισαγωγέας **έπαψε να είναι αόρατος** |

**Οι μεταλλάξεις που έχουν σημασία** *(ονομαστικά, όλες κόκκινες)*: `Μ3` επαναφορά του
`totalItems = 1` *(το ακριβές Β2)* · `Μ2` σύγκριση με **πλήθος γραμμών** αντί για μοναδικά URI
*(η προφανής, ανεπαρκής θεραπεία)* · `Μ10` πύλη ανοιχτή *(γράφει ατελές)* · `Μ11` επαναφορά του
`'0000'` · `Μ15` `malformed → absent` *(το ξέπλυμα)* · `Μ22` ο διακομιστής αγνοεί ξανά τα συνώνυμα ·
`Μ25` μνήμη χωρίς namespace *(τα δύο λεξιλόγια μπερδεύονται)*.

### 10.10 🔶 ΔΗΛΩΜΕΝΑ ΟΡΙΑ — ονομασμένα, όχι ξεχασμένα

1. **Δεν αποθηκεύεται η έκδοση ESCO** που απάντησε *(ADR-798 §20.4 #2, **παραμένει ανοιχτό**)*. Το
   IFC την απαιτεί *(Edition/EditionDate)* και το ESCO δημοσιεύει Delta files· ένα URI που
   αποσύρεται ταξιδεύει **σιωπηλά νεκρό**.
2. **Καμία ταφόπλακα**: έννοια που **φεύγει** από το ESCO μένει για πάντα στη μνήμη — η γραφή
   είναι `merge`, όχι αντικατάσταση συλλογής.
3. **Τα `alternativeLabels` γράφονται κενά**: τα αποτελέσματα του `/search` δεν τα περιέχουν, και
   μια κλήση λεπτομέρειας ανά έννοια θα ήταν ~2.942 επιπλέον αιτήματα. Το σκαλοπάτι 0.6 της
   κλίμακας υπάρχει και **δουλεύει**, αλλά σήμερα **δεν έχει δεδομένα να κρίνει**.
4. **Επανεισαγωγή απαιτείται** ώστε τα υπάρχοντα `'0000'`/`'000'` να γίνουν `''`. Η γραφή είναι
   **ιδιοδύναμη** *(σταθερό id από το URI)*, οπότε το ξανατρέξιμο αρκεί.
5. **Το `scripts/` παραμένει έξω από το jscpd ratchet** *(§10.8)* — δηλωμένο, μη λυμένο.

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
*EU Standard: ESCO v1.2.1 (European Commission, DG EMPL)*
