# ADR-283: Project Roles SSOT Refactoring

**Status**: IMPLEMENTED  
**Date**: 2026-04-04  
**Author**: Claude + Γιώργος Παγώνης  
**Related**: ADR-282 (Contact Persona Architecture Refactoring), ADR-032 (Linking Model)  
**Category**: Entity Systems / SSOT Architecture  

---

## 1. Πρόβλημα

### 1.1 Duplicate Entry Points

Στα Projects υπάρχουν 4 tabs για σύνδεση επαφών:

| Tab | Order | Ειδικά πεδία |
|-----|-------|-------------|
| Οικοπεδούχοι | 4.5 | Bartex %, ownership %, removal guards |
| **Συνεργάτες** | **5** | **Dropdown 9 ρόλων — ΑΥΤΟ ΑΛΛΑΖΕΙ** |
| Μεσίτες | 6 | Brokerage agreements |
| Πελάτες | 7 | Units, πληρωμές |

Το dropdown "Συνεργάτες" περιείχε ρόλους που **ΗΔΕΗ υπήρχαν σε ξεχωριστά tabs**:

- `land_owner` → Duplicate του tab "Οικοπεδούχοι"
- `buyer` → Duplicate του tab "Πελάτες"
- `realtor` → Duplicate του tab "Μεσίτες"

### 1.2 Wrong SSoT Placement

Ρόλοι που δεν ανήκουν σε project-level:

| Ρόλος | Σωστό SSoT | Γιατί |
|-------|-----------|-------|
| `lawyer` | Sale/Transaction | Κάθε πώληση έχει δικό της δικηγόρο |
| `notary` | Sale/Transaction | Κάθε συμβόλαιο έχει δικό του συμβολαιογράφο |
| `accountant` | Company | Ένας λογιστής για ολόκληρη την εταιρεία |
| `contractor` | Company/Self | Ο εργολάβος = η κατασκευαστική εταιρεία |

### 1.3 Generic "engineer"

Ο μοναδικός ρόλος `engineer` δεν διακρίνει μεταξύ αρχιτέκτονα, στατικού, ηλεκτρολόγου κλπ — κρίσιμη ανάγκη στην ελληνική κατασκευαστική βιομηχανία.

---

## 2. Απόφαση

### 2.1 Μετονομασία Tab

**Πριν**: "Συνεργάτες" (Contributors)  
**Μετά**: "Μηχανικοί Έργου" (Project Engineers)

### 2.2 Νέοι Ρόλοι (μόνο μηχανικοί)

| Role ID | Ελληνικά | Αγγλικά |
|---------|----------|---------|
| `architect` | Αρχιτέκτονας | Architect |
| `structural_engineer` | Στατικός Μηχανικός | Structural Engineer |
| `electrical_engineer` | Ηλεκτρολόγος Μηχανικός | Electrical Engineer |
| `mechanical_engineer` | Μηχανολόγος Μηχανικός | Mechanical Engineer |
| `surveyor` | Τοπογράφος | Surveyor |
| `energy_inspector` | Ενεργειακός Επιθεωρητής | Energy Inspector |
| `supervising_engineer` | Επιβλέπων Μηχανικός | Supervising Engineer |

### 2.3 Αφαιρεθέντες Ρόλοι

| Ρόλος | Λόγος αφαίρεσης |
|-------|----------------|
| `engineer` | Αντικαταστάθηκε από 7 ειδικούς ρόλους |
| `supervisor` | Αντικαταστάθηκε από `supervising_engineer` |
| `contractor` | Δεν είναι ρόλος — είναι η εταιρεία |
| `land_owner` | SSoT = tab "Οικοπεδούχοι" |
| `buyer` | SSoT = tab "Πελάτες" |
| `realtor` | SSoT = tab "Μεσίτες" |
| `lawyer` | SSoT = Sale/Transaction level |
| `notary` | SSoT = Sale/Transaction level |
| `accountant` | SSoT = Company level |

---

## 3. Υλοποίηση

### 3.1 Αρχεία που άλλαξαν

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/types/entity-associations.ts` | `project` array: 9 ρόλοι → 7 engineer roles |
| `src/constants/domains/project-building-persona-labels.ts` | `CONTRIBUTORS` → `PROJECT_ENGINEERS` |
| `src/config/project-tabs-config.ts` | Tab id/label/value/icon updated |
| `src/i18n/locales/el/building-address.json` | +7 νέα role labels, -4 αχρησιμοποίητα |
| `src/i18n/locales/en/building-address.json` | Same |
| `src/i18n/locales/pseudo/building-address.json` | Same |
| `src/i18n/locales/el/building-tabs.json` | `contributors` → `projectEngineers` |
| `src/i18n/locales/en/building-tabs.json` | Same |
| `src/i18n/locales/pseudo/building-tabs.json` | Same |

### 3.2 Αρχεία που ΔΕΝ άλλαξαν (και γιατί)

| Αρχείο | Γιατί δεν χρειάστηκε αλλαγή |
|--------|---------------------------|
| `EntityAssociationsManager.tsx` | Generic — διαβάζει roles dynamically via `getRolesForEntityType()` |
| `ProjectAssociationsTab.tsx` | Wrapper — delegating μόνο |
| `projectMappings.ts` | Component name `ProjectAssociationsTab` δεν άλλαξε |
| `useEntityAssociations.ts` | Generic hook |
| Building/Property role arrays | Untouched — ξεχωριστό scope |

---

## 4. SSOT Architecture (After)

```
PROJECTS — Contact Linking SSOT Map:

┌─ Οικοπεδούχοι (tab 4.5) ──────────┐
│  SSoT: Ιδιοκτησία γης              │
│  Πεδία: Bartex %, Ownership %      │
└────────────────────────────────────┘

┌─ Μηχανικοί Έργου (tab 5) ─────────┐  ← ADR-283
│  SSoT: Μηχανικοί & τεχνικοί       │
│  Ρόλοι: 7 ειδικοί (βλ. §2.2)     │
└────────────────────────────────────┘

┌─ Μεσίτες (tab 6) ─────────────────┐
│  SSoT: Μεσιτικές συμβάσεις        │
│  Πεδία: Agreement, commission      │
└────────────────────────────────────┘

┌─ Πελάτες (tab 7) ─────────────────┐
│  SSoT: Αγοραστές                   │
│  Πεδία: Units, πληρωμές           │
└────────────────────────────────────┘

ΑΛΛΟΥ (ΟΧΙ project-level):
  Δικηγόρος    → Sale/Transaction
  Συμβολαιογρ. → Sale/Transaction
  Λογιστής     → Company
  Εργολάβος    → Company (ίδια η εταιρεία)
```

---

## 5. Σχέση με ADR-282

Το ADR-282 (Contact Persona Architecture) αναδιαρθρώνει τα personas στο **contact side** (πώς η επαφή δηλώνει ότι είναι μηχανικός). Το ADR-283 αναδιαρθρώνει τους ρόλους στο **project side** (πώς το έργο δηλώνει ποιος μηχανικός εμπλέκεται).

Μαζί εξασφαλίζουν:
- Η επαφή δηλώνει "είμαι αρχιτέκτονας" (ADR-282, Επαγγελματικά Στοιχεία)
- Το έργο δηλώνει "ο Γιώργος είναι αρχιτέκτονας ΣΕ ΑΥΤΟ το έργο" (ADR-283, Μηχανικοί Έργου)

---

## 6. Περιβάλλον Ανάπτυξης

> Η εφαρμογή είναι σε στάδιο **ΑΝΑΠΤΥΞΗΣ**.
> - Τα δοκιμαστικά `contact_links` με παλιούς ρόλους (π.χ. `role: 'engineer'`) θα ορφανέψουν — OK
> - Δεν χρειάζεται migration
> - Breaking changes ΕΠΙΤΡΕΠΟΝΤΑΙ

---

## Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-04-04 | Initial implementation — 9 generic roles → 7 engineer-specific roles, tab renamed |
